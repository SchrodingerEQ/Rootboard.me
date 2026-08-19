# Rootboard Widget System — Combined Refactor & Build Plan

**Status:** Phases 1-3 complete; Phases 4-5 not started.
**Decided:** 2026-08-19 (contract-shape choices founder-ratified this date)
**Parent decision:** [0006 — Community-buildable widget system](../../decisions/0006-community-widget-system.md)
**Contract spec:** [CONTRACT.md](CONTRACT.md)
**Shape decisions:** [0007 — Widget contract shape](../../decisions/0007-widget-contract-shape.md)

This is the **single combined plan** required by the 2026-08-15 update in
[THEME-SYSTEM-PLAN.md](../theme-system/THEME-SYSTEM-PLAN.md): the theme
plan's Phase 0 color sweep and the widget-contract decoupling touch the
same files and are executed as one refactoring phase (Phase 2 below),
not two passes.

---

## Summary

Turn Rootboard's three hardcoded sections (Calendar, Chores, Dinner)
into widgets on a public contract, make the dashboard config a
human-readable JSON file with the UI as an editor over it, and let
anyone add a widget by dropping a folder into `/widgets/`. All
first-party widgets are rebuilt on the same public API — no privileged
internals.

**Ground truth (coupling audit, 2026-08-19):** the app has no widget
abstraction today. No registry, no layout state, no dynamic imports.
Sections are switched by a `useState` in `client/src/pages/calendar.tsx`
(472 lines — also the de-facto app shell), nav items are a hardcoded
array in `nav-rail.tsx`, and nothing about layout is persisted anywhere.
This plan *introduces* the widget concept, then migrates onto it.

## Decisions (locked 2026-08-19)

1. **v1 widget = full-screen section.** A widget owns the whole content
   area and is selected from the nav rail; the "layout picker" is a
   config-driven list of installed widgets (enable/disable + order).
   Manifests declare `slots` so tile-style widgets can arrive later
   without a contract break.
2. **Community widgets are self-contained ESM.** One bundle exporting
   `mount(container, host)`; widgets bring their own framework. No
   shared React, no import maps.
3. **Color sweep scope: hex/rgba *and* Tailwind palette classes**
   (`text-gray-500` etc.) in kiosk-facing surfaces; `setup.tsx` is
   exempt for now (202 of the 346 palette-class hits; install-guide
   page, themed later).
4. **`widgets/` lives at the app root** and is added to *both*
   updater preserve lists (`PRESERVE_PATHS` in `updateService.ts` and
   the `case` list in `scripts/start.sh`) in the same commit that
   creates the loading path.
5. **Dashboard config file at `data/config/dashboard.json`** —
   `data/` is already preserved across updates. Chores/dinner *data*
   blobs stay in `app_state` (they are data, not config) under their
   existing keys so no family data is touched.
6. **Migration order: chores → dinner → calendar.** Chores and dinner
   are nearly clean already (one hook + one state blob each); calendar
   goes last because migrating it requires splitting the app shell out
   of `calendar.tsx`.
7. **Test harness first:** vitest (dev-dependency only) lands at the
   start of Phase 2; the existing standalone `tsx` test scripts
   (`osk.test.ts`, `chores-state.test.ts`, …) get wired into
   `npm test`. A refactor of this size does not run on hand-executed
   scripts.

## Phases

Each phase ends with working, shippable software.

### Phase 1 — Contract spec ✅ (this document + CONTRACT.md)

Manifest schema, lifecycle, host services, config format, discovery,
trust model: see [CONTRACT.md](CONTRACT.md). The coupling audit that
sized the API surface is digested in "Repo facts" below.

### Phase 2 — Combined refactor: color sweep + decoupling ✅

→ Execution plan: [PHASE2-EXECUTION.md](PHASE2-EXECUTION.md)

Pure refactor; **success test: the app is pixel-identical before and
after**, all tests green. No feature work mixed in.

Work area-by-area in adjacent, bisectable commits (nav rail → calendar →
chores → dinner → keyboard/screensaver/settings), doing both workstreams
per area in one visit:

- **Color sweep** per the existing kickoff prompt
  ([phase0-color-sweep-prompt.md](../theme-system/phase0-color-sweep-prompt.md)),
  extended to Tailwind palette classes (decision 3). Audit-corrected
  scale: 220 hex across 29 files + 21 rgb()/rgba() + 346 palette
  classes (144 in scope with `setup.tsx` exempt). Includes the special
  cases already specified: `CONFETTI_COLORS` stays a testable export,
  `PERSON_PALETTE` (24 hex in `chores-state.ts`), scrollbar/screensaver
  colors in `index.css`. Done-check: the prompt's `git grep` gate plus
  a palette-class grep for the in-scope files.
- **Decoupling** — cut the couplings the audit found so Phase 3 is a
  move, not a rewrite: stop `calendar-header.tsx` importing types from
  the page; delete the dead `RB` constant in `color-utils.ts`; localize
  the `enabledCalendars` filtering inconsistency (MonthView filters
  internally, Week/Day get pre-filtered — pick one); thin the
  prop-drilling from `calendar.tsx` where a widget boundary will land.
- **Harness:** add vitest + `npm test` first, so every sweep commit is
  gated.

### Phase 3 — Widget host, config-as-text, first-party migration ✅

The substantive build.

1. `shared/widget-manifest.ts` + `shared/dashboard-config.ts` (Zod,
   `WIDGET_API_VERSION = 1`).
