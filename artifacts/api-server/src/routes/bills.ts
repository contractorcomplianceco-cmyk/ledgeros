import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import { db, billsTable, vendorsTable } from "@workspace/db";
import {
  CreateBillBody,
  TransitionBillBody,
  TransitionBillParams,
  GetBillParams,
} from "@workspace/api-zod";
import { requirePermission, can } from "../lib/auth";
import { recordAudit } from "../lib/audit";
import { round2, nextNumber } from "../lib/helpers";

const router: IRouter = Router();

function possibleDuplicate(
  bill: { vendorId: number; total: number; billDate: string; id: number },
  all: { vendorId: number; total: number; billDate: string; id: number }[],
): boolean {
  return all.some(
    (b) =>
      b.id !== bill.id &&
      b.vendorId === bill.vendorId &&
      Math.abs(b.total - bill.total) < 0.005 &&
      b.billDate === bill.billDate,
  );
}

router.get(
  "/bills",
  requirePermission("bills.view"),
  async (req, res): Promise<void> => {
    const status =
      typeof req.query.status === "string" ? req.query.status : undefined;
    const rows = await db.select().from(billsTable);
    const vendors = await db.select().from(vendorsTable);
    const vmap = new Map(vendors.map((v) => [v.id, v]));
    const showSensitive = can(req, "sensitive.view");
    const result = rows
      .filter((r) => !status || r.status === status)
      .filter((r) => showSensitive || !r.isSensitive)
      .map((r) => ({
        ...r,
        vendorName: vmap.get(r.vendorId)?.name ?? null,
        possibleDuplicate: possibleDuplicate(r, rows),
      }))
      .sort((a, b) => b.id - a.id);
    res.json(result);
  },
);

router.get(
  "/bills/:id",
  requirePermission("bills.view"),
  async (req, res): Promise<void> => {
    const params = GetBillParams.safeParse(req.params);
    if (!params.success) {
      res.status(400).json({ error: params.error.message });
      return;
    }
    const [bill] = await db
      .select()
      .from(billsTable)
      .where(eq(billsTable.id, params.data.id));
    if (!bill) {
      res.status(404).json({ error: "Bill not found" });
      return;
    }
    if (bill.isSensitive && !can(req, "sensitive.view")) {
      res.status(403).json({ error: "This bill is restricted." });
      return;
    }
    const [vendor] = await db
      .select()
      .from(vendorsTable)
      .where(eq(vendorsTable.id, bill.vendorId));
    const all = await db.select().from(billsTable);
    res.json({
      ...bill,
      vendorName: vendor?.name ?? null,
      possibleDuplicate: possibleDuplicate(bill, all),
    });
  },
);

router.post(
  "/bills",
  requirePermission("bills.manage"),
  async (req, res): Promise<void> => {
    const parsed = CreateBillBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.message });
      return;
    }
    const data = parsed.data;
    const [vendor] = await db
      .select()
      .from(vendorsTable)
      .where(eq(vendorsTable.id, data.vendorId));
    if (!vendor) {
      res.status(400).json({ error: "Vendor does not exist" });
      return;
    }
    const count = (await db.select().from(billsTable)).length;
    const [bill] = await db
      .insert(billsTable)
      .values({
        number: nextNumber("BILL", count),
        vendorId: data.vendorId,
        status: "draft",
        billDate: data.billDate,
        dueDate: data.dueDate ?? null,
        category: data.category ?? null,
        clientProject: data.clientProject ?? null,
        memo: data.memo ?? null,
        total: round2(data.total),
        amountPaid: 0,
        isSensitive: data.isSensitive ?? vendor.isSensitive,
      })
      .returning();
    await recordAudit(req, {
      action: "create",
      recordType: "bill",
      recordId: bill.id,
      after: bill,
    });
    res.status(201).json({
      ...bill,
      vendorName: vendor.name,
      possibleDuplicate: false,
    });
  },
);

const BILL_TRANSITIONS: Record<
  string,
  { from: string[]; to: string; perm: "bills.manage" | "bills.approve" }
> = {
  submit: { from: ["draft", "rejected"], to: "submitted", perm: "bills.manage" },
  approve: { from: ["submitted"], to: "approved", perm: "bills.approve" },
  reject: { from: ["submitted"], to: "rejected", perm: "bills.approve" },
  pay: { from: ["approved"], to: "paid", perm: "bills.approve" },
  void: { from: ["draft", "rejected", "approved"], to: "void", perm: "bills.approve" },
};

router.post(
  "/bills/:id/transition",
  requirePermission("bills.view"),
  async (req, res): Promise<void> => {
    const params = TransitionBillParams.safeParse(req.params);
    if (!params.success) {
      res.status(400).json({ error: params.error.message });
      return;
    }
    const parsed = TransitionBillBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.message });
      return;
    }
    const rule = BILL_TRANSITIONS[parsed.data.action];
    if (!rule) {
      res.status(400).json({ error: `Unknown action: ${parsed.data.action}` });
      return;
    }
    if (!can(req, rule.perm)) {
      res.status(403).json({
        error: `Your role is not permitted to ${parsed.data.action} a bill.`,
      });
      return;
    }
    const [before] = await db
      .select()
      .from(billsTable)
      .where(eq(billsTable.id, params.data.id));
    if (!before) {
      res.status(404).json({ error: "Bill not found" });
      return;
    }
    if (!rule.from.includes(before.status)) {
      res.status(400).json({
        error: `Cannot ${parsed.data.action} a bill in status "${before.status}".`,
      });
      return;
    }
    const patch: Record<string, unknown> = { status: rule.to };
    if (rule.to === "paid") patch.amountPaid = before.total;
    await db
      .update(billsTable)
      .set(patch)
      .where(eq(billsTable.id, params.data.id));
    await recordAudit(req, {
      action: parsed.data.action,
      recordType: "bill",
      recordId: params.data.id,
      before: { status: before.status },
      after: { status: rule.to },
      note: parsed.data.note ?? null,
    });
    const [vendor] = await db
      .select()
      .from(vendorsTable)
      .where(eq(vendorsTable.id, before.vendorId));
    const [updated] = await db
      .select()
      .from(billsTable)
      .where(eq(billsTable.id, params.data.id));
    res.json({
      ...updated,
      vendorName: vendor?.name ?? null,
      possibleDuplicate: false,
    });
  },
);

export default router;
