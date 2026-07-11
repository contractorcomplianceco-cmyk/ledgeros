import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import {
  db,
  usersTable,
  settingsTable,
  monthlyCloseTable,
  reconciliationsTable,
} from "@workspace/db";
import {
  CreateUserBody,
  UpdateUserBody,
  UpdateUserParams,
  UpdateSettingsBody,
} from "@workspace/api-zod";
import {
  requirePermission,
  hashPassword,
  ROLES,
  permissionsForRole,
} from "../lib/auth";
import { recordAudit } from "../lib/audit";

const router: IRouter = Router();

function toUser(u: {
  id: number;
  name: string;
  username: string;
  email: string | null;
  role: string;
  active: boolean;
  mfaEnabled: boolean;
}) {
  return {
    id: u.id,
    name: u.name,
    username: u.username,
    email: u.email,
    role: u.role,
    active: u.active,
    mfaEnabled: u.mfaEnabled,
  };
}

router.get(
  "/users",
  requirePermission("users.manage"),
  async (_req, res): Promise<void> => {
    const rows = await db.select().from(usersTable);
    res.json(rows.map(toUser).sort((a, b) => a.id - b.id));
  },
);

router.post(
  "/users",
  requirePermission("users.manage"),
  async (req, res): Promise<void> => {
    const parsed = CreateUserBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.message });
      return;
    }
    const d = parsed.data;
    if (!ROLES.some((r) => r.key === d.role)) {
      res.status(400).json({ error: `Unknown role: ${d.role}` });
      return;
    }
    const existing = await db
      .select()
      .from(usersTable)
      .where(eq(usersTable.username, d.username));
    if (existing.length > 0) {
      res.status(400).json({ error: "Username already exists." });
      return;
    }
    const [user] = await db
      .insert(usersTable)
      .values({
        name: d.name,
        username: d.username,
        email: d.email ?? null,
        role: d.role,
        passwordHash: hashPassword(d.password),
        active: true,
      })
      .returning();
    await recordAudit(req, {
      action: "create",
      recordType: "user",
      recordId: user.id,
      after: toUser(user),
    });
    res.status(201).json(toUser(user));
  },
);

router.patch(
  "/users/:id",
  requirePermission("users.manage"),
  async (req, res): Promise<void> => {
    const params = UpdateUserParams.safeParse(req.params);
    if (!params.success) {
      res.status(400).json({ error: params.error.message });
      return;
    }
    const parsed = UpdateUserBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.message });
      return;
    }
    const d = parsed.data;
    if (d.role && !ROLES.some((r) => r.key === d.role)) {
      res.status(400).json({ error: `Unknown role: ${d.role}` });
      return;
    }
    const [before] = await db
      .select()
      .from(usersTable)
      .where(eq(usersTable.id, params.data.id));
    if (!before) {
      res.status(404).json({ error: "User not found" });
      return;
    }
    const patch: Record<string, unknown> = {};
    if (d.role !== undefined) patch.role = d.role;
    if (d.active !== undefined) patch.active = d.active;
    if (d.name !== undefined) patch.name = d.name;
    const [user] = await db
      .update(usersTable)
      .set(patch)
      .where(eq(usersTable.id, params.data.id))
      .returning();
    await recordAudit(req, {
      action: "update",
      recordType: "user",
      recordId: user.id,
      before: toUser(before),
      after: toUser(user),
    });
    res.json(toUser(user));
  },
);

router.get(
  "/roles",
  requirePermission("users.manage"),
  async (_req, res): Promise<void> => {
    res.json(
      ROLES.map((r) => ({
        key: r.key,
        name: r.name,
        description: r.description,
        permissions: permissionsForRole(r.key),
      })),
    );
  },
);

async function loadSettings() {
  const [row] = await db.select().from(settingsTable);
  if (row) return row;
  const [created] = await db.insert(settingsTable).values({}).returning();
  return created;
}

router.get(
  "/settings",
  requirePermission("settings.view"),
  async (_req, res): Promise<void> => {
    res.json(await loadSettings());
  },
);

router.patch(
  "/settings",
  requirePermission("settings.manage"),
  async (req, res): Promise<void> => {
    const parsed = UpdateSettingsBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.message });
      return;
    }
    const before = await loadSettings();
    const [row] = await db
      .update(settingsTable)
      .set(parsed.data)
      .where(eq(settingsTable.id, before.id))
      .returning();
    await recordAudit(req, {
      action: "update",
      recordType: "settings",
      recordId: row.id,
      before,
      after: row,
    });
    res.json(row);
  },
);

router.get(
  "/production-readiness",
  requirePermission("readiness.view"),
  async (_req, res): Promise<void> => {
    const settings = await loadSettings();
    const closes = await db.select().from(monthlyCloseTable);
    const recons = await db.select().from(reconciliationsTable);
    const users = await db.select().from(usersTable);

    const hasLockedClose = closes.some((c) => c.status === "locked");
    const hasFinalizedRecon = recons.some((r) => r.status === "finalized");
    const distinctRoles = new Set(users.filter((u) => u.active).map((u) => u.role));

    const gates = [
      {
        key: "persistence",
        name: "Persistent database",
        status: "pass",
        detail: "All records are stored in PostgreSQL.",
      },
      {
        key: "rbac",
        name: "Role-based access control",
        status: distinctRoles.size >= 2 ? "pass" : "warn",
        detail: `${distinctRoles.size} active role(s) configured.`,
      },
      {
        key: "audit",
        name: "Audit logging",
        status: "pass",
        detail: "Every mutation is recorded to the audit log.",
      },
      {
        key: "reconciliation",
        name: "Bank reconciliation",
        status: hasFinalizedRecon ? "pass" : "warn",
        detail: hasFinalizedRecon
          ? "At least one reconciliation finalized."
          : "No reconciliations finalized yet.",
      },
      {
        key: "close",
        name: "Period close & lock",
        status: hasLockedClose ? "pass" : "warn",
        detail: hasLockedClose
          ? "At least one period locked."
          : "No periods locked yet.",
      },
    ];

    res.json({
      rolloutStage: settings.rolloutStage,
      gates,
      stages: ["pilot", "parallel", "cutover", "live"],
    });
  },
);

export default router;
