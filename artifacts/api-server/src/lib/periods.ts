import { db, monthlyCloseTable } from "@workspace/db";

/**
 * Returns the locked period covering the given date, or null if the date is not
 * within any locked period. Locked periods are read-only for accounting entries.
 */
export async function lockedPeriodFor(
  dateISO: string,
): Promise<{ periodLabel: string } | null> {
  const periods = await db.select().from(monthlyCloseTable);
  const hit = periods.find(
    (p) =>
      p.status === "locked" &&
      dateISO >= p.periodStart &&
      dateISO <= p.periodEnd,
  );
  return hit ? { periodLabel: hit.periodLabel } : null;
}
