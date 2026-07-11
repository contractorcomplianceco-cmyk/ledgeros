import {
  pgTable,
  serial,
  integer,
  text,
  boolean,
  doublePrecision,
  timestamp,
} from "drizzle-orm/pg-core";

export const integrationEventsTable = pgTable("integration_events", {
  id: serial("id").primaryKey(),
  sourceApp: text("source_app").notNull(),
  eventType: text("event_type").notNull(),
  status: text("status").notNull().default("new"),
  summary: text("summary"),
  amount: doublePrecision("amount"),
  payload: text("payload"),
  createdRecordType: text("created_record_type"),
  createdRecordId: integer("created_record_id"),
  receivedAt: timestamp("received_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  isTestData: boolean("is_test_data").notNull().default(false),
});

export const productMappingsTable = pgTable("product_mappings", {
  id: serial("id").primaryKey(),
  sourceApp: text("source_app").notNull(),
  eventType: text("event_type").notNull(),
  action: text("action").notNull(),
  revenueAccountId: integer("revenue_account_id"),
  costAccountId: integer("cost_account_id"),
  autoDraft: boolean("auto_draft").notNull().default(false),
  notes: text("notes"),
});

export type IntegrationEventRow = typeof integrationEventsTable.$inferSelect;
export type ProductMappingRow = typeof productMappingsTable.$inferSelect;
