import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import { db, monthlyCloseTable, journalEntriesTable } from "@workspace/db";
import {
  CreateMonthlyCloseBody,
  UpdateCloseChecklistBody,
  UpdateCloseChecklistParams,
  LockMonthlyCloseParams,
} from "@workspace/api-zod";
import { requirePermission } from "../lib/auth";
import { recordAudit } from "../lib/audit";

const router: IRouter = Router();

const DEFAULT_CHECKLIST = [
  { key: "reconcile_bank", label: "Bank accounts reconciled", done: false },
  { key: "review_ar", label: "Accounts receivable reviewed", done: false },
  { key: "review_ap", label: "Accounts payable reviewed", done: false },
  { key: "post_journal", label: "Adjusting journal entries posted", done: false },
  { key: "review_payroll", label: "Payroll posted", done: false },
];

router.get(
  "/monthly-close",
  requirePermission("close.view"),
  async (_req, res): Promise<void> => {
    const rows = await db.select().from(monthlyCloseTable);
    res.json(rows.sort((a, b) => b.periodStart.localeCompare(a.periodStart)));
  },
);

router.post(
  "/monthly-close",
  requirePermission("close.manage"),
  async (req, res): Promise<void> => {
    const parsed = CreateMonthlyCloseBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.message });
      return;
    }
    const d = parsed.data;
    const [row] = await db
      .insert(monthlyCloseTable)
      .values({
        periodLabel: d.periodLabel,
        periodStart: d.periodStart,
        periodEnd: d.periodEnd,
        status: "open",
        checklist: DEFAULT_CHECKLIST,
      })
      .returning();
    await recordAudit(req, {
      action: "create",
      recordType: "monthly_close",
      recordId: row.id,
      after: row,
    });
    res.status(201).json(row);
  },
);

router.patch(
  "/monthly-close/:id/checklist",
  requirePermission("close.manage"),
  async (req, res): Promise<void> => {
    const params = UpdateCloseChecklistParams.safeParse(req.params);
    if (!params.success) {
      res.status(400).json({ error: params.error.message });
      return;
    }
    const parsed = UpdateCloseChecklistBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.message });
      return;
    }
    const [before] = await db
      .select()
      .from(monthlyCloseTable)
      .where(eq(monthlyCloseTable.id, params.data.id));
    if (!before) {
      res.status(404).json({ error: "Close period not found" });
      return;
    }
    if (before.status === "locked") {
      res.status(400).json({ error: "This period is locked and cannot be edited." });
      return;
    }
    const checklist = before.checklist.map((item) =>
      item.key === parsed.data.key ? { ...item, done: parsed.data.done } : item,
    );
    const [row] = await db
      .update(monthlyCloseTable)
      .set({ checklist })
      .where(eq(monthlyCloseTable.id, params.data.id))
      .returning();
    await recordAudit(req, {
      action: "update_checklist",
      recordType: "monthly_close",
      recordId: row.id,
      after: { key: parsed.data.key, done: parsed.data.done },
    });
    res.json(row);
  },
);

router.post(
  "/monthly-close/:id/lock",
  requirePermission("close.lock"),
  async (req, res): Promise<void> => {
    const params = LockMonthlyCloseParams.safeParse(req.params);
    if (!params.success) {
      res.status(400).json({ error: params.error.message });
      return;
    }
    const [before] = await db
      .select()
      .from(monthlyCloseTable)
      .where(eq(monthlyCloseTable.id, params.data.id));
    if (!before) {
      res.status(404).json({ error: "Close period not found" });
      return;
    }
    if (before.status === "locked") {
      res.status(400).json({ error: "This period is already locked." });
      return;
    }
    const incomplete = before.checklist.filter((i) => !i.done);
    if (incomplete.length > 0) {
      res.status(400).json({
        error: `Cannot lock: ${incomplete.length} checklist item(s) still incomplete.`,
      });
      return;
    }
    // Block locking if there are unposted (draft) entries in the period.
    const entries = await db.select().from(journalEntriesTable);
    const draftsInPeriod = entries.filter(
      (e) =>
        e.status === "draft" &&
        e.entryDate >= before.periodStart &&
        e.entryDate <= before.periodEnd,
    );
    if (draftsInPeriod.length > 0) {
      res.status(400).json({
        error: `Cannot lock: ${draftsInPeriod.length} draft journal entry(ies) in this period must be posted or voided first.`,
      });
      return;
    }
    const [row] = await db
      .update(monthlyCloseTable)
      .set({
        status: "locked",
        lockedAt: new Date(),
        lockedById: req.currentUser?.id ?? null,
      })
      .where(eq(monthlyCloseTable.id, params.data.id))
      .returning();
    await recordAudit(req, {
      action: "lock",
      recordType: "monthly_close",
      recordId: row.id,
      before: { status: before.status },
      after: { status: "locked" },
    });
    res.json(row);
  },
);

export default router;
