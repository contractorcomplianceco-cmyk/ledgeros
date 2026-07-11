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

export const expensesTable = pgTable("expenses", {
  id: serial("id").primaryKey(),
  description: text("description").notNull(),
  vendorName: text("vendor_name"),
  amount: doublePrecision("amount").notNull().default(0),
  category: text("category"),
  clientProject: text("client_project"),
  sourceApp: text("source_app"),
  status: text("status").notNull().default("draft"),
  expenseDate: date("expense_date", { mode: "string" }).notNull(),
  hasReceipt: boolean("has_receipt").notNull().default(false),
  reimbursable: boolean("reimbursable").notNull().default(true),
  submittedById: integer("submitted_by_id"),
  isTestData: boolean("is_test_data").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export type ExpenseRow = typeof expensesTable.$inferSelect;
