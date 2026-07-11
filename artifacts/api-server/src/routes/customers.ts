import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import { db, customersTable, invoicesTable } from "@workspace/db";
import {
  CreateCustomerBody,
  UpdateCustomerBody,
  UpdateCustomerParams,
  GetCustomerParams,
} from "@workspace/api-zod";
import { requirePermission } from "../lib/auth";
import { recordAudit } from "../lib/audit";
import { round2 } from "../lib/helpers";

const router: IRouter = Router();

async function balanceMap(): Promise<Map<number, number>> {
  const invoices = await db
    .select({
      customerId: invoicesTable.customerId,
      total: invoicesTable.total,
      amountPaid: invoicesTable.amountPaid,
      status: invoicesTable.status,
    })
    .from(invoicesTable);
  const map = new Map<number, number>();
  for (const inv of invoices) {
    if (inv.status === "draft" || inv.status === "void") continue;
    const open = (inv.total ?? 0) - (inv.amountPaid ?? 0);
    map.set(inv.customerId, round2((map.get(inv.customerId) ?? 0) + open));
  }
  return map;
}

router.get(
  "/customers",
  requirePermission("customers.view"),
  async (_req, res): Promise<void> => {
    const rows = await db.select().from(customersTable);
    const balances = await balanceMap();
    res.json(
      rows.map((c) => ({ ...c, balance: balances.get(c.id) ?? 0 })),
    );
  },
);

router.get(
  "/customers/:id",
  requirePermission("customers.view"),
  async (req, res): Promise<void> => {
    const params = GetCustomerParams.safeParse(req.params);
    if (!params.success) {
      res.status(400).json({ error: params.error.message });
      return;
    }
    const [customer] = await db
      .select()
      .from(customersTable)
      .where(eq(customersTable.id, params.data.id));
    if (!customer) {
      res.status(404).json({ error: "Customer not found" });
      return;
    }
    const balances = await balanceMap();
    res.json({ ...customer, balance: balances.get(customer.id) ?? 0 });
  },
);

router.post(
  "/customers",
  requirePermission("customers.manage"),
  async (req, res): Promise<void> => {
    const parsed = CreateCustomerBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.message });
      return;
    }
    const [customer] = await db
      .insert(customersTable)
      .values({
        name: parsed.data.name,
        email: parsed.data.email ?? null,
        phone: parsed.data.phone ?? null,
        company: parsed.data.company ?? null,
        sourceApp: parsed.data.sourceApp ?? null,
        externalId: parsed.data.externalId ?? null,
        notes: parsed.data.notes ?? null,
      })
      .returning();
    await recordAudit(req, {
      action: "create",
      recordType: "customer",
      recordId: customer.id,
      after: customer,
    });
    res.status(201).json({ ...customer, balance: 0 });
  },
);

router.patch(
  "/customers/:id",
  requirePermission("customers.manage"),
  async (req, res): Promise<void> => {
    const params = UpdateCustomerParams.safeParse(req.params);
    if (!params.success) {
      res.status(400).json({ error: params.error.message });
      return;
    }
    const parsed = UpdateCustomerBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.message });
      return;
    }
    const [before] = await db
      .select()
      .from(customersTable)
      .where(eq(customersTable.id, params.data.id));
    if (!before) {
      res.status(404).json({ error: "Customer not found" });
      return;
    }
    const [customer] = await db
      .update(customersTable)
      .set(parsed.data)
      .where(eq(customersTable.id, params.data.id))
      .returning();
    await recordAudit(req, {
      action: "update",
      recordType: "customer",
      recordId: customer.id,
      before,
      after: customer,
    });
    const balances = await balanceMap();
    res.json({ ...customer, balance: balances.get(customer.id) ?? 0 });
  },
);

export default router;
