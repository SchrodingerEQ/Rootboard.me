# Rootboard.me — As-Built Specification

Regenerated from the code at v1.4.1 (2026-07-23). This documents what the
app **actually does**, including quirks. Update it when behavior changes.
Public document — no deployment specifics (hostnames, IPs, real names).

- [1. System overview](#1-system-overview)
- [2. Server](#2-server)
- [3. Client](#3-client)
- [4. Update system](#4-update-system)
- [5. Data invariants](#5-data-invariants)
- [6. Known quirks index](#6-known-quirks-index)

## 1. System overview

A touchscreen Google Calendar kiosk for a Raspberry Pi, running 24/7 in
browser kiosk mode. Express + TypeScript backend (ESM, bundled with
esbuild into `dist/index.js`), React 18 + Vite + Tailwind/Radix frontend,
`better-sqlite3` persistence, Google Calendar via a service-account key.
Version source of truth: `APP_VERSION` in `shared/version.ts`.

**Architectural rule: the server has no scheduler.** All periodic behavior
(calendar sync cadence, daily update checks, state polling) is driven by
client-side timers. The only server-side periodic-ish work is the event
retention sweep, which runs inside each sync.

## 2. Server

### 2.1 Entry (`server/index.ts`)

- Port hard-coded to `5000`, host `0.0.0.0` (the one non-firewalled port).
- Middleware: `express.json()` (default ~100 KB body limit — this backs the
  app-state size cap), `express.urlencoded`, and a custom `/api` request
  logger that truncates logged response JSON to 79 chars.
- Startup: `await storageReady` → `registerRoutes` → error middleware →
  Vite (dev) or static (prod) → listen.
- **Quirk:** the error middleware responds `{message}` with the error's
  status, then **re-throws** the error after responding.
- **Quirk:** `reusePort: true` is set only when `platform !== "win32"` —
  it throws `ENOTSUP` on Windows.
- Dev mode (`NODE_ENV=development`) mounts Vite middleware with an
  HTML catch-all (cache-busts `main.tsx` with a nanoid query); Vite logger
  errors call `process.exit(1)`. Prod serves `dist/public` with an
  `index.html` SPA fallback. API routes must register before the catch-all.

### 2.2 Endpoint inventory (`server/routes.ts`)

| Method | Path | Purpose | Guard |
|---|---|---|---|
| GET | `/api/version` | `{version, timestamp}` — supervisor health-check target | none |
| GET | `/api/weather` | Cached Open-Meteo forecast, or `{enabled:false}` | none |
| GET | `/api/calendar/events` | Events overlapping `from`/`to` (legacy `startDate`/`endDate` accepted) | none |
| GET | `/api/calendar/calendars` | Google calendar list | none |
| DELETE | `/api/calendar/calendars/:calendarId` | Unsubscribe + purge local events | none |
| POST | `/api/calendar/events` | Create event in Google + local mirror | none |
| PATCH | `/api/calendar/events/:id` | Update event | none |
| DELETE | `/api/calendar/events/:id` | Delete event (204; 404 if missing) | none |
| POST | `/api/calendar/subscribe` | Subscribe calendar (409 dup, 400 bad) | none |
| POST | `/api/calendar/sync` | Pull a date window from Google into storage | none |
| GET | `/api/calendar/sync-status` | `{lastSyncAt,lastSyncError,syncing}`, no-store | none |
| GET | `/api/calendar/service-account-email` | Service account `client_email` | none |
| GET | `/api/calendar/auth-status` | `{authenticated,needsAuth,error}`, no-store | none |
| GET | `/api/update/check` | Compare `APP_VERSION` vs latest GitHub release | none |
| GET | `/api/update/status` | In-memory update progress | none |
| POST | `/api/update/apply` | Trigger update (fire-and-forget) | **localhost-only** |
| POST | `/api/update/rollback` | Trigger rollback (fire-and-forget) | **localhost-only** |
| GET | `/api/update/backups` | List backups | none |
| GET | `/api/state/:key` | Read app-state blob | key whitelist |
| PUT | `/api/state/:key` | Write app-state blob | key whitelist + 64,000-char cap |
| GET | `/api/config/dashboard` | Re-reads config from disk every call; `{config, source}` | none |
| PUT | `/api/config/dashboard` | Zod-validate + atomic write of the whole config | none |

- **Localhost guard:** `isLocalRequest` compares `req.ip`/socket address to
  `127.0.0.1`, `::1`, `::ffff:127.0.0.1`, `localhost`; violations get 403.
  Applied **only** to `apply` and `rollback` — `check`, `status`, and
  `backups` are open. No `trust proxy` is configured, so the guard checks
  the direct socket peer; a reverse proxy would break/bypass semantics —
  re-verify if one is ever added.
- **Validation:** Zod. Event writes coerce `startTime`/`endTime` to Date,
  require non-empty trimmed title, and refine `endTime > startTime`;
  creates also require `calendarId`. App-state keys whitelisted to
  `{chores, dinner}` (built-in legacy aliases) **∪** `widget:<id>`
  (pattern `^widget:[a-z0-9][a-z0-9-]{1,40}$`, i.e. id length 2–41 —
  the widget host's per-widget storage namespace, §3.1); unknown key →
  400; serialized value > 64,000 chars → 413-style rejection. Dashboard
  config PUT validates the whole document against the same schema used
  to read it; an invalid body → 400 with flattened Zod errors.
- **Apply/rollback respond `{status:"in-progress"}` immediately**; progress
  is observable only by polling `GET /api/update/status`.

### 2.3 Google Calendar service (`server/services/googleCalendar.ts`)

- Auth: `GoogleAuth` with service-account key at
  `GOOGLE_SERVICE_ACCOUNT_KEY_FILE` (default `./service-account.json`),
  scope `https://www.googleapis.com/auth/calendar`.
- Eager init at construction: existence-check the key file, then
  `auth.getClient()` preflight so bad keys fail at startup, not first use.
  All public methods await the init promise.
- Calendars = everything in the service account's `calendarList`.
  Subscribe/unsubscribe = `calendarList.insert`/`.delete` (404 swallowed).
- **Sync** (`POST /api/calendar/sync` only — no server timer):
  - Concurrent syncs coalesce into a single in-flight promise.
  - Per calendar: paginated `events.list` (`singleEvents:true`,
    `orderBy:startTime`, `maxResults:2500`), upsert by
    `(googleEventId, calendarId)`, then delete local events for that
    calendar not present in the sync (handles cancellations).
  - **Retention sweep:** after syncing, events that ended more than
    3 months ago are pruned.
  - `lastSyncAt` records the last **successful** sync; failures set
    `lastSyncError` without clearing it.
- **All-day time normalization** (`server/services/googleEventTimes.ts`):
  date-only events are parsed as *local* midnight (never UTC — avoids
  double-bucketing) and stored with `endTime` = end of the last day
  (exclusive end − 1 ms), making the stored range inclusive.
- Event colors: calendar `backgroundColor`, else a deterministic
  hash-derived color from the calendar id. (A colorId→color map exists in
  the file but is not wired into sync.)
- Writes go to Google first (insert/patch/delete by stored
  `calendarId` + `googleEventId`), then mirror locally; deletes swallow
  Google 404/410 and still prune the local row. Timed events send the
  server's local IANA timezone.

### 2.4 Storage (`server/storage.ts`, `server/sqlite-storage.ts`)

- Selection at startup: **if `DATABASE_URL` is set → `MemStorage`
  (in-memory, non-persistent — the log line says "PostgreSQL" but no
  Postgres app-data storage is actually wired)**; otherwise →
  `SQLiteStorage('./calendar.db')`. Real persistence exists only on the
  SQLite path.
- SQLite: WAL mode. Tables:
  - `users(id, username UNIQUE, password)` — defined, unused by routes.
  - `calendar_events(…, UNIQUE(google_event_id, calendar_id))` with
    indexes on `(start_time, end_time)` and `google_event_id`; timestamps
    are ISO text; overlap query is `start_time < ? AND end_time > ?`.
  - `app_state(key PRIMARY KEY, value, updated_at)` — upsert on conflict.
- Drizzle (`shared/schema.ts`, `drizzle.config.ts`) targets Postgres and
  is used only by `npm run db:push`; **it has no `app_state` table**, so
  chores/dinner persistence exists only in SQLite/Mem.
- Chores and dinner are **opaque JSON blobs** under app-state keys
  `chores` and `dinner`; the server never parses them. There are no
  dedicated tables or endpoints for them.

### 2.5 Weather (`server/services/weatherService.ts`)

Enabled only when `WEATHER_ENABLED="true"` and `WEATHER_LAT`/`WEATHER_LON`
are finite numbers. `WEATHER_UNITS` is `fahrenheit` or defaults to
celsius; `WEATHER_LOCATION_LABEL` defaults to empty. Forecast is fetched
from Open-Meteo and cached server-side.

### 2.6 Environment variables

| Var | Default / behavior |
|---|---|
| `GOOGLE_SERVICE_ACCOUNT_KEY_FILE` | `./service-account.json` |
| `DATABASE_URL` | unset → SQLite; set → in-memory MemStorage (see 2.4) |
| `GITHUB_REPO_OWNER` / `GITHUB_REPO_NAME` | `SchrodingerEQ` / `Rootboard.me` |
| `MANAGED_BY_SUPERVISOR` / `SUPERVISED` | `1` → self-restart after update allowed |
| `PM2_HOME`, `INVOCATION_ID` | presence implies supervised (pm2/systemd) |
| `WEATHER_*` | see 2.5 |
| `NODE_ENV` | `development` → Vite middleware; else static `dist/public` |

## 3. Client

### 3.1 AppShell and widget host

- Entry `client/src/main.tsx` → `App.tsx`: QueryClientProvider →
  TooltipProvider → Toaster + Router + a single globally-mounted
  `<OnScreenKeyboard/>`.
- Router (`wouter`) has only three routes: `/` (`pages/calendar.tsx`,
  now a thin wrapper that renders `AppShell`), `/setup` (static install
  guide), catch-all NotFound.
- Layout: fixed 104px left NavRail (logo, one button per enabled
  widget with its manifest name/icon, live per-widget badges, Settings
  at bottom — Settings only when authenticated) + flex content column.
- TanStack Query defaults are fully manual: `staleTime: Infinity`,
  `retry: false`, no refetch-on-focus/interval; all cadence is explicit
  timers. All requests send `credentials: "include"`. Multiple React
  roots (shell + one per widget) share the single module-singleton
  `queryClient` — cache and invalidations are shared across all of
  them, by design.
- **AppShell** (`components/app-shell.tsx`) owns everything that is not
  widget content: the nav rail, screensaver/brightness/power-saving,
  the update check/apply/rollback flow, and the Settings popover
  (brightness, OSK mode, per-calendar visibility switches, add-calendar,
  service-account display, update controls, and the layout picker —
  enable/disable + reorder installed widgets). The single OSK stays
  global (mounted in `App.tsx`, not per-widget). Nav `section` is now a
  config-driven `string` (any enabled **and** installed widget id), not
  a fixed 3-way union — still persisted in localStorage
  `rootboard-section`; a previously-stored `calendar`/`chores`/`dinner`
  round-trips unchanged. If the stored/default section can't actually
  render (disabled, or enabled-but-not-installed), the shell falls back
  to `dashboard.json`'s `defaultWidget`, then the first renderable id.
- **Dashboard config** (`data/config/dashboard.json`, read/written via
  `GET`/`PUT /api/config/dashboard`) is the source of truth for nav
  order, enabled state, and per-widget settings. The shell polls it
  every 60 s (react-query `refetchInterval`) so a hand-edit over SSH is
  picked up without a restart; react-query's structural sharing means
  an unchanged file produces the same object identity, so polling can't
  cause a spurious re-render. `defaultDashboardConfig()` (calendar,
  chores, dinner — all enabled, `defaultWidget: "calendar"`) is both
  the client's placeholder while the query is pending and the server's
  fallback for a missing/corrupt file (2.2).
- **Widget host / keep-alive** (`components/widget-host-mount.tsx`):
  every enabled+installed widget is mounted exactly once and stays
  mounted across nav — switching sections toggles `display: none` on
  its container rather than unmounting it. This **replaces** the old
  hoisting invariant (`useChores()`/`useDinner()` called at
  CalendarPage level so section switching never unmounted them, keeping
  the badge/debounce/cooldown alive): keep-alive gives every widget
  that same guarantee uniformly, not just the two that used to be
  hoisted by hand. A widget's `unmount()` is called only when it leaves
  the enabled set (disabled in settings, or its folder removed — Phase
  4) or the app shuts down — never on a mere section switch.
- **Host services** (`WidgetHost`, `client/src/widgets/types.ts`, per
  CONTRACT.md §4): `storage.get()/set()` — backed by `AppStateClient`
  (`lib/app-state-client.ts`), the same hardened debounce/retry
  semantics `use-app-state.ts` used to provide (600 ms debounced PUT,
  15 s load/PUT retry, never-persist-before-successful-load). Built-in
  widgets keep their pre-widget `app_state` keys via a legacy-alias map
  (`chores`→`chores`, `dinner`→`dinner`); anything else uses
  `widget:<id>` (server whitelist pattern, §5). `settings.get()` /
  `subscribe(cb)` read this widget's settings blob from the dashboard
  config; `settings.patch(build)` is the only way a widget may write
  its **own** settings — `build` receives the CURRENT settings (read
  fresh at write time, not a value the widget captured earlier),
  returns a patch or `null`, and the shell sanitizes the result before
  merging/persisting (the widget id is bound at host-creation time, so
  a widget cannot address another widget's settings entry).
  `theme.getToken(name)` reads a computed `--rb-*` custom property;
  `theme.subscribe` is a stub (no-op unsubscribe) until the theme
  engine exists. `fetch` is `window.fetch.bind(window)` — full network
  access, same-origin `/api/*` included. `ui.setBadge(count)` sets the
  nav-rail badge; `ui.sleep()` triggers the shell's power-saving
  overlay (the overlay itself stays shell-owned).
- **Refresh scheduler** (`lib/refresh-scheduler.ts`): the host owns one
  shared 30 s interval that ticks every mounted widget's own
  `RefreshScheduler`. A widget's `instance.refresh()` fires when
  `visible && online && awake` **and** its manifest's
  `refresh.intervalSeconds` has elapsed since the last refresh;
  becoming visible or waking while overdue fires immediately as a
  catch-up (coming back online does not trigger a catch-up on its own).
  A widget with no `refresh` block in its manifest never fires.
- Three first-party widgets ship under `client/src/widgets/`:
  `calendar/`, `chores/`, `dinner/` — each a `manifest.json` +
  `index.tsx` that mounts its own `createRoot` React tree (wrapped in
  `QueryClientProvider client={queryClient}`) around the pre-widget
  page/hook, reached only through `mount(container, host)` like any
  community widget would be — no privileged internal access.
- **Keep-alive consequence, accepted:** a mount-time effect now fires
  once per app boot instead of once per section visit — e.g. the
  Week view's auto-scroll-to-7AM (3.2) only happens the first time it
  mounts, not every time the user navigates back to it. Similarly, the
  Day view's 30 s clock (past-event dimming + "Up next" badge, 3.2)
  keeps ticking while the calendar widget is hidden (`display: none`),
  not just while visible — wasted but negligible work, not a
  correctness issue.

### 3.2 Calendar views

- Fetch window (`lib/date-range.ts`): local-midnight start, **exclusive**
  end. Month = Sunday of first week → Saturday of last week (+1 day);
  Week = Sunday +7; Day = the month-grid window **plus a 14-day
  lookahead** (feeds the mini-month and "Coming up" list).
- Events query is enabled only when authenticated AND online AND the
  screensaver is not active. Sync (`POST /api/calendar/sync`) always
  covers **−3 months to +12 months** regardless of view. One-shot
  auto-sync on first auth when the DB is empty (ref-guarded);
  sync-status polled every 30 s.
- **Auto-refresh is host-driven, not an internal timer.** The manifest
  declares `refresh.intervalSeconds: 600`; the widget host's
  `RefreshScheduler` (3.1) calls `refresh()` → the same `autoRefresh()`
  used before, only while the calendar widget is visible, online, and
  awake, plus one catch-up fire when it becomes visible with an
  overdue interval — so there's no background sync while another
  section is showing, but the view is never stale on return.
  `useCalendar`'s own internal 10-minute throttle inside `autoRefresh()`
  is unchanged and still acts as a second guard.
- Keyboard nav: `←/→` navigate, `t` today, `1/2/3` = day/week/month
  (ignored while an input is focused, **and while the calendar widget
  is not the visible section** — keep-alive keeps it mounted behind
  other sections, so it must not eat arrow keys/shortcuts meant for
  whatever's actually on screen).
- **Calendar visibility is persisted widget settings, not ephemeral
  state.** The calendar widget's `dashboard.json` settings blob holds
  two id lists: `hiddenCalendars` (Settings popover's per-calendar
  switch — hidden from the header chip row AND its events) and
  `disabledCalendars` (header chip tap — chip stays visible/dimmed,
  only its events are filtered). Both derive from the subscribed-
  calendars query: `visible-in-header = subscribed − hidden`,
  `events-on = subscribed − hidden − disabled`. Absent/empty lists
  mean nothing hidden or disabled, i.e. **new calendars are visible by
  default** — this retired the old `seenCalendarIds`
  auto-enable-once-ref dance, since a hidden-list model has no "have I
  seen this id before" question to answer, so a refetch can never
  resurrect a calendar the user deliberately turned off. Empty
  `events-on` = no events shown, consistently across all three views
  (unchanged). Single filtering path: the widget computes
  `filteredEvents` once and passes it to Month/Week/Day alike; none of
  the three re-filters internally.
- **Month:** 7-col grid, 5 rows unless the month genuinely spills into a
  6th week; max 4 event chips per cell, overflow opens a day dialog;
  events bucketed all-day-first, then start time, then calendarId.
- **Week:** fixed 24 h grid, 65 px/hour, auto-scrolls to 7 AM; separate
  all-day row only when needed; overlap layout via
  `lib/calendar-layout.ts`; red now-line on today; day headers show
  weather hi/lo when weather is enabled.
- **Day:** agenda-style (a former 24 h timeline was replaced). Left rail:
  independently browsable MiniMonth + "Coming up" (next 3 future events).
  Main: all-day chips + timed event cards. A 30 s clock dims past events
  to 50 % opacity and drives the "Up next" badge (today only, first
  not-yet-ended event, auto-scrolled into view).
- Event color: `event.color || "#2563eb"`, softened via
  `lib/color-utils.ts` tint/text helpers.

### 3.3 On-screen keyboard (pure core `lib/osk.ts`)

- Eligible fields: textarea + input types
  `{text, search, email, url, tel, password}`. Date/time/number inputs
  are deliberately excluded (native pickers — which the OSK cannot type
  into; see 3.8).
- Modes (localStorage `calendar-osk-mode`, default `auto`): `off` never,
  `on` whenever an eligible field focuses, `auto` only on touch devices.
  Mode changes broadcast live via a window event + `storage` event.
- Touch detection uses `any-pointer: coarse` (NOT `pointer: coarse`,
  which under-reports on kiosks) OR `maxTouchPoints > 0` OR
  `ontouchstart`, and additionally **latches true on the first real
  touch** — the reliable path on Firefox/Linux.
- Three layers: qwerty letters, symbols/digits, and 30 curated single
  emoji (**no ZWJ sequences** — chosen for kiosk-Firefox font support and
  clean Google Calendar round-trip). One-shot shift (phone-style).
- Typing bypasses React via the native value setter + a dispatched
  bubbling `input` event. Backspace deletes whole **graphemes**
  (`Intl.Segmenter`) so surrogate pairs / variation selectors are never
  split. "Done" blurs everything.
- Kiosk defenses (all load-bearing, pinned by `osk.test.ts`): whole cell
  is the touch target; non-passive `touchstart` preventDefault;
  pointer-down preventDefault/stopPropagation so Radix outside-click
  doesn't close dialogs; explicit `pointerEvents: "auto"` because modal
  Radix sets `pointer-events: none` on body and the OSK portals into
  body; focus stolen by a key press is restored to the field;
  `isInsideOsk` keeps the tracked field while focus is on the keyboard;
  solid panel background (an undefined CSS var once made it transparent);
  centered dialogs are lifted via `data-osk-open` CSS when the OSK opens.

### 3.4 Dinner

Runs as the `dinner` widget (3.1); data semantics below are unchanged
from before the widget migration. Storage rides `host.storage` →
`AppStateClient` (same hardened debounce/retry semantics as the old
`use-app-state.ts`, same `dinner` app-state key via the legacy alias
map — existing kiosk data round-trips bit-for-bit). State is a
whole-JSON blob:
`{savedMeals: string[], candidates: {id,title,votes}[], dinners:
Record<dateKey,meal>}`.

- Constants: `MEAL_CAP = 40`, `VOTE_SLOTS = 7`, `VOTE_COOLDOWN_MS = 30 s`.
- Saved meals and candidates: trimmed, blank no-op, case-insensitive
  dedupe, capped (40 / 7).
- `vote()` increments unconditionally in the pure layer; the **cooldown
  is a hook concern and in-memory only** — deliberately never persisted,
  so a reload is always vote-ready. A 1 s ticker drives the "vote again
  in Ns" countdown.
- `resetVoting` clears all candidates and votes (the only way to free
  slots); saved meals untouched.
- Planner: 14 `DayCell`s (current week Sun–Sat + next week). Dinners
  before the current week's Sunday are purged (Sunday inclusive) on load
  and every 60 s; date keys are zero-padded ISO so lexical order ==
  chronological.
- `normalizeDinnerState` degrades any garbage to a valid empty state and
  coerces malformed entries (votes floored at 0).

### 3.5 Chores

Runs as the `chores` widget (3.1); data semantics below are unchanged
from before the widget migration. Storage rides `host.storage` →
`AppStateClient` (same `chores` app-state key via the legacy alias
map); the nav-rail badge is fed via `host.ui.setBadge(openChoreCount)`
instead of the old hoisted-hook prop. State blob:
`{people: [{id, name, colorIdx, doneToday, chores: [{id,title,done}]}],
tallyDate}`.

- Fixed 8-color palette; new person gets `colorIdx = count % 8`.
  `normalizeChoresState` **clamps out-of-range/non-integer colorIdx to
  0** (a white-screen regression) and degrades legacy/garbage shapes.
- `CHORE_CAP = 40` per person, counting done + active — **completing a
  chore does not free cap space**; only "Reset chores" does.
- Two distinct resets:
  - `clearPersonChores`: wipes **one chosen person's** whole list;
    their `doneToday` tally is kept.
  - `rolloverTallies`: at local midnight (checked on load + every 60 s),
    zeroes every `doneToday` and stamps `tallyDate`.
- Header "N done today" reads live `chore.done` (drops to 0 after a
  reset); the per-person "N today" pill reads persistent `doneToday`
  (survives resets). This asymmetry is intentional.
- First run auto-opens people setup; FLIP-style card reorder (active
  above done, 850 ms); completion confetti timers are tracked to avoid
  unbounded growth over kiosk uptime.

### 3.6 Screensaver / power saving

Both mechanisms drive `filter: brightness()` on `<html>` (0.5 s CSS
transition).

- Inactivity: 5 min timeout → 20 % brightness; activity events
  (mouse/key/scroll/touch, capture phase) restore. Brightness setting is
  localStorage `calendar-brightness` (default 1.0), clamped 0.1–1.5.
- The screensaver state **pauses all queries** while dimmed; exiting
  resets to month view of the current month and force-refreshes.
- Manual "Sleep" buttons (calendar header, chores, dinner) show a
  full-screen black overlay ("press any key or touch to wake"); while
  active, event/auth/update dialogs are suppressed.
- Dead code: `screensaver-overlay.tsx` (bouncing logo + clock) is defined
  but never mounted; only `power-saving-overlay.tsx` is used.

### 3.7 Settings and update UI

Settings is a 416 px Radix popover from the nav rail (authenticated
only): brightness slider (30–150 %, step 5), OSK mode (Auto/Always/Off),
per-calendar visibility switches + unsubscribe, add-calendar-by-ID
(`POST /api/calendar/subscribe`), service-account email display with
copy button (or a "key file not found" warning linking `/setup`),
Check-for-Updates and Roll Back buttons, and the current `APP_VERSION`.

Update flow (client side): auto-check if not checked since today 8 AM,
then re-check every 24 h. Dismissals persist per-day (localStorage
`update-dismissed-date`). The update dialog has Available → In-Progress
(non-dismissible, polls `/api/update/status` every 1 s) → Complete
(auto-reload) → Error (Close / Roll Back / Retry) states; a fetch
failure during polling is *assumed to be the restart* and reloads after
5 s.

### 3.8 Kiosk quirks (client)

- **Scrollbars:** global 28 px webkit scrollbars; a
  `@supports not selector(::-webkit-scrollbar)` block widens Firefox
  scrollbars — that block must stay scoped to non-webkit, because setting
  standard scrollbar properties on Chromium 121+ makes it ignore
  `::-webkit-scrollbar` and shrink the bars.
- **Fullscreen** comes from launching the browser with `--kiosk` — the
  client never calls `requestFullscreen`.
- Body: `user-select: none`, `touch-action: manipulation`; touch targets
  min 48 px (56 px on ≥1920 px screens).
- **Native pickers are unusable on the kiosk** (Firefox time segments
  only accept physical-keyboard digits), so the event form uses touch
  hour/minute Selects instead of `datetime-local`.
- Persistence hardening (`lib/app-state-client.ts`'s `AppStateClient`,
  backing every widget's `host.storage`, 3.1): never overwrites real
  data after a failed initial GET (retries GET every 15 s until it
  succeeds); failed PUTs retry every 15 s from the latest state; writes
  debounce 600 ms; the first post-load persist is skipped. Midnight/
  weekly transforms are re-applied on 60 s polls because the kiosk
  crosses those boundaries while mounted.
- Offline (navigator.onLine) pauses queries; sync and auto-refresh
  short-circuit when offline or dimmed.

### 3.9 Color tokens

All client styling colors come from CSS variables (the `--rb-*` palette
plus shadcn tokens) defined in `client/src/index.css`. Tailwind exposes
a subset of them as `rb-*` utility classes via the `rb` map in
`tailwind.config.ts` (38 keys); tokens not in that map are consumed via
arbitrary-value classes (`[var(--rb-…)]`) or inline `style` props.

Hardcoded color literals are allowed only at these documented exception
sites:

- `lib/chores-state.ts` `PERSON_PALETTE` — user-assigned person colors;
  identity data, not styling, and pinned by tests.
- `lib/calendar-meta.ts` `FALLBACK_COLORS` and the `EVENT_FALLBACK_COLOR`
  definition — deterministic per-calendar/per-event fallback colors that
  must match server logic; `EVENT_FALLBACK_COLOR` is the single
  definition site every event-color fallback now points at.
- `lib/color-utils.ts` — the `rgb()`/`rgba()` string builders and the
  `hexToRgb` parse-failure fallback.
- `components/chores/confetti-burst.tsx` `CONFETTI_COLORS` — the pinned
  default; at runtime, callers read `--rb-confetti-1` through `-5` and
  fall back to this constant only if a variable is missing.
- `components/calendar/settings-menu.tsx`'s duplicate calendar-color
  fallback block — a known bug (tracked in TASKS.md), not a styling
  exception; it duplicates `lib/calendar-meta.ts` and should eventually
  call `getCalendarColor()` instead.
- `pages/setup.tsx` — exempt install-guide page.
- `components/ui/**` — vendored shadcn components.
- `*.test.ts` / `*.spec.ts` — literal values asserted by tests.
- `components/screensaver/screensaver-overlay.tsx` — dead code (3.6),
  never mounted.

**Approved rendering drift (founder-ratified 2026-08-19, full rationale
in `docs/plans/widget-system/phase2-color-inventory.md` §2):** the
token sweep is otherwise pixel-identical, except for a small set of
deliberate, accepted deviations —

- Tailwind palette classes (`text-gray-500` etc.) were harmonized onto
  house `rb` tokens instead of aliasing their exact values; the drift is
  confined to secondary dialog chrome (settings popover, update/auth/
  event dialogs, the 404 page).
- Four micro-collapses: `#cfd2d8` → `--rb-ink-disabled`, `#8b919b` →
  `--rb-muted`, two distinct success greens unified onto one
  `--rb-success`/`--rb-success-hover` pair, and one hover-darkening step
  (`hover:text-amber-900`) dropped in favor of the shared warn ink.
- One fallback unification: the `'#4285f4'` calendar-color fallback in
  `event-details-dialog.tsx` now uses `EVENT_FALLBACK_COLOR` (`#2563eb`)
  like every other event-color fallback site.

Anything not on these two lists renders exactly as before the sweep.

## 4. Update system

### 4.1 Cadence

The **client** drives the daily check: `use-version-check.ts` aligns to a
next-check time, then checks every 24 h via `GET /api/update/check`. The
server compares `APP_VERSION` to the latest GitHub release tag (leading
`v` stripped; numeric dotted-segment comparison, missing segments = 0).

### 4.2 Apply flow (`server/services/updateService.ts`)

Statuses with progress %: checking(5) → backing-up(15) → downloading(30)
→ extracting(50) → applying(60) → installing(70, `npm install
--include=dev`) → building(80, `npm run build`) → restarting(90) →
complete(100). The release **source tarball** is downloaded over HTTPS to
`.update-temp/`, extracted with `tar`, and applied to the app root. If
install or build fails, the updater sets an error status, auto-runs
`rollback()`, and rethrows.

- `PRESERVE_PATHS` (never touched by apply/backup/rollback): `.env`,
  `data`, `node_modules`, `.update-backups`, `.update-temp`,
  `service-account.json`, `google_credentials.json`, `calendar.db` (+
  `-shm`/`-wal`).
- **Repo-metadata exclusion** (`isRepoMetadata`): `*.md`, `.claude`,
  `docs`, `.github`, `setup` (with `replit.md` exempt) are excluded from
  *applied files* and *backups*, but deliberately **not** from the
  stale-file deletion pass — so docs already on a device get cleaned up
  and are not re-applied. Consequence: **tracked docs never land on
  kiosks** even though they're in the tarball.
- Restart: `scheduleRestart` exits the process (2 s delay) **only when
  supervised** (env flags above); unsupervised instances stay running and
  show a manual-restart message instead of exit-locking the kiosk.
- Backups: at most **2** retained (oldest deleted first), each a
  timestamped `.update-backups/backup-*` dir containing a `version.txt`
  and all root files except preserves/metadata.

### 4.3 Rollback

Newest backup is restored (same deletion/exclusion rules), `version.txt`
identifies the restored version, then `npm install` + `npm run build`
(errors logged, non-fatal) and a supervised restart.

### 4.4 Supervisor (`scripts/start.sh`)

- Exports `MANAGED_BY_SUPERVISOR=1`, starts `npm start`, then health-checks
  `GET /api/version` on localhost:5000 (30 × 1 s attempts after a 5 s
  grace).
- On repeated failure (3 retries), kills the app and **auto-rolls back**
  from the newest backup, mirroring the updater's preserve list and
  metadata-skip list — **these two lists are maintained by hand in both
  files and must stay in sync** (`PRESERVE_PATHS`/`isRepoMetadata` in
  `updateService.ts` ↔ the `case` lists in `start.sh`).
- Exit 0 (update restart) → relaunch in 2 s; nonzero exit → 5 s; no
  backup available → wait 60 s and retry.

## 5. Data invariants

- One local event row per `(googleEventId, calendarId)` (SQLite UNIQUE).
- Event `endTime > startTime` (Zod refinement on writes).
- All-day events: local-midnight start, inclusive stored end (end of last
  day − 1 ms); never parsed as UTC.
- Events ended > 3 months ago are pruned at each sync.
- `lastSyncAt` = last *successful* sync only.
- App-state: keys ∈ `{chores, dinner} ∪ widget:[a-z0-9-]{2,41}` (built-in
  legacy aliases plus the widget-host storage pattern, 3.1), serialized
  ≤ 64,000 chars, written atomically as whole-blob upserts; server
  treats them as opaque.
- `data/config/dashboard.json`: nav order/enabled-state/per-widget
  settings source of truth. Zod-validated on both read and write;
  writes are atomic (`.tmp` + rename); a missing, unparseable, or
  schema-invalid file degrades to `defaultDashboardConfig()` on read
  rather than ever failing to boot. Gitignored — never tracked, and on
  both updater preserve lists.
- `APP_VERSION` (`shared/version.ts`) is the single version source; update
  eligibility is `latest > current` numerically per dotted segment.

## 6. Known quirks index

- Error middleware re-throws after responding (`server/index.ts`).
- `reusePort` only off-Windows (`ENOTSUP` on win32).
- `DATABASE_URL` branch = in-memory storage, not Postgres (misleading log).
- Localhost guard trusts the raw socket IP; no `trust proxy` — re-verify
  if a reverse proxy is ever introduced.
- Update `check`/`status`/`backups` endpoints are unguarded; only
  `apply`/`rollback` are localhost-only.
- No server-side scheduler: sync cadence, update checks, and state
  refresh are all client timers.
- Drizzle/Postgres schema lacks `app_state`; `db:push` covers events/users
  only.
- `better-sqlite3` is a native module — always `npm install` on the target
  device, never copy `node_modules` across architectures.
- Chores/Dinner are not routes — section state lives in AppShell, not a
  page. Their live-badge/debounce/cooldown guarantees no longer depend
  on being specially hoisted: `WidgetHostMount`'s keep-alive (mount
  once at boot, hide via `display: none`) covers every enabled widget
  uniformly (3.1).
- OSK touch detection must use `any-pointer: coarse` and the first-touch
  latch; `pointer: coarse` under-reports on the kiosk (3.3).
- Firefox scrollbar CSS must stay inside the
  `@supports not selector(::-webkit-scrollbar)` guard (3.8).
- Chore cap counts completed chores; dinner vote cooldown is in-memory
  only by design (3.4, 3.5).
- `screensaver-overlay.tsx` is dead code; the live overlay is
  `power-saving-overlay.tsx` (3.6).
- `PUT /api/config/dashboard` from the client requires an
  already-loaded config in the react-query cache — `app-shell.tsx`'s
  `writeDashboardConfig` drops (and just invalidates/refetches) any
  change attempted before the first successful `GET`, rather than ever
  PUTting a `defaultDashboardConfig()`-derived document over a real
  on-disk one (3.1).
- Manual sleep (`host.ui.sleep()` / the Sleep buttons) does not
  dispatch `screensaver-state-change` — only the auto-screensaver's
  inactivity timeout does (3.6). `WidgetHostMount`'s `awakeRef`
  therefore only tracks the latter; a widget mounted mid-session (the
  layout picker enabling it) while the kiosk is manually asleep comes
  up visible instead of hidden — a pre-existing asymmetry, not
  introduced by keep-alive (3.1).
- A widget host's React root unmounting synchronously during another
  component's render can trigger React's dev-only "Attempted to
  synchronously unmount a root while React was already rendering"
  warning; cosmetic, reproduces on cold boot in dev, not yet
  root-caused (tracked in TASKS.md).
