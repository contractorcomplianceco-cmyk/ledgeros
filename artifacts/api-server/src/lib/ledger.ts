import { eq, inArray } from "drizzle-orm";
import {
  db,
  journalEntriesTable,
  journalLinesTable,
} from "@workspace/db";
import { round2 } from "./helpers";

/**
 * Returns a map of accountId -> net (debit - credit) across all POSTED journal
 * entries. Only posted entries affect the general ledger.
 */
export async function postedBalancesByAccount(): Promise<Map<number, number>> {
  const rows = await db
    .select({
      accountId: journalLinesTable.accountId,
      debit: journalLinesTable.debit,
      credit: journalLinesTable.credit,
      status: journalEntriesTable.status,
    })
    .from(journalLinesTable)
    .innerJoin(
      journalEntriesTable,
      eq(journalLinesTable.journalEntryId, journalEntriesTable.id),
    );

  const map = new Map<number, number>();
  for (const r of rows) {
    if (r.status !== "posted") continue;
    const prev = map.get(r.accountId) ?? 0;
    map.set(r.accountId, prev + (r.debit ?? 0) - (r.credit ?? 0));
  }
  for (const [k, v] of map) map.set(k, round2(v));
  return map;
}

export async function postedLinesForAccounts(
  accountIds: number[],
): Promise<
  {
    id: number;
    journalEntryId: number;
    entryDate: string;
    accountId: number;
    debit: number;
    credit: number;
    memo: string | null;
    reference: string | null;
  }[]
> {
  if (accountIds.length === 0) return [];
  const rows = await db
    .select({
      id: journalLinesTable.id,
      journalEntryId: journalLinesTable.journalEntryId,
      entryDate: journalEntriesTable.entryDate,
      accountId: journalLinesTable.accountId,
      debit: journalLinesTable.debit,
      credit: journalLinesTable.credit,
      memo: journalLinesTable.memo,
      reference: journalEntriesTable.reference,
      status: journalEntriesTable.status,
    })
    .from(journalLinesTable)
    .innerJoin(
      journalEntriesTable,
      eq(journalLinesTable.journalEntryId, journalEntriesTable.id),
    )
    .where(inArray(journalLinesTable.accountId, accountIds));
  return rows
    .filter((r) => r.status === "posted")
    .map(({ status: _status, ...rest }) => rest);
}
