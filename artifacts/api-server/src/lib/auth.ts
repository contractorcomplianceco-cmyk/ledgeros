import { randomBytes, scryptSync, timingSafeEqual } from "node:crypto";
import type { Request, Response, NextFunction } from "express";
import { eq } from "drizzle-orm";
import { db, usersTable, type UserRow } from "@workspace/db";

export type Permission =
  | "dashboard.view"
  | "accounts.view"
  | "accounts.manage"
  | "customers.view"
  | "customers.manage"
  | "vendors.view"
  | "vendors.manage"
  | "invoices.view"
  | "invoices.manage"
  | "invoices.approve"
  | "bills.view"
  | "bills.manage"
  | "bills.approve"
  | "expenses.view"
  | "expenses.submit"
  | "expenses.approve"
  | "payments.view"
  | "payments.record"
  | "banking.view"
  | "banking.manage"
  | "banking.review"
  | "reconciliation.view"
  | "reconciliation.manage"
  | "reconciliation.approve"
  | "ledger.view"
  | "journal.view"
  | "journal.manage"
  | "journal.approve"
  | "payroll.view"
  | "payroll.manage"
  | "payroll.approve"
  | "close.view"
  | "close.manage"
  | "close.lock"
  | "integrations.view"
  | "integrations.manage"
  | "integrations.ingest"
  | "mappings.view"
  | "mappings.manage"
  | "approvals.view"
  | "audit.view"
  | "reports.view"
  | "commandcenter.view"
  | "users.view"
  | "users.manage"
  | "settings.view"
  | "settings.manage"
  | "readiness.view"
  | "sensitive.view";

export interface RoleDef {
  key: string;
  name: string;
  description: string;
  permissions: Permission[];
}

const ALL_PERMISSIONS: Permission[] = [
  "dashboard.view",
  "accounts.view",
  "accounts.manage",
  "customers.view",
  "customers.manage",
  "vendors.view",
  "vendors.manage",
  "invoices.view",
  "invoices.manage",
  "invoices.approve",
  "bills.view",
  "bills.manage",
  "bills.approve",
  "expenses.view",
  "expenses.submit",
  "expenses.approve",
  "payments.view",
  "payments.record",
  "banking.view",
  "banking.manage",
  "banking.review",
  "reconciliation.view",
  "reconciliation.manage",
  "reconciliation.approve",
  "ledger.view",
  "journal.view",
  "journal.manage",
  "journal.approve",
  "payroll.view",
  "payroll.manage",
  "payroll.approve",
  "close.view",
  "close.manage",
  "close.lock",
  "integrations.view",
  "integrations.manage",
  "integrations.ingest",
  "mappings.view",
  "mappings.manage",
  "approvals.view",
  "audit.view",
  "reports.view",
  "commandcenter.view",
  "users.view",
  "users.manage",
  "settings.view",
  "settings.manage",
  "readiness.view",
  "sensitive.view",
];

export const ROLES: RoleDef[] = [
  {
    key: "owner",
    name: "Owner",
    description:
      "Full control of the accounting system and final approval authority.",
    permissions: [...ALL_PERMISSIONS],
  },
  {
    key: "accounting_lead",
    name: "Accounting Lead",
    description:
      "Runs day-to-day operations and approves most accounting activity.",
    permissions: ALL_PERMISSIONS.filter(
      (p) => p !== "users.manage" && p !== "settings.manage",
    ),
  },
  {
    key: "systems_reviewer",
    name: "Systems Reviewer",
    description:
      "Read-only oversight of controls, audit trail, and production readiness.",
    permissions: [
      "dashboard.view",
      "accounts.view",
      "customers.view",
      "vendors.view",
      "invoices.view",
      "bills.view",
      "expenses.view",
      "payments.view",
      "banking.view",
      "reconciliation.view",
      "ledger.view",
      "journal.view",
      "payroll.view",
      "close.view",
      "integrations.view",
      "mappings.view",
      "approvals.view",
      "audit.view",
      "reports.view",
      "commandcenter.view",
      "users.view",
      "settings.view",
      "readiness.view",
    ],
  },
  {
    key: "accountant",
    name: "Accountant / Tax Advisor",
    description:
      "External accountant with read access to the books and the ability to draft adjusting entries.",
    permissions: [
      "dashboard.view",
      "accounts.view",
      "customers.view",
      "vendors.view",
      "invoices.view",
      "bills.view",
      "expenses.view",
      "payments.view",
      "banking.view",
      "reconciliation.view",
      "ledger.view",
      "journal.view",
      "journal.manage",
      "payroll.view",
      "close.view",
      "reports.view",
      "sensitive.view",
    ],
  },
  {
    key: "team_member",
    name: "Team Member",
    description: "Submits expenses and tracks their own reimbursements.",
    permissions: ["expenses.submit", "expenses.view"],
  },
  {
    key: "integration_service",
    name: "Integration Service",
    description:
      "Automated service account that ingests events from connected apps into the inbox.",
    permissions: ["integrations.view", "integrations.ingest"],
  },
];

const ROLE_MAP = new Map(ROLES.map((r) => [r.key, r]));

export function permissionsForRole(role: string): Permission[] {
  return ROLE_MAP.get(role)?.permissions ?? [];
}

export function roleHasPermission(role: string, perm: Permission): boolean {
  return permissionsForRole(role).includes(perm);
}

export function hashPassword(password: string): string {
  const salt = randomBytes(16).toString("hex");
  const derived = scryptSync(password, salt, 64).toString("hex");
  return `${salt}:${derived}`;
}

export function verifyPassword(password: string, stored: string): boolean {
  const [salt, key] = stored.split(":");
  if (!salt || !key) return false;
  const derived = scryptSync(password, salt, 64);
  const keyBuf = Buffer.from(key, "hex");
  if (keyBuf.length !== derived.length) return false;
  return timingSafeEqual(keyBuf, derived);
}

declare module "express-session" {
  interface SessionData {
    userId?: number;
  }
}

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      currentUser?: UserRow;
    }
  }
}

export async function loadUser(req: Request): Promise<UserRow | undefined> {
  const userId = req.session?.userId;
  if (!userId) return undefined;
  const [user] = await db
    .select()
    .from(usersTable)
    .where(eq(usersTable.id, userId));
  if (!user || !user.active) return undefined;
  return user;
}

export async function attachUser(
  req: Request,
  _res: Response,
  next: NextFunction,
): Promise<void> {
  req.currentUser = await loadUser(req);
  next();
}

export function requireAuth(
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  if (!req.currentUser) {
    res.status(401).json({ error: "Not authenticated" });
    return;
  }
  next();
}

export function requirePermission(perm: Permission) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.currentUser) {
      res.status(401).json({ error: "Not authenticated" });
      return;
    }
    if (!roleHasPermission(req.currentUser.role, perm)) {
      res.status(403).json({
        error: `Your role (${req.currentUser.role}) is not permitted to perform this action.`,
      });
      return;
    }
    next();
  };
}

export function can(req: Request, perm: Permission): boolean {
  return !!req.currentUser && roleHasPermission(req.currentUser.role, perm);
}
