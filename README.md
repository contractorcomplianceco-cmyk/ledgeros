# LedgerOS

## Overview

LedgerOS is Contractor Compliance Authority's (CCA) custom, production‑intent
double‑entry accounting platform. It is designed to eventually **replace Zoho
Books** after a validated data migration, a parallel run against the existing
books, balance reconciliation, and a formal cutover approval.

It is built correctness‑ and accountability‑first: a persistent PostgreSQL
ledger, server‑side role‑based access control, approval gates, and an immutable
audit trail on every mutation. Posted entries cannot be edited, closed periods
are read‑only, and sensitive data is restricted by default.

## Current Status

- The application is **built and tested** end‑to‑end.
- Core accounting workflows work: authentication, RBAC, journal entries with
  balancing enforcement, period locking, reversals, and audit logging.
- It is **ready for internal review** by CCA.
- It is **not** automatically approved as the final accounting system of record.
- **Zoho Books migration and cutover must be separately validated** (migration,
  parallel run, reconciliation, and sign‑off) before LedgerOS becomes
  authoritative.

## Core Features

- Authentication (username/password, hashed credentials)
- Session‑cookie persistence (Postgres‑backed sessions)
- Server‑side role‑based access control (authoritative on every route)
- Six user roles (see below)
- Double‑entry journal entries with debit/credit balancing enforcement
- Locked accounting periods (monthly close makes prior periods read‑only)
- Reversal workflows (posted entries are corrected via reversing entries)
- Chart of accounts
- Banking transaction review
- Reconciliation
- Customers and vendors
- Invoices (AR)
- Payments
- Bills (AP)
- Expenses
- Payroll summaries (sensitive; restricted by default)
- Reports (a subset of a full accounting suite — see Known Limitations)
- Monthly close with period locking
- Integration inbox (events stay `new` until a human accepts/dismisses them)
- Command Center overview feed (read‑only)
- Audit logging on every mutation, plus login and logout
- Zoho Books migration support (import‑oriented; cutover is a separate process)

## Roles

| Role | Seed user | Access summary |
| --- | --- | --- |
| Owner | Rose | Full access |
| Accounting Lead | Christin | Manage all accounting, approvals |
| Systems Reviewer | Carmen | Read‑only oversight (cannot mutate) |
| Accountant / Tax Advisor | Alex | Day‑to‑day bookkeeping |
| Team Member | Sam | Minimal (e.g. submit expenses); no accounts/payroll |
| Integration Service | — | Ingest integration events only |

Access is enforced **server‑side** on every route via `requirePermission`. The
web UI mirrors permissions (navigation is filtered, and restricted routes render
an "Access restricted" page), but the server is always authoritative. Sensitive
data such as payroll is denied to unauthorized roles rather than silently
returning empty results.

## Architecture

- **pnpm monorepo** (pnpm workspaces).
- **Express API server** (`artifacts/api-server`) — Express 5, session‑cookie
  auth (`express-session` + `connect-pg-simple`), Zod‑validated inputs/outputs,
  Drizzle ORM. Served under **`/api`**.
- **React frontend** (`artifacts/ledgeros`) — React + Vite + wouter, TanStack
  Query, and Orval‑generated API hooks. Served at **`/`**.
- **PostgreSQL** — persistent ledger; account balances are computed from posted
  ledger lines, never stored.
- **Shared types/schemas** (`lib/*`) — DB schema (`@workspace/db`), OpenAPI spec
  (`@workspace/api-spec`), generated Zod schemas and React Query clients.
- **Session authentication** — Postgres‑backed session store (`user_sessions`).
- **Server‑side authorization** — a single RBAC source of truth in
  `artifacts/api-server/src/lib/auth.ts`.

## Repository Structure

```
.
├── artifacts/
│   ├── api-server/      # Express API (routes, RBAC, ledger math, audit, seed)
│   ├── ledgeros/        # React + Vite web app (pages, components, hooks)
│   └── mockup-sandbox/  # Component preview sandbox (dev tooling only)
├── lib/
│   ├── db/              # Drizzle schema (source of truth); applied via push
│   ├── api-spec/        # OpenAPI spec (codegen source)
│   ├── api-zod/         # Generated Zod schemas
│   └── api-client-react/# Generated React Query hooks + fetch client
├── scripts/             # Shared workspace scripts
├── .env.example         # Documented environment variables
├── pnpm-workspace.yaml  # Workspace + catalog definitions
├── replit.md            # Detailed repo map, decisions, and gotchas
└── README.md
```

