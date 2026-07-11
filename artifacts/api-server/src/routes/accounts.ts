import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import { db, accountsTable } from "@workspace/db";
import {
  CreateAccountBody,
  UpdateAccountBody,
  UpdateAccountParams,
} from "@workspace/api-zod";
import { requirePermission, can } from "../lib/auth";
import { recordAudit } from "../lib/audit";
import { postedBalancesByAccount } from "../lib/ledger";

const router: IRouter = Router();

router.get(
  "/accounts",
  requirePermission("accounts.view"),
  async (req, res): Promise<void> => {
    const rows = await db.select().from(accountsTable);
    const balances = await postedBalancesByAccount();
    const showSensitive = can(req, "sensitive.view");
    const result = rows
      .filter((a) => showSensitive || !a.isSensitive)
      .map((a) => ({ ...a, balance: balances.get(a.id) ?? 0 }))
      .sort((a, b) => a.code.localeCompare(b.code));
    res.json(result);
  },
);

router.post(
  "/accounts",
  requirePermission("accounts.manage"),
  async (req, res): Promise<void> => {
    const parsed = CreateAccountBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.message });
      return;
    }
    const [account] = await db
      .insert(accountsTable)
      .values({
        code: parsed.data.code,
        name: parsed.data.name,
        type: parsed.data.type,
        subtype: parsed.data.subtype ?? null,
        description: parsed.data.description ?? null,
        isSensitive: parsed.data.isSensitive ?? false,
      })
      .returning();
    await recordAudit(req, {
      action: "create",
      recordType: "account",
      recordId: account.id,
      after: account,
    });
    res.status(201).json({ ...account, balance: 0 });
  },
);

router.patch(
  "/accounts/:id",
  requirePermission("accounts.manage"),
  async (req, res): Promise<void> => {
    const params = UpdateAccountParams.safeParse(req.params);
    if (!params.success) {
      res.status(400).json({ error: params.error.message });
      return;
    }
    const parsed = UpdateAccountBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.message });
      return;
    }
    const [before] = await db
      .select()
      .from(accountsTable)
      .where(eq(accountsTable.id, params.data.id));
    if (!before) {
      res.status(404).json({ error: "Account not found" });
      return;
    }
    const [account] = await db
      .update(accountsTable)
      .set(parsed.data)
      .where(eq(accountsTable.id, params.data.id))
      .returning();
    await recordAudit(req, {
      action: "update",
      recordType: "account",
      recordId: account.id,
      before,
      after: account,
    });
    const balances = await postedBalancesByAccount();
    res.json({ ...account, balance: balances.get(account.id) ?? 0 });
  },
);

export default router;
