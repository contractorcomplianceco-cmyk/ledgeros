import {
  pgTable,
  serial,
  integer,
  text,
  boolean,
  doublePrecision,
  date,
} from "drizzle-orm/pg-core";

export const bankAccountsTable = pgTable("bank_accounts", {
  id: serial("id").primaryKey(),
  label: text("label").notNull(),
  institution: text("institution").notNull(),
  maskedNumber: text("masked_number").notNull(),
  connectionMethod: text("connection_method").notNull(),
  accountType: text("account_type"),
  balance: doublePrecision("balance").notNull().default(0),
  isTestData: boolean("is_test_data").notNull().default(false),
});

export const bankTransactionsTable = pgTable("bank_transactions", {
  id: serial("id").primaryKey(),
  bankAccountId: integer("bank_account_id").notNull(),
  txnDate: date("txn_date", { mode: "string" }).notNull(),
  description: text("description").notNull(),
  amount: doublePrecision("amount").notNull().default(0),
  status: text("status").notNull().default("unreviewed"),
  category: text("category"),
  matchedType: text("matched_type"),
  matchedId: integer("matched_id"),
  suggestedCategory: text("suggested_category"),
  confidence: doublePrecision("confidence"),
  reconciled: boolean("reconciled").notNull().default(false),
  isTestData: boolean("is_test_data").notNull().default(false),
});

export const reconciliationsTable = pgTable("reconciliations", {
  id: serial("id").primaryKey(),
  bankAccountId: integer("bank_account_id").notNull(),
  periodStart: date("period_start", { mode: "string" }).notNull(),
  periodEnd: date("period_end", { mode: "string" }).notNull(),
  startingBalance: doublePrecision("starting_balance").notNull().default(0),
  endingBalance: doublePrecision("ending_balance").notNull().default(0),
  clearedTotal: doublePrecision("cleared_total").notNull().default(0),
  variance: doublePrecision("variance").notNull().default(0),
  status: text("status").notNull().default("draft"),
  clearedTransactionIds: integer("cleared_transaction_ids").array(),
  isTestData: boolean("is_test_data").notNull().default(false),
});

export type BankAccountRow = typeof bankAccountsTable.$inferSelect;
export type BankTransactionRow = typeof bankTransactionsTable.$inferSelect;
export type ReconciliationRow = typeof reconciliationsTable.$inferSelect;
