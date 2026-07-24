# Tasks

## Open

- [ ] Remove dead code: `client/src/components/screensaver/screensaver-overlay.tsx` is defined but never mounted (the live overlay is `power-saving-overlay.tsx`). Confirm it isn't earmarked for future use before deleting.
- [ ] Fix misleading storage selection: when `DATABASE_URL` is set, `server/storage.ts` logs "PostgreSQL" but actually uses non-persistent in-memory `MemStorage`. Either wire real Postgres app-data storage or correct the log and docs.
