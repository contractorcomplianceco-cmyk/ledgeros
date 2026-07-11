import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import {
  db,
  invoicesTable,
  invoiceLinesTable,
  customersTable,
} from "@workspace/db";
import {
  CreateInvoiceBody,
  TransitionInvoiceBody,
  TransitionInvoiceParams,
  GetInvoiceParams,
} from "@workspace/api-zod";
import { requirePermission, can } from "../lib/auth";
import { recordAudit } from "../lib/audit";
import { round2, nextNumber } from "../lib/helpers";

const router: IRouter = Router();

async function hydrate(invoiceId: number) {
  const [inv] = await db
    .select()
    .from(invoicesTable)
    .where(eq(invoicesTable.id, invoiceId));
  if (!inv) return null;
  const lines = await db
    .select()
    .from(invoiceLinesTable)
    .where(eq(invoiceLinesTable.invoiceId, invoiceId));
  const [customer] = await db
    .select({ name: customersTable.name })
    .from(customersTable)
    .where(eq(customersTable.id, inv.customerId));
  return {
    ...inv,
    customerName: customer?.name ?? null,
    lines: lines.map((l) => ({
      id: l.id,
      description: l.description,
      quantity: l.quantity,
      unitPrice: l.unitPrice,
      amount: l.amount,
      accountId: l.accountId,
    })),
  };
}

router.get(
  "/invoices",
  requirePermission("invoices.view"),
  async (req, res): Promise<void> => {
    const status =
      typeof req.query.status === "string" ? req.query.status : undefined;
    const rows = await db.select().from(invoicesTable);
    const customers = await db.select().from(customersTable);
    const cmap = new Map(customers.map((c) => [c.id, c.name]));
    const result = rows
      .filter((r) => !status || r.status === status)
      .map((r) => ({ ...r, customerName: cmap.get(r.customerId) ?? null }))
      .sort((a, b) => b.id - a.id);
    res.json(result);
  },
);

router.get(
  "/invoices/:id",
  requirePermission("invoices.view"),
  async (req, res): Promise<void> => {
    const params = GetInvoiceParams.safeParse(req.params);
    if (!params.success) {
      res.status(400).json({ error: params.error.message });
      return;
    }
    const inv = await hydrate(params.data.id);
    if (!inv) {
      res.status(404).json({ error: "Invoice not found" });
      return;
    }
    res.json(inv);
  },
);

router.post(
  "/invoices",
  requirePermission("invoices.manage"),
  async (req, res): Promise<void> => {
    const parsed = CreateInvoiceBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.message });
      return;
    }
    const data = parsed.data;
    const [customer] = await db
      .select()
      .from(customersTable)
      .where(eq(customersTable.id, data.customerId));
    if (!customer) {
      res.status(400).json({ error: "Customer does not exist" });
      return;
    }
    const subtotal = round2(
      data.lines.reduce((s, l) => s + (l.amount ?? 0), 0),
    );
    const count = (await db.select().from(invoicesTable)).length;
    const [invoice] = await db
      .insert(invoicesTable)
      .values({
        number: nextNumber("INV", count),
        customerId: data.customerId,
        status: "draft",
        sourceApp: data.sourceApp ?? null,
        issueDate: data.issueDate,
        dueDate: data.dueDate ?? null,
        terms: data.terms ?? null,
        memo: data.memo ?? null,
        subtotal,
        total: subtotal,
        amountPaid: 0,
      })
      .returning();
    if (data.lines.length > 0) {
      await db.insert(invoiceLinesTable).values(
        data.lines.map((l) => ({
          invoiceId: invoice.id,
          description: l.description,
          quantity: l.quantity,
          unitPrice: l.unitPrice,
          amount: l.amount,
          accountId: l.accountId ?? null,
        })),
      );
    }
    await recordAudit(req, {
      action: "create",
      recordType: "invoice",
      recordId: invoice.id,
      after: invoice,
    });
    res.status(201).json(await hydrate(invoice.id));
  },
);

const INVOICE_TRANSITIONS: Record<
  string,
  { from: string[]; to: string; perm: "invoices.manage" | "invoices.approve" }
> = {
  submit: { from: ["draft", "rejected"], to: "submitted", perm: "invoices.manage" },
  approve: { from: ["submitted"], to: "approved", perm: "invoices.approve" },
  reject: { from: ["submitted"], to: "rejected", perm: "invoices.approve" },
  send: { from: ["approved"], to: "sent", perm: "invoices.manage" },
  void: { from: ["draft", "rejected", "approved"], to: "void", perm: "invoices.approve" },
};

router.post(
  "/invoices/:id/transition",
  requirePermission("invoices.view"),
  async (req, res): Promise<void> => {
    const params = TransitionInvoiceParams.safeParse(req.params);
    if (!params.success) {
      res.status(400).json({ error: params.error.message });
      return;
    }
    const parsed = TransitionInvoiceBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.message });
      return;
    }
    const rule = INVOICE_TRANSITIONS[parsed.data.action];
    if (!rule) {
      res.status(400).json({ error: `Unknown action: ${parsed.data.action}` });
      return;
    }
    if (!can(req, rule.perm)) {
      res.status(403).json({
        error: `Your role is not permitted to ${parsed.data.action} an invoice.`,
      });
      return;
    }
    const [before] = await db
      .select()
      .from(invoicesTable)
      .where(eq(invoicesTable.id, params.data.id));
    if (!before) {
      res.status(404).json({ error: "Invoice not found" });
      return;
    }
    if (!rule.from.includes(before.status)) {
      res.status(400).json({
        error: `Cannot ${parsed.data.action} an invoice in status "${before.status}".`,
      });
      return;
    }
    await db
      .update(invoicesTable)
      .set({ status: rule.to })
      .where(eq(invoicesTable.id, params.data.id));
    await recordAudit(req, {
      action: parsed.data.action,
      recordType: "invoice",
      recordId: params.data.id,
      before: { status: before.status },
      after: { status: rule.to },
      note: parsed.data.note ?? null,
    });
    res.json(await hydrate(params.data.id));
  },
);

export default router;
