import {
  pgTable,
  serial,
  integer,
  text,
  boolean,
  doublePrecision,
  date,
  timestamp,
} from "drizzle-orm/pg-core";

export const invoicesTable = pgTable("invoices", {
  id: serial("id").primaryKey(),
  number: text("number").notNull(),
  customerId: integer("customer_id").notNull(),
  status: text("status").notNull().default("draft"),
  sourceApp: text("source_app"),
  issueDate: date("issue_date", { mode: "string" }).notNull(),
  dueDate: date("due_date", { mode: "string" }),
  terms: text("terms"),
  memo: text("memo"),
  subtotal: doublePrecision("subtotal").notNull().default(0),
  total: doublePrecision("total").notNull().default(0),
  amountPaid: doublePrecision("amount_paid").notNull().default(0),
  isTestData: boolean("is_test_data").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const invoiceLinesTable = pgTable("invoice_lines", {
  id: serial("id").primaryKey(),
  invoiceId: integer("invoice_id").notNull(),
  description: text("description").notNull(),
  quantity: doublePrecision("quantity").notNull().default(1),
  unitPrice: doublePrecision("unit_price").notNull().default(0),
  amount: doublePrecision("amount").notNull().default(0),
  accountId: integer("account_id"),
});

export type InvoiceRow = typeof invoicesTable.$inferSelect;
export type InvoiceLineRow = typeof invoiceLinesTable.$inferSelect;
