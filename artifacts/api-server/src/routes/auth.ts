import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import { db, usersTable } from "@workspace/db";
import { LoginBody } from "@workspace/api-zod";
import {
  verifyPassword,
  permissionsForRole,
  requireAuth,
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

router.post("/auth/login", async (req, res): Promise<void> => {
  const parsed = LoginBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const { username, password } = parsed.data;
  const [user] = await db
    .select()
    .from(usersTable)
    .where(eq(usersTable.username, username));

  if (!user || !user.active || !verifyPassword(password, user.passwordHash)) {
    req.log.warn({ username }, "Failed login attempt");
    res.status(401).json({ error: "Invalid username or password" });
    return;
  }

  req.session.userId = user.id;
  req.currentUser = user;
  await recordAudit(req, {
    action: "login",
    recordType: "session",
    recordId: user.id,
  });

  res.json({
    authenticated: true,
    user: toUser(user),
    permissions: permissionsForRole(user.role),
  });
});

router.post("/auth/logout", requireAuth, async (req, res): Promise<void> => {
  await recordAudit(req, {
    action: "logout",
    recordType: "session",
    recordId: req.currentUser?.id ?? null,
  });
  req.session.destroy(() => {
    res.clearCookie("ledgeros.sid");
    res.json({ ok: true });
  });
});

router.get("/auth/me", async (req, res): Promise<void> => {
  if (!req.currentUser) {
    res.json({ authenticated: false, user: null, permissions: [] });
    return;
  }
  res.json({
    authenticated: true,
    user: toUser(req.currentUser),
    permissions: permissionsForRole(req.currentUser.role),
  });
});

export default router;
