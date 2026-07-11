import {
  pgTable,
  serial,
  text,
  doublePrecision,
} from "drizzle-orm/pg-core";

export const settingsTable = pgTable("settings", {
  id: serial("id").primaryKey(),
  companyName: text("company_name").notNull().default("CCA"),
  legalName: text("legal_name"),
  fiscalYearStart: text("fiscal_year_start"),
  baseCurrency: text("base_currency").notNull().default("USD"),
  approvalThreshold: doublePrecision("approval_threshold").notNull().default(1000),
  highValueThreshold: doublePrecision("high_value_threshold").notNull().default(10000),
  rolloutStage: text("rollout_stage").notNull().default("pilot"),
});

export type SettingsRow = typeof settingsTable.$inferSelect;
