# Phase 3 Execution Plan — Widget Host, Config-as-Text, First-Party Migration

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the widget host runtime and JSON dashboard config, then migrate chores → dinner → calendar onto the public contract from [CONTRACT.md](CONTRACT.md), ending with zero privileged internal widgets and the UI acting as an editor over `data/config/dashboard.json`.

**Architecture:** New `shared/` Zod schemas; a server config service (atomic file writes, degrade-to-default); a client host (`WidgetHostMount`) that keep-alive-mounts every enabled widget through `mount(container, host)`; an `AppShell` extracted from `calendar.tsx`; three built-in widget folders under `client/src/widgets/`. Storage rides a new imperative `AppStateClient` that reproduces `use-app-state.ts`'s hardened semantics.

**Tech Stack:** Existing stack + vitest (fake timers for the storage client and refresh scheduler specs). No new runtime dependencies.

**Parent plan:** [WIDGET-SYSTEM-PLAN.md](WIDGET-SYSTEM-PLAN.md) Phase 3 · contract: [CONTRACT.md](CONTRACT.md) · shape decisions: [0007](../../decisions/0007-widget-contract-shape.md)

## Global Constraints

- **Behavior-preserving except the founder-ratified deltas** (see "Ratified deltas" below). Anything else must work exactly as before: chores badge live from any section, dinner debounce/cooldown surviving section switches, midnight/weekly transforms, OSK, screensaver, update flow.
- **Data safety is absolute:** existing `app_state` keys `chores`/`dinner` are read/written unchanged (host alias map per CONTRACT §4). No task may lose, rename, or reformat kiosk family data. The never-persist-before-successful-load guard must survive every refactor.
- **No privileged internals at phase end:** every first-party widget reaches the app only through `mount(container, host)` and the `WidgetHost` surface. Shell chrome (nav, settings popover, OSK, screensaver, update dialogs, toaster) is not a widget and may use app internals.
- Server changes are additive: new endpoints + the whitelist pattern extension. Update/rollback guards, sync, events routes untouched.
- `data/` is gitignored and on both updater preserve lists — `dashboard.json` is user config, never tracked.
- Every commit passes `npm test` and `npm run build`; `npm run check` may show only the pre-existing `server/` errors (or none, once the parallel fix session lands — pull/rebase before Task 2).
- Commit prefixes: `feat:` for new capability, `refactor:` for moves. Public repo: security review before any push; commit messages public.

## Ratified deltas (founder-approved 2026-08-19 at the plan gate)

