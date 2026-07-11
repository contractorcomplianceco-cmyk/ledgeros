# LedgerOS

Double-entry accounting system for CCA — an in-house replacement for Zoho Books. Full-stack web app with persistent Postgres, server-side role-based access control, approval gates, and audit logging on every mutation.

## Run & Operate

- `pnpm --filter @workspace/api-server run dev` — run the API server (binds to `PORT`, proxied at `/api`)
- `pnpm --filter @workspace/ledgeros run dev` — run the LedgerOS web app (served at `/`)
- `pnpm --filter @workspace/api-server run seed` — seed roles/users, chart of accounts, settings, sample master data (idempotent)
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from the OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- Required env: `DATABASE_URL` — Postgres connection string; `SESSION_SECRET` — session signing secret

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- API: Express 5, session-cookie auth (`express-session` + `connect-pg-simple`)
- Web: React + Vite + wouter, TanStack Query, generated Orval hooks
- DB: PostgreSQL + Drizzle ORM
- Validation: Zod (`zod/v4`), `drizzle-zod`
- API codegen: Orval (from OpenAPI spec)
- Build: esbuild (CJS bundle)

## Where things live

- API routes: `artifacts/api-server/src/routes/*.ts` (mounted in `routes/index.ts`)
- RBAC source of truth: `artifacts/api-server/src/lib/auth.ts` (`Permission` union, `ROLES` array, `requirePermission`, `can`)
- Audit logging: `artifacts/api-server/src/lib/audit.ts` (`recordAudit`)
- Ledger math: `artifacts/api-server/src/lib/ledger.ts`; period locking: `src/lib/periods.ts`
- Seed: `artifacts/api-server/src/seed.ts`
- Web pages: `artifacts/ledgeros/src/pages/*.tsx`; nav + route guards: `src/components/layout/app-shell.tsx`, `src/App.tsx`
- DB schema (source of truth): `lib/db/src/schema/*.ts`
- API contract (codegen source): `lib/api-spec/openapi.yaml`

## Architecture decisions

- **Money is stored as `double precision` dollars; dates as `date` (string mode). Account balances are computed from posted ledger lines, never stored.**
- **Posted journal entries are immutable** — corrections are made via reversing entries, not edits. Entries in locked periods are read-only.
- **Every mutation writes an audit record** (actor, action, record type/id, before/after) via `recordAudit`.
- **RBAC is enforced server-side** on every route via `requirePermission`; the web UI mirrors it (nav filtered by permission, routes render an "Access restricted" page) but the server is authoritative.
- **Sensitive data (e.g. payroll) is restricted by default** — routes reject unauthorized roles rather than silently returning empty data.
- **The session table (`user_sessions`) is created via raw SQL**, not `connect-pg-simple`'s `createTableIfMissing`, because the esbuild server bundle does not include the package's `table.sql`.

## Product

Six roles: Owner (Rose), Accounting Lead (Christin), Systems Reviewer (Carmen, read-only), Accountant (Alex), Team Member (Sam, minimal), and an Integration Service account. Capabilities include chart of accounts, customers/vendors, invoices (AR), bills (AP), expenses, payments, banking + reconciliation, manual journal entries with a general ledger view, payroll (sensitive), monthly close with period locking, an integration inbox, approvals, an audit log, a read-only Command Center overview, and a production-readiness checklist.

## Known limitations

- **Payments and invoices/bills do NOT auto-post journal entries.** Journal entries are created manually. This is intentional and honest — there is no hidden automatic bookkeeping.
- **Integration inbox events never auto-post.** They stay `new` until a human accepts or dismisses them.
- **Reports are a subset** of a full accounting suite (not every statement/period combination exists yet).
- **No MFA enforcement.** The user model has an `mfaEnabled` flag but MFA is not implemented.
- **Seed/test data is labeled** (`isTestData = true`) and includes known passwords for the six named users — rotate before any real production use.

## User preferences

_Populate as you build — explicit user instructions worth remembering across sessions._

## Gotchas

- Do NOT run `pnpm dev` at the workspace root. Use per-artifact workflows.
- Verify artifacts with `pnpm --filter @workspace/<slug> run typecheck`, not `build` (build needs workflow-provided `PORT`/`BASE_PATH`).
- After editing the OpenAPI spec, run codegen before typechecking clients.
- If you recreate the DB, re-run the session-table SQL (see `src/app.ts` comment) or sessions will silently fail to persist.

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
