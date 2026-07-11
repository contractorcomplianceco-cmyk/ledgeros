import { Router, type IRouter } from "express";
import { desc, eq } from "drizzle-orm";
import {
  db,
  bankAccountsTable,
  bankTransactionsTable,
  invoicesTable,
  billsTable,
  expensesTable,
  payrollTable,
  monthlyCloseTable,
  reconciliationsTable,
  integrationEventsTable,
  auditLogsTable,
  usersTable,
} from "@workspace/db";
import { requirePermission, can } from "../lib/auth";
import { round2, todayISO } from "../lib/helpers";

const router: IRouter = Router();

async function computeMetrics(showSensitive: boolean) {
  const [
    bankAccounts,
    bankTxns,
    invoices,
    bills,
    expenses,
    payroll,
    closes,
    recons,
    events,
  ] = await Promise.all([
    db.select().from(bankAccountsTable),
    db.select().from(bankTransactionsTable),
    db.select().from(invoicesTable),
    db.select().from(billsTable),
    db.select().from(expensesTable),
    db.select().from(payrollTable),
    db.select().from(monthlyCloseTable),
    db.select().from(reconciliationsTable),
    db.select().from(integrationEventsTable),
  ]);

  const today = todayISO();
  const cashPosition = round2(
    bankAccounts.reduce((s, b) => s + (b.balance ?? 0), 0),
  );
  const pendingBankReview = bankTxns.filter(
    (t) => t.status === "unreviewed",
  ).length;

  const openInvoices = invoices.filter(
    (i) => i.status !== "draft" && i.status !== "void",
  );
  const arTotal = round2(
    openInvoices.reduce((s, i) => s + ((i.total ?? 0) - (i.amountPaid ?? 0)), 0),
  );
  const overdue = openInvoices.filter(
    (i) =>
      i.status !== "paid" &&
      i.dueDate &&
      i.dueDate < today &&
      (i.total ?? 0) - (i.amountPaid ?? 0) > 0.005,
  );
  const overdueInvoicesAmount = round2(
    overdue.reduce((s, i) => s + ((i.total ?? 0) - (i.amountPaid ?? 0)), 0),
  );

  const openBills = bills.filter(
    (b) => b.status !== "draft" && b.status !== "void" && b.status !== "paid",
  );
  const apDueSoon = round2(
    openBills.reduce((s, b) => s + ((b.total ?? 0) - (b.amountPaid ?? 0)), 0),
  );

  const pendingApprovals =
    invoices.filter((i) => i.status === "submitted").length +
    bills.filter((b) => b.status === "submitted").length +
    expenses.filter((e) => e.status === "submitted").length;

  const finalizedRecons = recons.filter((r) => r.status === "finalized").length;
  const reconciliationHealth =
    recons.length === 0
      ? "no data"
      : finalizedRecons === recons.length
        ? "healthy"
        : "attention";

  const latestClose = [...closes].sort((a, b) =>
    b.periodStart.localeCompare(a.periodStart),
  )[0];
  const monthlyCloseStatus = latestClose ? latestClose.status : "none";

  const payrollAlerts = showSensitive
    ? payroll.filter((p) => p.flagged).length
    : 0;

  return {
    cashPosition,
    bankBalances: bankAccounts,
    pendingBankReview,
    arTotal,
    apDueSoon,
    overdueInvoicesCount: overdue.length,
    overdueInvoicesAmount,
    pendingApprovals,
    reconciliationHealth,
    monthlyCloseStatus,
    expenseReviewQueue: expenses.filter((e) => e.status === "submitted").length,
    integrationErrors: events.filter((e) => e.status === "error").length,
    payrollAlerts,
  };
}

router.get(
  "/dashboard",
  requirePermission("dashboard.view"),
  async (req, res): Promise<void> => {
    const showSensitive = can(req, "sensitive.view");
    const metrics = await computeMetrics(showSensitive);
    const recent = await db
      .select({
        id: auditLogsTable.id,
        userId: auditLogsTable.userId,
        userName: usersTable.name,
        action: auditLogsTable.action,
        recordType: auditLogsTable.recordType,
        recordId: auditLogsTable.recordId,
        before: auditLogsTable.before,
        after: auditLogsTable.after,
        note: auditLogsTable.note,
        ipAddress: auditLogsTable.ipAddress,
        timestamp: auditLogsTable.timestamp,
      })
      .from(auditLogsTable)
      .leftJoin(usersTable, eq(auditLogsTable.userId, usersTable.id))
      .orderBy(desc(auditLogsTable.id))
      .limit(15);
    res.json({
      ...metrics,
      arAging: [],
      productRevenue: [],
      clientProfitability: [],
      recentActivity: recent.map((r) => ({
        ...r,
        timestamp: r.timestamp.toISOString(),
      })),
    });
  },
);

router.get(
  "/command-center/summary",
  requirePermission("dashboard.view"),
  async (req, res): Promise<void> => {
    // Command Center is a read-only, safe overview. It never exposes sensitive
    // detail and offers no actions.
    const metrics = await computeMetrics(can(req, "sensitive.view"));
    res.json({
      cashPosition: metrics.cashPosition,
      arAgingSummary: metrics.arTotal,
      apDueSoon: metrics.apDueSoon,
      overdueInvoicesCount: metrics.overdueInvoicesCount,
      overdueInvoicesAmount: metrics.overdueInvoicesAmount,
      pendingApprovals: metrics.pendingApprovals,
      reconciliationHealth: metrics.reconciliationHealth,
      monthlyCloseStatus: metrics.monthlyCloseStatus,
      integrationErrors: metrics.integrationErrors,
      productRevenue: [],
      clientProfitability: [],
      generatedAt: new Date().toISOString(),
    });
  },
);

export default router;
