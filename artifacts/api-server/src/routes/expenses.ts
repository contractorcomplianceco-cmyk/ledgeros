import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import { db, expensesTable } from "@workspace/db";
import {
  CreateExpenseBody,
  TransitionExpenseBody,
  TransitionExpenseParams,
} from "@workspace/api-zod";
import { requirePermission, can } from "../lib/auth";
import { recordAudit } from "../lib/audit";
import { round2 } from "../lib/helpers";

const router: IRouter = Router();

router.get(
  "/expenses",
  requirePermission("expenses.view"),
  async (req, res): Promise<void> => {
    const status =
      typeof req.query.status === "string" ? req.query.status : undefined;
    const rows = await db.select().from(expensesTable);
    // Team members may only see their own submissions.
    const restrictToOwn = !can(req, "expenses.approve");
    const uid = req.currentUser?.id;
    const result = rows
      .filter((r) => !status || r.status === status)
      .filter((r) => !restrictToOwn || r.submittedById === uid)
      .sort((a, b) => b.id - a.id);
    res.json(result);
  },
);

router.post(
  "/expenses",
  requirePermission("expenses.submit"),
  async (req, res): Promise<void> => {
    const parsed = CreateExpenseBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.message });
      return;
    }
    const d = parsed.data;
    const [expense] = await db
      .insert(expensesTable)
      .values({
        description: d.description,
        vendorName: d.vendorName ?? null,
        amount: round2(d.amount),
        category: d.category ?? null,
        clientProject: d.clientProject ?? null,
        sourceApp: d.sourceApp ?? null,
        status: "submitted",
        expenseDate: d.expenseDate,
        hasReceipt: d.hasReceipt ?? false,
        submittedById: req.currentUser?.id ?? null,
      })
      .returning();
    await recordAudit(req, {
      action: "create",
      recordType: "expense",
      recordId: expense.id,
      after: expense,
    });
    res.status(201).json(expense);
  },
);

const EXPENSE_TRANSITIONS: Record<string, { from: string[]; to: string }> = {
  approve: { from: ["submitted"], to: "approved" },
  reject: { from: ["submitted"], to: "rejected" },
  reimburse: { from: ["approved"], to: "reimbursed" },
};

router.post(
  "/expenses/:id/transition",
  requirePermission("expenses.approve"),
  async (req, res): Promise<void> => {
    const params = TransitionExpenseParams.safeParse(req.params);
    if (!params.success) {
      res.status(400).json({ error: params.error.message });
      return;
    }
    const parsed = TransitionExpenseBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.message });
      return;
    }
    const rule = EXPENSE_TRANSITIONS[parsed.data.action];
    if (!rule) {
      res.status(400).json({ error: `Unknown action: ${parsed.data.action}` });
      return;
    }
    const [before] = await db
      .select()
      .from(expensesTable)
      .where(eq(expensesTable.id, params.data.id));
    if (!before) {
      res.status(404).json({ error: "Expense not found" });
      return;
    }
    if (!rule.from.includes(before.status)) {
      res.status(400).json({
        error: `Cannot ${parsed.data.action} an expense in status "${before.status}".`,
      });
      return;
    }
    const [expense] = await db
      .update(expensesTable)
      .set({ status: rule.to })
      .where(eq(expensesTable.id, params.data.id))
      .returning();
    await recordAudit(req, {
      action: parsed.data.action,
      recordType: "expense",
      recordId: expense.id,
      before: { status: before.status },
      after: { status: rule.to },
      note: parsed.data.note ?? null,
    });
    res.json(expense);
  },
);

export default router;
