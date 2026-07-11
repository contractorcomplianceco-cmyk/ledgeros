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

export const billsTable = pgTable("bills", {
  id: serial("id").primaryKey(),
  number: text("number").notNull(),
  vendorId: integer("vendor_id").notNull(),
  status: text("status").notNull().default("draft"),
  billDate: date("bill_date", { mode: "string" }).notNull(),
  dueDate: date("due_date", { mode: "string" }),
  category: text("category"),
  clientProject: text("client_project"),
  memo: text("memo"),
  total: doublePrecision("total").notNull().default(0),
  amountPaid: doublePrecision("amount_paid").notNull().default(0),
  isSensitive: boolean("is_sensitive").notNull().default(false),
  isTestData: boolean("is_test_data").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export type BillRow = typeof billsTable.$inferSelect;
