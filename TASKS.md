# Tasks

## Open

- [ ] Theme system — plan at `docs/plans/theme-system/THEME-SYSTEM-PLAN.md` (Phase 0 = color sweep, prompt included; community themes deferred)
- [ ] Resolve dead code vs. theme plan: `client/src/components/screensaver/screensaver-overlay.tsx` is defined but never mounted (the live overlay is `power-saving-overlay.tsx`) — however the theme plan's repo-facts section lists its rAF bounce loop as the screensaver base. Decide whether the theme work revives it or the plan should point at `power-saving-overlay.tsx`; don't delete before that's settled.
- [ ] Fix misleading storage selection: when `DATABASE_URL` is set, `server/storage.ts` logs "PostgreSQL" but actually uses non-persistent in-memory `MemStorage`. Either wire real Postgres app-data storage or correct the log and docs.
- [x] Design widget contract spec: manifest schema (Zod), lifecycle, host services, apiVersion — see decision 0006 (added 2026-08-15) (done 2026-08-19)
- [x] Audit existing built-in widgets for coupling to internal state; inventory what the public API must expose (only what first-party widgets need) (added 2026-08-15) (done 2026-08-19)
- [x] Combine widget-contract refactor with theme Phase 0 color sweep into a single refactor plan; write plan doc under docs/plans/ (added 2026-08-15) (done 2026-08-19)
- [ ] Implement folder-drop widget loading (/widgets/) + Zod validation + layout picker integration (added 2026-08-15)
- [ ] Migrate all first-party widgets onto the public contract (added 2026-08-15)
- [ ] Move dashboard state to human-readable JSON config files with the UI as an editor over them (added 2026-08-15)
- [ ] Create rootboard-widget-template repo + working hello-world widget (added 2026-08-15)
- [ ] Write "build your first widget in 30 minutes" tutorial (added 2026-08-15)
- [ ] Write contribution guide + trust-model note (no sandbox in v1: widgets run with full access, install ones you trust) (added 2026-08-15)
- [ ] Create awesome-rootboard list, seeded with first-party entries (added 2026-08-15)
- [ ] Build one reference community widget in a separate repo, public API only (candidate: stock ticker or grocery list) (added 2026-08-15)
- [ ] Fix stale-closure keyboard nav: the calendar keyboard effect captures `currentDate` with only `[currentView]` deps, so repeated ArrowLeft/Right presses navigate from a stale date (pre-existing, predates widget migration; an eslint-disable in widgets/calendar/index.tsx currently conceals it) (added 2026-08-19)
- [ ] Fix duplicate calendar-color fallback: settings-menu.tsx:186-188 copy-pastes a hash with a different palette than lib/calendar-meta.ts getCalendarColor(), so uncolored calendars render different colors in Settings vs. views — replace local list+hash with getCalendarColor() (found in phase-2 inventory, Q12) (added 2026-08-19)
- [ ] Investigate React warning "Attempted to synchronously unmount a root while React was already rendering" (stack rooted at WidgetHostMount), reproducing on cold boot in dev even at HEAD before Task 9 (differential-tested via `git stash` + fresh dev-server restart) — predates the widget-picker work, not yet root-caused; leading suspect is the nested `createRoot()` roots inside widget `mount()` interacting with Vite dev-mode module updates, unconfirmed (added 2026-08-19)

## Deferred (recorded, not scheduled)

- [ ] Widget registry / one-click install / widget auto-updates — only if a community materializes (added 2026-08-15)
