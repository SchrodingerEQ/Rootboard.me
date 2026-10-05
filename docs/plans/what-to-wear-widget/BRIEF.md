# What to Wear — kid-facing school outfit widget

**Status:** Built and released in v1.7.0 (2026-10-05). Deviations made during
review are recorded in decision 0012 and SPEC §3.10.
**Type:** First-party widget (lives in this repo, `client/src/widgets/what-to-wear/`).
**Contract:** [Widget Contract apiVersion 1](../widget-system/CONTRACT.md) — zero exceptions, like every first-party widget.
**Parent decisions:** [0006](../../decisions/0006-community-widget-system.md), [0007](../../decisions/0007-widget-contract-shape.md), [0009](../../decisions/0009-theme-engine-persistence-and-token-layer.md).

---

## 1. What it is, in one paragraph

A full-screen section a kindergartener through middle-schooler can glance
at while getting ready and immediately know **what today's weather feels
like, what to wear this morning, what to wear this afternoon, and what to
put in their backpack**. It reads the forecast from the same trusted
source the kiosk already uses (Open-Meteo), turns it into kid-friendly
words and big friendly icons, and applies a simple rules table to
recommend clothing. No accounts, no analytics, no touch interaction in
v1 — it is a glanceable display. The only configuration is a zip code,
a temperature unit, and school start/end times, entered through the
host's existing Settings screen.

## 2. Decisions locked in this brief

These were agreed with the founder on 2026-10-04. Do not reopen them in
the implementation; raise anything that conflicts with them.

| # | Decision | Choice |
|---|---|---|
| 1 | Where the code lives | First-party widget inside this repo, registered in `client/src/widgets/registry.ts` next to calendar/chores/dinner. Can be split into its own community repo later. |
| 2 | Location | Widget has its own **zip code** setting (US zip codes only in v1). When the zip is **blank**, fall back to the kiosk's already-configured weather location so it works on day one with no setup. |
| 3 | Which day is shown | **Today until school lets out, then tomorrow**, with a clear "Today" / "Tomorrow" label. Weekends are not special-cased: the widget keeps working and shows the day name, so it is useful for weekend outings. |
| 4 | Time windows | Settings for **school start (default 08:00)** and **school end (default 15:00)**. **Evening is fixed at 18:00.** Morning = conditions at school start, Afternoon = at school end, Evening = at 18:00. |
| 5 | Units | **Celsius by default**, with a settings toggle to Fahrenheit. |
| 6 | Clothing cutoffs | Hard-coded sensible defaults in v1 (not user-tunable). |
| 7 | Advice coverage | Temperature layering, rain, **snow** (boots/gloves/hat), **strong wind**, and **high UV** (sunscreen/hat/water bottle). |
| 8 | Interaction | **None** in v1. Pure display. Zip and other settings are typed in the host Settings screen, not inside the widget (this keeps the widget out of on-screen-keyboard territory). |
| 9 | Look | Big friendly emoji-style icons, generic copy (no kid names), large text readable from across the room, every colour from `--rb-*` theme tokens. |
| 10 | Zip → coordinates | Use a free, keyless, HTTPS postal-code lookup (see §4.2). This adds one more outside host; that is accepted. |

## 3. What the kid sees

Target screen: the reference kiosk is a 21.5-inch landscape touchscreen
in Firefox kiosk mode. The widget owns the whole content area to the
right of the nav rail. **Nothing may scroll.** Design for a fixed
landscape panel; everything must fit on one screen at the kiosk's
resolution and still look fine on a 1024×600 dev window.

Layout, top to bottom (an implementation may adjust proportions, not
the sections or their order):

1. **Header strip** — day label ("Today" / "Tomorrow", plus the weekday
   name, e.g. "Today · Tuesday"), the location label, and the headline
   weather sentence in kid language with one big weather emoji, e.g.
   "Sunny and warm! ☀️", "Rainy afternoon ahead 🌧️", "Brrr, it's freezing 🥶".
2. **Day-at-a-glance row** — three equal cards side by side:
   **Morning**, **Afternoon**, **Evening**. Each shows: a big weather
   emoji, the temperature in large type, a one-line kid phrase
   ("Chilly", "Nice and warm", "Hot!"), and small chips when relevant
   ("💧 60% rain", "💨 windy", "☀️ strong sun"). Times shown in small
   text under each heading (e.g. "8:00 AM").
