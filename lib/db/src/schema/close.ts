import {
  pgTable,
  serial,
  integer,
  text,
  boolean,
  date,
  timestamp,
  jsonb,
} from "drizzle-orm/pg-core";

type ChecklistItem = { key: string; label: string; done: boolean };

export const monthlyCloseTable = pgTable("monthly_close", {
  id: serial("id").primaryKey(),
  periodLabel: text("period_label").notNull(),
  periodStart: date("period_start", { mode: "string" }).notNull(),
  periodEnd: date("period_end", { mode: "string" }).notNull(),
  status: text("status").notNull().default("open"),
  lockedAt: timestamp("locked_at", { withTimezone: true }),
  lockedById: integer("locked_by_id"),
  checklist: jsonb("checklist").$type<ChecklistItem[]>().notNull().default([]),
  isTestData: boolean("is_test_data").notNull().default(false),
});

export type MonthlyCloseRow = typeof monthlyCloseTable.$inferSelect;
