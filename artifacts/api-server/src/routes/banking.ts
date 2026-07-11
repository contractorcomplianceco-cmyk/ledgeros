import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import {
  db,
  bankAccountsTable,
  bankTransactionsTable,
  reconciliationsTable,
} from "@workspace/db";
import {
  CreateBankAccountBody,
  ImportBankTransactionsBody,
  ReviewBankTransactionBody,
  ReviewBankTransactionParams,
  CreateReconciliationBody,
  TransitionReconciliationBody,
  TransitionReconciliationParams,
} from "@workspace/api-zod";
import { requirePermission, can } from "../lib/auth";
import { recordAudit } from "../lib/audit";
import { round2 } from "../lib/helpers";

const router: IRouter = Router();

const SAMPLE_ROWS = [
  { txnDate: "2026-06-02", description: "Stripe payout", amount: 4200.0 },
  { txnDate: "2026-06-05", description: "AWS invoice", amount: -318.44 },
  { txnDate: "2026-06-09", description: "Client wire - Acme", amount: 7500.0 },
  { txnDate: "2026-06-14", description: "Payroll run", amount: -12850.0 },
  { txnDate: "2026-06-20", description: "Office supplies", amount: -142.19 },
];

router.get(
  "/bank-accounts",
  requirePermission("banking.view"),
  async (_req, res): Promise<void> => {
    const rows = await db.select().from(bankAccountsTable);
    res.json(rows.sort((a, b) => a.id - b.id));
  },
);

router.post(
  "/bank-accounts",
  requirePermission("banking.manage"),
  async (req, res): Promise<void> => {
    const parsed = CreateBankAccountBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.message });
      return;
    }
    const d = parsed.data;
    const [account] = await db
      .insert(bankAccountsTable)
      .values({
        label: d.label,
        institution: d.institution,
        maskedNumber: d.maskedNumber,
        connectionMethod: d.connectionMethod,
        accountType: d.accountType ?? null,
      })
      .returning();
    await recordAudit(req, {
      action: "create",
      recordType: "bank_account",
      recordId: account.id,
      after: account,
    });
    res.status(201).json(account);
  },
);

router.get(
  "/bank-transactions",
  requirePermission("banking.view"),
  async (req, res): Promise<void> => {
    const status =
      typeof req.query.status === "string" ? req.query.status : undefined;
    const rows = await db.select().from(bankTransactionsTable);
    res.json(
      rows
        .filter((r) => !status || r.status === status)
        .sort((a, b) => b.id - a.id),
    );
  },
);

router.post(
  "/bank-transactions/import",
  requirePermission("banking.manage"),
  async (req, res): Promise<void> => {
    const parsed = ImportBankTransactionsBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.message });
      return;
    }
    const d = parsed.data;
    const [account] = await db
      .select()
      .from(bankAccountsTable)
      .where(eq(bankAccountsTable.id, d.bankAccountId));
    if (!account) {
      res.status(400).json({ error: "Bank account does not exist." });
      return;
    }
    const rows =
      d.useTestData || !d.rows || d.rows.length === 0 ? SAMPLE_ROWS : d.rows;
    const inserted = await db
      .insert(bankTransactionsTable)
      .values(
        rows.map((r) => ({
          bankAccountId: d.bankAccountId,
          txnDate: r.txnDate,
          description: r.description,
          amount: round2(r.amount),
          status: "unreviewed",
          isTestData: !!d.useTestData,
        })),
      )
      .returning();
    await recordAudit(req, {
      action: "import",
      recordType: "bank_transaction",
      recordId: account.id,
      note: `Imported ${inserted.length} transactions${d.useTestData ? " (test data)" : ""}`,
    });
    res.status(201).json(inserted);
  },
);

