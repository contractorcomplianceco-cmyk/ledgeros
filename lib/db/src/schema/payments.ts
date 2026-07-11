import {
  pgTable,
  serial,
  integer,
  text,
  boolean,
  doublePrecision,
  date,
} from "drizzle-orm/pg-core";

export const paymentsTable = pgTable("payments", {
  id: serial("id").primaryKey(),
  invoiceId: integer("invoice_id"),
  customerId: integer("customer_id"),
  amount: doublePrecision("amount").notNull().default(0),
  paymentDate: date("payment_date", { mode: "string" }).notNull(),
  method: text("method").notNull(),
  direction: text("direction").notNull().default("in"),
  reference: text("reference"),
  depositAccountId: integer("deposit_account_id"),
  matchedBankTransactionId: integer("matched_bank_transaction_id"),
  status: text("status").notNull().default("recorded"),
  isTestData: boolean("is_test_data").notNull().default(false),
});

export type PaymentRow = typeof paymentsTable.$inferSelect;
