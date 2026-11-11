# 01 — Weather location becomes a config setting

**Status:** Done 2026-11-11 — merged to main in #18; implemented as specified; SPEC §2.2/2.5/2.6/3.7/3.10/5, decision 0015. Not yet in a release; kiosk verification follows the next release. Privacy: the postal code and country code go to zippopotam.us on Look up; per the founder (2026-11-11) the Crucible privacy policy gets a Rootboard section and a change-history entry saying so before this ships. That policy section is still pending (its website PR is not open yet), so the next release must not go out before it is live. Note for 03: the Settings popover only renders once Google is connected, so the wizard (not Settings) is the first-run path to this setting.
**Type:** Small server + settings change. One session.
**Depends on:** nothing.
**Unblocks:** 03 (the wizard needs a place to write the location).

---

## 1. Goal

A new owner can set the kiosk's weather location from the touchscreen.
Today the header weather chip and the week/day-view weather read
`WEATHER_ENABLED`, `WEATHER_LAT`, `WEATHER_LON`, `WEATHER_UNITS` and
`WEATHER_LOCATION_LABEL` from `.env` (`server/services/weatherService.ts`
around line 224), which only an SSH session can change. What to Wear
already has its own zip-code setting and a free postal-code lookup
(`client/src/widgets/what-to-wear/`, brief §4.2 of that widget). Unify
these into one host-level location that both consume.

## 2. Decisions locked

| # | Decision | Choice |
|---|---|---|
| 1 | Where the value lives | `data/config/dashboard.json` under a new optional `weather` key, validated in `shared/dashboard-config.ts` with the same lenient `.catch(undefined)` posture the `theme` key uses, so a malformed value never invalidates the widget layout. |
| 2 | Shape | `{ postalCode, countryCode, label, lat, lon, units }`. Coordinates are stored once after lookup; the postal code is kept so the UI can show what was typed. Units `celsius` or `fahrenheit`. |
| 3 | Lookup | Reuse the keyless HTTPS postal-code lookup What to Wear already calls, server-side, so the client never talks to a third host. Add a `GET /api/weather/lookup?postal=&country=` endpoint that proxies it and returns candidates. |
| 4 | `.env` compatibility | `WEATHER_*` env vars keep working as the fallback when the config key is absent. Nothing shipped breaks. Document them as deprecated for kiosks, still fine for hosted use. |
| 5 | Privacy posture | Same as today: coordinates are device-local, gitignored (`data/`), preserved across updates (`PRESERVE_PATHS`). Recommend a postal code rather than a street address in the UI copy. |
| 6 | What to Wear | Its own zip setting stays (principle 4). When it is blank it already falls back to the host location; that fallback now reads the config key first, then env. |

## 3. Work

1. Schema: extend `dashboardConfigSchema`; extend `defaultDashboardConfig()`
   with no `weather` key (absent = disabled unless env says otherwise).
2. Server: a `resolveWeatherConfig()` that returns config → env → null, used
   by `weatherService.ts` wherever the env is read today. Config changes
   must take effect without restart: `PUT /api/config/dashboard` already
   rewrites the file; weatherService must re-read on its next refresh and
   drop its cached forecast when the location changes.
3. Lookup endpoint as in decision 3, with the same 10–20 s timeout policy
   `weatherService.ts` uses and a generic error body.
4. Settings UI: a **Weather** row in the Settings popover (System section
   is the natural home, next to the existing weather status) with postal
   code, country (default from the browser locale), unit toggle, a "Look
   up" button showing candidates, and the current label. Uses the on-
   screen keyboard like every other text field.
5. Tests: schema accept/reject cases in `dashboard-config.spec.ts`;
   `resolveWeatherConfig` precedence; lookup endpoint error paths.

## 4. Acceptance

- Fresh install with no `.env` weather keys: Settings → Weather, type a
  postal code, pick a candidate, the header chip appears within one
  refresh without a restart.
- Existing kiosk with `WEATHER_*` in `.env` and no config key: behaviour
  unchanged.
- Both set: config wins; log one line saying so at startup.
- `data/config/dashboard.json` with `"weather": "garbage"` still loads the
  widget layout.

## 5. Docs

- `docs/SPEC.md` §2.5 (weather) and §2.6 (env vars) and §3.7 (settings).
- `.env.example`: mark `WEATHER_*` as fallback only.
- `INSTALLATION.md` step 8: remove weather from the "things you must edit"
  list; point at Settings.

## 6. PR tier

Safe zone. No new network destination (the lookup host is already used
by What to Wear), no new data leaves the device.
