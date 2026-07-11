import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import { db, payrollTable } from "@workspace/db";
import {
  CreatePayrollBody,
  TransitionPayrollBody,
  TransitionPayrollParams,
} from "@workspace/api-zod";
import { requirePermission, can } from "../lib/auth";
import { recordAudit } from "../lib/audit";
import { round2 } from "../lib/helpers";

const router: IRouter = Router();

router.get(
  "/payroll",
  requirePermission("payroll.view"),
  async (req, res): Promise<void> => {
    if (!can(req, "sensitive.view")) {
      res.status(403).json({
        error: "Payroll data is restricted to authorized roles.",
      });
      return;
    }
    const rows = await db.select().from(payrollTable);
    res.json(rows.sort((a, b) => b.id - a.id));
  },
);

router.post(
  "/payroll",
  requirePermission("payroll.manage"),
  async (req, res): Promise<void> => {
    const parsed = CreatePayrollBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.message });
      return;
    }
    const d = parsed.data;
    const gross = round2(d.grossPay);
    const taxes = round2(d.taxes ?? 0);
    const net = round2(d.netPay ?? gross - taxes);
    // Flag anomalies for review rather than silently accepting them.
    let flagged = false;
    let flagReason: string | null = null;
    if (net > gross) {
      flagged = true;
      flagReason = "Net pay exceeds gross pay.";
    } else if (taxes > gross) {
      flagged = true;
      flagReason = "Taxes exceed gross pay.";
    }
    const [row] = await db
      .insert(payrollTable)
      .values({
        periodStart: d.periodStart,
        periodEnd: d.periodEnd,
        payDate: d.payDate,
        grossPay: gross,
        taxes,
        netPay: net,
        employerTaxes: round2(d.employerTaxes ?? 0),
        employeeCount: d.employeeCount ?? null,
        source: d.source ?? null,
        status: "draft",
        flagged,
        flagReason,
      })
      .returning();
    await recordAudit(req, {
      action: "create",
      recordType: "payroll",
      recordId: row.id,
      after: row,
    });
    res.status(201).json(row);
  },
);

const PAYROLL_TRANSITIONS: Record<string, { from: string[]; to: string }> = {
  approve: { from: ["draft"], to: "approved" },
  post: { from: ["approved"], to: "posted" },
};

router.post(
  "/payroll/:id/transition",
  requirePermission("payroll.manage"),
  async (req, res): Promise<void> => {
    const params = TransitionPayrollParams.safeParse(req.params);
    if (!params.success) {
      res.status(400).json({ error: params.error.message });
      return;
    }
    const parsed = TransitionPayrollBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.message });
      return;
    }
    const rule = PAYROLL_TRANSITIONS[parsed.data.action];
    if (!rule) {
      res.status(400).json({ error: `Unknown action: ${parsed.data.action}` });
      return;
    }
    const [before] = await db
      .select()
      .from(payrollTable)
      .where(eq(payrollTable.id, params.data.id));
    if (!before) {
      res.status(404).json({ error: "Payroll summary not found" });
      return;
    }
    if (!rule.from.includes(before.status)) {
      res.status(400).json({
        error: `Cannot ${parsed.data.action} a payroll summary in status "${before.status}".`,
      });
      return;
    }
    if (parsed.data.action === "approve" && before.flagged) {
      res.status(400).json({
        error: `This payroll summary is flagged (${before.flagReason}) and must be corrected before approval.`,
      });
      return;
    }
    const [row] = await db
      .update(payrollTable)
      .set({ status: rule.to })
      .where(eq(payrollTable.id, params.data.id))
      .returning();
    await recordAudit(req, {
      action: parsed.data.action,
      recordType: "payroll",
      recordId: row.id,
      before: { status: before.status },
      after: { status: rule.to },
      note: parsed.data.note ?? null,
    });
    res.json(row);
  },
);

export default router;
