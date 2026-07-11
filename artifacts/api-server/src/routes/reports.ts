import { Router, type IRouter } from "express";
import {
  db,
  accountsTable,
  invoicesTable,
  billsTable,
} from "@workspace/db";
import { GetReportParams } from "@workspace/api-zod";
import { requirePermission, can } from "../lib/auth";
import { round2, todayISO } from "../lib/helpers";
import { postedBalancesByAccount } from "../lib/ledger";

const router: IRouter = Router();

type Row = {
  label: string;
  value: number;
  group?: string | null;
  detail?: string | null;
};

function agingBuckets(
  items: { due: string | null; open: number }[],
): Row[] {
  const today = todayISO();
  const buckets = { current: 0, d30: 0, d60: 0, d90: 0 };
  for (const it of items) {
    if (it.open <= 0.005) continue;
    if (!it.due || it.due >= today) buckets.current += it.open;
    else {
      const days =
        (new Date(today).getTime() - new Date(it.due).getTime()) /
        86400000;
      if (days <= 30) buckets.d30 += it.open;
      else if (days <= 60) buckets.d60 += it.open;
      else buckets.d90 += it.open;
    }
  }
  return [
    { label: "Current", value: round2(buckets.current) },
    { label: "1–30 days", value: round2(buckets.d30) },
    { label: "31–60 days", value: round2(buckets.d60) },
    { label: "60+ days", value: round2(buckets.d90) },
  ];
}

router.get(
  "/reports/:type",
  requirePermission("reports.view"),
  async (req, res): Promise<void> => {
    const params = GetReportParams.safeParse(req.params);
    if (!params.success) {
      res.status(400).json({ error: params.error.message });
      return;
    }
    const type = params.data.type;
    const generatedAt = new Date().toISOString();
    const showSensitive = can(req, "sensitive.view");

    const accounts = (await db.select().from(accountsTable)).filter(
      (a) => showSensitive || !a.isSensitive,
    );
    const balances = await postedBalancesByAccount();

    if (type === "trial-balance") {
      const rows: Row[] = accounts
        .map((a) => ({
          label: `${a.code} ${a.name}`,
          value: round2(balances.get(a.id) ?? 0),
          group: a.type,
        }))
        .filter((r) => Math.abs(r.value) > 0.005);
      const debits = round2(
        rows.filter((r) => r.value > 0).reduce((s, r) => s + r.value, 0),
      );
      const credits = round2(
        rows.filter((r) => r.value < 0).reduce((s, r) => s + -r.value, 0),
      );
      res.json({
        type,
        title: "Trial Balance",
        generatedAt,
        columns: ["Account", "Balance"],
        rows,
        totals: [
          { label: "Total Debits", value: debits },
          { label: "Total Credits", value: credits },
        ],
      });
      return;
    }

    if (type === "profit-loss" || type === "income-statement") {
      // Revenue accounts carry credit (negative debit-credit) balances.
      const revenue = accounts.filter((a) => a.type === "revenue");
      const expense = accounts.filter((a) => a.type === "expense");
      const revRows = revenue.map((a) => ({
        label: a.name,
        value: round2(-(balances.get(a.id) ?? 0)),
        group: "Revenue",
      }));
      const expRows = expense.map((a) => ({
        label: a.name,
        value: round2(balances.get(a.id) ?? 0),
        group: "Expenses",
      }));
      const totalRev = round2(revRows.reduce((s, r) => s + r.value, 0));
      const totalExp = round2(expRows.reduce((s, r) => s + r.value, 0));
      res.json({
        type: "profit-loss",
        title: "Profit & Loss",
        generatedAt,
        columns: ["Account", "Amount"],
        rows: [...revRows, ...expRows],
        totals: [
          { label: "Total Revenue", value: totalRev },
          { label: "Total Expenses", value: totalExp },
          { label: "Net Income", value: round2(totalRev - totalExp) },
        ],
      });
      return;
    }

    if (type === "balance-sheet") {
      const asset = accounts.filter((a) => a.type === "asset");
      const liability = accounts.filter((a) => a.type === "liability");
      const equity = accounts.filter((a) => a.type === "equity");
      const rows: Row[] = [
        ...asset.map((a) => ({
          label: a.name,
          value: round2(balances.get(a.id) ?? 0),
          group: "Assets",
        })),
        ...liability.map((a) => ({
          label: a.name,
          value: round2(-(balances.get(a.id) ?? 0)),
          group: "Liabilities",
        })),
        ...equity.map((a) => ({
          label: a.name,
          value: round2(-(balances.get(a.id) ?? 0)),
          group: "Equity",
        })),
      ];
      const totalAssets = round2(
        rows.filter((r) => r.group === "Assets").reduce((s, r) => s + r.value, 0),
      );
      const totalLiab = round2(
        rows
          .filter((r) => r.group === "Liabilities")
          .reduce((s, r) => s + r.value, 0),
      );
      const totalEq = round2(
        rows.filter((r) => r.group === "Equity").reduce((s, r) => s + r.value, 0),
      );
      res.json({
        type,
        title: "Balance Sheet",
        generatedAt,
        columns: ["Account", "Amount"],
        rows,
        totals: [
          { label: "Total Assets", value: totalAssets },
          { label: "Total Liabilities", value: totalLiab },
          { label: "Total Equity", value: totalEq },
          { label: "Liabilities + Equity", value: round2(totalLiab + totalEq) },
        ],
      });
      return;
    }

    if (type === "ar-aging") {
      const invoices = (await db.select().from(invoicesTable)).filter(
        (i) => i.status !== "draft" && i.status !== "void",
      );
      const rows = agingBuckets(
        invoices.map((i) => ({
          due: i.dueDate,
          open: (i.total ?? 0) - (i.amountPaid ?? 0),
        })),
      );
      res.json({
        type,
        title: "A/R Aging",
        generatedAt,
        columns: ["Bucket", "Amount"],
        rows,
        totals: [
          {
            label: "Total Outstanding",
            value: round2(rows.reduce((s, r) => s + r.value, 0)),
          },
        ],
      });
      return;
    }

    if (type === "ap-aging") {
      const bills = (await db.select().from(billsTable)).filter(
        (b) =>
          b.status !== "draft" &&
          b.status !== "void" &&
          (showSensitive || !b.isSensitive),
      );
      const rows = agingBuckets(
        bills.map((b) => ({
          due: b.dueDate,
          open: (b.total ?? 0) - (b.amountPaid ?? 0),
        })),
      );
      res.json({
        type,
        title: "A/P Aging",
        generatedAt,
        columns: ["Bucket", "Amount"],
        rows,
        totals: [
          {
            label: "Total Payable",
            value: round2(rows.reduce((s, r) => s + r.value, 0)),
          },
        ],
      });
      return;
    }

    res.status(400).json({
      error: `Unknown report type "${type}". Supported: trial-balance, profit-loss, balance-sheet, ar-aging, ap-aging.`,
    });
  },
);

export default router;
