import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import {
  db,
  paymentsTable,
  invoicesTable,
  bankTransactionsTable,
} from "@workspace/db";
import { CreatePaymentBody } from "@workspace/api-zod";
import { requirePermission } from "../lib/auth";
import { recordAudit } from "../lib/audit";
import { round2 } from "../lib/helpers";

const router: IRouter = Router();

router.get(
  "/payments",
  requirePermission("payments.view"),
  async (_req, res): Promise<void> => {
    const rows = await db.select().from(paymentsTable);
    res.json(rows.sort((a, b) => b.id - a.id));
  },
);

router.post(
  "/payments",
  requirePermission("payments.record"),
  async (req, res): Promise<void> => {
    const parsed = CreatePaymentBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.message });
      return;
    }
    const d = parsed.data;
    const amount = round2(d.amount);
    if (amount <= 0) {
      res.status(400).json({ error: "Payment amount must be positive." });
      return;
    }

    let invoice = null;
    if (d.invoiceId) {
      [invoice] = await db
        .select()
        .from(invoicesTable)
        .where(eq(invoicesTable.id, d.invoiceId));
      if (!invoice) {
        res.status(400).json({ error: "Invoice does not exist." });
        return;
      }
      if (invoice.status === "draft" || invoice.status === "void") {
        res.status(400).json({
          error: `Cannot record a payment against a ${invoice.status} invoice.`,
        });
        return;
      }
      const open = round2((invoice.total ?? 0) - (invoice.amountPaid ?? 0));
      if (amount > open + 0.005) {
        res.status(400).json({
          error: `Payment of ${amount} exceeds the open balance of ${open}.`,
        });
        return;
      }
    }

    // If matching a bank transaction, verify it exists and is unmatched.
    if (d.matchedBankTransactionId) {
      const [txn] = await db
        .select()
        .from(bankTransactionsTable)
        .where(eq(bankTransactionsTable.id, d.matchedBankTransactionId));
      if (!txn) {
        res.status(400).json({ error: "Bank transaction does not exist." });
        return;
      }
    }

    const [payment] = await db
      .insert(paymentsTable)
      .values({
        invoiceId: d.invoiceId ?? null,
        customerId: d.customerId ?? invoice?.customerId ?? null,
        amount,
        paymentDate: d.paymentDate,
        method: d.method,
        direction: "in",
        reference: d.reference ?? null,
        depositAccountId: d.depositAccountId ?? null,
        matchedBankTransactionId: d.matchedBankTransactionId ?? null,
        status: "recorded",
      })
      .returning();

    if (invoice) {
      const newPaid = round2((invoice.amountPaid ?? 0) + amount);
      const fullyPaid = newPaid >= (invoice.total ?? 0) - 0.005;
      await db
        .update(invoicesTable)
        .set({
          amountPaid: newPaid,
          status: fullyPaid ? "paid" : invoice.status,
        })
        .where(eq(invoicesTable.id, invoice.id));
    }

    if (d.matchedBankTransactionId) {
      await db
        .update(bankTransactionsTable)
        .set({
          status: "matched",
          matchedType: "payment",
          matchedId: payment.id,
        })
        .where(eq(bankTransactionsTable.id, d.matchedBankTransactionId));
    }

    await recordAudit(req, {
      action: "create",
      recordType: "payment",
      recordId: payment.id,
      after: payment,
    });
    res.status(201).json(payment);
  },
);

export default router;
