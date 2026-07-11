import { pgTable, serial, text, boolean } from "drizzle-orm/pg-core";

export const accountsTable = pgTable("accounts", {
  id: serial("id").primaryKey(),
  code: text("code").notNull(),
  name: text("name").notNull(),
  type: text("type").notNull(),
  subtype: text("subtype"),
  description: text("description"),
  isActive: boolean("is_active").notNull().default(true),
  isSensitive: boolean("is_sensitive").notNull().default(false),
  isTestData: boolean("is_test_data").notNull().default(false),
});

export type AccountRow = typeof accountsTable.$inferSelect;
