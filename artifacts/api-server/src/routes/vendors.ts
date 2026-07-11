import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import { db, vendorsTable, billsTable } from "@workspace/db";
import {
  CreateVendorBody,
  UpdateVendorBody,
  UpdateVendorParams,
} from "@workspace/api-zod";
import { requirePermission, can } from "../lib/auth";
import { recordAudit } from "../lib/audit";
import { round2 } from "../lib/helpers";

const router: IRouter = Router();

async function balanceMap(): Promise<Map<number, number>> {
  const bills = await db
    .select({
      vendorId: billsTable.vendorId,
      total: billsTable.total,
      amountPaid: billsTable.amountPaid,
      status: billsTable.status,
    })
    .from(billsTable);
  const map = new Map<number, number>();
  for (const b of bills) {
    if (b.status === "draft" || b.status === "void") continue;
    const open = (b.total ?? 0) - (b.amountPaid ?? 0);
    map.set(b.vendorId, round2((map.get(b.vendorId) ?? 0) + open));
  }
  return map;
}

router.get(
  "/vendors",
  requirePermission("vendors.view"),
  async (req, res): Promise<void> => {
    const rows = await db.select().from(vendorsTable);
    const balances = await balanceMap();
    const showSensitive = can(req, "sensitive.view");
    res.json(
      rows
        .filter((v) => showSensitive || !v.isSensitive)
        .map((v) => ({ ...v, balance: balances.get(v.id) ?? 0 })),
    );
  },
);

router.post(
  "/vendors",
  requirePermission("vendors.manage"),
  async (req, res): Promise<void> => {
    const parsed = CreateVendorBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.message });
      return;
    }
    const [vendor] = await db
      .insert(vendorsTable)
      .values({
        name: parsed.data.name,
        email: parsed.data.email ?? null,
        phone: parsed.data.phone ?? null,
        category: parsed.data.category ?? null,
        isSensitive: parsed.data.isSensitive ?? false,
        notes: parsed.data.notes ?? null,
      })
      .returning();
    await recordAudit(req, {
      action: "create",
      recordType: "vendor",
      recordId: vendor.id,
      after: vendor,
    });
    res.status(201).json({ ...vendor, balance: 0 });
  },
);

router.patch(
  "/vendors/:id",
  requirePermission("vendors.manage"),
  async (req, res): Promise<void> => {
    const params = UpdateVendorParams.safeParse(req.params);
    if (!params.success) {
      res.status(400).json({ error: params.error.message });
      return;
    }
    const parsed = UpdateVendorBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.message });
      return;
    }
    const [before] = await db
      .select()
      .from(vendorsTable)
      .where(eq(vendorsTable.id, params.data.id));
    if (!before) {
      res.status(404).json({ error: "Vendor not found" });
      return;
    }
    const [vendor] = await db
      .update(vendorsTable)
      .set(parsed.data)
      .where(eq(vendorsTable.id, params.data.id))
      .returning();
    await recordAudit(req, {
      action: "update",
      recordType: "vendor",
      recordId: vendor.id,
      before,
      after: vendor,
    });
    const balances = await balanceMap();
    res.json({ ...vendor, balance: balances.get(vendor.id) ?? 0 });
  },
);

export default router;