3. **Outfit cards** — two large cards side by side:
   - **"This morning, wear…"** — a row of big item chips, each an emoji
     plus a short label: 👕 T-shirt · 🩳 Shorts · 🧥 Hoodie · 👟 Sneakers.
   - **"This afternoon…"** — same style, showing what changes: e.g.
     "Take off your hoodie when it warms up ☀️" or "Put your raincoat on
     before you go outside 🌧️". If nothing changes, say so cheerfully
     ("Same as this morning 👍").
4. **Backpack strip** — "🎒 Put in your backpack:" followed by item
   chips (raincoat, umbrella, sunscreen, hat, water bottle, gloves…).
   When there is nothing extra, show "Nothing extra today!".
5. **Footer line** (small, muted) — "Weather as of 7:30 AM" plus the
   source name. This is where stale-data and setup messages appear.

Copy tone: short, warm, second person, no jargon, no scary wording.
Reading level around grade 2. Every sentence under ten words where
possible.

### Empty / error states

- **No zip set AND host weather disabled** → friendly full-panel message:
  "Ask a grown-up to add your zip code in Settings 🙂" (with a small
  hint that Settings is on the nav rail). Nothing else renders.
- **Forecast fetch fails but a cached forecast exists** → render it,
  footer says "Weather from earlier — as of 6:10 AM".
- **Fetch fails and no cache** → "Can't reach the weather right now.
  Try again in a bit ☁️".
- **Invalid zip** (lookup returns 404) → "That zip code didn't work —
  check it in Settings".

## 4. Data

### 4.1 Forecast source — Open-Meteo (already the kiosk's source)

The kiosk's existing weather (`server/services/weatherService.ts`,
`GET /api/weather`) only carries the current temperature and daily
high/low. This widget needs **hourly** data, so there are two paths that
produce the same internal shape:

**Path A — zip code set (widget-side fetch):**
Resolve zip → lat/lon (§4.2), then call Open-Meteo directly via
`host.fetch` (allowed by the contract's v1 trust model):

```
https://api.open-meteo.com/v1/forecast
  ?latitude=…&longitude=…
  &hourly=temperature_2m,apparent_temperature,precipitation_probability,
          precipitation,snowfall,weather_code,wind_speed_10m,uv_index
  &daily=sunrise,sunset
  &temperature_unit=celsius&wind_speed_unit=kmh&precipitation_unit=mm
  &timezone=auto&forecast_days=3
```

Always request Celsius / km/h / mm from upstream; the widget converts
for display. `forecast_days=3` covers "tomorrow" even late at night.

**Path B — zip blank (host fallback):**
Extend `server/services/weatherService.ts` **additively** so the
`/api/weather` payload gains an `hourly` array (next 48 h, same fields
as above) and a `units` field reporting the server's configured unit.
The existing `current`/`daily` fields and the 30-minute cache stay
exactly as they are so the header chip and week view are unaffected.
The widget reads `/api/weather` through `host.fetch` and normalises to
Celsius internally. The kiosk's coordinates never reach the client
(they stay in `.env`); only the derived forecast does.

Internal shape the rules engine consumes, regardless of path:

```ts
interface HourPoint {
  time: string;            // ISO local time from upstream
  tempC: number;
  feelsLikeC: number;
  precipChance: number;    // 0–100
  precipMm: number;
  snowCm: number;
  code: number;            // WMO weather code
  windKmh: number;
  uv: number;
}
interface ForecastBundle {
  location: string;        // display label (zip or host label)
  fetchedAt: string;       // ISO
  hours: HourPoint[];
}
```

### 4.2 Zip → coordinates

Use `https://api.zippopotam.us/us/<zip>` — free, no key, HTTPS, returns
latitude/longitude. Cache the result in `host.storage` keyed by zip so
the lookup happens **once per zip**, not on every refresh. Re-run only
when the zip setting changes. Validate the zip is exactly five digits
before calling. Treat a 404 as "invalid zip" (see error states).

If the implementing agent finds this service unreliable, the documented
alternative is Open-Meteo's own geocoder
(`https://geocoding-api.open-meteo.com/v1/search?name=<zip>&countryCode=US`),
which works for most US zips. Pick one, note the choice in the decision
record (§9), and do not call both.

### 4.3 Caching and freshness

- Manifest `refresh.intervalSeconds: 1800` (30 min, matching the host's
  own weather cadence). The host calls `refresh()` only while visible,
  online, and the screensaver is off — do not add a polling loop.
- Persist the last good `ForecastBundle` (plus the zip→coords map) in
  `host.storage` so a reboot or outage still renders something. Keep the
  blob well under the 64,000-character cap: store at most 48 hours.
- One private one-minute timer re-evaluates the **day flip** (today →
  tomorrow at school end) and the "as of" footer. Pause it on
  `onVisibilityChange(false)`, resume on `true`, clear it in
  `unmount()`. Handlers must be idempotent (the host may repeat values).

## 5. Time windows

All in the kiosk's local time (Open-Meteo returns local times with
`timezone=auto`).

