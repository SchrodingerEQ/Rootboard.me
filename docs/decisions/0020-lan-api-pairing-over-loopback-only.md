# 0020 — LAN API pairing, not loopback-only
Date: 2026-11-14
Status: accepted (beta-launch brief 05, decisions locked 2026-11-08); on main via the brief 05 PR, not yet released

## Decision

1. **Loopback is trusted.** The kiosk's own browser (`127.0.0.1`, `::1`,
   `::ffff:127.0.0.1`) calls `/api/*` with no token, exactly as before.
2. **Everything else needs a bearer token.** A guard
   (`server/middleware/lanAuth.ts`) is mounted with `app.use("/api", …)`
   ahead of every route. A non-loopback request without a valid
   `Authorization: Bearer <token>` gets a 401 whose body says how to pair.
   Three requests stay open: `GET /api/version` (the supervisor health
   check), `GET /api/system/diagnostics` (an unpaired caller gets the
   redacted view only; `?view=full` is a 401), and `POST /api/pair` (the
   code is the credential).
3. **Pairing.** Settings → System → Pair a device asks for a 6-digit code
   (`POST /api/system/pairing-code`, loopback only) that lives 5 minutes,
   in memory, single use. `POST /api/pair {code, name}` trades it for a
   token: `rbp_` + 32 random bytes (base64url). Only the token's SHA-256
   is stored, in `data/paired-devices.json` (mode 0600, written
   atomically). Wrong code 5 times → the code is cancelled. Expired or no
   code → 410. Paired devices are listed in Settings with Revoke.
4. **Default on**, with `LAN_API_OPEN=true` as an escape hatch for hosted
   and development setups. It logs a warning at boot. It does not open
   the loopback-only routes.
5. **Loopback-only routes stay loopback-only for paired callers too:**
   update apply, rollback, and issuing or cancelling a pairing code. A
   token never lets a remote device install code or mint more codes.

## Context and alternatives

The server listens on every interface and, before this, only update
apply/rollback checked the caller. Anything on the household Wi-Fi could
read the calendar and the dashboard config, and create, change or delete
events.

- **Listen on 127.0.0.1 only.** Rejected: it closes the hole but also
  closes the door the agent-facing setup (brief 06) and the widget dev
  loop (brief 07) walk through. Pairing keeps the door and gives the owner
  the lock.
- **A static API key in `.env`.** Rejected: an SSH-first step, one key
  for every device, and no way to revoke one device from the screen.
- **Accounts and passwords.** Rejected: principle "no accounts unless
  functionally required"; a code read off a screen proves presence in the
  house, which is the property that matters.
- **TLS on the LAN API.** Out of scope for the beta: a token sent over
  plain HTTP can be read by someone already sniffing the home network.
  Recorded as a known limit.

## Consequences

- The route inventory in `server/lan-auth.spec.ts` lists every `/api`
  route with its expected guard and fails when a route is added without
  being classified. Every protected route is exercised from a
  non-loopback address with no token, a paired token, and loopback.
- Express matches paths case-insensitively and ignores a trailing slash;
  the guard is mounted the same way, so `/API/...` cannot reach a handler
  without passing it (tested).
- `trust proxy` stays unset, so `X-Forwarded-For` cannot fake loopback
  (tested). A reverse proxy in front of the app would make every caller
  look like loopback: re-verify before ever adding one.
- `/widgets/*` static assets are outside `/api` and stay open (they are
  sideloaded widget code and icons, not data).
- Deleting `data/paired-devices.json` over SSH revokes every device
  without a restart. A damaged file fails closed.
- The pairing code, the token and the diagnostics body are kept out of
  the request log.
