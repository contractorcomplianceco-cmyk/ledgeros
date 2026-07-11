import {
  pgTable,
  serial,
  integer,
  text,
  timestamp,
} from "drizzle-orm/pg-core";

export const auditLogsTable = pgTable("audit_logs", {
  id: serial("id").primaryKey(),
  userId: integer("user_id"),
  action: text("action").notNull(),
  recordType: text("record_type").notNull(),
  recordId: integer("record_id"),
  before: text("before"),
  after: text("after"),
  note: text("note"),
  ipAddress: text("ip_address"),
  timestamp: timestamp("timestamp", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export type AuditLogRow = typeof auditLogsTable.$inferSelect;
