---
name: connect-pg-simple sessions with esbuild bundles
description: Why session persistence silently fails when connect-pg-simple runs from an esbuild bundle, and the fix.
---

# connect-pg-simple + esbuild: sessions silently fail

`connect-pg-simple`'s `createTableIfMissing: true` reads a `table.sql` file
relative to the package at runtime. When the server is bundled with esbuild,
that SQL file is NOT included in the bundle, so the read throws
`ENOENT ... dist/table.sql`. The error is swallowed by the store, so the
`user_sessions` table is never created and **every login appears to succeed but
no session persists** — the cookie is set and sent, but every subsequent request
is unauthenticated.

**Fix:** create the session table out-of-band via raw SQL and set
`createTableIfMissing: false`. The standard connect-pg-simple schema is a
`user_sessions` table with `sid varchar PK`, `sess json`, `expire timestamp(6)`
plus an index on `expire`.

**Why:** the symptom (login works, next request 401) looks like a cookie/secure
flag problem and wastes debugging time; the real cause is the missing bundled
SQL file.

**How to apply:** any bundled Express server using connect-pg-simple. If the DB
is ever recreated, re-run the session-table SQL or sessions break again.
