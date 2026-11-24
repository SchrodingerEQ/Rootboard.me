# Rootboard.me — As-Built Specification

Regenerated from the code at v1.4.1 (2026-07-23); maintained
incrementally through the widget-system phases and current as of v1.8.0
(2026-11-21), the release that ships the beta-launch work merged through
2026-11-16 (latest: Google sign-in, brief 02). This documents what the app **actually does**, including
quirks. Update it when behavior changes.
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
  logger that truncates logged response JSON to 79 chars. Response bodies
  of `/api/weather/lookup`, `/api/pair`, `/api/system/pairing-code`,
  `/api/system/diagnostics` and `/api/system/paired-devices` are never
  logged (place names, the code and token, the full diagnostics view).
- **Log ring** (`server/services/logRing.ts`, installed by
  `server/install-log-ring.ts`, the second import after dotenv so the
  services' startup lines are caught): console.log/info/warn/error also go
  into an in-memory ring of the last 500 lines. Lines are scrubbed before
  storage: emails, `Bearer …` and `rbp_…` tokens, the response-body
  tail of request log lines (it can hold event titles), and any value
  wrapped in `logPrivate()` (calendar names, calendar ids, paired-device
  names; an invisible U+2063 mark the journal shows as plain text) are
  removed. Request lines are kept only for 5xx, so kiosk polling or a 401
  flood from the LAN can't push errors out. No file is written. The
  diagnostics bundle shows the last 50 (2.7). **Any new log line that
  prints a name or other personal text must wrap it in `logPrivate()`.**
- Startup: `await storageReady` → `registerRoutes` (first mounts the LAN
  guard, 2.7) → error middleware → Vite (dev) or static (prod) → listen.
  With `LAN_API_OPEN=true` a boot warning says the API is open.
- **Quirk:** the error middleware responds `{message}` with the error's
  status, then **re-throws** the error after responding.
- **Quirk:** `reusePort: true` is set only when `platform !== "win32"` —
  it throws `ENOTSUP` on Windows.
- Dev mode (`NODE_ENV=development`) mounts Vite middleware with an
  HTML catch-all (cache-busts `main.tsx` with a nanoid query); Vite logger
  errors call `process.exit(1)`. Prod serves `dist/public` with an
  `index.html` SPA fallback. API routes must register before the catch-all.

### 2.2 Endpoint inventory (`server/routes.ts`)

**Guard column:** "LAN token" means loopback callers need nothing and any
other caller needs a paired bearer token (2.7); before brief 05 every row
marked so was open to the whole network. "Kiosk only" means loopback only,
even with a token.

| Method | Path | Purpose | Guard |
|---|---|---|---|
| GET | `/api/version` | `{version, timestamp}` — supervisor health-check target | none (open from the LAN) |
| GET | `/api/weather` | Cached Open-Meteo forecast, or `{enabled:false}` | LAN token |
| GET | `/api/weather/status` | `{configured, lastSuccessAt, lastError:{at, reason}}` — server-side Open-Meteo health for Settings → System | LAN token |
| GET | `/api/weather/lookup?postal=&country=` | Postal code → `{candidates:[{label, lat, lon}]}` via `api.zippopotam.us` (server-side proxy, 20 s budget); 400 on bad input, 502 generic message when the lookup host is unreachable; response body is kept out of the request log | LAN token |
| GET | `/api/calendar/events` | Events overlapping `from`/`to` (legacy `startDate`/`endDate` accepted) | LAN token |
| GET | `/api/calendar/calendars` | Google calendar list | LAN token |
| DELETE | `/api/calendar/calendars/:calendarId` | Unsubscribe + purge local events | LAN token |
| POST | `/api/calendar/events` | Create event in Google + local mirror | LAN token |
| PATCH | `/api/calendar/events/:id` | Update event | LAN token |
| DELETE | `/api/calendar/events/:id` | Delete event (204; 404 if missing) | LAN token |
| POST | `/api/calendar/subscribe` | Subscribe calendar (409 dup, 400 bad) | LAN token |
| POST | `/api/calendar/sync` | Pull a date window from Google into storage | LAN token |
| GET | `/api/calendar/sync-status` | `{lastSyncAt,lastSyncError,syncing}`, no-store | LAN token |
| GET | `/api/calendar/service-account-email` | Service account `client_email` | LAN token |
| GET | `/api/calendar/auth-status` | `{authenticated,needsAuth,error,mode,email,oauthClient}`, no-store; `mode` is `oauth`\|`service-account`\|`none`, `oauthClient` is `missing`\|`configured`\|`invalid` (2.3); body kept out of the request log | LAN token |
| POST | `/api/google/start` | Begin Google sign-in (2.3): `{url}` of Google's page for the kiosk browser; replaces any earlier unfinished sign-in; 409 `{message, oauthClient}` when the unit has no valid sign-in client; body kept out of the request log | **kiosk only** + JSON body + not cross-site |
| GET | `/api/google/callback?code&state` (or `?error&state`) | Google's loopback redirect: exchanges the code with the PKCE verifier, saves the tokens, empties the event cache, then 302 to `http://localhost:5000/?google=connected` or `?google=failed&reason=` (`denied`, `expired`, `bad-request`, `no-refresh-token`, `exchange-failed`, `no-client`) | **kiosk only** |
| GET | `/api/google/status` | Same `{mode, authenticated, error, email, oauthClient}` as auth-status, no-store; body kept out of the request log | LAN token |
| PUT | `/api/google/client` | Install the unit's Google sign-in client: Google's Desktop-client JSON as downloaded (`installed.client_id` ending `.apps.googleusercontent.com`, non-empty `installed.client_secret`, ≤ 8 KB) → `data/google-oauth-client.json` (tmp + rename, 0600) → `{configured: true}` only, never echoing the secret; 400 invalid, 413 too large, 403 non-JSON or cross-site | LAN token (kiosk or paired) + JSON body + not cross-site |
| POST | `/api/google/signout` | Revoke at Google (best effort), delete `data/google-oauth.json`, empty the event cache → `{signedOut, revoked, cleared}`; 409 when not signed in with Google | **kiosk only** + JSON body + not cross-site |
| GET | `/api/update/check` | Compare `APP_VERSION` vs the newest release on this kiosk's channel (§4.1); includes `channel` | LAN token |
| GET | `/api/update/status` | In-memory update progress plus the effective `channel` | LAN token |
| POST | `/api/update/apply` | Trigger update (fire-and-forget) | **kiosk only** |
| POST | `/api/update/rollback` | Trigger rollback (fire-and-forget) | **kiosk only** |
| GET | `/api/update/backups` | List backups | LAN token |
| GET | `/api/state/:key` | Read app-state blob | LAN token + key whitelist |
| PUT | `/api/state/:key` | Write app-state blob | LAN token + key whitelist + 64,000-char cap |
| GET | `/api/config/dashboard` | Re-reads config from disk every call; `{config, source}` | LAN token |
| PUT | `/api/config/dashboard` | Zod-validate + atomic write of the whole config | LAN token |
| GET | `/api/widgets` | Discover `widgets/*/widget.json`; `{widgets, invalid}`, no-store | LAN token |
| GET | `/api/system/diagnostics?view=redacted\|full` | Diagnostics bundle (2.7), no-store | redacted: none (open from the LAN); full: LAN token |
| POST | `/api/system/pairing-code` | Show a new 6-digit pairing code `{code, expiresAt}` (replaces any earlier one) | **kiosk only** |
| GET | `/api/system/pairing-code?code=` | `{active}` — whether that code still works (never returns a code) | **kiosk only** |
| DELETE | `/api/system/pairing-code?code=` | Cancel the showing code (only that code, when `code` is given); 204 | **kiosk only** |
| POST | `/api/pair` | `{code, name}` → 201 `{token, device}`; 410 no/expired code; 403 wrong code (`attemptsLeft`); 400 bad name; 409 too many devices | none (the code is the credential) |
| GET | `/api/system/paired-devices` | `{devices:[{id, name, createdAt}]}` (never a hash), no-store | LAN token |
| DELETE | `/api/system/paired-devices/:id` | Revoke a device; 204, 404 unknown | LAN token |
| GET | `/widgets/*` | Static community-widget assets (`express.static`) | realpath containment |
| GET | `/api/system/network/status` | `{managed, connected, connection:{type: wifi\|ethernet\|other, device, name, ip}, hasWifiDevice, uptimeSeconds}` (shapes in `shared/system-network.ts`; the nmcli read is reused for 3 s); `?internet=1` adds `internet: "reachable"\|"unreachable"` (one HEAD to `www.googleapis.com`, answer reused for 15 s), no-store (3.11) | LAN token (2.7) |
| POST | `/api/system/network/scan` | Rescan → `{networks:[{ssid, signal, secured, inUse}]}`; 502 when the scan is refused, 409 when NetworkManager is absent | **localhost-only** |
| POST | `/api/system/network/connect` | `{ssid, password?, hidden?}` → `{status:"connected"}` or `{status:"failed", reason}` (`bad-password`, `not-found`, `timeout`, `failed`); 400 for a bad SSID or a password of impossible length | **localhost-only** |
| POST | `/api/system/network/forget` | `{ssid}` → deletes every saved Wi-Fi profile for that SSID (no UI yet) | **localhost-only** |
| GET | `/api/system/timezone` | `{managed:false}` or `{managed:true, current, zones}`, no-store | LAN token (2.7) |
| POST | `/api/system/timezone` | `{timezone}` (must be in `zones`) → `timedatectl set-timezone`, then `process.env.TZ` so the server follows at once | **localhost-only** |

- **Kiosk-only guard:** `isLocalRequest` (`server/middleware/lanAuth.ts`)
  compares `req.ip`/socket address to `127.0.0.1`, `::1`,
  `::ffff:127.0.0.1`, `localhost`; violations get 403. Applied to update
  `apply`/`rollback`, to issuing/cancelling a pairing code, and to the four
  `/api/system/*` Wi-Fi/time-zone mutations (`server/system-routes.ts`)
  and the three Google sign-in mutations (`server/google-routes.ts`) —
  a paired LAN device cannot change them either. Update/rollback and the
  system mutations also require a JSON body and refuse `Sec-Fetch-Site: cross-site`/`same-site`,
  so a web page open in the kiosk's own browser cannot form-POST to
  localhost (one shared check, `isSameOriginJsonRequest` in
  `server/middleware/lanAuth.ts`); so do Google start and
  sign out. The Google callback cannot (it *is* Google's cross-site
  redirect) and relies on the single-use `state` instead. The same check is what
  lets the kiosk skip the LAN token (2.7). No `trust proxy` is configured,
  so both check the direct socket peer; a reverse proxy would make every
  caller look local — re-verify if one is ever added.
- **Validation:** Zod. Event writes coerce `startTime`/`endTime` to Date,
  require non-empty trimmed title, and refine `endTime > startTime`;
  creates also require `calendarId`. App-state keys whitelisted to
  `{chores, dinner}` (built-in legacy aliases) **∪** `widget:<id>`
  (pattern `^widget:[a-z0-9][a-z0-9-]{1,40}$`, i.e. id length 2–41 —
  the widget host's per-widget storage namespace, §3.1); unknown key →
  400; serialized value > 64,000 chars → 413-style rejection. Dashboard
  config PUT validates the whole document against the same schema used
  to read it; an invalid body → 400 with flattened Zod errors. Because
  `weather` and `update` are lenient, a PUT carrying a malformed value
  for either is refused with 400 rather than silently erasing it.
- **Apply/rollback respond `{status:"in-progress"}` immediately**; progress
  is observable only by polling `GET /api/update/status`.
- **Widget discovery** (`server/services/widgetDiscovery.ts`):
  `GET /api/widgets` re-scans `widgets/*/widget.json` on every call (no
  caching, no restart needed after a sideload) and never throws — a
  missing `widgets/` dir returns an empty result, and a folder that
  fails to read/parse/validate becomes an `invalid` entry instead of
  aborting the scan. Each `widget.json` read is capped at 65,536 bytes (64 KiB)
  (`MAX_MANIFEST_BYTES`) so an oversized manifest can't stall a request.
  `/widgets/*` static serving sits behind a realpath containment guard
  ahead of `express.static`: the request path is resolved with symlinks
  followed and rejected unless it lands strictly inside the real
  `widgets/` root — this closes a symlink-escape route (e.g.
  `widgets/evil/x -> ../../service-account.json`) that a literal
  `..`-segment check alone would miss.

- **Request log:** `/api/system/network/*` response bodies (SSIDs,
  the kiosk's address) are kept out of the log like the weather lookup's
  (`UNLOGGED_BODY_PATHS`, `server/index.ts`). No handler logs a request
  body, so a Wi-Fi password never reaches the journal; a failed connect
  logs only its reason and nmcli's exit code.

### 2.3 Google Calendar service (`server/services/googleCalendar.ts`)

- **Two identities, one seam** (brief 02, decision 0017):
  `calendarClient()` returns the signed-in owner's `OAuth2Client` when
  `data/google-oauth.json` exists, else the service account. Every Google
  call (list, sync, insert/patch/delete, subscribe) goes through
  `withCalendar()`, so the code below the seam is the same for both.
  `getAuthStatus()` → `{mode, authenticated, error, email}`:
  - `oauth` whenever the token file exists. Connected while it holds a
    refresh token; after `invalid_grant` it holds `lost: {at, reason}`
    and no tokens, so `authenticated` is false and `error` is the
    one-sentence reason. Wins over a service-account key; a boot log line
    says so when both exist.
  - `service-account` when the key loaded; `none` otherwise (`error` is
    the key-file error).
- **Sign-in client** (`server/services/googleOAuthClient.ts`, decision
  0017 "Client credentials"): the Desktop client's id and secret are
  never in the repo. Each unit reads `data/google-oauth-client.json`,
  Google's download as-is (`{"installed": {client_id, client_secret, …}}`),
  on demand, so a new file needs no restart. It is written by `PUT
  /api/google/client` or put in place by scp / the provision script.
  `oauthClient` in the auth status is `missing`, `configured` or `invalid`
  (unparseable, wrong shape, or > 8 KB). The secret is never logged or
  returned; diagnostics carry only `{status, projectNumber}` (the leading
  digits of the client id). Without a valid file, start answers 409, a
  signed-in unit reports `authenticated: false` with that reason, and the
  service-account path is unaffected. `shared/google-oauth-client.ts`
  holds only the scopes.
- **Google sign-in** (`server/services/googleOAuth.ts`, flow B): Desktop
  client from the file above, scopes
  `calendar.events` + `calendar.readonly`, `access_type=offline`,
  `prompt=consent`, PKCE S256 (43-char verifier), redirect
  `http://127.0.0.1:5000/api/google/callback`. One pending sign-in at a
  time (in memory, 15 min, single use; a restart cancels it). The
  account address is the primary calendar's id (no extra scope), for
  display only. The library refreshes the access token; each refresh is
  written back. Token file: mode 0600, atomic `.tmp` + rename; a
  damaged file reads as signed out and is left in place. `invalid_grant`
  on any call → `markLost()` once, `GoogleAccessLostError`, and later
  calls fail fast without contacting Google (no retry loop).
- **Testing-status limit:** while the OAuth consent screen is in
  Testing, only listed test users can sign in and Google expires the
  refresh token after 7 days (→ the lost state above). Production status
  removes both.
- Service-account auth: `GoogleAuth` with the key at
  `GOOGLE_SERVICE_ACCOUNT_KEY_FILE` (default `./service-account.json`),
  scope `https://www.googleapis.com/auth/calendar`. Eager init at
  construction: existence-check the key file, then `auth.getClient()`
  preflight so bad keys fail at startup, not first use. All public
  methods await the init promise.
- Calendars = everything in the identity's `calendarList` (signed in:
  the owner's list, which includes calendars shared with them).
  Subscribe/unsubscribe = `calendarList.insert`/`.delete` (404
  swallowed); service account only: signed in, both routes answer 409
  ("add or remove calendars in Google Calendar") without calling Google,
  since the OAuth scopes do not allow them and the list is the owner's.
- **Account change:** the callback (after saving the tokens) and sign
  out first call `beginAccountChange()`: it bumps a generation counter
  and waits for any running sync, which stops before its next storage
  write (`AccountChangedError`), then the event cache is emptied. So a
  sync started under the old identity can never write its events back
  after the clear.
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
- Event colors: calendar `backgroundColor`, else
  `calendarFallbackColor(id)` from `shared/calendar-color.ts`, the same
  function the client's `getCalendarColor()` uses for Settings, chips and
  avatars, so an uncolored calendar matches everywhere. (A colorId→color
  map exists in the file but is not wired into sync.)
- Writes go to Google first (insert/patch/delete by stored
  `calendarId` + `googleEventId`), then mirror locally; deletes swallow
  Google 404/410 and still prune the local row. Timed events send the
  server's local IANA timezone.

### 2.4 Storage (`server/storage.ts`, `server/sqlite-storage.ts`)

- Storage is always `SQLiteStorage('./calendar.db')`. There is no
  other backend: the old `DATABASE_URL` → in-memory `MemStorage` branch
  was removed on 2026-11-11 (decision 0002). If `DATABASE_URL` is still
  set, the server logs that it is ignored and uses SQLite.
- SQLite: WAL mode. Tables:
  - `users(id, username UNIQUE, password)` — defined, unused by routes.
  - `calendar_events(…, UNIQUE(google_event_id, calendar_id))` with
    indexes on `(start_time, end_time)` and `google_event_id`; timestamps
    are ISO text; overlap query is `start_time < ? AND end_time > ?`.
  - `app_state(key PRIMARY KEY, value, updated_at)` — upsert on conflict.
- `shared/schema.ts` declares the `users` and `calendar_events` row
  types with Drizzle's Postgres table helpers; only the TypeScript types
  and insert schemas are used. No Drizzle client, config or migration
  runs (`drizzle.config.ts` and `npm run db:push` were removed with the
  `DATABASE_URL` path).
- Chores and dinner are **opaque JSON blobs** under app-state keys
  `chores` and `dinner`; the server never parses them. There are no
  dedicated tables or endpoints for them.

### 2.5 Weather (`server/services/weatherService.ts`)

The location resolves on every request (`resolveWeatherConfig`, decision
0015): the `weather` key of `data/config/dashboard.json` (set from
Settings → System → Weather, 3.7) wins; when it is absent or malformed
the `WEATHER_*` env vars are the fallback; with neither, weather is off.
The env path is enabled only when `WEATHER_ENABLED="true"` and
`WEATHER_LAT`/`WEATHER_LON` are finite numbers; `WEATHER_UNITS` is
`fahrenheit` or defaults to celsius; `WEATHER_LOCATION_LABEL` defaults
to empty. Startup logs one line naming the source (and that `.env` is
ignored when both are set), never the place. A change of location or
units takes effect on the next request without a restart: the cached
forecast and the status fields are dropped, and a fetch still in the air
for the old place does not fill the cache. Forecast is fetched
from Open-Meteo (20 s budget per attempt, kept in `shared/weather-timeouts.ts`
next to the widget's — the kiosk's Wi-Fi can stall
for seconds at a time) and cached server-side for 30 minutes; a failed
refresh serves the last good payload. The last good payload is also
written atomically to `data/weather-cache.json` (gitignored; `data/` is
in the updater's preserve list) and loaded at startup as the stale
fallback only: the first request after a restart still asks upstream,
and the file is never served as fresh. `lastSuccessAt` in
`/api/weather/status` is restored from it. Decision 0014.

Payload: `{ enabled: true, current, daily[7], hourly[≤48], units,
location, updatedAt }`. `hourly` (added for the What to Wear widget,
3.10) carries `time, temp, feelsLike, precipChance, precipMm, snowCm,
code, windKmh, uv` from the first hour of the current local day;
`temp`/`feelsLike` follow `WEATHER_UNITS` (reported in `units`), wind is
km/h, precipitation mm, snowfall cm. `/api/weather` never carries the
coordinates — only the derived forecast. A location set from Settings
is stored in `dashboard.json`, so its postal code, label and
postal-code-centroid coordinates are returned by `/api/config/dashboard`
to the kiosk UI; `.env` coordinates never reach the client. The weather
service contacts only `api.open-meteo.com` (HTTPS, keyless); the
Settings lookup (`server/services/weatherLookup.ts`) contacts only
`api.zippopotam.us`, on a tap, and never logs the postal code. When weather is not
configured the response is `{ enabled: false }`; when it is configured
but the upstream fetch failed with a cold cache it is
`{ enabled: false, configured: true }` (an outage, not a setup problem;
an older server without the field reads as not configured). When the
upstream fetch fails with a warm cache, the last good forecast is served
with an additive `stale: true` (its `updatedAt` says how old it is);
fresh responses omit the field.

Clients (`hooks/use-weather.ts`: header and week view) poll every 30
minutes while weather is healthy or not configured, every minute while
there is nothing to show (`{ enabled: false, configured: true }`, a
request error, nothing loaded yet) and every 5 minutes while a stale
forecast is being re-served (`lib/weather-poll.ts`). The server only
retries upstream when a client asks, so this is also the retry cadence.

### 2.6 Environment variables

| Var | Default / behavior |
|---|---|
| `GOOGLE_SERVICE_ACCOUNT_KEY_FILE` | `./service-account.json`; only for the service-account path. Google sign-in needs no env var: its client is `data/google-oauth-client.json` and its tokens `data/google-oauth.json` (2.3), never `.env` and never the repo |
| `DATABASE_URL` | no longer used; if set, a startup log line says it is ignored (see 2.4) |
| `GITHUB_REPO_OWNER` / `GITHUB_REPO_NAME` | `SchrodingerEQ` / `Rootboard.me` |
| `UPDATE_CHANNEL` | `stable` or `beta`; fallback only when `dashboard.json` has no `update` key (§4.1); anything else logs a warning and means `stable` |
| `MANAGED_BY_SUPERVISOR` / `SUPERVISED` | `1` → self-restart after update allowed |
| `PM2_HOME`, `INVOCATION_ID` | presence implies supervised (pm2/systemd) |
| `WEATHER_*` | fallback only when `dashboard.json` has no `weather` key — see 2.5; deprecated for kiosks (use Settings → System → Weather), still fine for hosted use |
| `NODE_ENV` | `development` → Vite middleware; else static `dist/public` |
| `LAN_API_OPEN` | `true` → non-loopback callers need no pairing token (hosted/dev escape hatch; boot warning). Kiosk-only routes stay kiosk-only. Any other value or unset → pairing required (2.7) |

### 2.7 LAN pairing and diagnostics (beta-launch brief 05, decision 0020)

**Guard** (`server/middleware/lanAuth.ts`), mounted first in
`registerRoutes` with `app.use("/api", …)` — the same case-insensitive,
trailing-slash-tolerant matching the routes use, so `/API/…` cannot reach
a handler around it. Order: loopback → pass (`res.locals.apiAccess =
"loopback"`); `LAN_API_OPEN=true` → pass (`"lan-open"`); a valid
`Authorization: Bearer <token>` → pass (`"paired"`); `GET /api/version`,
`GET /api/system/diagnostics` or `POST /api/pair` (also as HEAD for the
two GETs, in any letter case, with one trailing slash — the forms Express
routes to those same handlers) → pass (`"unpaired"`);
anything else → 401 `{message: "Pairing required", pairing: <how-to>}`
with `WWW-Authenticate: Bearer realm="rootboard"`.

**Pairing** (`server/services/pairingService.ts`): one code at a time,
6 digits from `crypto.randomInt`, in memory, 5-minute TTL, single use,
cancelled after 5 wrong tries (compare is constant-time). A token is
`rbp_` + 32 random bytes base64url; only its SHA-256 is kept, in
`data/paired-devices.json` (`{devices:[{id, name, createdAt,
tokenHash}]}`, mode 0600, `.tmp` + rename). The file is re-read on each
LAN call, so deleting it over SSH revokes everything without a restart; a
missing or invalid file means no devices (fails closed), and the next
pairing renames an invalid file to `paired-devices.json.damaged` instead
of overwriting it. Names are 1–64 characters, control characters
stripped. At most 20 devices. `code` may be a string or a whole number
(re-padded to 6 digits).

**Diagnostics** (`server/services/diagnosticsService.ts`, type in
`shared/diagnostics.ts`): `version`, app and system uptime, Node version,
platform/arch, `supervised`, update status + last check (in memory,
`getLastUpdateCheck`), auth `{mode: oauth|service-account|none, connected,
error, oauthClient: {status, projectNumber}}` (never the email, the
client id or its secret; brief 02), calendar sync
status, weather status, enabled widgets with versions (built-ins from
their manifests) and errors, widget-folder errors, theme id, network
`{interface, connected, internetReachable}`, disk free/total on the app
volume (`fs.statfsSync`), Wi-Fi self-heal count, config warnings
(`readDashboardConfig().warnings`), last 50 log-ring lines.
- `internetReachable` is inferred from the latest weather fetch / calendar
  sync (a success in the last 2 h → true, a later failure → false, else
  null); the bundle makes no network call.
- Wi-Fi self-heal: `null` unless `/etc/systemd/system/wifi-selfheal.timer`
  exists; otherwise the number of `reconnected` lines from
  `journalctl -t wifi-selfheal --since -24h -o cat` (INSTALLATION.md
  §12.3). journalctl's "not seeing messages from other users" hint (the
  service user is not in `systemd-journal`/`adm`) also gives `null`, not 0.
- The full view adds `network.ssid` (`nmcli -t -f active,ssid dev wifi`,
  else `iwgetid -r`), `network.ip`, `network.hostname`. The whole bundle
  is built at most once per 5 s (concurrent calls share one build; a
  failed build is not kept), because the redacted view is open to the LAN.
- **Redaction** (`redactDiagnostics`): drops the three fields, then
  scrubs every string of the SSID, IP, hostname and Linux username (values
  of 3+ characters), IPv4 literals, `/home/<user>`, emails, tokens, and any
  remaining `@`. Both views scrub emails and tokens. IPv6 literals are
  not scrubbed (a time like `8:10:53` looks like one); the kiosk's own
  address is only ever read as IPv4.

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
  at bottom — in every auth state since brief 05) + flex content column.
- TanStack Query defaults are fully manual: `staleTime: Infinity`,
  `retry: false`, no refetch-on-focus/interval; all cadence is explicit
  timers. All requests send `credentials: "include"`. Multiple React
  roots (shell + one per widget) share the single module-singleton
  `queryClient` — cache and invalidations are shared across all of
  them, by design.
- **AppShell** (`components/app-shell.tsx`) owns everything that is not
  widget content: the nav rail, screensaver/brightness/power-saving,
  the update check/apply/rollback flow, and the Settings popover. The
  popover is a main screen (Brightness, five category rows, version)
  plus five sub-menus opened by tapping a row and closed with Back
  (`components/calendar/settings-nav.ts`): **Display** (theme picker,
  theme errors), **Calendars** (service-account display, per-calendar
  visibility switches, remove, add-calendar — the list and add-calendar
  are hidden while Google is not connected), **Widgets** (layout
  picker — enable/disable + reorder installed widgets and their
  settings, community widgets, widget-folder errors), **Keyboard** (OSK
  mode), **System** (update check, roll back, Setup: Wi-Fi / Time zone /
  Run setup again — 3.11, weather status, and two sub-screens:
  **Diagnostics** and **Pair a device**, 3.7; Back from them returns to
  System, `parentView` in `settings-nav.ts`). It always
  reopens on the main screen; a category with a problem (theme error,
  widget-folder error or crashed community widget, missing
  service-account key, the server's latest weather fetch failed) shows
  a warning dot on the main screen. The weather status
  (`lib/weather-status.ts`, refetched each time Settings opens) shows
  the last successful update and the most recent failure as a plain
  sentence plus the error code (e.g. "Couldn't look up
  api.open-meteo.com — no internet, or a DNS problem (ENOTFOUND)"), so
  the cause can be read off the touchscreen before a reboot clears it.
  It lives in server memory only, is hidden when weather isn't
  configured, and covers the server's fetch — not What to Wear's
  zip-code path, which the browser fetches itself. The reason never
  includes the error message (the request URL carries the coordinates),
  only a mapped sentence and the code. The panel is height-capped to the
  on-screen space and scrolls; because it opens upward from the rail and
  floating-ui re-anchors only on window resize, a view switch and the
  OSK opening/closing each dispatch a `resize` so it stays on its
  trigger, and while the OSK is open the panel is stretched to the OSK
  height cap so the Add Calendar field sits above the keyboard. The
  single OSK stays
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
  chores, dinner enabled; what-to-wear disabled;
  `defaultWidget: "calendar"`) is both
  the client's placeholder while the query is pending and the server's
  fallback for a missing/corrupt file (2.2).
  A built-in widget absent from an existing `dashboard.json` (e.g. one
  added in a later release) is listed in the layout picker as disabled
  and appended to the config when the user enables it.
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
- **Community widget ecosystem repos** (Phase 5): the starter template
  + tutorial + contribution guide live in `rootboard-widget-template`,
  the reference widget in `rootboard-widget-grocery-list`, and the
  community list in `awesome-rootboard` — all under the same GitHub
  account as this repo. The contract doc here stays normative.
- **Community widget loading** (folder-drop, Phase 4;
  `lib/community-widgets.ts`, `server/services/widgetDiscovery.ts`): the
  shell polls `GET /api/widgets` every 60 s (same cadence as the
  dashboard-config poll, 3.1 above) and the server re-scans
  `widgets/*/widget.json` on every call, so a folder sideloaded via SD
  card/SSH appears in the layout picker without a restart. Only
  **enabled** manifests are ever imported (`filterEnabledManifests`) —
  a discovered-but-disabled widget's entry module never executes.
  Before any import is attempted, `apiVersion` is checked against
  `WIDGET_API_VERSION`; a widget built for a newer contract is listed
  but never fetched, shown as "built for a newer Rootboard"
  (`loadCommunityWidget`). An imported module is validated against the
  contract's shape (`{ default: { mount(container, host) } }`,
  `extractWidgetFromModule`) before it counts as loaded — a mismatch
  surfaces as a load error, not a crash. Imports are cached by
  `id`+`version`: toggling a widget off then back on without a manifest
  version bump reuses the cached module rather than re-importing, so
  its top-level (module-scope) code runs once per version, at first
  enable, and does not re-run on re-enable — only `mount()`/`unmount()`
  replay. Bumping the manifest `version` (an SSH-side edit) invalidates
  the cache and remounts the widget in place on the next poll, no page
  reload needed; built-ins never change identity, so this path is a
  no-op for them (`widget-host-mount.tsx`).
- **Crash isolation:** every widget lifecycle call — `mount()`,
  `unmount()`, `refresh()`, `onVisibilityChange()` — is wrapped so a
  throw is caught and logged, never left to propagate
  (`widget-host-mount.tsx`'s `safeMount`/`safeUnmount`/
  `safeVisibilityChange`). A `mount()` throw (or a return that isn't
  `{unmount(): void, ...}`) is reported via `onWidgetCrash`, which drops
  the widget from the renderable set and surfaces the crash in the
  picker instead of ever blanking the app; a `WidgetHostErrorBoundary`
  around the render tree is the belt to this guarded-call-sites
  suspenders. This applies uniformly to built-in and community widgets
  — CONTRACT.md's "no privileged internals" extends to fault
  handling.
- **Icons render `<img src>` only** — never inline/innerHTML SVG. This
  is what makes an embedded `<script>` in a malicious icon inert without
  a separate sanitization pass, and is how CONTRACT.md §2's "sanitized
  before render" is satisfied in v1, for built-in and community icons
  alike.
- **Layout picker — per-pool reorder:** built-in and community widgets
  are two separate ordering pools over the one `config.widgets` array
  (`app-shell.tsx`'s `moveWidget`/`moveCommunityWidget`). Reordering
  resolves "the next widget" among same-pool ids only, then swaps those
  two ids' actual array positions — a community widget's move can land
  it past one or more built-in entries in the underlying array if
  they're interleaved, since only same-pool adjacency is guaranteed, not
  raw array adjacency. A `config.widgets` entry whose folder is no
  longer present renders as a **ghost row** ("not installed — folder
  missing") in the picker — kept so its settings aren't silently
  discarded, but with no reorder arrows, since a ghost has no discovered
  position to reorder among.
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
  `theme.subscribe` fires after every theme switch (see "Themes" below).
  `fetch` is `window.fetch.bind(window)` — full network
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
- Four first-party widgets ship under `client/src/widgets/`:
  `calendar/`, `chores/`, `dinner/`, `what-to-wear/` (3.10) — each a `manifest.json` +
  `index.tsx` that mounts its own `createRoot` React tree (wrapped in
  `QueryClientProvider client={queryClient}`) around the pre-widget
  page/hook, reached only through `mount(container, host)` like any
  community widget would be — no privileged internal access.
- **Keep-alive consequence, accepted:** mount-time effects in a
  widget's top-level tree fire once per app boot instead of once per
  *section* visit. Note the scope: this covers section switches only —
  the calendar's own Month/Week/Day sub-views are still conditionally
  mounted inside the widget, so e.g. the Week view's
  auto-scroll-to-7AM (3.2) still re-fires on every Day→Week toggle;
  what no longer remounts is the widget as a whole when leaving and
  returning to the Calendar section while the view stays on Week.
  Similarly, the Day view's 30 s clock (past-event dimming + "Up next"
  badge, 3.2) keeps ticking while the calendar widget is hidden
  (`display: none`), not just while visible — wasted but negligible
  work, not a correctness issue.

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
- The "Syncing calendar..." indicator (top right) shows only while the
  calendar is the visible section; a sync still in flight when another
  section comes up carries on without it, so it never covers that
  section's header.
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
- **Default view is Day** (the widget opens on today's agenda).
- **Month:** 7-col grid, 5 rows unless the month genuinely spills into a
  6th week; max 4 event chips per cell. When a day overflows, a
  full-width **"+ N more" pill** (≥32 px tall) replaces the last chip
  row and sits outside the clipped chip list, so it is never cut off;
  a ResizeObserver on the grid fits only whole chip rows into short
  cells (fewer chips on small screens, pill always kept). Tapping the
  pill **or the day number** opens the day dialog. Events bucketed
  all-day-first, then start time, then calendarId.
- **Week:** fixed 24 h grid, 65 px/hour, auto-scrolls to 7 AM; separate
  all-day row only when needed; overlap layout via
  `lib/calendar-layout.ts`; red now-line on today; day headers show
  weather hi/lo when weather is enabled.
- **Day:** agenda-style (a former 24 h timeline was replaced). Left rail:
  independently browsable MiniMonth + "Coming up" (next 3 future events).
  **Tapping a MiniMonth day shows that day** (sets the widget's
  `currentDate`; greyed adjacent-month days work too). Today stays the
  coral fill; a picked non-today day gets an accent ring. The agenda
  heading reads "Today's Schedule" on today, otherwise the date
  (e.g. "Monday, Sep 28").
- **Which day an event is on** (all three views): half-open overlap
  with the day's `[local midnight, next midnight)`, ignoring the viewed
  date's time of day — `eventOverlapsDay` in `lib/date-utils.ts` (Day,
  Week; Month's bucketing loop applies the same rule inline). An event
  ending exactly at midnight stays off the next day; overnight events
  land on both days; a zero-length event counts as 1 ms.
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

Brightness is painted only as a fixed, click-through black overlay
(`#rb-dim-overlay`, `lib/brightness-layers.ts`, z-index 110 — above the
power-saving overlay) whose opacity is `1 − brightness`, written at most
once per animation frame. There is **no** `filter: brightness()` on
`<html>` any more: measured on the kiosk (Pi 5, 2026-09-24) a page-wide
filter costs ~115 ms per frame (<9 fps) versus 17 ms (60 fps) without,
slowing every repaint, not just the slider. Brightness is therefore
capped at 100 % (decision 0011); 100 % paints nothing.

- Inactivity: 5 min timeout → 20 % brightness (overlay opacity 0.8);
  activity events (mouse/key/scroll/touch, capture phase) restore. The
  change is instant (the old 0.5 s filter transition is gone). Brightness
  setting is localStorage `calendar-brightness` (percent, default 100),
  clamped 30–100 by the slider (0.1–1 internally); a value saved above
  100 by an older build is clamped to 100 and re-saved on load.
- The screensaver state **pauses all queries** while dimmed; exiting
  **keeps the current view** (Day/Week/Month), jumps the date back to
  today, and force-refreshes.
- Manual "Sleep" buttons (calendar header, chores, dinner) show a
  full-screen black overlay ("press any key or touch to wake"); while
  active, event/auth/update dialogs are suppressed.
- Dead code: `screensaver-overlay.tsx` (bouncing logo + clock) is defined
  but never mounted; only `power-saving-overlay.tsx` is used.

### 3.7 Settings and update UI

Settings is a 416 px Radix popover from the nav rail, in every auth state
(brief 05 goal 3: a unit that has lost Google is the one that most needs
it; `app-shell.tsx` passes `googleConnected` and the full `googleAuth`
status, and only the calendar list and add-calendar hide while it is
false — the calendar list query is not even sent). On a unit that is not
connected the calendar widget's "Google Calendar Not Connected" dialog
still opens at boot; Close it to reach the rail.

**Google sign-in (brief 02).** That dialog (`auth-dialog.tsx`) has two
tabs: **Connect Google** (`google-connect-panel.tsx`: one button →
`POST /api/google/start` → the kiosk browser goes to Google; the panel
makes no dialog or popover assumptions, so the wizard can embed it; with
`oauthClient` missing or invalid it shows "This Rootboard has no Google
sign-in client configured…" with the setup-guide link instead of the
button) and
**Advanced: service account** (the key-file steps, Retry, Setup Guide
link, and the key-file error). With `mode: oauth` the auth status's
`error` is the lost-access reason and shows on the Connect tab. Back
from Google, the shell reads `?google=` once at mount and strips it:
`connected` opens **Choose which calendars to show**
(`calendar-picker-dialog.tsx`, switches writing the same
`hiddenCalendars` as Settings; Done syncs), `failed` shows a toast with
one sentence per reason (`lib/google-sign-in.ts`). In boot mode the
picker waits until the wizard closes. After Google refuses the sign-in,
the events query keeps running (`shouldShowSyncedEvents`), so the last
synced events stay on screen with the header's sync error; a failed sync
re-reads auth-status so the connect dialog opens within that sync.

Settings → **Calendars**, Google account (`google-account-settings.tsx`):
signed in → "Signed in with Google as <address>" and **Sign out**
(confirm: stops showing the calendars, removes access at Google,
deletes the kiosk's copy of the events; the account is not changed).
Not connected (`none`, or a lost sign-in) → the Connect Google panel
(with the reason when lost), and a lost sign-in keeps Sign out. On a
service-account kiosk a "Sign in with a Google account instead" link
opens the same panel (the sign-in then takes over; Sign out returns to
the service account). With
`mode: oauth` the service-account rows hide: the share-email box,
per-calendar Remove and Add by ID (a hint says shared calendars appear
on their own). With `none`, a link offers the service account via the
Setup Guide. A read-only line under it says "Google sign-in client:
configured / missing / invalid file". The Calendars warning dot means Google needs setup (no
key and no sign-in, or a lost sign-in). Calendar dots use
`getCalendarColor()` from `lib/calendar-meta.ts` (no local copy).

Contents: brightness slider (30–100 %, step 5; its own component so a drag
re-renders only the slider, saved on release), OSK mode (Auto/Always/Off),
the Google account row above, per-calendar visibility switches +
unsubscribe, add-calendar-by-ID (`POST /api/calendar/subscribe`),
service-account email display with copy button (or a "key file not
found" warning linking `/setup`) — the last three for the service
account only,
Check-for-Updates and Roll Back buttons, and the current `APP_VERSION`.

System → **Setup** (brief 03): **Wi-Fi** and **Time zone** open that
one wizard step over the dashboard; **Run setup again** replays every step
(3.11). Each closes the popover first. Settings opens in every auth state
(brief 05), so these work before Google is connected too.

System → **Weather** (`weather-location-settings.tsx`): postal code and
two-letter country (default: the browser locale's region, else US), a
°F/°C toggle (default °F for US-style countries, else °C), and **Look up**
(`GET /api/weather/lookup`), which lists up to 8 candidate places; tapping
one saves `{postalCode, countryCode, label, lat, lon, units}` as
`dashboard.json` `weather` through the shell's read-merge-PUT, then
re-asks `/api/weather` and its status so the header chip follows at
once. With a place saved, the unit toggle saves immediately. The status
lines (last update, last error) sit under it once weather is configured.
Clearing a saved location is not offered yet (hand-edit the file).

System → **Updates** (`update-channel-settings.tsx`, decision 0022):
Check for Updates and Roll Back, then a **Release channel** Stable/Beta
toggle with "Beta gets fixes a few days earlier and may have rough
edges." A tap saves `dashboard.json` `update: {channel}` through the
shell's read-merge-PUT and re-reads `/api/update/status`. With no saved
value the toggle shows the server's effective channel (env, else
stable); while that is still unknown, neither option is shown as
selected. After saving, the client re-checks for updates, and a check
that finds none closes any earlier offer. On Stable while running a
prerelease build, a line says the kiosk stays on that beta until a newer stable release comes out.

System → **Diagnostics** (`system-diagnostics.tsx`, rows from
`lib/diagnostics-rows.ts`): fetches the *redacted* bundle (2.7) each time
it opens and shows it as label/value rows, with a warning mark on the
ones that probably need fixing (supervisor off, update failed, Google not
set up or not connected, sync error, weather failing, no network,
internet unreachable, 3+ self-heal reconnects in 24 h, under 1 GB or 5 %
disk free, widget errors, config warnings). **Copy** puts the same
redacted JSON on the clipboard; **Show details** shows the log tail;
refresh re-fetches.

System → **Pair a device** (`pair-device-settings.tsx`): opening it
issues a code (shown large, with a m:ss countdown) and reads the full
diagnostics view for the kiosk's LAN address, shown as
`http://<ip>:5000/api/pair`. While the code is live the device list is
polled every 2 s together with `GET /api/system/pairing-code?code=`
(`lib/pairing-outcome.ts`): a device created at or after the code's issue
time replaces the code with "Paired “name”"; a code the server no longer
accepts (5 wrong tries, a restart) shows "That code no longer works" and
a new-code button. A code that arrives after the screen was left is
cancelled at once.
Leaving the screen cancels that code (`DELETE …?code=`, so a late cancel
never removes a newer one). Paired devices are listed with Revoke (tap,
then tap again to confirm).

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
- **Google sign-in leaves the app.** Firefox kiosk mode follows the
  navigation to Google's pages and back without leaving kiosk. On
  Google's pages the app's on-screen keyboard (3.3) does not run, so
  typing an address or password needs a USB keyboard (the account picker
  does not). The return is to the absolute `http://localhost:5000/`, so
  the app stays on one origin (localStorage theme cache and drafts; the
  feedback service's allowed Origin). Firefox keeps Google's session
  cookie afterwards; acceptable on a household kiosk.
- **Fonts are bundled, never fetched.** `client/src/fonts.css` declares
  Nunito (the body face) from woff2 files in `client/src/assets/fonts/`,
  with the subsets and unicode-ranges Google Fonts served; the family's
  `OFL.txt` sits beside its files. The page loads nothing from outside
  the device at load time — no font CDN, no third-party script.
- **No browser zoom.** `html, body { touch-action: pan-x pan-y }` (and
  the same value on `.touch-button`) disables pinch and double-tap zoom
  while keeping touch scrolling. Never use `touch-action: manipulation`
  here — it is an alias for `pan-x pan-y pinch-zoom` and still lets a
  pinch zoom the whole page, which on the kiosk (Firefox desktop,
  `apz.allow_zooming=true`, viewport meta ignored) left the layout
  panning instead of fitting the screen. Guarded by
  `lib/kiosk-zoom-policy.spec.ts`; decision 0013. The install guide also
  pins Firefox's zoom prefs on the device as a second layer.
- Body: `user-select: none`; touch targets
  min 48 px (56 px on ≥1920 px screens). The shared dialog close (X)
  button (`ui/dialog.tsx`, used by every Dialog) and the Settings
  panel's X follow this: a 48/56 px round `.touch-button` around a
  24 px icon; `DialogHeader` carries `pr-12` so titles clear it.
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
  default; at burst time `runtimeConfettiColors()` reads `--rb-confetti-1`
  through `-5` and falls back to this constant only if a variable is
  missing, logging the first missing token once (console warning).
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

### Themes (engine slice 1)

Design: `docs/plans/theme-system/THEME-ENGINE-SPEC.md`; decision 0009.

- **One token layer.** `:root` defines the shadcn tokens (`--background`,
  `--muted-foreground`, …) as `var(--rb-*)` aliases; a theme is a flat map
  of the 100 `--rb-*` tokens. `--rb-ink-tertiary` carries the former
  `--muted-foreground` value. The `.dark` block is dead (never applied).
- **Manifest** (`shared/theme-manifest.ts`): `{ engineVersion, id, name,
  tokens }`, every token required, unknown keys rejected, literal colors
  only. `engineVersion > THEME_ENGINE_VERSION` → "built for a newer
  Rootboard".
- **Built-ins** are bundled modules under `client/src/themes/` (`default`,
  `deep-space`), validated at load by `lib/theme-engine.ts`; a failing one
  is listed under Settings → "Theme Errors" instead of crashing.
  `default.ts` is the copyable authoring reference.
- **Persistence:** `data/config/dashboard.json` `theme` (optional,
  lenient — a malformed value becomes undefined, never invalidating the
  file). Unknown id → Default. Hand-edits land within the 60 s poll.
- **Boot cache:** `applyTheme` mirrors the resolved tokens to
  `localStorage["rootboard.theme-cache"]`; an inline script in
  `client/index.html` (`#rb-theme-boot`) repaints `--rb-*` from it before
  React mounts, so a dark theme does not flash light. The config remains
  the source of truth and corrects the cache on the first successful
  config load.
- **Contrast guard** (`themes/contrast.spec.ts`): new themes ≥ 4.5:1 on
  the text/fill pairs listed there; Default is grandfathered at its
  measured ratios (no regression).
- **Person palette:** 24 of the 100 tokens are `--rb-person-{1..8}-
  {color,tint,text}` (slot order = identity, stable across themes: 1
  purple, 2 green, 3 orange, 4 blue, 5 rose/red, 6 teal, 7 pink, 8
  slate). Chores maps each person's `colorIdx` to a slot instead of a
  color literal (`client/src/lib/person-colors.ts`), so a theme switch
  repaints person columns live; `people-contrast.spec.ts` enforces the
  contrast/distinguishability floors per theme, per slot.
- **Calendar ink on dark surfaces:** `eventTextColor` lightens toward
  white on surfaces with relative luminance < 0.2 (via `useSurfaceHex`),
  byte-identical on light surfaces; Deep Space event-chip contrast went
  from ~1.2–2.0:1 to ≥ 6.1:1.
- **Confetti:** the chore check-off burst takes the active theme's
  `--rb-confetti-1…5` at burst time (`runtimeConfettiColors` in
  `components/chores/confetti-burst.tsx`), so a theme switch shows on
  the next burst; tested in `confetti-colors.spec.ts`.
- **Widgets:** `host.theme.subscribe` now fires on every switch.

### 3.10 What to Wear (`client/src/widgets/what-to-wear/`)

Kid-facing, display-only section: weather for Morning / Afternoon /
Evening, what to wear this morning, what changes this afternoon, and
what to pack. Brief: `docs/plans/what-to-wear-widget/BRIEF.md`;
decision 0012. Disabled in the default config; enable it from the
layout picker.

- **Settings** (manifest, edited in the host Settings UI, persisted in
  `dashboard.json`): `zipCode` (blank = use the kiosk's `/api/weather`,
  i.e. the Settings location, else `.env` — 2.5),
  `units` (`celsius` default / `fahrenheit`), `schoolStart` / `schoolEnd`
  (`"HH:MM"`, fall back to `08:00` / `15:00` when unparsable or
  inverted). Evening is fixed at 18:00. The zip is treated as personal
  data: never logged, never in an error message, no default.
- **Data paths** (`forecast.ts`): zip set → `api.zippopotam.us` (zip →
  lat/lon; 404 = invalid zip) then Open-Meteo hourly direct via
  `host.fetch`, always requested in °C / km/h / mm, with no `daily`
  parameter. Zip blank → `/api/weather` `hourly` (2.5), normalised to
  °C client-side. Both yield the same `ForecastBundle`; the last good
  one (≤ 48 h) persists in `host.storage` so a reboot or outage still
  renders. The zip → coords cache in `host.storage` holds only the
  current zip: it is re-run only when the zip changes, and older zips
  are dropped on the next lookup. Exactly two outside hosts, both
  HTTPS, keyless.
- **Cadence:** manifest `refresh.intervalSeconds: 1800` (host-driven,
  visible + online + awake). One private 1-minute timer re-evaluates
  the day flip and footer; it runs only while visible and is cleared on
  unmount. After an "unreachable" result that same clock fires a bounded
  retry 1, 2 and 5 minutes after consecutive failures (`retry.ts`), then
  waits for the host; a host-driven or initial load restarts the
  sequence. No other polling. Fetches time out after 30 s — longer than
  the server's 20 s upstream budget, so the browser never abandons a
  host fetch the server is about to answer (decision 0014).
- **Day selection:** before `schoolEnd` → today, otherwise tomorrow
  ("Today · Tuesday"). Windows: Morning = hour nearest `schoolStart`
  (range −1 h…+2 h), Afternoon = nearest `schoolEnd` (same range),
  Evening = 18:00 (17–20). School day (backpack rules) = start…end.
- **Rules** (`advice.ts`, pure, unit-tested): feels-like bands Hot ≥24,
  Warm 18–23, Cool 12–17, Chilly 5–11, Cold −5–4, Freezing <−5 with
  base outfits per band. Layering: when the afternoon is at least one
  band warmer, the outfit is the afternoon base plus the morning band's
  removable layer ("take it off") and, for Cold/Freezing mornings, the
  morning's warm hat, gloves, and scarf (so a child at 0 °C is not sent
  out without gloves); the afternoon note names only the layer. When
  the afternoon is colder, the outfit is the morning base and the
  afternoon layer is packed. Never shorts when the morning is
  Cold/Freezing. Rain: ≥40 % morning → raincoat worn; ≥40 % afternoon
  only → raincoat packed; ≥70 % in the school day → rain boots worn +
  umbrella packed; code ≥95 → storm headline. Snow: any → boots,
  gloves, hat; ≥2 cm → snow pants. Wind: ≥30 km/h → windbreaker if no
  outer layer, "windy" chip; ≥45 → headline. UV: ≥6 → sunscreen, sun
  hat, water bottle; the "strong sun" chip goes on the window whose own
  range max UV is ≥6 (highest wins, ties to the earliest), and if the
  school-day peak falls between windows the backpack items are still
  added but no window is chipped. UV 3–5 with a clear afternoon →
  sunscreen; Hot afternoon → water bottle.
- **Copy and emoji** live in `phrases.ts`; single-codepoint emoji only
  (3.3). `ItemChip` takes an optional lucide icon for one-line swaps if
  a glyph is missing on the kiosk.
- **States:** no zip + host weather not configured → "Ask a grown-up to add
  your zip code in Settings"; a host-side outage (`enabled: false,
  configured: true`) renders the cached forecast with the "from earlier"
  footer (or "Can't reach the weather right now" with no cache); the
  host-path footer time comes from the payload's `updatedAt`; a host
  payload flagged `stale: true` (server re-serving its last good forecast)
  is treated the same as an outage with cache — rendered with the "from
  earlier" footer, not persisted; invalid zip → "That zip code didn't work";
  fetch failed with cache → render it, footer "Weather from earlier — as
  of …"; failed with no cache → "Can't reach the weather right now". The
  footer time gains the day ("Sun 6:29 AM", or "Mar 5, 6:29 AM" past a
  week) when the data is not from today. A forecast that no longer covers
  the day shown → "The weather is out of date" with the last-update time
  as the hint. Nothing throws out of `mount()`/`refresh()`.
- **Known limitation:** times are compared in the kiosk's local zone; a
  zip in a different time zone than the kiosk shifts the windows by the
  offset (not a v1 use case).
- **Layout:** fixed landscape panel, nothing scrolls; theme tokens only.

### 3.11 First-run wizard (`client/src/pages/setup-wizard.tsx`)

Beta-launch brief 03, decision 0018. Session 1 built the wizard; session
2 (WP-02) made the Google step embed brief 02's connect panel.

- **Steps:** Welcome → Network → Time zone → Google → Weather → Done.
  Every step but Network has "Skip this step"; Welcome and Done only move
  on. The boot-time Network screen (`network-only`) alone also offers
  **Continue without network** (founder 2026-11-16): back to the
  dashboard, whose offline handling covers the gap; nothing is written.
  First-run Network stays required. Each step changes something only when its own button is tapped.
- **Modes** (`lib/setup-wizard.ts`): `first-run` (every step), `rerun`
  (Settings → System → **Run setup again**: every step, current values
  shown, a Close button), `network` / `timezone` (Settings → System →
  **Wi-Fi** / **Time zone**: that one step), `network-only` (boot with no
  network: the Network step alone). Only `first-run` and `rerun` write the
  completion record, and only when Done is tapped; Close writes nothing.
- **Run condition** (`hooks/use-setup-run-condition.ts`, decided once per
  page load): the shell shows a "Starting…" splash, then
  - no `setup.completedAt` in `dashboard.json` → `first-run`;
  - otherwise asks `/api/system/network/status`: connected, NetworkManager
    absent, the request failing, or the page loaded more than 300 s after
    the OS booted → the dashboard (a reload after an update, or a drop
    later in the day, never opens the wizard); not connected and uptime
    < 90 s → "Connecting to the network…" splash, re-asking every 5 s;
    still not connected at 90 s → `network-only`.
  Once decided, it is never re-run in that page: after "Continue without
  network" (or an auto-pass) the dashboard stays up while offline, and a
  later drop never reopens it. The rule is "once per page load": a reload
  counts as a new decision, so only a reload within 300 s of the OS
  booting, still offline, could show the screen again; any later reload
  lands on the dashboard.
  At boot the wizard is rendered **instead of** the nav rail and widget
  host, so no widget mounts or fetches until Done (or until a
  `network-only` run passes). From Settings it opens over the running
  dashboard (`fixed inset-0 z-50`; the OSK is `z-[60]`, AuthDialog's
  portal sits above it).
- **Network step:** polls status every 5 s. At boot (`first-run`,
  `network-only`) it passes on its own 2.5 s after a one-line
  confirmation when Ethernet or any saved connection is up — also when one
  comes up while the step shows — unless a password is being typed, a join
  is running, or the last join's internet check failed. From Settings it
  never auto-passes. Scan list strongest first, one row per SSID, hidden
  networks dropped from the list and offered as "Network not listed? Type
  its name" (SSID + optional password). Open networks join on tap. After a
  join the internet check runs once. Failure sentences (one sentence +
  Retry; in the join form the Connect button becomes Retry): "That
  password didn't work.", "Rootboard can't see that network from here.",
  "Connected to Wi-Fi, but the internet isn't reachable yet.", plus
  timeout/generic/scan/server variants (`FAILURE_COPY`). The password is
  cleared from component state after a successful join. The step's
  footnote discloses where the password goes and the HEAD request ("When
  Rootboard checks its internet connection (after joining Wi-Fi or
  tapping Retry) …" — the published privacy page uses the same words). A
  paired LAN device can also trigger the check with
  `GET /api/system/network/status?internet=1`.
- **Time zone step:** searchable list (space matches `_` or `/`, 40
  shown), starting on the browser's reported zone if the system lists it,
  else the system's current zone; the selected zone and every row show
  their current time. After "Use this time zone" it shows the local time
  there; if the browser's own zone still differs it adds "The dashboard
  clock follows after the next restart." (Firefox keeps the zone it
  started with).
- **Google step** (brief 03 decision 7): reads the shell's own
  `/api/calendar/auth-status` query (no second query), through
  `googleStepState` (`lib/setup-wizard.ts`):
  - `connected` — authenticated in **either** mode (Google sign-in, or a
    service-account key file): "Connected to Google as <email>." (sign-in)
    or "Google Calendar is connected.", and **Continue**.
  - `needs-client` / `connect` — not authenticated: `GoogleConnectPanel`
    (large) with the status's `oauthClient` and, in sign-in mode, the
    `error` as its reason. With no usable client file
    (`data/google-oauth-client.json` missing or invalid) the panel says
    so instead of offering a button that can't work, and its last
    sentence points at the button below rather than the dialog's
    Advanced tab.
  - Under the panel, **Set up manually (self-hosting)** (founder
    2026-11-24). It opens a warning, not the instructions: one paragraph
    (significant manual setup on a computer — a Google Cloud project, a
    service-account key file copied onto the unit; the steps are in the
    install guide's service-account appendix and in the unit's own setup
    guide, which the next screen links to; choosing it leaves the wizard —
    on a first run adding that the wizard opens again at the next start,
    from Settings only that it closes: `manualSetupLeaveSentence`). **Back to
    setup** closes the warning and changes nothing. **Continue with manual
    setup** closes the wizard **without** writing `setup.completedAt` and
    opens `AuthDialog` on its **Advanced: service account** tab over the
    dashboard (`manualSetupOutcome`). The calendar widget's own connect
    dialog, which opens by itself on an unauthenticated kiosk, is held back
    while those steps show (`lib/service-account-steps.ts`, a store both
    React roots read) and opens as usual once they are closed. Not
    writing the record is intended: after a first run the wizard opens
    again on the next boot (from Settings the record already exists, so it
    does not); a self-hoster who has put the key file in place by then finds
    the Google step connected and taps through to Done, which writes it.
  - **Skip this step** stays.
- **Return from Google's page** (`startingStep`, `lib/setup-wizard.ts`):
  the callback reloads the app at `/?google=connected` (or
  `?google=failed&reason=`). With no completion record that load is
  `first-run`, so the wizard **resumes at the Google step** instead of
  Welcome: connected and Continue, or — after a failure, whose sentence
  shows as a toast — the panel again. Wi-Fi and time zone are not redone.
  The shell keeps the search string as the page loaded (it then takes the
  parameters off the URL) and passes it in. A sign-in started from a
  `rerun` (Settings → Run setup again) is not resumed: the reload lands on
  the dashboard, where the calendar picker opens and Settings → Calendars
  shows the account. Every other mode starts at its first step.
- **Weather step:** embeds `WeatherLocationSettings` (3.7) with the
  shell's `saveWeatherLocation`; Continue appears once a place is saved.
- **Managed outside Rootboard:** when nmcli/NetworkManager or
  timedatectl/systemd is absent, the Network and Time zone steps say so
  and pass (Network on its own after 2.5 s). This is the `npm run dev`
  path on a laptop and in CI.
- **Server** (`server/services/networkService.ts`): `execFile` (never a
  shell) with a 30 s timeout and `LC_ALL=C.UTF-8` (English messages,
  non-ASCII SSIDs intact); nmcli connect gets `--wait 25`. "Connected"
  is NetworkManager's own overall state (`nmcli -t -f STATE general`):
  `connected` or `connected (site only)`, never `connected (local only)`
  (a Docker bridge or VPN interface alone). The link it names is the
  first `connected…` device (including `connected (externally)`), wired
  before Wi-Fi before anything else. The nmcli read is shared while in
  flight and for 3 s after; the client applies only status replies newer
  than the last one it applied. Presence is the binary (looked up once) **and** a daemon
  answering (`nmcli -t -f RUNNING general`, `timedatectl show`, asked each
  time). Terse output is parsed with `\:`/`\\` unescaping; tests run
  against hand-written fixtures (`networkService.fixtures.ts`, to refresh
  from the real kiosk). The runner resolves a plain result instead of
  rejecting, so Node's exec error (whose `cmd` holds the password) can
  never be logged. A leading `-` is refused in an SSID and a zone name.
- **Permissions:** `scripts/polkit/50-rootboard-network.rules` grants the
  `rootboard-system` group `NetworkManager.settings.modify.system`,
  `.network-control`, `.wifi.scan` and `timedate1.set-timezone`, nothing
  else (`server/polkit-rule.spec.ts`). Installed by hand per
  INSTALLATION.md step 11 until brief 06's provision script does it.

## 4. Update system

### 4.1 Cadence

The **client** drives the daily check: `use-version-check.ts` aligns to a
next-check time, then checks every 24 h via `GET /api/update/check`.

**Channels** (decision 0022). The server resolves the channel on every
check: `dashboard.json` `update.channel` → `UPDATE_CHANNEL` env →
`stable`.

- `stable` reads `releases/latest` (GitHub: newest non-prerelease,
  non-draft) — the only behaviour before channels — and refuses (logs,
  no update) a tag with a prerelease part or one that is not a version,
  in case a beta was published without GitHub's Pre-release tick.
- `beta` reads `releases?per_page=10`, skips drafts and tags that are not
  versions, and takes the highest version, prereleases included.

**Compare** (`shared/release-version.ts`): leading `v` stripped; 1–3
numeric core segments (missing = 0) plus an optional `-` prerelease;
semver prerelease order, so `1.7.3 < 1.8.0-beta.1 < 1.8.0-beta.2 <
1.8.0`. An update is offered only when the release is strictly newer;
an unreadable tag is never offered. A beta build on a kiosk switched to
stable stays until stable is newer (no automatic downgrade). Applying an
update re-runs the check, so it installs the same channel's release.
Release steps: `docs/RELEASING.md`.

### 4.2 Apply flow (`server/services/updateService.ts`)

Statuses with progress %: checking(5) → backing-up(15) → downloading(30)
→ extracting(50) → applying(60) → installing(70, `npm install
--include=dev`) → building(80, `npm run build`) → restarting(90) →
complete(100). The release **source tarball** is downloaded over HTTPS to
`.update-temp/`, extracted with `tar`, and applied to the app root. If
install or build fails, the updater sets an error status, auto-runs
`rollback()`, and rethrows.

`POST /api/update/apply` and `/api/update/rollback` start only for a
same-origin JSON request from the kiosk itself (2.2), so a web page open
in the kiosk's browser cannot form-POST either; the app's update prompt sends
an empty JSON body. A call by hand on the kiosk needs one too:
`curl -X POST -H 'Content-Type: application/json' -d '{}' http://localhost:5000/api/update/apply`.

- `PRESERVE_PATHS` (never touched by apply/backup/rollback): `.env`,
  `data`, `node_modules`, `.update-backups`, `.update-temp`,
  `service-account.json`, `google_credentials.json`, `calendar.db` (+
  `-shm`/`-wal`).
- **Repo-metadata exclusion** (`isRepoMetadata`): `*.md`, `.claude`,
  `docs`, `.github`, `setup` are excluded from
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
  settings, theme, weather location and update channel source of truth.
  `theme`, `weather` and `update` are lenient (a malformed value becomes
  undefined, never invalidating the widget layout). Zod-validated on both read and write;
  writes are atomic (`.tmp` + rename); a missing, unparseable, or
  schema-invalid file degrades to `defaultDashboardConfig()` on read
  rather than ever failing to boot. Gitignored — never tracked, and on
  both updater preserve lists.
- `dashboard.json` `setup`: `{completedAt (ISO 8601), version}`, written
  only by the wizard's Done in `first-run`/`rerun` (3.11). Lenient like
  `theme`/`weather`; its absence opens the wizard at boot, so a PUT that
  carries a malformed `setup` is refused (400) rather than silently
  dropping it. `version` is `SETUP_WIZARD_VERSION` (1).
- Wi-Fi passwords are never stored by the app: they go to NetworkManager's
  system connection profile and are dropped after `nmcli` returns.
- `data/paired-devices.json`: LAN pairing (2.7) — SHA-256 token hashes
  only, never a token; mode 0600; gitignored and preserved across updates
  with the rest of `data/`. Missing or invalid → no paired devices.
- `data/google-oauth.json`: Google sign-in (2.3) — `{version: 1, email,
  refreshToken, accessToken, expiryDate, scope, signedInAt}` while signed
  in, `{version: 1, email, lost: {at, reason}}` after `invalid_grant`;
  mode 0600, atomic writes, never logged, never in the diagnostics
  bundle. Gitignored and preserved with `data/`. Its presence makes
  `mode: oauth`; Sign out deletes it.
- `data/google-oauth-client.json`: the unit's Google Desktop client
  (2.3), Google's download as-is; mode 0600 when the app writes it;
  gitignored and preserved with `data/`; never committed (the
  `GOCSPX-` gitleaks rule has no allowlist; `server/secret-scan-rules.spec.ts`).
- The event cache (`calendar_events`) belongs to one identity: a Google
  sign-in and a sign-out each empty it, and the next sync refills it.
- `widgets/`: sideloaded folder-drop community widgets (SD card/SSH).
  Gitignored — never tracked, never in the release tarball — and on
  both updater preserve lists (`PRESERVE_PATHS` in `updateService.ts`,
  the `case` list in `start.sh`), so installed widgets survive
  auto-updates.
- `APP_VERSION` (`shared/version.ts`) is the single version source and
  matches the release tag without its `v` (`1.8.0-beta.1`); update
  eligibility is `latest > current` by the prerelease-aware compare
  (§4.1).

## 6. Known quirks index

- Error middleware re-throws after responding (`server/index.ts`).
- `reusePort` only off-Windows (`ENOTSUP` on win32).
- Kiosk-only guard and the LAN guard trust the raw socket IP; no
  `trust proxy` — a reverse proxy would make every caller loopback;
  re-verify if one is ever introduced.
- Update `check`/`status`/`backups` need a LAN token like any other
  route; only `apply`/`rollback` are kiosk only.
- `/widgets/*` static assets are outside `/api` and stay open to the LAN
  (decision 0020).
- The LAN API is plain HTTP: a paired token can be read by someone already
  sniffing the home network (TLS out of scope, brief 05 §8).
- An existing kiosk updating to the release with the wizard has no
  `setup` record, so it opens the full wizard once at its next boot
  (decision 1 of brief 03, flagged for the founder in the PR).
- No server-side scheduler: sync cadence, update checks, and state
  refresh are all client timers.
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
- `touch-action: manipulation` still allows pinch zoom; the kiosk root
  uses `pan-x pan-y` and nothing may re-enable zoom below it (3.8).
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
- A community widget's module is cached by `id`+`version` once
  imported: disabling then re-enabling it (no manifest version bump in
  between) reuses the cached module rather than re-importing, so its
  top-level module-scope code only ever ran once, at first enable, and
  stays run — it does not re-execute on re-enable, only `mount()`/
  `unmount()` replay. A version bump or full page reload is what
  actually re-runs it (3.1).
- Layout picker reorder is per-pool (built-in vs. community) over one
  shared `config.widgets` array: moving a community widget swaps it
  with the next community-owned array entry, which can be several
  positions away — not necessarily physically adjacent — if built-in
  entries sit between them (3.1).