router.post(
  "/bank-transactions/:id/review",
  requirePermission("banking.review"),
  async (req, res): Promise<void> => {
    const params = ReviewBankTransactionParams.safeParse(req.params);
    if (!params.success) {
      res.status(400).json({ error: params.error.message });
      return;
    }
    const parsed = ReviewBankTransactionBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.message });
      return;
    }
    const [before] = await db
      .select()
      .from(bankTransactionsTable)
      .where(eq(bankTransactionsTable.id, params.data.id));
    if (!before) {
      res.status(404).json({ error: "Transaction not found" });
      return;
    }
    const action = parsed.data.action;
    const patch: Record<string, unknown> = {};
    if (action === "categorize") {
      patch.status = "reviewed";
      patch.category = parsed.data.category ?? before.category;
    } else if (action === "match") {
      patch.status = "matched";
      patch.matchedType = parsed.data.matchedType ?? null;
      patch.matchedId = parsed.data.matchedId ?? null;
    } else if (action === "ignore") {
      patch.status = "ignored";
    } else {
      res.status(400).json({ error: `Unknown action: ${action}` });
      return;
    }
    const [updated] = await db
      .update(bankTransactionsTable)
      .set(patch)
      .where(eq(bankTransactionsTable.id, params.data.id))
      .returning();
    await recordAudit(req, {
      action: `review.${action}`,
      recordType: "bank_transaction",
      recordId: updated.id,
      before: { status: before.status },
      after: { status: updated.status },
    });
    res.json(updated);
  },
);

router.get(
  "/reconciliations",
  requirePermission("banking.view"),
  async (_req, res): Promise<void> => {
    const rows = await db.select().from(reconciliationsTable);
    res.json(rows.sort((a, b) => b.id - a.id));
  },
);

router.post(
  "/reconciliations",
  requirePermission("reconciliation.manage"),
  async (req, res): Promise<void> => {
    const parsed = CreateReconciliationBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.message });
      return;
    }
    const d = parsed.data;
    const clearedIds = d.clearedTransactionIds ?? [];
    let clearedTotal = 0;
    if (clearedIds.length > 0) {
      const txns = await db.select().from(bankTransactionsTable);
      clearedTotal = round2(
        txns
          .filter((t) => clearedIds.includes(t.id))
          .reduce((s, t) => s + (t.amount ?? 0), 0),
      );
    }
    const variance = round2(
      d.endingBalance - d.startingBalance - clearedTotal,
    );
    const [rec] = await db
      .insert(reconciliationsTable)
      .values({
        bankAccountId: d.bankAccountId,
        periodStart: d.periodStart,
        periodEnd: d.periodEnd,
        startingBalance: round2(d.startingBalance),
        endingBalance: round2(d.endingBalance),
        clearedTotal,
        variance,
        status: "draft",
        clearedTransactionIds: clearedIds,
      })
      .returning();
    await recordAudit(req, {
      action: "create",
      recordType: "reconciliation",
      recordId: rec.id,
      after: rec,
    });
    res.status(201).json(rec);
  },
);

router.post(
  "/reconciliations/:id/transition",
  requirePermission("reconciliation.approve"),
  async (req, res): Promise<void> => {
    const params = TransitionReconciliationParams.safeParse(req.params);
    if (!params.success) {
      res.status(400).json({ error: params.error.message });
      return;
    }
    const parsed = TransitionReconciliationBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.message });
      return;
    }
    const [before] = await db
      .select()
      .from(reconciliationsTable)
      .where(eq(reconciliationsTable.id, params.data.id));
    if (!before) {
      res.status(404).json({ error: "Reconciliation not found" });
      return;
    }
    if (parsed.data.action !== "finalize") {
      res.status(400).json({ error: `Unknown action: ${parsed.data.action}` });
      return;
    }
    if (before.status !== "draft") {
      res.status(400).json({
        error: `Reconciliation is already ${before.status}.`,
      });
      return;
    }
    if (Math.abs(before.variance) > 0.005) {
      res.status(400).json({
        error: `Cannot finalize: variance of ${before.variance} must be zero. Reconciliation must balance before it can be finalized.`,
      });
      return;
    }
    const [rec] = await db
      .update(reconciliationsTable)
      .set({ status: "finalized" })
      .where(eq(reconciliationsTable.id, params.data.id))
      .returning();
    const ids = before.clearedTransactionIds ?? [];
    for (const id of ids) {
      await db
        .update(bankTransactionsTable)
        .set({ reconciled: true })
        .where(eq(bankTransactionsTable.id, id));
    }
    await recordAudit(req, {
      action: "finalize",
      recordType: "reconciliation",
      recordId: rec.id,
      before: { status: before.status },
      after: { status: rec.status },
      note: parsed.data.note ?? null,
    });
    res.json(rec);
  },
);

export default router;
