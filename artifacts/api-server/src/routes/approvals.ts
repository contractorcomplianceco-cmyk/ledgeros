import { Router, type IRouter } from "express";
import {
  db,
  invoicesTable,
  billsTable,
  expensesTable,
  payrollTable,
  usersTable,
} from "@workspace/db";
import { requirePermission, can } from "../lib/auth";

const router: IRouter = Router();

router.get(
  "/approvals",
  requirePermission("approvals.view"),
  async (req, res): Promise<void> => {
    const [invoices, bills, expenses, payroll, users] = await Promise.all([
      db.select().from(invoicesTable),
      db.select().from(billsTable),
      db.select().from(expensesTable),
      db.select().from(payrollTable),
      db.select().from(usersTable),
    ]);
    const uname = new Map(users.map((u) => [u.id, u.name]));
    const showSensitive = can(req, "sensitive.view");

    const items = [
      ...invoices
        .filter((r) => r.status === "submitted")
        .map((r) => ({
          recordType: "invoice",
          recordId: r.id,
          title: `Invoice ${r.number}`,
          amount: r.total,
          status: r.status,
          submittedBy: null,
          submittedAt: r.issueDate,
        })),
      ...bills
        .filter((r) => r.status === "submitted")
        .filter((r) => showSensitive || !r.isSensitive)
        .map((r) => ({
          recordType: "bill",
          recordId: r.id,
          title: `Bill ${r.number}`,
          amount: r.total,
          status: r.status,
          submittedBy: null,
          submittedAt: r.billDate,
        })),
      ...expenses
        .filter((r) => r.status === "submitted")
        .map((r) => ({
          recordType: "expense",
          recordId: r.id,
          title: r.description,
          amount: r.amount,
          status: r.status,
          submittedBy: r.submittedById
            ? (uname.get(r.submittedById) ?? null)
            : null,
          submittedAt: r.expenseDate,
        })),
      ...payroll
        .filter((r) => r.status === "draft")
        .filter(() => showSensitive)
        .map((r) => ({
          recordType: "payroll",
          recordId: r.id,
          title: `Payroll ${r.periodStart} → ${r.periodEnd}`,
          amount: r.grossPay,
          status: r.flagged ? "flagged" : r.status,
          submittedBy: null,
          submittedAt: r.payDate,
        })),
    ];

    res.json(items.sort((a, b) => b.submittedAt.localeCompare(a.submittedAt)));
  },
);

export default router;
