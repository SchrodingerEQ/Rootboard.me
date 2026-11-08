# 05 — Diagnostics bundle and local-network API pairing

**Status:** Not started.
**Type:** Server endpoints + Settings panel + a small auth layer. One to two sessions.
**Depends on:** nothing hard; 03's network service makes the bundle richer.
**Unblocks:** 04 (attachment), 06 (what an agent reads first), 07.

---

## 1. Goal

Two things that let a unit be supported from a distance **without the
developer having any standing access to it**:

1. A **diagnostics bundle**: one JSON document describing the unit's
   health, readable on screen in Settings → System, attachable to
   feedback (brief 04), and fetchable by the owner's own tools or AI agent.
2. **Pairing** for the local-network API, so a laptop or agent in the same
   house can use the API after the owner reads a code off the screen, and
   nothing else on the Wi-Fi can.

## 2. Why pairing and not localhost-only

An earlier proposal was to listen on 127.0.0.1 only. That closes the
"anyone on the Wi-Fi can delete events" hole but also closes the door the
agent-first setup (brief 06) and the widget dev loop (brief 07) walk
through. Pairing keeps the door and adds a lock the owner controls.

## 3. Decisions locked

| # | Decision | Choice |
|---|---|---|
| 1 | Loopback is trusted | Requests from the kiosk's own browser (`isLocalRequest`) need no token, exactly as today. Nothing about the kiosk UI changes. |
| 2 | LAN requires a bearer token | Any non-loopback request to `/api/*` (except `GET /api/version`, the supervisor health check, and `GET /api/system/diagnostics` *redacted view*, see 5) must carry `Authorization: Bearer <token>`; otherwise 401 with a body that says how to pair. |
| 3 | Pairing flow | Settings → System → **Pair a device** shows a 6-digit code for 5 minutes. The caller does `POST /api/pair { code, name }` from the LAN and receives a long random token, stored hashed in `data/paired-devices.json` with the name and created-at. Settings lists paired devices with Revoke. |
| 4 | Existing deployments | Default **on**. The reference kiosk has no LAN callers today, so nothing breaks; the only effect is closing the open-write hole. A `LAN_API_OPEN=true` env escape hatch exists for hosted/dev use and logs a warning at boot. |
| 5 | Diagnostics content | `version`, uptime, `nodeVersion`, platform/arch, `supervised`, update status and last check, auth mode (service-account / oauth / none — never the email), calendar sync status and last error, weather status (from `/api/weather/status`), enabled widgets with versions and any load errors, theme id, network status (interface, connected yes/no, internet reachable yes/no — never the SSID or IP in the *redacted* view), disk free on the app volume, last 50 lines of the app's own ring-buffer log (see 6), config validation warnings. Two views: **redacted** (what feedback attaches; safe to send anywhere) and **full** (adds SSID, IP, hostname; paired callers and the kiosk screen only). |
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
- Client: System section additions in `settings-menu.tsx`.
- Update `docs/SPEC.md` §2.2's auth column for every endpoint.

## 5. Acceptance

- From a laptop on the LAN: `GET /api/calendar/events` → 401 with a
  pairing hint; pair with the on-screen code; same call → 200; revoke on
  the kiosk; same call → 401.
- Kiosk UI: unchanged behaviour in every flow (run the SPEC §3 smoke list).
- Redacted bundle contains no `@`, no SSID, no IPv4 literal, no token; a
  test asserts this with a fixture full of each.
- Supervisor health check (`scripts/start.sh` → `/api/version`) still
  passes without a token.
- Expired code → 410; wrong code 5× → code invalidated.

## 6. Docs

- `docs/SPEC.md` §2.1, §2.2, new §2.7 "LAN pairing", §3.7.
- `INSTALLATION.md` troubleshooting: "Read the diagnostics screen first"
  replaces several SSH-first entries; a new short section on pairing.
- `docs/decisions/0018-lan-api-pairing-over-loopback-only.md`.

## 7. PR tier

**Safe zone (verified)** for pairing (no new outbound calls; permissions
tighten, not loosen). The diagnostics bundle is only *sent* by brief 04,
which carries the privacy flag.

## 8. Out of scope

TLS on the LAN API; mDNS (brief 06); any cloud relay.