1. **`host.ui.sleep()` added to the contract** (apiVersion 1 is still DRAFT/unshipped). All three first-party widgets have Sleep buttons; the overlay is shell-owned. CONTRACT.md §4 + traceability updated in Task 4.
2. **Per-calendar visibility becomes persisted calendar-widget settings** in `dashboard.json` (`settings: { hiddenCalendars: [], disabledCalendars: [] }`, hidden-list model — new calendars visible by default, which also retires the `seenCalendarIds` auto-enable dance). Today these toggles are ephemeral and reset on every browser restart; persisting them is a deliberate improvement. Settings popover writes them via the config API; the widget consumes them via `host.settings`.
3. **Keep-alive rendering**: hidden widgets stay mounted (display-none) instead of unmounting — ratified in CONTRACT §3; consequences (mount-time effects like WeekView's 7 AM auto-scroll fire once per app start, not per section visit) are accepted.
4. **Host-driven refresh with catch-up**: the calendar's 10-minute auto-refresh moves to manifest `refresh.intervalSeconds: 600`, fired by the host while visible/online/awake, plus one catch-up refresh when a widget becomes visible with an overdue interval. Net effect: no background refresh while another section is showing, but never-stale on return.
5. **Sequencing deviation from the parent plan:** the app-shell split happens *before* widget migration (Task 5) as a pure refactor, because each subsequent migration is then an isolated move. Mid-phase hybrid states (some sections widgets, some legacy) are acceptable — the app works at every commit.

---

### Task 1: Shared schemas — `widget-manifest.ts` + `dashboard-config.ts`

**Files:** Create `shared/widget-manifest.ts`, `shared/dashboard-config.ts`, `shared/widget-manifest.spec.ts`... (specs live beside client code? No — vitest include is `client/src/**/*.spec.ts`; put specs at `client/src/lib/widget-manifest.spec.ts` and `client/src/lib/dashboard-config.spec.ts` importing via `@shared`).

**Interfaces (produced, later tasks consume verbatim):**

```ts
// shared/widget-manifest.ts
export const WIDGET_API_VERSION = 1;
export const widgetIdSchema = z.string().regex(/^[a-z0-9][a-z0-9-]{1,40}$/);
export const widgetManifestSchema = z.object({
  id: widgetIdSchema,
  name: z.string().min(1).max(40),
  version: z.string().regex(/^\d+\.\d+\.\d+$/),
  apiVersion: z.number().int().positive(),
  entry: z.string().min(1).refine((p) => !p.split("/").includes(".."), { message: "no .. segments" }),
  slots: z.array(z.string()).nonempty().refine((s) => s.includes("section"), { message: 'v1 requires the "section" slot' }),
  description: z.string().max(200).optional(),
  icon: z.string().refine((p) => !p.split("/").includes(".."), { message: "no .. segments" }).optional(),
  refresh: z.object({ intervalSeconds: z.number().int().min(30) }).optional(),
  settings: z.array(widgetSettingFieldSchema).optional(),
});
export type WidgetManifest = z.infer<typeof widgetManifestSchema>;
```

`widgetSettingFieldSchema`: `{ key (1-40 chars), label (1-40), type: "string"|"number"|"boolean"|"select", default?, options? }` with a refine: `select` requires non-empty `options`, non-select must omit them.

```ts
// shared/dashboard-config.ts
export const dashboardConfigSchema = z.object({
  configVersion: z.literal(1),
  defaultWidget: widgetIdSchema,
  widgets: z.array(z.object({
    id: widgetIdSchema,
    enabled: z.boolean(),
    settings: z.record(z.unknown()).default({}),
  })).min(1).refine((ws) => new Set(ws.map((w) => w.id)).size === ws.length, { message: "duplicate widget id" }),
}).refine((c) => c.widgets.some((w) => w.enabled), { message: "at least one widget must be enabled" });
export type DashboardConfig = z.infer<typeof dashboardConfigSchema>;
export function defaultDashboardConfig(): DashboardConfig; // calendar, chores, dinner — all enabled, defaultWidget "calendar"
```

Specs (TDD): valid manifest passes; bad id/semver/apiVersion/slots/`..`-path/select-without-options fail; config duplicate-id and all-disabled fail; `defaultDashboardConfig()` round-trips through its own schema.

---

### Task 2: Server — config service, `/api/config/dashboard`, widget storage keys

**Pre-step: `git pull --ff-only`** — the parallel session fixing `server/` tsc errors may have landed on main; build on top of it.

**Files:** Create `server/services/configService.ts`; modify `server/routes.ts` (two new routes + whitelist change at :34).

- `configService`: `readDashboardConfig()` — read `data/config/dashboard.json`, parse + `dashboardConfigSchema.safeParse`; on missing file/parse failure/validation failure log once and return `defaultDashboardConfig()` (never throw — kiosk must boot with a corrupt file). `writeDashboardConfig(config)` — validate, `mkdir -p data/config`, write `dashboard.json.tmp`, `fs.renameSync` over the target (atomic), pretty-printed 2-space JSON (human-editable is the point).
- Routes (same-origin kiosk endpoints, no localhost guard, mirroring `/api/state`): `GET /api/config/dashboard` → re-reads the file each call (SSH hand-edits picked up on next poll) → `{config, source: "file"|"default"}`. `PUT /api/config/dashboard` → Zod-validate body → write → `{success:true}`; 400 with flattened errors otherwise.
- Whitelist: `APP_STATE_KEYS` check becomes `APP_STATE_KEYS.has(key) || /^widget:[a-z0-9][a-z0-9-]{1,40}$/.test(key)` in both GET and PUT handlers (`routes.ts:330`, `:344`); comment updated. Size cap and body schema unchanged.
- Verification: `npm run build`; curl GET (returns defaults, `source:"default"`), PUT a valid config, GET again (`source:"file"`), PUT garbage → 400, corrupt the file on disk → GET returns defaults; PUT/GET `/api/state/widget:test-widget` round-trips; `/api/state/nonsense` still 400.

---

### Task 3: `AppStateClient` — imperative hardened storage core

**Files:** Create `client/src/lib/app-state-client.ts` + `client/src/lib/app-state-client.spec.ts`. **`use-app-state.ts` is NOT touched** (chores/dinner keep working on it until their migration tasks).

Reproduce the exact semantics of [use-app-state.ts](../../../client/src/hooks/use-app-state.ts) as a framework-free class (constructor `(key: string, fetchImpl = fetch)`):

- `load<T>(): Promise<T | null>` — GET `/api/state/:key`, retry every 15 s forever until success (cancellable via `dispose()`); resolves with the stored value (`null` if empty). Sets the internal `loadSucceeded` gate.
- `set(value)` — **rejected (console.error, no-op) until `loadSucceeded`**; then 600 ms debounced PUT; failed PUT schedules a 15 s retry that re-reads the latest value at fire time; a newer `set` supersedes any pending retry.
- `flush()` — immediate persist of pending value (host calls it on `unmount`).
- `getServerCap()` note: values must serialize ≤ 64,000 chars — surface PUT 400s via console.error like today.

Specs (TDD, vitest fake timers + stubbed `fetchImpl`): load retries on failure then succeeds; `set` before load never PUTs; debounce coalesces rapid sets into one PUT with the last value; failed PUT retries with the *latest* value; new set cancels pending retry; `dispose()` cancels everything.

---

### Task 4: Widget runtime — types, host, registry, `WidgetHostMount`

**Files:** Create `client/src/widgets/types.ts` (the `RootboardWidget` / `WidgetInstance` / `WidgetHost` interfaces exactly as CONTRACT §3–4 **plus `ui.sleep(): void`**), `client/src/widgets/registry.ts`, `client/src/components/widget-host-mount.tsx`, `client/src/lib/refresh-scheduler.ts` + spec. Modify `docs/plans/widget-system/CONTRACT.md` (add `sleep()` to §4 with traceability: all three first-party widgets carry Sleep buttons; overlay is shell-owned).

- **Registry:** built-ins as `{ manifest: WidgetManifest, widget: RootboardWidget, navIcon?: LucideIcon }`, each widget folder `client/src/widgets/<id>/` holding `manifest.json` (validated through `widgetManifestSchema` at module init — a bad built-in manifest fails fast in dev) and `index.tsx`. React built-ins mount via their own `createRoot(container)` wrapped in `<QueryClientProvider client={queryClient}>` (module-singleton client, shared cache).
- **Host object per widget instance:** `storage` = `AppStateClient` with key `LEGACY_KEY_ALIASES[id] ?? \`widget:${id}\`` (`chores`→`chores`, `dinner`→`dinner`); `settings.get/subscribe` backed by the dashboard-config query; `theme.getToken` via `getComputedStyle(document.documentElement)`, `subscribe` a no-op-returning stub until the theme engine exists; `fetch` = `window.fetch.bind(window)`; `ui.setBadge` + `ui.sleep` wired to shell callbacks.
- **`WidgetHostMount`:** given the config's enabled widgets + active section id, renders one persistent `<div>` per widget (keyed by id, `style.display` toggles), calls `mount` once, `onVisibilityChange` on section switch and on screensaver dim/wake (listen to the existing `screensaver-state-change` window event), `unmount` + `storage.flush()` only on disable/removal.
- **Refresh scheduler** (`refresh-scheduler.ts`, pure + spec'd with fake timers): per-widget `lastRefresh`; tick every 30 s; fire `refresh()` when visible && online && awake && `now − lastRefresh ≥ intervalSeconds`; becoming visible with an overdue interval fires immediately (ratified delta 4).
- Nothing consumes any of this yet — app unchanged. Gate: build + all specs green.

---

### Task 5: AppShell extraction (pure refactor — behavior identical)

**Files:** Create `client/src/components/app-shell.tsx`, `client/src/components/calendar/calendar-section.tsx`; shrink `client/src/pages/calendar.tsx` to `<AppShell/>` (or repoint `App.tsx` and delete the page — implementer's choice, keep wouter routes working).

Split of today's `calendar.tsx` (facts verified 2026-08-19):

- **Shell keeps:** section state + `rootboard-section` localStorage (`:34-41`), `useScreensaver` + brightness init (`:59-66`), sleep/wake/power-saving (`:69-80`), `useVersionCheck` + `UpdateNotification` (`:56`, `:448-459`), `NavRail` + `SettingsMenu` in the rail (`:326-343`), `PowerSavingOverlay` (`:462-465`), **temporarily** the hoisted `useChores`/`useDinner` (`:95-102`) and the `<ChoresPage/>`/`<DinnerPage/>` renders — they move out in Tasks 6–7.
- **CalendarSection gets:** everything else — `useCalendar`, view/date state, calendar sets + `seenCalendarIds` (`:45-46`, `:114-138`), filtering (`:163-168`), all handlers, `CalendarHeader`/`CalendarFilters`/views, the four calendar dialogs, `LoadingIndicator`, keyboard shortcuts (`:262-293`), the 10-min auto-refresh (`:253-259`), screensaver-exit reset (`:150-160`). Props from shell: `onSleep`, `isPowerSavingActive`.
- **Settings coupling to resolve now:** shell's `SettingsMenu` needs `authStatus` (today from `useCalendar`) — give the shell its own tiny `useQuery(['/api/calendar/auth-status'])`; and `onSubscribeSuccess={manualRefresh}` becomes a direct `POST /api/calendar/sync` + events-key invalidation inside the settings handler (identical net effect). `visibleCalendarsInHeader`/`handleCalendarHeaderToggle` stay lifted in the shell and flow down to CalendarSection as props **for now** (they move into widget settings in Task 8).
- Gate: build + tests; manual pass — section switching, badge, sleep from all three sections, update dialog, settings, keyboard nav, auth dialog.

---

### Task 6: Config-driven shell + chores becomes the first real widget

**Files:** Create `client/src/widgets/chores/manifest.json` + `index.tsx`, `client/src/hooks/use-widget-state.ts`; modify `app-shell.tsx`, `nav-rail.tsx`, `client/src/hooks/use-chores.ts`.

- Shell loads `GET /api/config/dashboard` (react-query; `defaultDashboardConfig()` as placeholder while loading). Nav rail renders from config order/enabled (built-in `navIcon`s preserved; active-section semantics unchanged; `defaultWidget` used when localStorage section is missing/disabled).
- `use-widget-state.ts`: React hook giving widgets the old `useAppState` ergonomics **on top of `host.storage`** (public-surface only): `useWidgetState<T>(host, { emptyState, normalize, transformOnLoad, pollTransformMs })` — load via `host.storage`, transforms + 60 s polling client-side, `setState` → `host.storage.set`.
- `use-chores.ts` gains a variant (or a `storage` parameter) built on `useWidgetState(host, …)`; pure `chores-state.ts` logic untouched; legacy key `chores` via the alias map so **existing data is read bit-for-bit**.
- Chores widget: `mount(container, host)` renders `<ChoresApp host={host}/>` = today's `ChoresPage` wired to the host: badge via `host.ui.setBadge(openChoreCount)` (effect), sleep button → `host.ui.sleep()`. Shell drops the hoisted `useChores` and the rail's `choreBadgeCount` prop (badge now host-fed); chores renders through `WidgetHostMount`.
- Gate: build/tests; manual — existing chores data appears untouched, badge live from calendar/dinner sections, midnight-rollover poll still scheduled, confetti, sleep. Dinner/calendar still legacy.

---

### Task 7: Dinner widget

Same pattern as Task 6 (`client/src/widgets/dinner/`): `useDinner` onto `useWidgetState`, legacy key `dinner`, sleep via host. Shell drops the dinner hoisting. **The keep-alive host now provides what the hoisting invariant provided** — verify explicitly: vote, switch sections within the debounce window, switch back, reload after 1 s → vote persisted; cooldown not resettable by section bouncing. Gate: those two manual checks + build/tests.

---

### Task 8: Calendar widget (the big one)

**Files:** Create `client/src/widgets/calendar/manifest.json` (with `refresh: { intervalSeconds: 600 }` and the settings fields below) + `index.tsx`; move `calendar-section.tsx` content into the widget; modify `settings-menu.tsx`, `app-shell.tsx`.

- CalendarSection mounts as a widget; keyboard shortcuts listen only while visible (guard on the host visibility state); the internal 10-min `setInterval` is **deleted** — the host's refresh scheduler calls `refresh()` → `autoRefresh()` (ratified delta 4). Screensaver-exit reset stays (window event, page-global).
- **Visibility settings model (ratified delta 2):** widget settings `{ hiddenCalendars: string[], disabledCalendars: string[] }` (hidden = out of header AND events, per today's Settings toggle; disabled = header chip off = events hidden). `enabledCalendars`/`visibleCalendarsInHeader` sets + `seenCalendarIds` are derived: visible-in-header = subscribed − hidden; events-on = subscribed − hidden − disabled. New calendars are visible by default (not in either list) — the auto-enable-once ref dance is deleted. Header chips write `disabledCalendars` via the config API; Settings toggles write `hiddenCalendars`. `SettingsMenu` reads/writes through `PUT /api/config/dashboard` (shell-side helper), the widget reacts via `host.settings.subscribe`.
- Unsubscribe purge (`handleCalendarRemoved`) becomes: also drop the id from both lists in config.
- Gate: build/tests; manual — all three views, event CRUD dialogs, chip + settings toggles **persist across a full reload**, sync/auth flows, keyboard nav only when calendar visible, refresh catch-up when returning to calendar after >10 min away.

---

### Task 9: Layout picker

**Files:** modify `settings-menu.tsx` (new "Widgets" section), small shell support.

Enable/disable toggles + up/down reorder per widget (from the discovery list = built-in registry for now — folder-drop arrives in Phase 4), writing the full config via `PUT /api/config/dashboard`. Guards: cannot disable the last enabled widget; disabling the active section switches to `defaultWidget` (or first enabled). Touch targets ≥ 48 px. Gate: reorder reflects in nav immediately and survives reload; `data/config/dashboard.json` on disk is human-readable and hand-editable (edit by hand, GET picks it up).

---

### Task 10: Cleanup, docs, ship

- Delete now-unused code once verified unreferenced: `use-app-state.ts` (if both consumers migrated), the stale hoisting comments, `calendar-section.tsx` shim if fully absorbed. `git grep` proof per deletion.
- `docs/SPEC.md` §3 rewrite: new client architecture (AppShell, widget host, keep-alive, config file, storage keys incl. `widget:*` pattern, refresh model, persisted calendar visibility); §5 data invariants updated (config file, whitelist pattern); quirks index updated (hoisting-invariant entry replaced by keep-alive note).
- `WIDGET-SYSTEM-PLAN.md` Phase 3 ✅; CONTRACT.md status → "implemented (built-ins); folder-drop pending Phase 4".
- Final gates: `npm test`, `npm run build`, full manual pass on dev machine, **data-safety check on a copy of a real `calendar.db`** (chores/dinner blobs load unmodified), security review per CLAUDE.md, then merge/push per the finishing workflow.
- TASKS.md: propose checking off "Migrate all first-party widgets onto the public contract" and "Move dashboard state to human-readable JSON config files…" (confirm with founder first).

## Landmines

- **The never-persist-before-load guard** must hold through `AppStateClient` and `useWidgetState` — it is the family-data-wipe protection. Its spec (Task 3) is the phase's most important test.
- **Legacy key aliases**: `widget:chores` must never be written — the alias map keeps `chores`/`dinner`. A typo here silently forks family data.
- Config PUT validation must reject unknown shapes but the READ path must degrade to defaults — a hand-edit typo must not brick the kiosk.
- Multiple React roots share one `queryClient` — never create per-widget clients (cache split would break invalidations from Settings).
- The parallel tsc-fix session may land on main mid-phase: pull before each server-touching task; expect `npm run check` to go fully green at some point (update task briefs' expectations accordingly).
- Dev on Windows: `npm run dev` needs the bash launcher (`.claude/launch.json`); the kiosk path (`build`/`start`) is untouched.

## Repo facts this plan relies on (verified 2026-08-19, post-Phase-2)

- `calendar.tsx` (468 lines) structure and line refs as cited in Task 5; hoisting rationale comments at `:93-102`.
- `use-app-state.ts` semantics: 600 ms debounce, 15 s load/PUT retries, `loadSucceededRef` gate, skip-first-persist, transform polling.
- `APP_STATE_KEYS = new Set(['chores','dinner'])` at `server/routes.ts:34`; handlers at `:328-365`; 64,000-char cap; Express 100 KB body limit.
- `useScreensaver` dispatches `screensaver-state-change` + `screensaver-exit` window events; brightness via `documentElement.style.filter`.
- `App.tsx`: QueryClientProvider → TooltipProvider → Toaster/Router/OSK; `queryClient` is a module singleton in `lib/queryClient.ts` (query keys are URL paths).
- `data/` gitignored and on both updater preserve lists; no `data/` dir exists on the dev machine yet.
- vitest configured (`client/src/**/*.spec.ts`, node env, `oxc.jsx` set); `npm test` = legacy scripts + vitest.
