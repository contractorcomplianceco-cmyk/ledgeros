import { Router, type IRouter } from "express";
import { desc, eq } from "drizzle-orm";
import { db, auditLogsTable, usersTable } from "@workspace/db";
import { requirePermission } from "../lib/auth";

const router: IRouter = Router();

router.get(
  "/audit-logs",
  requirePermission("audit.view"),
  async (req, res): Promise<void> => {
    const recordType =
      typeof req.query.recordType === "string"
        ? req.query.recordType
        : undefined;
    const rows = await db
      .select({
        id: auditLogsTable.id,
        userId: auditLogsTable.userId,
        userName: usersTable.name,
        action: auditLogsTable.action,
        recordType: auditLogsTable.recordType,
        recordId: auditLogsTable.recordId,
        before: auditLogsTable.before,
        after: auditLogsTable.after,
        note: auditLogsTable.note,
        ipAddress: auditLogsTable.ipAddress,
        timestamp: auditLogsTable.timestamp,
      })
      .from(auditLogsTable)
      .leftJoin(usersTable, eq(auditLogsTable.userId, usersTable.id))
      .orderBy(desc(auditLogsTable.id))
      .limit(500);
    res.json(
      rows
        .filter((r) => !recordType || r.recordType === recordType)
        .map((r) => ({ ...r, timestamp: r.timestamp.toISOString() })),
    );
  },
);

export default router;
