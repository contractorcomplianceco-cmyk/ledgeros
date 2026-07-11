import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import {
  db,
  journalEntriesTable,
  journalLinesTable,
  accountsTable,
} from "@workspace/db";
import {
  CreateJournalEntryBody,
  TransitionJournalEntryBody,
  TransitionJournalEntryParams,
  GetJournalEntryParams,
  GetGeneralLedgerQueryParams,
} from "@workspace/api-zod";
import { requirePermission, can } from "../lib/auth";
import { recordAudit } from "../lib/audit";
import { round2, todayISO } from "../lib/helpers";
import { lockedPeriodFor } from "../lib/periods";
import { postedLinesForAccounts } from "../lib/ledger";

const router: IRouter = Router();

async function hydrate(entryId: number) {
  const [entry] = await db
    .select()
    .from(journalEntriesTable)
    .where(eq(journalEntriesTable.id, entryId));
  if (!entry) return null;
  const lines = await db
    .select()
    .from(journalLinesTable)
    .where(eq(journalLinesTable.journalEntryId, entryId));
  const accounts = await db.select().from(accountsTable);
  const amap = new Map(accounts.map((a) => [a.id, a]));
  const totalDebit = round2(lines.reduce((s, l) => s + (l.debit ?? 0), 0));
  const totalCredit = round2(lines.reduce((s, l) => s + (l.credit ?? 0), 0));
  return {
    ...entry,
    totalDebit,
    totalCredit,
    balanced: Math.abs(totalDebit - totalCredit) < 0.005,
    lines: lines.map((l) => ({
      id: l.id,
      accountId: l.accountId,
      accountName: amap.get(l.accountId)?.name ?? null,
      debit: l.debit,
      credit: l.credit,
      memo: l.memo,
    })),
  };
}

router.get(
  "/journal-entries",
  requirePermission("journal.view"),
  async (_req, res): Promise<void> => {
    const entries = await db.select().from(journalEntriesTable);
    const lines = await db.select().from(journalLinesTable);
    const byEntry = new Map<number, { debit: number; credit: number }>();
    for (const l of lines) {
      const cur = byEntry.get(l.journalEntryId) ?? { debit: 0, credit: 0 };
      cur.debit += l.debit ?? 0;
      cur.credit += l.credit ?? 0;
      byEntry.set(l.journalEntryId, cur);
    }
    const result = entries
      .map((e) => {
        const t = byEntry.get(e.id) ?? { debit: 0, credit: 0 };
        return {
          ...e,
          totalDebit: round2(t.debit),
          totalCredit: round2(t.credit),
          balanced: Math.abs(t.debit - t.credit) < 0.005,
        };
      })
      .sort((a, b) => b.id - a.id);
    res.json(result);
  },
);

router.get(
  "/journal-entries/:id",
  requirePermission("journal.view"),
  async (req, res): Promise<void> => {
    const params = GetJournalEntryParams.safeParse(req.params);
    if (!params.success) {
      res.status(400).json({ error: params.error.message });
      return;
    }
    const entry = await hydrate(params.data.id);
    if (!entry) {
      res.status(404).json({ error: "Journal entry not found" });
      return;
    }
    res.json(entry);
  },
);

function validateLines(
  lines: { accountId: number; debit: number; credit: number }[],
): string | null {
  if (lines.length < 2) {
    return "A journal entry must have at least two lines.";
  }
  for (const l of lines) {
    const debit = l.debit ?? 0;
    const credit = l.credit ?? 0;
    if (debit < 0 || credit < 0) {
      return "Debit and credit amounts cannot be negative.";
    }
    if (debit > 0 && credit > 0) {
      return "A single line cannot have both a debit and a credit.";
    }
    if (debit === 0 && credit === 0) {
      return "Each line must have either a debit or a credit amount.";
    }
  }
  const totalDebit = round2(lines.reduce((s, l) => s + (l.debit ?? 0), 0));
  const totalCredit = round2(lines.reduce((s, l) => s + (l.credit ?? 0), 0));
  if (Math.abs(totalDebit - totalCredit) > 0.005) {
    return `Entry is not balanced: debits (${totalDebit}) must equal credits (${totalCredit}).`;
  }
  return null;
}

router.post(
  "/journal-entries",
  requirePermission("journal.manage"),
  async (req, res): Promise<void> => {
    const parsed = CreateJournalEntryBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.message });
      return;
    }
    const d = parsed.data;
    const err = validateLines(d.lines);
    if (err) {
      res.status(400).json({ error: err });
      return;
    }
    const locked = await lockedPeriodFor(d.entryDate);
    if (locked) {
      res.status(400).json({
        error: `The period "${locked.periodLabel}" is locked. No entries can be created in a locked period.`,
      });
      return;
    }
    const accounts = await db.select().from(accountsTable);
    const validIds = new Set(accounts.map((a) => a.id));
    for (const l of d.lines) {
      if (!validIds.has(l.accountId)) {
        res.status(400).json({ error: `Account ${l.accountId} does not exist.` });
        return;
      }
    }
    const [entry] = await db
      .insert(journalEntriesTable)
      .values({
        entryDate: d.entryDate,
        memo: d.memo,
        reason: d.reason ?? null,
        status: "draft",
        source: "manual",
      })
      .returning();
    await db.insert(journalLinesTable).values(
      d.lines.map((l) => ({
        journalEntryId: entry.id,
        accountId: l.accountId,
        debit: round2(l.debit ?? 0),
        credit: round2(l.credit ?? 0),
        memo: l.memo ?? null,
      })),
    );
    await recordAudit(req, {
      action: "create",
      recordType: "journal_entry",
      recordId: entry.id,
      after: { ...entry, lines: d.lines },
    });
    res.status(201).json(await hydrate(entry.id));
  },
);

