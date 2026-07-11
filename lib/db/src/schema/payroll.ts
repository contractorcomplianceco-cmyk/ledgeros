import {
  pgTable,
  serial,
  integer,
  text,
  boolean,
  doublePrecision,
  date,
} from "drizzle-orm/pg-core";

export const payrollTable = pgTable("payroll_summaries", {
  id: serial("id").primaryKey(),
  periodStart: date("period_start", { mode: "string" }).notNull(),
  periodEnd: date("period_end", { mode: "string" }).notNull(),
  payDate: date("pay_date", { mode: "string" }).notNull(),
  grossPay: doublePrecision("gross_pay").notNull().default(0),
  taxes: doublePrecision("taxes").notNull().default(0),
  netPay: doublePrecision("net_pay").notNull().default(0),
  employerTaxes: doublePrecision("employer_taxes").notNull().default(0),
  employeeCount: integer("employee_count"),
  source: text("source"),
  status: text("status").notNull().default("draft"),
  flagged: boolean("flagged").notNull().default(false),
  flagReason: text("flag_reason"),
  isTestData: boolean("is_test_data").notNull().default(false),
});

export type PayrollRow = typeof payrollTable.$inferSelect;