## Requirements

- **Node.js 24+**
- **pnpm 9+** (the repo enforces pnpm via a `preinstall` guard)
- **PostgreSQL 14+**

## Local Installation

```bash
# 1. Install dependencies (from the repo root)
pnpm install

# 2. Configure environment
cp .env.example .env
#    then set DATABASE_URL and SESSION_SECRET

# 3. Create the database schema (dev)
pnpm --filter @workspace/db run push

# 4. Seed roles, users, chart of accounts, and labeled sample data (idempotent)
pnpm --filter @workspace/api-server run seed
```

> **Session table note:** the `user_sessions` table is created out‑of‑band via
> raw SQL (not by `connect-pg-simple`), because the bundled server does not ship
> the package's `table.sql`. If you recreate the database, re‑run that SQL — see
> the comment in `artifacts/api-server/src/app.ts` and `replit.md` "Gotchas".

## Environment Variables

See `.env.example` for the authoritative, documented list. Summary:

| Variable | Required | Purpose |
| --- | --- | --- |
| `DATABASE_URL` | Yes | Postgres connection string. |
| `SESSION_SECRET` | Yes (prod) | Signs session cookies. **The server refuses to start in production without it.** A temporary insecure fallback is used in development (with a warning). |
| `NODE_ENV` | No | `development` (default) or `production`. Production enables secure cookies and enforces `SESSION_SECRET`. |
| `PORT` | No | API server port. Provided automatically by the Replit workflow. |
| `LOG_LEVEL` | No | pino log level (default `info`). |
| `BASE_PATH` | No | Base path the web app is served under (default `/`). Provided by the web workflow at build time. |

The Zoho / ADP / Navy Federal / SMTP / external Command Center integrations are
**not yet implemented** and require **no** environment variables today. Add them
here only when those integrations are actually built.

## Database Setup

- **Schema source of truth:** `lib/db/src/schema/*.ts` (Drizzle). The full
  schema is defined in code and committed to the repository.
- **Apply schema:** `pnpm --filter @workspace/db run push` (uses
  `drizzle-kit push` to reconcile a Postgres database to the committed schema).
  Running this against a fresh Postgres instance — on Replit or anywhere else —
  recreates the entire structure, so the database is fully reproducible from
  committed code.
- **Note — no versioned migration files yet.** The project currently uses
  `drizzle-kit push` (schema‑diff) rather than incremental, checked‑in migration
  files. This is reproducible for a fresh database but does not provide an
  ordered migration history. Generating versioned migrations
  (`drizzle-kit generate`) is a recommended production‑readiness item before
  running LedgerOS as the system of record.
- **Session table:** created out‑of‑band via raw SQL (see the Session table note
  above); re‑run it if you recreate the database.
- **Seed (development only):** `pnpm --filter @workspace/api-server run seed`.
  All seeded records are labeled `isTestData = true` and use known test
  passwords — see Security Notes.

No production financial records, real bank transactions, real payroll data, real
customer financial data, or real bank account numbers are committed to this
repository.

## Development

The API server and web app run as separate processes:

```bash
# API server (builds then starts; binds to PORT, served under /api)
pnpm --filter @workspace/api-server run dev

# Web app (Vite dev server, served at /)
pnpm --filter @workspace/ledgeros run dev
```

On Replit these run as workflows automatically. Do **not** run `pnpm dev` at the
workspace root.

## Production Build

```bash
# Typecheck everything, then build all packages
pnpm run build

# Or build individually:
pnpm --filter @workspace/api-server run build   # esbuild CJS bundle -> dist/
pnpm --filter @workspace/ledgeros run build     # Vite build -> dist/public/
```

The API server is a long‑running Node process (`node dist/index.mjs`). The web
app builds to static assets that can be served by any static host or fronted by
the API/proxy.

## Testing

```bash
pnpm run typecheck   # full TypeScript typecheck across all workspaces
```

End‑to‑end verification is performed against the running API (authentication,
RBAC, sensitive‑data denial, journal balancing, reversal dating, and locked
periods). There is not yet an automated unit/integration test suite committed;
adding one is a recommended production‑readiness item.

