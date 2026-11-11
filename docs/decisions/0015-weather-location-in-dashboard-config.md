# 0015 — Weather location lives in `dashboard.json`, `.env` is the fallback
Date: 2026-11-11
Status: accepted (beta-launch brief 01, decisions locked 2026-11-08)

## Decision

1. The kiosk's weather location is the optional `weather` key of
   `data/config/dashboard.json` — `{ postalCode, countryCode, label,
   lat, lon, units }` — set from Settings → System → Weather. It is
   validated leniently (`.catch(undefined)`, like `theme`): a malformed
   value disables only the weather location, never the widget layout.
2. Precedence is config → `WEATHER_*` env vars → off, resolved on every
   request so a Settings save or an SSH hand-edit applies without a
   restart. A change of location drops the cached forecast. Startup
   logs one line naming the source, never the place.
3. The postal-code lookup is a server-side proxy
   (`GET /api/weather/lookup`) to `api.zippopotam.us`, the keyless HTTPS
   lookup What to Wear already used, so the kiosk UI talks to no third
   host for it. It runs only on a tap. The postal code is never logged,
   and the response body (place names) is kept out of the request log.

## Context and alternatives

Before this, the location was `.env`-only, which only an SSH session can
change — a blocker for a new owner and for the first-run wizard
(brief 03), which needs a place to write it.

- **Keep `.env` and have the UI rewrite it.** Rejected: `.env` also holds
  the Google key path and other settings a UI should not be able to
  clobber, and the server reads it once at boot, so a change would need
  a restart.
- **Remove the env path.** Rejected: shipped functionality is never
  removed (principle 4), and hosted installs have no touchscreen.
- **Do the lookup in the browser**, as What to Wear does. Rejected: the
  brief wants the client to talk only to its own server; a server-side
  proxy also keeps the timeout policy in one place.

## Consequences

- The saved postal code, label and postal-code-centroid coordinates are
  returned by `GET /api/config/dashboard` to the kiosk UI (the whole
  document round-trips through the shell's read-merge-PUT). `.env`
  coordinates still never reach the client. Like every other
  same-origin endpoint today, that response is readable from the local
  network until brief 05's pairing work lands.
- `data/` is gitignored and on both updater preserve lists, so the
  location stays on the device and survives updates.
- Look up sends the postal code and two-letter country code to
  zippopotam.us. The founder decided (2026-11-11) that the Crucible
  privacy policy states this in a Rootboard-specific section, with a
  change-history entry, before this ships; the UI copy next to Look up
  says the same.
- There is no "clear location" control yet; clearing it is a hand-edit.
