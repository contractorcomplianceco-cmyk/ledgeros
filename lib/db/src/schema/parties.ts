import { pgTable, serial, text, boolean } from "drizzle-orm/pg-core";

export const customersTable = pgTable("customers", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email"),
  phone: text("phone"),
  company: text("company"),
  sourceApp: text("source_app"),
  externalId: text("external_id"),
  notes: text("notes"),
  isTestData: boolean("is_test_data").notNull().default(false),
});

export const vendorsTable = pgTable("vendors", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email"),
  phone: text("phone"),
  category: text("category"),
  isSensitive: boolean("is_sensitive").notNull().default(false),
  notes: text("notes"),
  isTestData: boolean("is_test_data").notNull().default(false),
});

export type CustomerRow = typeof customersTable.$inferSelect;
export type VendorRow = typeof vendorsTable.$inferSelect;
