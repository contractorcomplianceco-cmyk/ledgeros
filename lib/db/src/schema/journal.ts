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

export const journalEntriesTable = pgTable("journal_entries", {
  id: serial("id").primaryKey(),
  reference: text("reference"),
  entryDate: date("entry_date", { mode: "string" }).notNull(),
  memo: text("memo").notNull(),
  reason: text("reason"),
  status: text("status").notNull().default("draft"),
  source: text("source"),
  reversedById: integer("reversed_by_id"),
  reversalOfId: integer("reversal_of_id"),
  isTestData: boolean("is_test_data").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const journalLinesTable = pgTable("journal_lines", {
  id: serial("id").primaryKey(),
  journalEntryId: integer("journal_entry_id").notNull(),
  accountId: integer("account_id").notNull(),
  debit: doublePrecision("debit").notNull().default(0),
  credit: doublePrecision("credit").notNull().default(0),
  memo: text("memo"),
});

export type JournalEntryRow = typeof journalEntriesTable.$inferSelect;
export type JournalLineRow = typeof journalLinesTable.$inferSelect;