| Window | Point value | Range used for "any rain / max UV / max wind" |
|---|---|---|
| Morning | hour nearest school start (default 08:00) | start − 1 h … start + 2 h |
| Afternoon | hour nearest school end (default 15:00) | end − 1 h … end + 2 h |
| Evening | 18:00 | 17:00 … 20:00 |
| School day (for backpack items) | — | school start … school end |

**Day selection:** if current local time is before school end → show
today; otherwise → show tomorrow. Label "Today"/"Tomorrow" and the
weekday name.

Settings `schoolStart` / `schoolEnd` are `"HH:MM"` strings (the contract
has no time type). Validate on read; on anything unparsable or when
start ≥ end, silently fall back to `08:00` / `15:00`.

## 6. Recommendation rules

Implement as a **pure function** with no DOM or fetch inside:

```ts
buildAdvice(bundle: ForecastBundle, settings: ResolvedSettings, now: Date): Advice
```

It returns structured data (bands, item lists, phrases); the React layer
only renders it. This is what the unit tests target (§8).

### 6.1 Temperature bands (on **feels-like** temperature, Celsius)

| Band | Feels-like | Base outfit |
|---|---|---|
| Hot | ≥ 24 | 👕 T-shirt · 🩳 Shorts · 👟 Sneakers |
| Warm | 18 – 23 | 👕 T-shirt · 🩳 Shorts (or light pants) · 👟 Sneakers |
| Cool | 12 – 17 | 👕 T-shirt · 👖 Long pants · 🧥 Hoodie or sweatshirt |
| Chilly | 5 – 11 | 👕 Long sleeves · 👖 Pants · 🧥 Jacket |
| Cold | −5 – 4 | 🧥 Winter coat · 🧢 Warm hat · 🧤 Gloves · 👖 Pants |
| Freezing | < −5 | 🧥 Heavy coat · 🧣 Scarf · 🧢 Hat · 🧤 Gloves · (❄️ Snow pants if snowing) |

### 6.2 Layering (the "shorts with a sweatshirt" rule)

Compute the band for Morning and for Afternoon.

- If Afternoon is **at least one band warmer** than Morning: the base
  outfit is the **Afternoon** band, plus the removable layer the Morning
  band calls for (hoodie / jacket). Morning card says "wear it", the
  Afternoon card says "take it off when it warms up ☀️".
  Example: feels-like 13 °C at 08:00, 24 °C at 15:00 → shorts + T-shirt +
  hoodie in the morning; afternoon: take the hoodie off.
- If Afternoon is **colder** than Morning by a band or more: dress for
  Morning, and the Afternoon card says to put the extra layer on, with
  that layer also listed in the backpack strip.
- Otherwise: same outfit both cards; Afternoon says "Same as this
  morning 👍".
- Never recommend shorts when the Morning band is Cold or Freezing, even
  if the afternoon is Warm.

### 6.3 Rain

Use the max `precipChance` over each window's range.

- ≥ 40 % in the **Morning** range → "wear your raincoat 🧥🌧️" in the
  Morning card. Also listed as worn, not packed.
- ≥ 40 % in the **Afternoon** range but **not** the morning → raincoat
  goes in the **backpack** strip; Afternoon card: "put your raincoat on
  before you go outside".