2. Config service: `data/config/dashboard.json`, atomic writes,
   `GET/PUT /api/config/dashboard`, degrade-to-default on
   missing/corrupt file.
3. Widget host runtime: static registry for built-ins, keep-alive
   mounting (hidden ≠ unmounted — replaces the CalendarPage hoisting
   invariant), host-driven `refresh()` cadence that respects
   online/screensaver state, `WidgetHost` services including the
   `widget:<id>` storage path (server whitelist: legacy keys + pattern)
   and built-in key aliases (`chores`, `dinner`).
4. Nav rail + layout picker render from config (order, enable/disable,
   badges via `host.ui.setBadge`).
5. Migrate **chores**, then **dinner** (each: manifest + entry wrapping
   the existing page/hook through the contract; existing data keys
   unchanged; success = behavior identical incl. badge, cooldown,
   midnight rollover).
6. Migrate **calendar**: split `calendar.tsx` into an app shell
   (screensaver, brightness, update flow, OSK stays global, section
   plumbing → host) and a calendar widget (views, header, dialogs,
   auth dialog, keyboard shortcuts, sync cadence via host refresh where
   it fits, own timers where it doesn't).
7. Update `docs/SPEC.md` §3 for the new client architecture.

### Phase 4 — Folder-drop loading

1. `express.static("widgets")` mounted inside `registerRoutes`;
   `GET /api/widgets` discovery endpoint (validated manifests +
   per-folder validation errors for the picker UI).
2. Client dynamic `import()` of community entries; apiVersion gate with
   the "built for a newer Rootboard" message.
3. **Preserve-list commit:** `widgets/` added to `PRESERVE_PATHS` and
   `start.sh` (decision 4) — its own reviewed commit, since a miss
   silently deletes users' widgets on the next auto-update.
4. `.gitignore` entry for `/widgets/` (installed widgets are user
   content, never tracked).
5. End-to-end proof: hand-built hello-world folder dropped onto a dev
   machine and onto the Pi via SSH, appears in picker, survives an
   update cycle.

### Phase 5 — Proof-of-openness package (mostly separate repos)

- `rootboard-widget-template` repo with the working hello-world.
- "Build your first widget in 30 minutes" tutorial.
- Contribution guide + the trust-model statement (CONTRACT.md §7)
  verbatim.
- `awesome-rootboard` list seeded with first-party entries.
- One reference community widget on the public API only (candidate:
  stock ticker or grocery list).

**Deferred (unchanged from 0006):** registry / one-click install /
widget auto-updates — only if a community materializes.

## Landmines & risks

- **Updater deletes unknown root dirs.** `applyFiles` removes any
  top-level entry not in `PRESERVE_PATHS`; the list is duplicated by
  hand in `scripts/start.sh`. Both must gain `widgets` (Phase 4 step 3).
- **`app_state` whitelist** is hardcoded to `{chores, dinner}`
  (`server/routes.ts:34`); widget storage requires the pattern
  extension. Keep the 64,000-char cap (Express body limit is 100 KB).
- **Keep-alive is load-bearing.** Today's hoisting invariant (nav badge,
  dinner debounce, vote cooldown) survives only if the host never
  unmounts on section switch.
- **Dev-mode routing:** the Vite middleware catch-all would swallow
  `/widgets/*`; the static mount must register with the API routes,
  before both catch-alls.
- **No CI:** tests are manual scripts until Phase 2 adds vitest.
- **Data safety:** migration keeps existing `app_state` keys; at no
  point may a phase lose or reformat a kiosk's chores/dinner data.
- Existing related tasks to settle alongside: the dead
  `screensaver-overlay.tsx` question and the misleading
  `DATABASE_URL`/MemStorage log (tracked separately in TASKS.md; not
  blockers, but Phase 2 touches neighboring files).

## Effort read

Phase 2: 2–4 days mechanical (sweep grew ~2.5× vs the theme plan's
estimate). Phase 3: the real build, 1–2 weeks. Phase 4: 2–3 days.
Phase 5: ~1 week, spread out. Theme Phase 1 (theme engine) can start
any time after Phase 2 — it shares the token groundwork but not the
host runtime.

## Repo facts this plan relies on (verified 2026-08-19)

- No widget/layout/dashboard abstraction exists; sections switch via
  `useState` in `pages/calendar.tsx` (persisted only in localStorage
  `rootboard-section`); nav items hardcoded in `nav-rail.tsx:13-17`.
- `useChores`/`useDinner` hoisted to CalendarPage (SPEC §3.1 invariant).
- Chores/dinner: one `app_state` blob each via `use-app-state.ts`
  (600 ms debounce, 15 s retries, never-persist-before-load guard) —
  the pattern `WidgetHost.storage` wraps.
- Color spread: 220 hex / 29 files, 21 rgb(a) / 16 files, 346 Tailwind
  palette classes / 25 files (202 in `setup.tsx`); `--rb-*` already
  used 106× across 21 files. Dead `RB` constant in `color-utils.ts`.
- Weather is embedded in `calendar-header.tsx` and `week-view.tsx`
  headers (via `useWeather` → `/api/weather`), not a component of its
  own — it stays part of the calendar widget in v1.
- Build: Vite → `dist/public`, esbuild → `dist/index.js`; zero dynamic
  imports in the client today; prod statics served by `serveStatic`
  with an SPA catch-all; API routes register first.
- No test runner or `test` script; tests are standalone `tsx` scripts.
- Updater preserve/exclusion lists: `updateService.ts:40-56` ↔
  `start.sh:50` (hand-synced pair).
