# Tasks

## Open

- [ ] Theme system — plan at `docs/plans/theme-system/THEME-SYSTEM-PLAN.md` (Phase 0 = color sweep, prompt included; community themes deferred)
- [ ] Resolve dead code vs. theme plan: `client/src/components/screensaver/screensaver-overlay.tsx` is defined but never mounted (the live overlay is `power-saving-overlay.tsx`) — however the theme plan's repo-facts section lists its rAF bounce loop as the screensaver base. Decide whether the theme work revives it or the plan should point at `power-saving-overlay.tsx`; don't delete before that's settled.
- [ ] Fix misleading storage selection: when `DATABASE_URL` is set, `server/storage.ts` logs "PostgreSQL" but actually uses non-persistent in-memory `MemStorage`. Either wire real Postgres app-data storage or correct the log and docs.
- [ ] Design widget contract spec: manifest schema (Zod), lifecycle, host services, apiVersion — see decision 0006 (added 2026-08-15)
- [ ] Audit existing built-in widgets for coupling to internal state; inventory what the public API must expose (only what first-party widgets need) (added 2026-08-15)
- [ ] Combine widget-contract refactor with theme Phase 0 color sweep into a single refactor plan; write plan doc under docs/plans/ (added 2026-08-15)
- [ ] Implement folder-drop widget loading (/widgets/) + Zod validation + layout picker integration (added 2026-08-15)
- [ ] Migrate all first-party widgets onto the public contract (added 2026-08-15)
- [ ] Move dashboard state to human-readable JSON config files with the UI as an editor over them (added 2026-08-15)
- [ ] Create rootboard-widget-template repo + working hello-world widget (added 2026-08-15)
- [ ] Write "build your first widget in 30 minutes" tutorial (added 2026-08-15)
- [ ] Write contribution guide + trust-model note (no sandbox in v1: widgets run with full access, install ones you trust) (added 2026-08-15)
- [ ] Create awesome-rootboard list, seeded with first-party entries (added 2026-08-15)
- [ ] Build one reference community widget in a separate repo, public API only (candidate: stock ticker or grocery list) (added 2026-08-15)

## Deferred (recorded, not scheduled)

- [ ] Widget registry / one-click install / widget auto-updates — only if a community materializes (added 2026-08-15)