- ≥ 70 % anywhere in the school day → add ☔ Umbrella and 🥾 Rain boots
  to the backpack strip (boots are "wear", umbrella is "pack").
- WMO code ≥ 95 (thunderstorm) in the school day → headline mentions
  storms gently ("Storms this afternoon — stay cozy inside 🌩️") and the
  raincoat rules apply.

### 6.4 Snow

- Any `snowCm > 0` or snow WMO code (71–77, 85, 86) in the school day →
  🥾 Boots (wear), 🧤 Gloves, 🧢 Hat (wear, even if the band alone would
  not add them).
- Snow total over the school day ≥ 2 cm → add ❄️ Snow pants (wear).

### 6.5 Wind

- Max `windKmh` over the school day ≥ 30 → add 🧥 Windbreaker if the
  band has no jacket/coat already, and a chip "💨 windy" on the affected
  window cards. ≥ 45 → headline mentions it ("Super windy — hold onto
  your hat! 💨").

### 6.6 Sun / UV

- Max `uv` over the school day ≥ 6 → backpack: 🧴 Sunscreen · 🧢 Sun hat
  · 💧 Water bottle; chip "☀️ strong sun" on the sunniest window.
- uv 3 – 5 and the afternoon code is clear/mostly sunny (0–1) → 🧴
  Sunscreen only.
- Hot band in the afternoon → always add 💧 Water bottle.

### 6.7 Kid-friendly weather phrases

Map (WMO code, band) → phrase. Keep one table in `phrases.ts` so copy is
easy to edit without touching logic. Minimum set:

| Code | Phrase |
|---|---|
| 0–1 | "Sunny" |
| 2 | "Some clouds, some sun" |
| 3 | "Cloudy" |
| 45, 48 | "Foggy — hard to see far" |
| 51–57 | "Drizzly" |
| 61–67, 80–82 | "Rainy" |
| 71–77, 85–86 | "Snowy!" |
| 95+ | "Stormy" |

Band phrases: Hot "Hot!", Warm "Nice and warm", Cool "A little cool",
Chilly "Chilly", Cold "Cold — bundle up", Freezing "Freezing! Brrr".
Headline = weather phrase + band phrase with an emoji, e.g.
"Sunny and nice and warm ☀️" (the implementation may smooth grammar).

### 6.8 Emoji

Use **single-codepoint emoji with no ZWJ sequences**, the same rule the
on-screen keyboard follows for kiosk-Firefox font support (SPEC §3.3).
Verify each emoji used renders on the Pi's Firefox; if any glyph is
missing, swap it for a `lucide-react` icon rather than shipping a tofu
box. Prefer a small shared `ItemChip` component that takes
`{ emoji, label, icon? }` so swapping is one-line.

## 7. Settings (manifest)

```json
{
  "id": "what-to-wear",
  "name": "What to Wear",
  "version": "1.0.0",
  "apiVersion": 1,
  "entry": "index.js",
  "slots": ["section"],
  "description": "Kid-friendly weather and what to wear to school, morning and afternoon.",
  "refresh": { "intervalSeconds": 1800 },
  "settings": [
    { "key": "zipCode",     "label": "Zip code (blank = kiosk location)", "type": "string", "default": "" },
    { "key": "units",       "label": "Temperature", "type": "select", "default": "celsius",
      "options": [ { "value": "celsius", "label": "°C" }, { "value": "fahrenheit", "label": "°F" } ] },
    { "key": "schoolStart", "label": "School starts (HH:MM)", "type": "string", "default": "08:00" },
    { "key": "schoolEnd",   "label": "School ends (HH:MM)",   "type": "string", "default": "15:00" }
  ]
}
```

- Settings are read via `host.settings.get()` and `subscribe()`; the
  widget never writes them (no `patch()` needed in v1).
- Values persist in `data/config/dashboard.json`, which is gitignored.
  The zip code is treated as personal data: never log it, never put it
  in an error message that could end up in a log, and never ship a
  default value.

## 8. Testing

- **Unit tests (vitest)** for `buildAdvice` and the window/day-selection
  helpers, with fixtures. Must include at least these scenarios, which
  are the founder's own examples:
  1. Sunny, feels-like 13 °C at 08:00 and 24 °C at 15:00 → morning:
     shorts + T-shirt + hoodie; afternoon: take off hoodie; backpack:
     nothing extra (plus sunscreen if UV ≥ 3 in the fixture).
  2. Dry morning, 65 % rain chance at 15:00 → raincoat in **backpack**,
     afternoon card says put it on; morning card has no raincoat.
  3. Rain 80 % at 08:00 → raincoat **worn** in the morning; umbrella
     and boots added.
  4. −8 °C with 3 cm snow → Freezing band, boots, gloves, hat, snow pants.
  5. Day flip: `now` at 15:30 selects tomorrow; at 14:59 selects today.
  6. Bad `schoolStart` string falls back to 08:00.
  7. Fahrenheit display converts correctly and rounds to whole degrees.
- **Manifest** passes `validateBuiltinManifest` (existing test pattern).
- **Manual kiosk check** before release: both fetch paths (zip set /
  zip blank), the no-config empty state, a theme switch (no literal
  colours), screensaver dim/wake, and a 10-minute soak to confirm no
  timer leak after switching sections.

## 9. Files to create or touch

| Path | Change |
|---|---|
| `client/src/widgets/what-to-wear/manifest.json` | new, as §7 |
| `client/src/widgets/what-to-wear/index.tsx` | new — `mount`/`unmount`/`refresh`/`onVisibilityChange`, mirrors `widgets/dinner/index.tsx` structure (own React root, `validateBuiltinManifest`) |
| `client/src/widgets/what-to-wear/forecast.ts` | new — both fetch paths, zip lookup, normalisation to `ForecastBundle`, storage cache |
| `client/src/widgets/what-to-wear/advice.ts` | new — pure rules engine (§6) |
| `client/src/widgets/what-to-wear/phrases.ts` | new — copy tables (§6.7) |
| `client/src/widgets/what-to-wear/advice.spec.ts` | new — §8 scenarios |
| `client/src/widgets/what-to-wear/WhatToWear.tsx` (+ small components) | new — layout (§3), theme tokens only |
| `client/src/widgets/registry.ts` | add entry with a `lucide-react` nav icon (`Shirt`) |
| `server/services/weatherService.ts` | **additive** `hourly` + `units` fields on the payload (Path B) — keep existing fields/cache untouched |
| `docs/SPEC.md` | document the widget (new §3.x) and the `/api/weather` payload addition in §2.5 |
| `docs/decisions/0012-what-to-wear-widget.md` | short record: why a widget-side fetch + host fallback, which zip service, why hard-coded bands |
| `TASKS.md` | tick the build item when done |
| `README.md` / awesome-rootboard | add the widget to the first-party list after it ships |

Rebuild (`npm run build`) after the server change — the server is
bundled into `dist/index.js`.

## 10. Guardrails (from CLAUDE.md, restated for this task)

- Public repo + auto-updater: no hostnames, IPs, real zip codes, real
  names, or coordinates anywhere in source, tests, fixtures, docs, or
  commit messages. Test fixtures use obviously fake values.
- No analytics, telemetry, or third-party scripts. Exactly two outside
  hosts, both HTTPS and keyless: `api.open-meteo.com` and the chosen
  zip lookup service. Document both in SPEC §2.5.
- No literal colours; `--rb-*` tokens only (decision 0009).
- Weather must never break the kiosk: every failure path renders a
  friendly state, never throws out of `mount()` or `refresh()`.
- Run the mandatory pre-push security review and `npm test` before
  pushing.

## 11. Explicitly out of scope for v1 (do not build)

- Per-kid profiles or names, or multiple zip codes.
- Any tap interaction (packing checklist, "got it" button).
- International postal codes.
- User-tunable temperature cutoffs.
- Changing the header weather chip or week view in any way.
- Weather alerts/warnings feeds.

## 12. Definition of done

- Widget appears in the layout picker and nav rail, can be enabled,
  disabled, and reordered like the other first-party widgets.
- With a blank zip on a kiosk that has weather configured, it renders a
  full forecast with no setup.
- With a valid zip, it renders that location's forecast and the footer
  shows that zip's label.
- All §8 unit tests pass; `npm test` and `npm run build` are green.
- SPEC.md, decision 0012, and TASKS.md are updated.
