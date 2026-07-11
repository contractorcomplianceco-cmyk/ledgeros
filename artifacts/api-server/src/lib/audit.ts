import type { Request } from "express";
import { db, auditLogsTable } from "@workspace/db";

interface AuditInput {
  action: string;
  recordType: string;
  recordId?: number | null;
  before?: unknown;
  after?: unknown;
  note?: string | null;
}

function serialize(value: unknown): string | null {
  if (value === undefined || value === null) return null;
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

export async function recordAudit(
  req: Request,
  input: AuditInput,
): Promise<void> {
  await db.insert(auditLogsTable).values({
    userId: req.currentUser?.id ?? null,
    action: input.action,
    recordType: input.recordType,
    recordId: input.recordId ?? null,
    before: serialize(input.before),
    after: serialize(input.after),
    note: input.note ?? null,
    ipAddress: req.ip ?? null,
  });
}
