# 0002 — SQLite + Google service account for the self-hosted default

Date: 2026-07-23 (reconstructed as-built rationale)
Status: accepted; amended 2026-11-11 — the `DATABASE_URL` path was removed, see the update at the end

## Decision

The self-hosted (Raspberry Pi) default is `better-sqlite3` storing
`calendar.db` next to the app, with Google Calendar auth via a
**service-account JSON key** (`service-account.json`). Postgres (via
`DATABASE_URL`) exists only for hosted deployments; interactive OAuth
(`google_credentials.json`) is legacy.

## Context and alternatives

The target deployment is a single always-on kiosk owned by one household —
no accounts, no multi-tenancy, no external services beyond Google's API.

- **Postgres by default** — rejected for self-hosting: a second daemon to
  install, secure, and keep running on a Pi, for zero benefit at this scale.
  Kept as an option for hosted use where a managed DB already exists.
- **Interactive Google OAuth** — rejected: tokens expire and need re-consent
  in a browser, which is hostile on a headless-ish kiosk. A service account
  is granted read access once (calendar shared with its `client_email`) and
  then works unattended indefinitely.

This also matches Crucible Creations' bias toward low-overhead,
no-account, client/self-hosted products.

## Consequences

- `better-sqlite3` is a **native module**: it must be `npm install`ed on the
  target architecture, never copied between machines (Pi vs x86). The
  updater's `npm install` step handles this.
- The service-account key is a long-lived credential sitting on disk — it is
  gitignored, server-side only, and must be rotated if ever exposed.
- Calendar access is read via one identity; per-user Google features are out
  of scope by design.

## Update 2026-11-11 — `DATABASE_URL` path removed

The founder ruled: "drop the unused Google Sans font and remove the
database storage path" (founder, 2026-11-11). SQLite is now the only
storage. The hosted "Postgres" option never stored app data: with
`DATABASE_URL` set, the server used non-persistent in-memory storage
and lost everything on restart. That branch, `drizzle.config.ts`,
`npm run db:push`, and the unused `@neondatabase/serverless`,
`connect-pg-simple`, `@types/connect-pg-simple` and `drizzle-kit`
packages are gone. A leftover `DATABASE_URL` is ignored with a startup
log line. `shared/schema.ts` keeps its Drizzle table declarations only
as the source of the row types.
