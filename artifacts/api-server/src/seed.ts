import {
  db,
  pool,
  usersTable,
  accountsTable,
  customersTable,
  vendorsTable,
  settingsTable,
  bankAccountsTable,
} from "@workspace/db";
import { hashPassword } from "./lib/auth";
import { logger } from "./lib/logger";

/**
 * Idempotent seed. Creates the named CCA users, a chart of accounts, company
 * settings, and a small amount of clearly-labeled TEST data (isTestData=true).
 * Real financial documents (invoices, bills, journal entries) are NOT seeded —
 * they must be created through the app so nothing shows as sent/paid/posted
 * unless it genuinely went through the workflow.
 */

const USERS = [
  { name: "Rose", username: "rose", role: "owner", password: "OwnerPass123" },
  {
    name: "Christin",
    username: "christin",
    role: "accounting_lead",
    password: "LeadPass123",
  },
  {
    name: "Carmen",
    username: "carmen",
    role: "systems_reviewer",
    password: "ReviewPass123",
  },
  {
    name: "Alex Tax",
    username: "accountant",
    role: "accountant",
    password: "AcctPass123",
  },
  {
    name: "Sam Member",
    username: "member",
    role: "team_member",
    password: "MemberPass123",
  },
  {
    name: "Integration Service",
    username: "integration",
    role: "integration_service",
    password: "IntegrationPass123",
  },
];

const ACCOUNTS = [
  { code: "1000", name: "Cash - Operating", type: "asset" },
  { code: "1010", name: "Cash - Savings", type: "asset" },
  { code: "1200", name: "Accounts Receivable", type: "asset" },
  { code: "1500", name: "Prepaid Expenses", type: "asset" },
  { code: "2000", name: "Accounts Payable", type: "liability" },
  { code: "2100", name: "Payroll Liabilities", type: "liability", sensitive: true },
  { code: "2200", name: "Sales Tax Payable", type: "liability" },
  { code: "3000", name: "Owner's Equity", type: "equity" },
  { code: "3900", name: "Retained Earnings", type: "equity" },
  { code: "4000", name: "Consulting Revenue", type: "revenue" },
  { code: "4100", name: "Product Revenue", type: "revenue" },
  { code: "5000", name: "Salaries & Wages", type: "expense", sensitive: true },
  { code: "5100", name: "Software & Subscriptions", type: "expense" },
  { code: "5200", name: "Office & Supplies", type: "expense" },
  { code: "5300", name: "Professional Fees", type: "expense" },
  { code: "5400", name: "Travel & Meals", type: "expense" },
];

async function seed(): Promise<void> {
  logger.info("Seeding LedgerOS...");

  const existingUsers = await db.select().from(usersTable);
  const byUsername = new Set(existingUsers.map((u) => u.username));
  for (const u of USERS) {
    if (byUsername.has(u.username)) continue;
    await db.insert(usersTable).values({
      name: u.name,
      username: u.username,
      role: u.role,
      passwordHash: hashPassword(u.password),
      active: true,
      isTestData: true,
    });
    logger.info(`  + user ${u.username} (${u.role})`);
  }

  const existingAccounts = await db.select().from(accountsTable);
  const byCode = new Set(existingAccounts.map((a) => a.code));
  for (const a of ACCOUNTS) {
    if (byCode.has(a.code)) continue;
    await db.insert(accountsTable).values({
      code: a.code,
      name: a.name,
      type: a.type,
      isSensitive: !!a.sensitive,
      isTestData: true,
    });
  }
  logger.info("  + chart of accounts");

  const existingSettings = await db.select().from(settingsTable);
  if (existingSettings.length === 0) {
    await db.insert(settingsTable).values({
      companyName: "CCA",
      legalName: "CCA LLC",
      baseCurrency: "USD",
      rolloutStage: "pilot",
    });
    logger.info("  + settings");
  }

  const existingCustomers = await db.select().from(customersTable);
  if (existingCustomers.length === 0) {
    await db.insert(customersTable).values([
      {
        name: "Acme Corp (TEST)",
        email: "ap@acme.example",
        company: "Acme Corp",
        isTestData: true,
      },
      {
        name: "Globex Inc (TEST)",
        email: "billing@globex.example",
        company: "Globex Inc",
        isTestData: true,
      },
    ]);
    logger.info("  + sample customers");
  }

  const existingVendors = await db.select().from(vendorsTable);
  if (existingVendors.length === 0) {
    await db.insert(vendorsTable).values([
      { name: "AWS (TEST)", category: "Software", isTestData: true },
      { name: "WeWork (TEST)", category: "Rent", isTestData: true },
      {
        name: "Payroll Provider (TEST)",
        category: "Payroll",
        isSensitive: true,
        isTestData: true,
      },
    ]);
    logger.info("  + sample vendors");
  }

  const existingBanks = await db.select().from(bankAccountsTable);
  if (existingBanks.length === 0) {
    await db.insert(bankAccountsTable).values([
      {
        label: "Operating Checking (TEST)",
        institution: "First National (Test)",
        maskedNumber: "****1234",
        connectionMethod: "manual",
        accountType: "checking",
        balance: 0,
        isTestData: true,
      },
    ]);
    logger.info("  + sample bank account");
  }

  logger.info("Seed complete.");
}

seed()
  .then(() => pool.end())
  .then(() => process.exit(0))
  .catch((err) => {
    logger.error(err, "Seed failed");
    return pool.end().finally(() => process.exit(1));
  });
