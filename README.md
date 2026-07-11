# LedgerOS

Double-entry accounting system for CCA — an in-house replacement for Zoho Books.

LedgerOS is a full-stack web application with a persistent PostgreSQL ledger,
server-side role-based access control, approval gates, and an immutable audit
trail on every mutation. It is built with correctness and accountability first:
posted entries cannot be edited, closed periods are read-only, and sensitive
data is restricted by default.

## Architecture

- **Web app** (`artifacts/ledgeros`) — React + Vite + wouter, TanStack Query,
  UI generated against the OpenAPI contract. Served at `/`.
- **API server** (`artifacts/api-server`) — Express 5 with session-cookie auth,
  Zod-validated inputs/outputs, Drizzle ORM. Proxied at `/api`.
- **Shared libraries** (`lib/*`) — DB schema (`@workspace/db`), OpenAPI spec
  (`@workspace/api-spec`), and generated clients/schemas.

## Getting started

```bash
# 1. Ensure DATABASE_URL and SESSION_SECRET are set
# 2. Push the schema (dev)
pnpm --filter @workspace/db run push
# 3. Seed roles, users, chart of accounts, and sample data (idempotent)
pnpm --filter @workspace/api-server run seed
# 4. The API server and web app run as Replit workflows
```

## Roles

| Role | User | Access |
| --- | --- | --- |
| Owner | Rose | Full access |
| Accounting Lead | Christin | Manage all accounting, approvals |
| Systems Reviewer | Carmen | Read-only oversight |
| Accountant | Alex | Day-to-day bookkeeping |
| Team Member | Sam | Minimal (submit expenses) |
| Integration Service | — | Ingest integration events only |

Access is enforced **server-side** on every route. The UI mirrors permissions
(navigation is filtered and restricted routes show an "Access restricted" page),
but the server is always authoritative.

## Core guarantees

- **Balanced journal entries** — an entry is rejected unless debits equal credits.
- **Immutable posted entries** — corrections are made via reversing entries only.
- **Locked periods are read-only** — once a period is closed, its entries cannot change.
- **Audit logging** — every mutation records actor, action, and before/after state.
- **No fake success** — operations fail loudly rather than pretending to succeed.
- **Restrictive sensitive-data defaults** — e.g. payroll is denied to unauthorized roles.
- **Read-only Command Center** — a safe overview that never exposes sensitive data.

## Known limitations

- **Payments, invoices, and bills do NOT auto-post journal entries.** Journal
  entries are created manually — there is no hidden automatic bookkeeping.
- **Integration inbox events never auto-post.** They stay `new` until a human
  accepts or dismisses them.
- **Reports are a subset** of a full accounting suite.
- **No MFA enforcement.** The user model has an `mfaEnabled` flag, but MFA is not
  implemented.
- **Seed/test data is labeled** (`isTestData = true`) and the six named users have
  known default passwords. Rotate credentials before any real production use.

## Development

- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate hooks/schemas from the OpenAPI spec

See `replit.md` for the detailed repo map, architecture decisions, and gotchas.
