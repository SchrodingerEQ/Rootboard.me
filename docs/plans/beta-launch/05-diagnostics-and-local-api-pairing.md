# 05 — Diagnostics bundle and local-network API pairing

**Status:** Built 2026-11-14 (pairing guard, diagnostics bundle, Settings in every auth state; decision 0020). Founder kiosk checks pending: LAN laptop pairing, the redacted bundle on the real kiosk, the self-heal count from the kiosk's journal.
**Type:** Server endpoints + Settings panel + a small auth layer. One to two sessions.
**Depends on:** nothing, so it can run now, before brief 00. 03's network
service makes the bundle richer when it lands.
**Unblocks:** 06 (what an agent reads first), 07, and the Settings entry
points that 03 and 04 use (goal 3).
**Closes in `TASKS.md`:** the beta sub-item 05.

---

## 1. Goal

Two things that let a unit be supported from a distance **without the
developer having any standing access to it**:

1. A **diagnostics bundle**: one JSON document describing the unit's
   health, readable on screen in Settings → System, copyable, and
   fetchable by the owner's own tools or AI agent. It is not attached to
   feedback: the feedback contract has no attachments in v1 (brief 04,
   decision 8).
2. **Pairing** for the local-network API, so a laptop or agent in the same
   house can use the API after the owner reads a code off the screen, and
   nothing else on the Wi-Fi can.
3. **Settings in every auth state.** Today `app-shell.tsx` renders the
   Settings popover only when `authStatus.authenticated` is true, so a
   unit that has lost Google, which is the unit most in need of support,
   shows no Diagnostics, no Pair a device and no version string. Open the
   popover in every auth state and hide only the rows that need Google
   (the calendar list, subscribe). Brief 03 (Run setup again) and brief 04
   (Send feedback) rely on this.

## 2. Why pairing and not localhost-only

An earlier proposal was to listen on 127.0.0.1 only. That closes the
"anyone on the Wi-Fi can delete events" hole but also closes the door the
agent-first setup (brief 06) and the widget dev loop (brief 07) walk
through. Pairing keeps the door and adds a lock the owner controls.

## 3. Decisions locked

| # | Decision | Choice |
|---|---|---|
| 1 | Loopback is trusted | Requests from the kiosk's own browser (`isLocalRequest`) need no token, exactly as today. Nothing about the kiosk UI changes, except that Settings now opens while signed out (goal 3). |
| 2 | LAN requires a bearer token | Any non-loopback request to `/api/*` (except `GET /api/version`, the supervisor health check, and `GET /api/system/diagnostics` *redacted view*, see 5) must carry `Authorization: Bearer <token>`; otherwise 401 with a body that says how to pair. |
| 3 | Pairing flow | Settings → System → **Pair a device** shows a 6-digit code for 5 minutes. The caller does `POST /api/pair { code, name }` from the LAN and receives a long random token, stored hashed in `data/paired-devices.json` with the name and created-at. Settings lists paired devices with Revoke. |
| 4 | Existing deployments | Default **on**. The reference kiosk has no LAN callers today, so nothing breaks; the only effect is closing the open-write hole. A `LAN_API_OPEN=true` env escape hatch exists for hosted/dev use and logs a warning at boot. |
| 5 | Diagnostics content | `version`, uptime, `nodeVersion`, platform/arch, `supervised`, update status and last check, auth mode (service-account / oauth / none — never the email), calendar sync status and last error, weather status (from `/api/weather/status`), enabled widgets with versions and any load errors, theme id, network status (interface, connected yes/no, internet reachable yes/no — never the SSID or IP in the *redacted* view), disk free on the app volume, Wi-Fi self-heal count (how many times the `wifi-selfheal` timer from `INSTALLATION.md` §12.3 reconnected in the last 24 h, read from its journal tag; `null` when the timer is absent or the journal is not readable by the service user), last 50 lines of the app's own ring-buffer log (see 6), config validation warnings. Two views: **redacted** (safe to share anywhere: copy it into a message or hand it to an agent) and **full** (adds SSID, IP, hostname; paired callers and the kiosk screen only). |
| 6 | App log ring buffer | The server keeps its last 500 log lines in memory (wrap the existing logger in `server/index.ts`). No new files on the SD card. Lines are scrubbed of anything matching an email or a `Bearer` token before storage. |
| 7 | On screen | Settings → System → **Diagnostics** renders the redacted view as readable rows with a "Show details" toggle for the log tail, and a "Copy" button (kiosk clipboard works in Firefox). |

## 4. Where the code goes

- `server/middleware/lanAuth.ts`: the guard, mounted before routes;
  allow-list by path for the exceptions in decision 2. Token compare is
  constant-time; tokens are 32 random bytes, stored as SHA-256.
- `server/services/pairingService.ts`: code issue/expire, token mint,
  revoke, list.
- `server/services/diagnosticsService.ts`: assembles the bundle from the
  existing services; both views from one builder with a redaction pass.
- Routes: `GET /api/system/diagnostics?view=redacted|full`,
  `POST /api/pair`, `GET/DELETE /api/system/paired-devices`.
- Client: System section additions in `settings-menu.tsx`; `app-shell.tsx`
  renders `SettingsMenu` in every auth state (goal 3), and
  `settings-menu.tsx` hides its Google-only rows while signed out.
- Update `docs/SPEC.md` §2.2's auth column for every endpoint.

## 5. Acceptance

- From a laptop on the LAN: `GET /api/calendar/events` → 401 with a
  pairing hint; pair with the on-screen code; same call → 200; revoke on
  the kiosk; same call → 401.
- Kiosk UI: unchanged behaviour in every flow apart from goal 3 (run the
  SPEC §3 smoke list).
- Redacted bundle contains no `@`, no SSID, no IPv4 literal, no token; a
  test asserts this with a fixture full of each.
- Supervisor health check (`scripts/start.sh` → `/api/version`) still
  passes without a token.
- Expired code → 410; wrong code 5× → code invalidated.
- Signed out of Google (or no key file): the Settings popover opens and
  shows Diagnostics, Pair a device and the version, with the calendar
  rows hidden.

## 6. Docs

- `docs/SPEC.md` §2.1, §2.2, new §2.7 "LAN pairing", §3.7.
- `INSTALLATION.md` troubleshooting: "Read the diagnostics screen first"
  replaces several SSH-first entries; a new short section on pairing.
- `docs/decisions/0020-lan-api-pairing-over-loopback-only.md`.

## 7. PR tier

**Safe zone (verified)** for pairing (no new outbound calls; permissions
tighten, not loosen). The app never sends the diagnostics bundle
anywhere: it is read on the screen or fetched by a paired caller.

## 8. Out of scope

TLS on the LAN API; mDNS (brief 06); any cloud relay.
