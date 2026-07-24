# Tasks

## Open

- [ ] Theme system — plan at `docs/plans/theme-system/THEME-SYSTEM-PLAN.md` (Phase 0 = color sweep, prompt included; community themes deferred)
- [ ] Resolve dead code vs. theme plan: `client/src/components/screensaver/screensaver-overlay.tsx` is defined but never mounted (the live overlay is `power-saving-overlay.tsx`) — however the theme plan's repo-facts section lists its rAF bounce loop as the screensaver base. Decide whether the theme work revives it or the plan should point at `power-saving-overlay.tsx`; don't delete before that's settled.
- [ ] Fix misleading storage selection: when `DATABASE_URL` is set, `server/storage.ts` logs "PostgreSQL" but actually uses non-persistent in-memory `MemStorage`. Either wire real Postgres app-data storage or correct the log and docs.