## Security Notes

- **`SESSION_SECRET` is required in production.** The server throws on startup in
  production if it is missing, rather than falling back to an insecure default.
- **Seed users use known test passwords** (e.g. `OwnerPass123`). These are for
  development only and are labeled `isTestData = true`.
- **Rotate or remove seed users before any production use.** Production seeding
  should be disabled and real credentials issued.
- **Sensitive data is restricted by default** — payroll and other sensitive
  routes deny unauthorized roles (403) rather than returning empty data.
- **No secrets are committed** to this repository (verified). Credentials are
  provided via environment variables only; `.env` is git‑ignored.
- **No MFA enforcement yet.** The user model has an `mfaEnabled` flag but MFA is
  not implemented.

## Known Limitations

- **Payments, invoices, and bills do NOT auto‑post journal entries.** Journal
  entries are created manually — there is no hidden automatic bookkeeping.
- **Integration inbox events never auto‑post.** They stay `new` until a human
  accepts or dismisses them.
- **Reports are a subset** of a full accounting suite (not every statement /
  period combination exists yet).
- **MFA is not yet enforced.**
- **Seed users use known test passwords** and must be rotated/removed for
  production.
- **External bank sync relies on import workflows**, not a live bank connection.
- **Replacing Zoho Books requires a validated migration and parallel run** before
  LedgerOS can be the system of record.

## Lovable Import Notes

- **Frontend directory:** `artifacts/ledgeros` (React + Vite; entry
  `src/main.tsx`, built to `dist/public/`).
- **API directory:** `artifacts/api-server` (Express; entry `src/index.ts`,
  bundled to `dist/index.mjs`). API routes live under **`/api`**.
- **Frontend and backend are cleanly separated** — they are distinct workspace
  packages and do not import from each other; shared code lives in `lib/*`.
- **Commands Lovable should use:**
  - Install: `pnpm install`
  - Typecheck: `pnpm run typecheck`
  - Build web: `pnpm --filter @workspace/ledgeros run build`
  - Build API: `pnpm --filter @workspace/api-server run build`
- **Required environment variables:** `DATABASE_URL`, `SESSION_SECRET` (see
  `.env.example`).
- **API base URL is configurable** — the web client uses relative URLs and the
  app's base path (`import.meta.env.BASE_URL`); there are no hardcoded
  Replit‑preview or localhost production URLs.
- **Backend hosting:** the API is a stateful Express server with a Postgres
  session store and must be **deployed as a running Node service** (Lovable
  should not attempt to convert it into a frontend‑only app). The React frontend
  can be hosted separately as static assets and pointed at the API.
- **Routing/proxy:** in production the frontend and API are served through a
  path‑based proxy — everything under `/api` goes to the API server, everything
  else to the web app. Direct page refreshes are supported (SPA fallback).

> Lovable must **not** replace or bypass server‑side RBAC, session security,
> audit logging, accounting validation, database transactions, locked‑period
> enforcement, or journal‑balancing rules. The frontend may be redesigned, but
> the backend accounting controls remain authoritative.

## Deployment

- **Replit:** the app runs as workflows (API server + web) and can be published
  via Replit Deployments. `DATABASE_URL` and `SESSION_SECRET` are provided as
  managed secrets.
- **Elsewhere:** run the API server as a Node service with `DATABASE_URL` and
  `SESSION_SECRET` set and `NODE_ENV=production`; serve the built web assets from
  any static host or behind the same proxy. Postgres migrations run outside
  Replit against any Postgres instance.

## Production Checklist

- [ ] Rotate seed passwords
- [ ] Remove or disable development/seed users
- [ ] Configure a strong production `SESSION_SECRET`
- [ ] Configure production `DATABASE_URL`
- [ ] Configure secure cookies (`NODE_ENV=production`)
- [ ] Configure trusted CORS origins
- [ ] Enable MFA when available
- [ ] Review sensitive‑data permissions
- [ ] Validate the Zoho Books migration
- [ ] Complete a parallel run against the existing books
- [ ] Reconcile balances
- [ ] Approve cutover

## License

This repository is **private and proprietary to Contractor Compliance
Authority**. No open‑source license is granted. All rights reserved.