router.post(
  "/journal-entries/:id/transition",
  requirePermission("journal.view"),
  async (req, res): Promise<void> => {
    const params = TransitionJournalEntryParams.safeParse(req.params);
    if (!params.success) {
      res.status(400).json({ error: params.error.message });
      return;
    }
    const parsed = TransitionJournalEntryBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.message });
      return;
    }
    if (!can(req, "journal.manage")) {
      res.status(403).json({
        error: "Your role is not permitted to modify journal entries.",
      });
      return;
    }
    const action = parsed.data.action;
    const [before] = await db
      .select()
      .from(journalEntriesTable)
      .where(eq(journalEntriesTable.id, params.data.id));
    if (!before) {
      res.status(404).json({ error: "Journal entry not found" });
      return;
    }

    if (action === "post") {
      if (before.status !== "draft") {
        res.status(400).json({
          error: `Only draft entries can be posted (current status: ${before.status}).`,
        });
        return;
      }
      const lines = await db
        .select()
        .from(journalLinesTable)
        .where(eq(journalLinesTable.journalEntryId, before.id));
      const err = validateLines(lines);
      if (err) {
        res.status(400).json({ error: `Cannot post: ${err}` });
        return;
      }
      const locked = await lockedPeriodFor(before.entryDate);
      if (locked) {
        res.status(400).json({
          error: `The period "${locked.periodLabel}" is locked and cannot be posted into.`,
        });
        return;
      }
      await db
        .update(journalEntriesTable)
        .set({ status: "posted" })
        .where(eq(journalEntriesTable.id, before.id));
      await recordAudit(req, {
        action: "post",
        recordType: "journal_entry",
        recordId: before.id,
        before: { status: before.status },
        after: { status: "posted" },
        note: parsed.data.note ?? null,
      });
      res.json(await hydrate(before.id));
      return;
    }

    if (action === "reverse") {
      if (before.status !== "posted") {
        res.status(400).json({
          error: "Only posted entries can be reversed.",
        });
        return;
      }
      if (before.reversedById) {
        res.status(400).json({
          error: "This entry has already been reversed.",
        });
        return;
      }
      // Reversals are always posted into the current open period, never into
      // the original (possibly locked) period. This keeps the original posted
      // entry immutable while allowing corrections after a period is closed.
      const reversalDate = todayISO();
      const locked = await lockedPeriodFor(reversalDate);
      if (locked) {
        res.status(400).json({
          error: `The current period "${locked.periodLabel}" is locked; a reversal cannot be posted until it is reopened.`,
        });
        return;
      }
      const lines = await db
        .select()
        .from(journalLinesTable)
        .where(eq(journalLinesTable.journalEntryId, before.id));
      const [reversal] = await db
        .insert(journalEntriesTable)
        .values({
          entryDate: reversalDate,
          memo: `Reversal of #${before.id}: ${before.memo}`,
          reason: parsed.data.note ?? "Reversal",
          status: "posted",
          source: "reversal",
          reversalOfId: before.id,
        })
        .returning();
      await db.insert(journalLinesTable).values(
        lines.map((l) => ({
          journalEntryId: reversal.id,
          accountId: l.accountId,
          debit: l.credit,
          credit: l.debit,
          memo: l.memo,
        })),
      );
      await db
        .update(journalEntriesTable)
        .set({ status: "reversed", reversedById: reversal.id })
        .where(eq(journalEntriesTable.id, before.id));
      await recordAudit(req, {
        action: "reverse",
        recordType: "journal_entry",
        recordId: before.id,
        before: { status: "posted" },
        after: { status: "reversed", reversalId: reversal.id },
        note: parsed.data.note ?? null,
      });
      res.json(await hydrate(reversal.id));
      return;
    }

    if (action === "void") {
      if (before.status !== "draft") {
        res.status(400).json({
          error: "Only draft entries can be voided. Posted entries must be reversed.",
        });
        return;
      }
      await db
        .update(journalEntriesTable)
        .set({ status: "void" })
        .where(eq(journalEntriesTable.id, before.id));
      await recordAudit(req, {
        action: "void",
        recordType: "journal_entry",
        recordId: before.id,
        before: { status: before.status },
        after: { status: "void" },
        note: parsed.data.note ?? null,
      });
      res.json(await hydrate(before.id));
      return;
    }

    res.status(400).json({ error: `Unknown action: ${action}` });
  },
);

router.get(
  "/ledger",
  requirePermission("ledger.view"),
  async (req, res): Promise<void> => {
    const q = GetGeneralLedgerQueryParams.safeParse(req.query);
    const accounts = await db.select().from(accountsTable);
    const showSensitive = can(req, "sensitive.view");
    const visible = accounts.filter((a) => showSensitive || !a.isSensitive);
    const accountId =
      q.success && q.data.accountId ? q.data.accountId : undefined;
    const targetIds = accountId
      ? visible.filter((a) => a.id === accountId).map((a) => a.id)
      : visible.map((a) => a.id);
    const lines = await postedLinesForAccounts(targetIds);
    const amap = new Map(visible.map((a) => [a.id, a]));
    const result = lines
      .map((l) => ({
        ...l,
        accountCode: amap.get(l.accountId)?.code ?? null,
        accountName: amap.get(l.accountId)?.name ?? null,
      }))
      .sort((a, b) =>
        a.entryDate === b.entryDate
          ? a.journalEntryId - b.journalEntryId
          : a.entryDate.localeCompare(b.entryDate),
      );
    res.json(result);
  },
);

export default router;
