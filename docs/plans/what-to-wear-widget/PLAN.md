# What to Wear Widget Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Status:** executed 2026-10-04 via subagent-driven development; merged to `main`; released in v1.7.0 (2026-10-05). Reviews changed the plan in places — see decision 0012 and SPEC §3.10 for the as-built behaviour.

**Goal:** Ship the kid-facing "What to Wear" first-party widget specified in [BRIEF.md](BRIEF.md): kid-friendly weather for morning/afternoon/evening, outfit advice with a layering rule, and a backpack list, driven by Open-Meteo hourly data.

**Architecture:** A pure rules engine (`advice.ts`) turns a normalized `ForecastBundle` plus resolved settings into structured `Advice`; React only renders it. `forecast.ts` produces the bundle from either a widget-side Open-Meteo fetch (zip set) or the host's `/api/weather` (zip blank), caching the last good bundle and zip coordinates in `host.storage`. The widget entry (`index.tsx`) mirrors the calendar widget's bridge pattern (own React root, `refresh()` from the host scheduler, visibility-gated one-minute clock).

**Tech Stack:** React 18 + TypeScript (Vite), vitest for unit tests (`client/src/**/*.spec.ts`, node environment), Express server bundled by esbuild, `lucide-react` for the nav icon, Zod manifest validation via `validateBuiltinManifest`.

## Global Constraints

Copied from the brief and `CLAUDE.md`; every task implicitly includes these.

- Widget contract apiVersion 1, zero exceptions: touch only `container`, `host`, and the widget's own code (`docs/plans/widget-system/CONTRACT.md`).
- Exactly two outside hosts, both HTTPS and keyless: `https://api.open-meteo.com` and `https://api.zippopotam.us`. No other network calls.
- No literal colours anywhere in the widget: `var(--rb-*)` tokens only (decision 0009). Allowed tokens include `--rb-canvas`, `--rb-surface`, `--rb-surface-sunken`, `--rb-ink`, `--rb-ink-secondary`, `--rb-muted`, `--rb-grid-line`, `--rb-chip`, `--rb-accent`, `--rb-accent-wash`, `--rb-info-wash`, `--rb-warn-wash`.
- Emoji: single-codepoint only, no ZWJ sequences (variation selector U+FE0F is fine). All emoji live in `phrases.ts` so swapping one is a one-line change.
- No real zip codes, coordinates, hostnames, IPs, names, or home paths in source, tests, fixtures, docs, or commit messages. Test zip is `00000` (unassigned). Test dates use the year 2030.
- Zip code is personal data: never log it, never include it in an error message, never ship a default value.
- Weather must never break the kiosk: no throw escapes `mount()`, `refresh()`, or `onVisibilityChange()`; every failure renders a friendly state.
- Nothing scrolls: the layout fits a fixed landscape panel (1920×1080 kiosk, still fine at 1024×600).
- Manifest `refresh.intervalSeconds: 1800`; no polling loop in the widget. One private one-minute timer only, paused while hidden, cleared on unmount.
- Server change to `weatherService.ts` is additive: existing `current`/`daily`/`location`/`updatedAt` fields and the 30-minute cache are untouched.
- Upstream always requested in Celsius / km/h / mm on the widget path; the widget converts for display. Host path reports its unit in a `units` field and the widget normalises to Celsius.
- Settings `schoolStart`/`schoolEnd` are `"HH:MM"` strings; unparsable or `start >= end` silently falls back to `08:00` / `15:00`. Evening is fixed at `18:00`.
- Commit messages end with the trailer `Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>` and the git author email is `3730937+SchrodingerEQ@users.noreply.github.com` (already the repo-local config).
- Run `npx vitest run <path>` for a single spec, `npm test` for everything (it also runs the legacy tsx tests), `npm run check` for `tsc`, `npm run build` after any `server/**` change.
- Before every push: the mandatory security review from `CLAUDE.md` (`git status`, read `git diff --cached`, grep the diff for `private_key`, `BEGIN PRIVATE KEY`, `client_email`, `192.168.`, `10.0.`, `/home/`, `@gmail.com`).

**Known brief conflict, resolved here:** §8 scenario 1 says "backpack: nothing extra", but §6.6 says a Hot afternoon always adds a water bottle. Rule 6.6 wins (it is the explicit rule; "nothing extra" in the scenario is about rain gear). Scenario 1's test asserts no raincoat/umbrella/sunscreen and does assert the water bottle. Flag this to the founder in the final report.

---

## File map

| Path | Responsibility |
|---|---|
| `client/src/widgets/what-to-wear/manifest.json` | Manifest exactly as brief §7 |
| `client/src/widgets/what-to-wear/types.ts` | Shared types: `HourPoint`, `ForecastBundle`, `ResolvedSettings`, `Band`, `Item`, `WindowSummary`, `Advice` |
| `client/src/widgets/what-to-wear/settings.ts` | `resolveSettings()`: HH:MM parsing with fallback, units, zip trimming |
| `client/src/widgets/what-to-wear/time-windows.ts` | Day selection, nearest-hour pick, range filters, trim to 48 h, time labels |
| `client/src/widgets/what-to-wear/units.ts` | `formatTemp()` Celsius/Fahrenheit display |
| `client/src/widgets/what-to-wear/phrases.ts` | Copy tables: item catalog (emoji + label), base outfits per band, weather phrases/emoji, band phrases |
| `client/src/widgets/what-to-wear/advice.ts` | Pure rules engine `buildAdvice()` (brief §6) |
| `client/src/widgets/what-to-wear/forecast.ts` | Both fetch paths, zip lookup, normalisation, storage blob shape |
| `client/src/widgets/what-to-wear/ItemChip.tsx` | One emoji+label chip (with optional lucide fallback icon) |
| `client/src/widgets/what-to-wear/WhatToWear.tsx` | Presentational layout (brief §3) incl. empty/error panels |
| `client/src/widgets/what-to-wear/index.tsx` | Contract entry: `mount`/`unmount`/`refresh`/`onVisibilityChange` |
| `client/src/widgets/what-to-wear/*.spec.ts` | `manifest.spec.ts`, `settings.spec.ts`, `time-windows.spec.ts`, `advice.spec.ts`, `forecast.spec.ts` |
| `client/src/widgets/registry.ts` | Register the widget with the `Shirt` nav icon |
| `server/services/weatherService.ts` | Additive `hourly` + `units` on the payload |
| `shared/dashboard-config.ts` + spec | Default config gains `what-to-wear` (disabled) |
| `client/src/components/app-shell.tsx` | Picker lists built-ins missing from config as disabled rows; enabling appends |
| `docs/SPEC.md`, `docs/decisions/0012-what-to-wear-widget.md`, `TASKS.md` | Documentation |

---

### Task 1: Manifest, types, and settings resolution

**Files:**
- Create: `client/src/widgets/what-to-wear/manifest.json`
- Create: `client/src/widgets/what-to-wear/types.ts`
- Create: `client/src/widgets/what-to-wear/settings.ts`
- Test: `client/src/widgets/what-to-wear/manifest.spec.ts`
- Test: `client/src/widgets/what-to-wear/settings.spec.ts`

**Interfaces:**
- Produces: every type in `types.ts` below; `resolveSettings(raw: Record<string, unknown>): ResolvedSettings`; `parseHHMM(value: unknown): number | null`; constants `DEFAULT_SCHOOL_START_MIN = 480`, `DEFAULT_SCHOOL_END_MIN = 900`, `EVENING_MIN = 1080`.

- [ ] **Step 1: Write the manifest**

`client/src/widgets/what-to-wear/manifest.json`:

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
    { "key": "zipCode", "label": "Zip code (blank = kiosk location)", "type": "string", "default": "" },
    { "key": "units", "label": "Temperature", "type": "select", "default": "celsius",
      "options": [ { "value": "celsius", "label": "°C" }, { "value": "fahrenheit", "label": "°F" } ] },
    { "key": "schoolStart", "label": "School starts (HH:MM)", "type": "string", "default": "08:00" },
    { "key": "schoolEnd", "label": "School ends (HH:MM)", "type": "string", "default": "15:00" }
  ]
}
```

- [ ] **Step 2: Write the types**

`client/src/widgets/what-to-wear/types.ts`:

```ts
/**
 * Shared shapes for the What to Wear widget (docs/plans/what-to-wear-widget/BRIEF.md).
 * The rules engine (advice.ts) consumes ForecastBundle + ResolvedSettings and
 * produces Advice; the React layer only renders Advice.
 */

/** One forecast hour, always Celsius / km/h / mm / cm regardless of source. */
export interface HourPoint {
  time: string;        // ISO local time from upstream, "YYYY-MM-DDTHH:MM"
  tempC: number;
  feelsLikeC: number;
  precipChance: number; // 0–100
  precipMm: number;
  snowCm: number;
  code: number;         // WMO weather code
  windKmh: number;
  uv: number;
}

export interface ForecastBundle {
  location: string;  // display label (zip place name or host label)
  fetchedAt: string; // ISO
  hours: HourPoint[];
}

export type Units = "celsius" | "fahrenheit";

export interface ResolvedSettings {
  /** Trimmed raw zip string: "" = use host weather; non-5-digit = invalid. */
  zipCode: string;
  units: Units;
  schoolStartMin: number; // minutes after local midnight
  schoolEndMin: number;
}

export type Band = "hot" | "warm" | "cool" | "chilly" | "cold" | "freezing";

export interface Item {
  id: string;
  emoji: string;
  label: string;
}

export type WindowKey = "morning" | "afternoon" | "evening";

export interface WindowSummary {
  key: WindowKey;
  title: string;      // "Morning"
  timeLabel: string;  // "8:00 AM"
  tempC: number;
  feelsLikeC: number;
  band: Band;
  code: number;
  emoji: string;      // weather emoji
  phrase: string;     // band phrase, e.g. "Chilly"
  chips: string[];    // e.g. "💧 60% rain", "💨 windy", "☀️ strong sun"
}

export interface Advice {
  dayLabel: "Today" | "Tomorrow";
  weekday: string;    // "Tuesday"
  dateKey: string;    // "YYYY-MM-DD"
  headline: string;   // "Sunny and nice and warm ☀️"
  windows: WindowSummary[]; // morning, afternoon, evening in that order
  wear: Item[];             // "This morning, wear…"
  afternoonNotes: string[]; // "This afternoon…" sentences; never empty
  backpack: Item[];         // may be empty → UI says "Nothing extra today!"
}
```

- [ ] **Step 3: Write the failing settings tests**

`client/src/widgets/what-to-wear/settings.spec.ts`:

```ts
import { describe, expect, test } from "vitest";
import { DEFAULT_SCHOOL_END_MIN, DEFAULT_SCHOOL_START_MIN, parseHHMM, resolveSettings } from "./settings";

describe("parseHHMM", () => {
  test("parses zero-padded and unpadded times", () => {
    expect(parseHHMM("08:00")).toBe(480);
    expect(parseHHMM("8:05")).toBe(485);
    expect(parseHHMM("23:59")).toBe(1439);
  });

  test("rejects garbage", () => {
    expect(parseHHMM("8am")).toBeNull();
    expect(parseHHMM("24:00")).toBeNull();
    expect(parseHHMM("08:60")).toBeNull();
    expect(parseHHMM(800)).toBeNull();
    expect(parseHHMM(undefined)).toBeNull();
  });
});

describe("resolveSettings", () => {
  test("empty settings resolve to defaults", () => {
    expect(resolveSettings({})).toEqual({
      zipCode: "",
      units: "celsius",
      schoolStartMin: DEFAULT_SCHOOL_START_MIN,
      schoolEndMin: DEFAULT_SCHOOL_END_MIN,
    });
  });

  test("scenario 6: a bad schoolStart string falls back to 08:00 (and end to 15:00)", () => {
    const s = resolveSettings({ schoolStart: "8am", schoolEnd: "14:00" });
    expect(s.schoolStartMin).toBe(480);
    expect(s.schoolEndMin).toBe(900);
  });

  test("start >= end falls back to both defaults", () => {
    const s = resolveSettings({ schoolStart: "15:00", schoolEnd: "08:00" });
    expect(s.schoolStartMin).toBe(480);
    expect(s.schoolEndMin).toBe(900);
  });

  test("valid custom times are kept", () => {
    const s = resolveSettings({ schoolStart: "07:30", schoolEnd: "14:15" });
    expect(s.schoolStartMin).toBe(450);
    expect(s.schoolEndMin).toBe(855);
  });

  test("units: only the literal 'fahrenheit' selects Fahrenheit", () => {
    expect(resolveSettings({ units: "fahrenheit" }).units).toBe("fahrenheit");
    expect(resolveSettings({ units: "F" }).units).toBe("celsius");
    expect(resolveSettings({ units: 1 }).units).toBe("celsius");
  });

  test("zip is trimmed and kept verbatim; non-strings become blank", () => {
    expect(resolveSettings({ zipCode: " 00000 " }).zipCode).toBe("00000");
    expect(resolveSettings({ zipCode: "1234" }).zipCode).toBe("1234");
    expect(resolveSettings({ zipCode: 12345 }).zipCode).toBe("");
  });
});
```

`client/src/widgets/what-to-wear/manifest.spec.ts`:

```ts
import { describe, expect, test } from "vitest";
import { validateBuiltinManifest } from "@/widgets/validate-manifest";
import rawManifest from "./manifest.json";

describe("what-to-wear manifest", () => {
  test("passes the shared Zod schema and apiVersion gate", () => {
    const m = validateBuiltinManifest(rawManifest);
    expect(m.id).toBe("what-to-wear");
    expect(m.slots).toContain("section");
    expect(m.refresh?.intervalSeconds).toBe(1800);
    expect(m.settings?.map((s) => s.key)).toEqual(["zipCode", "units", "schoolStart", "schoolEnd"]);
  });
});
```

- [ ] **Step 4: Run the tests to verify they fail**

Run: `npx vitest run client/src/widgets/what-to-wear`
Expected: FAIL — `settings.spec.ts` cannot resolve `./settings`; `manifest.spec.ts` passes already (the JSON exists). That is fine.

- [ ] **Step 5: Implement settings.ts**

`client/src/widgets/what-to-wear/settings.ts`:

```ts
import type { ResolvedSettings, Units } from "./types";

export const DEFAULT_SCHOOL_START_MIN = 8 * 60;
export const DEFAULT_SCHOOL_END_MIN = 15 * 60;
/** Evening is fixed at 18:00 (brief §2 decision 4). */
export const EVENING_MIN = 18 * 60;

/** "HH:MM" (hour may be unpadded) → minutes after midnight, or null. */
export function parseHHMM(value: unknown): number | null {
  if (typeof value !== "string") return null;
  const m = /^([01]?\d|2[0-3]):([0-5]\d)$/.exec(value.trim());
  if (!m) return null;
  return Number(m[1]) * 60 + Number(m[2]);
}

/**
 * Resolves the raw manifest settings blob (host.settings.get()) into typed
 * values. Bad or inverted school times fall back to 08:00 / 15:00 silently
 * (brief §5). The zip is only trimmed here — forecast.ts decides between
 * blank (host fallback), five digits (lookup), and anything else (invalid).
 */
export function resolveSettings(raw: Record<string, unknown>): ResolvedSettings {
  const units: Units = raw.units === "fahrenheit" ? "fahrenheit" : "celsius";
  let start = parseHHMM(raw.schoolStart);
  let end = parseHHMM(raw.schoolEnd);
  if (start === null || end === null || start >= end) {
    start = DEFAULT_SCHOOL_START_MIN;
    end = DEFAULT_SCHOOL_END_MIN;
  }
  const zipCode = typeof raw.zipCode === "string" ? raw.zipCode.trim() : "";
  return { zipCode, units, schoolStartMin: start, schoolEndMin: end };
}
```

- [ ] **Step 6: Run the tests to verify they pass**

Run: `npx vitest run client/src/widgets/what-to-wear`
Expected: PASS (2 files).

- [ ] **Step 7: Commit**

```bash
git add client/src/widgets/what-to-wear/manifest.json client/src/widgets/what-to-wear/types.ts client/src/widgets/what-to-wear/settings.ts client/src/widgets/what-to-wear/settings.spec.ts client/src/widgets/what-to-wear/manifest.spec.ts
git commit -m "feat(what-to-wear): manifest, shared types, and settings resolution

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 2: Time windows and day selection

**Files:**
- Create: `client/src/widgets/what-to-wear/time-windows.ts`
- Test: `client/src/widgets/what-to-wear/time-windows.spec.ts`

**Interfaces:**
- Consumes: `HourPoint` from `./types`.
- Produces: `dateKeyOf(d: Date): string`; `minutesOfDay(d: Date): number`; `hourDateKey(h: HourPoint): string`; `hourMinutes(h: HourPoint): number`; `selectDay(now: Date, schoolEndMin: number): DaySelection` where `DaySelection = { dateKey: string; label: "Today" | "Tomorrow"; weekday: string }`; `pickHour(hours: HourPoint[], dateKey: string, minutes: number): HourPoint | null`; `hoursInRange(hours: HourPoint[], dateKey: string, fromMin: number, toMin: number): HourPoint[]`; `trimHours(hours: HourPoint[], now: Date, maxCount?: number): HourPoint[]`; `formatTimeLabel(minutes: number): string`; `formatClock(iso: string): string`.

Hour times are the upstream "YYYY-MM-DDTHH:MM" local strings; the helpers read the date and minutes by slicing that string, never through `Date` parsing, so there is no timezone ambiguity.

- [ ] **Step 1: Write the failing tests**

`client/src/widgets/what-to-wear/time-windows.spec.ts`:

```ts
import { describe, expect, test } from "vitest";
import type { HourPoint } from "./types";
import {
  dateKeyOf,
  formatClock,
  formatTimeLabel,
  hoursInRange,
  pickHour,
  selectDay,
  trimHours,
} from "./time-windows";

// 2030-03-12 is a Tuesday. All `now` values are local-time constructors.
const DAY = "2030-03-12";
const NEXT = "2030-03-13";

function hour(time: string, over: Partial<HourPoint> = {}): HourPoint {
  return { time, tempC: 15, feelsLikeC: 15, precipChance: 0, precipMm: 0, snowCm: 0, code: 0, windKmh: 10, uv: 2, ...over };
}
function dayHours(dateKey: string): HourPoint[] {
  return Array.from({ length: 24 }, (_, h) => hour(`${dateKey}T${String(h).padStart(2, "0")}:00`));
}

describe("selectDay (scenario 5)", () => {
  test("14:59 with school end 15:00 selects today", () => {
    const sel = selectDay(new Date(2030, 2, 12, 14, 59), 15 * 60);
    expect(sel).toEqual({ dateKey: DAY, label: "Today", weekday: "Tuesday" });
  });
  test("15:30 with school end 15:00 selects tomorrow", () => {
    const sel = selectDay(new Date(2030, 2, 12, 15, 30), 15 * 60);
    expect(sel).toEqual({ dateKey: NEXT, label: "Tomorrow", weekday: "Wednesday" });
  });
  test("exactly school end selects tomorrow", () => {
    expect(selectDay(new Date(2030, 2, 12, 15, 0), 15 * 60).label).toBe("Tomorrow");
  });
});

describe("pickHour", () => {
  test("picks the nearest hour on the requested date", () => {
    const hours = dayHours(DAY);
    expect(pickHour(hours, DAY, 8 * 60)?.time).toBe(`${DAY}T08:00`);
    expect(pickHour(hours, DAY, 8 * 60 + 29)?.time).toBe(`${DAY}T08:00`);
    expect(pickHour(hours, DAY, 8 * 60 + 31)?.time).toBe(`${DAY}T09:00`);
  });
  test("returns null when the date has no hours", () => {
    expect(pickHour(dayHours(DAY), NEXT, 8 * 60)).toBeNull();
  });
});

describe("hoursInRange", () => {
  test("is inclusive on both ends and scoped to the date", () => {
    const hours = [...dayHours(DAY), ...dayHours(NEXT)];
    const got = hoursInRange(hours, DAY, 7 * 60, 10 * 60).map((h) => h.time);
    expect(got).toEqual([`${DAY}T07:00`, `${DAY}T08:00`, `${DAY}T09:00`, `${DAY}T10:00`]);
  });
  test("clamps a negative start to midnight", () => {
    const got = hoursInRange(dayHours(DAY), DAY, -60, 60).map((h) => h.time);
    expect(got).toEqual([`${DAY}T00:00`, `${DAY}T01:00`]);
  });
});

describe("trimHours", () => {
  test("drops hours before today and caps at 48 entries", () => {
    const hours = [...dayHours("2030-03-11"), ...dayHours(DAY), ...dayHours(NEXT), ...dayHours("2030-03-14")];
    const got = trimHours(hours, new Date(2030, 2, 12, 23, 0));
    expect(got).toHaveLength(48);
    expect(got[0].time).toBe(`${DAY}T00:00`);
    expect(got[47].time).toBe(`${NEXT}T23:00`);
  });
});

describe("labels", () => {
  test("dateKeyOf is zero-padded local", () => {
    expect(dateKeyOf(new Date(2030, 2, 5, 9, 0))).toBe("2030-03-05");
  });
  test("formatTimeLabel renders 12-hour clock", () => {
    expect(formatTimeLabel(8 * 60)).toBe("8:00 AM");
    expect(formatTimeLabel(15 * 60 + 5)).toBe("3:05 PM");
    expect(formatTimeLabel(0)).toBe("12:00 AM");
    expect(formatTimeLabel(12 * 60)).toBe("12:00 PM");
  });
  test("formatClock renders an ISO timestamp's local time", () => {
    const iso = new Date(2030, 2, 12, 7, 30).toISOString();
    expect(formatClock(iso)).toBe("7:30 AM");
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npx vitest run client/src/widgets/what-to-wear/time-windows.spec.ts`
Expected: FAIL — cannot resolve `./time-windows`.

- [ ] **Step 3: Implement time-windows.ts**

```ts
import type { HourPoint } from "./types";

const WEEKDAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

/** Local "YYYY-MM-DD" for a Date. */
export function dateKeyOf(d: Date): string {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

export function minutesOfDay(d: Date): number {
  return d.getHours() * 60 + d.getMinutes();
}

/** Upstream times are "YYYY-MM-DDTHH:MM" local strings — read them by
 *  slicing, never via Date parsing, so no timezone math can creep in. */
export function hourDateKey(h: HourPoint): string {
  return h.time.slice(0, 10);
}

export function hourMinutes(h: HourPoint): number {
  const hh = Number(h.time.slice(11, 13));
  const mm = Number(h.time.slice(14, 16));
  return (Number.isFinite(hh) ? hh : 0) * 60 + (Number.isFinite(mm) ? mm : 0);
}

export interface DaySelection {
  dateKey: string;
  label: "Today" | "Tomorrow";
  weekday: string;
}

/** Brief §5: before school end → today; otherwise → tomorrow. */
export function selectDay(now: Date, schoolEndMin: number): DaySelection {
  const isToday = minutesOfDay(now) < schoolEndMin;
  const d = new Date(now);
  if (!isToday) d.setDate(d.getDate() + 1);
  return { dateKey: dateKeyOf(d), label: isToday ? "Today" : "Tomorrow", weekday: WEEKDAYS[d.getDay()] };
}

/** Nearest hour (by absolute minute distance) on the given date, or null. */
export function pickHour(hours: HourPoint[], dateKey: string, minutes: number): HourPoint | null {
  let best: HourPoint | null = null;
  let bestDist = Infinity;
  for (const h of hours) {
    if (hourDateKey(h) !== dateKey) continue;
    const dist = Math.abs(hourMinutes(h) - minutes);
    if (dist < bestDist) {
      best = h;
      bestDist = dist;
    }
  }
  return best;
}

/** Hours on `dateKey` with fromMin ≤ minutes ≤ toMin (clamped to the day). */
export function hoursInRange(hours: HourPoint[], dateKey: string, fromMin: number, toMin: number): HourPoint[] {
  const lo = Math.max(0, fromMin);
  const hi = Math.min(23 * 60 + 59, toMin);
  return hours.filter((h) => {
    if (hourDateKey(h) !== dateKey) return false;
    const m = hourMinutes(h);
    return m >= lo && m <= hi;
  });
}

/** Keep hours from the start of today's local date, at most `maxCount`
 *  (48 h covers "tomorrow" even late at night and keeps the storage blob
 *  far under the 64,000-char cap — brief §4.3). */
export function trimHours(hours: HourPoint[], now: Date, maxCount = 48): HourPoint[] {
  const todayKey = dateKeyOf(now);
  return hours.filter((h) => hourDateKey(h) >= todayKey).slice(0, maxCount);
}

/** 480 → "8:00 AM". */
export function formatTimeLabel(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}:${pad2(m)} ${h < 12 ? "AM" : "PM"}`;
}

/** ISO timestamp → local "7:30 AM"; "" if unparsable. */
export function formatClock(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return formatTimeLabel(minutesOfDay(d));
}
```

- [ ] **Step 4: Run to verify pass**

Run: `npx vitest run client/src/widgets/what-to-wear/time-windows.spec.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add client/src/widgets/what-to-wear/time-windows.ts client/src/widgets/what-to-wear/time-windows.spec.ts
git commit -m "feat(what-to-wear): day selection and time-window helpers

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 3: Copy tables and unit formatting

**Files:**
- Create: `client/src/widgets/what-to-wear/phrases.ts`
- Create: `client/src/widgets/what-to-wear/units.ts`
- Test: `client/src/widgets/what-to-wear/units.spec.ts`

**Interfaces:**
- Consumes: `Band`, `Item`, `Units` from `./types`.
- Produces: `ITEMS` (record of `Item` keyed by id), `BASE_OUTFIT: Record<Band, Item[]>`, `LAYER_FOR_BAND: Partial<Record<Band, Item>>`, `OUTER_LAYER_IDS: ReadonlySet<string>`, `BAND_PHRASE: Record<Band, string>`, `weatherPhrase(code: number): string`, `weatherEmoji(code: number): string`, `isSnowCode(code: number): boolean`, `formatTemp(c: number, units: Units): string`.

- [ ] **Step 1: Write the failing units test**

`client/src/widgets/what-to-wear/units.spec.ts`:

```ts
import { describe, expect, test } from "vitest";
import { formatTemp } from "./units";

describe("formatTemp (scenario 7)", () => {
  test("Celsius rounds to whole degrees", () => {
    expect(formatTemp(13.4, "celsius")).toBe("13°");
    expect(formatTemp(-7.6, "celsius")).toBe("-8°");
  });
  test("Fahrenheit converts and rounds to whole degrees", () => {
    expect(formatTemp(13, "fahrenheit")).toBe("55°");   // 55.4
    expect(formatTemp(24, "fahrenheit")).toBe("75°");   // 75.2
    expect(formatTemp(-8, "fahrenheit")).toBe("18°");   // 17.6
    expect(formatTemp(0, "fahrenheit")).toBe("32°");
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npx vitest run client/src/widgets/what-to-wear/units.spec.ts`
Expected: FAIL — cannot resolve `./units`.

- [ ] **Step 3: Implement units.ts**

```ts
import type { Units } from "./types";

export function cToF(c: number): number {
  return (c * 9) / 5 + 32;
}

export function fToC(f: number): number {
  return ((f - 32) * 5) / 9;
}

/** Whole-degree display with the degree sign, no unit letter (the unit is
 *  implied by the setting; kids don't need "°C"). */
export function formatTemp(c: number, units: Units): string {
  const v = units === "fahrenheit" ? cToF(c) : c;
  return `${Math.round(v)}°`;
}
```

- [ ] **Step 4: Implement phrases.ts**

All copy and every emoji live here (brief §6.7, §6.8). Every emoji is a single codepoint, optionally followed by U+FE0F; no ZWJ sequences.

```ts
import type { Band, Item } from "./types";

// ---------------------------------------------------------------------------
// Clothing and gear catalog. Ids are stable (the rules engine dedupes by id);
// emoji/labels are free to edit. Single-codepoint emoji only (SPEC §3.3).
// ---------------------------------------------------------------------------
export const ITEMS = {
  tshirt: { id: "tshirt", emoji: "👕", label: "T-shirt" },
  longSleeves: { id: "longSleeves", emoji: "👕", label: "Long sleeves" },
  shorts: { id: "shorts", emoji: "🩳", label: "Shorts" },
  pants: { id: "pants", emoji: "👖", label: "Long pants" },
  sneakers: { id: "sneakers", emoji: "👟", label: "Sneakers" },
  hoodie: { id: "hoodie", emoji: "🧥", label: "Hoodie" },
  jacket: { id: "jacket", emoji: "🧥", label: "Jacket" },
  winterCoat: { id: "winterCoat", emoji: "🧥", label: "Winter coat" },
  heavyCoat: { id: "heavyCoat", emoji: "🧥", label: "Heavy coat" },
  windbreaker: { id: "windbreaker", emoji: "🧥", label: "Windbreaker" },
  raincoat: { id: "raincoat", emoji: "🧥", label: "Raincoat" },
  warmHat: { id: "warmHat", emoji: "🧢", label: "Warm hat" },
  sunHat: { id: "sunHat", emoji: "🧢", label: "Sun hat" },
  gloves: { id: "gloves", emoji: "🧤", label: "Gloves" },
  scarf: { id: "scarf", emoji: "🧣", label: "Scarf" },
  boots: { id: "boots", emoji: "🥾", label: "Boots" },
  rainBoots: { id: "rainBoots", emoji: "🥾", label: "Rain boots" },
  snowPants: { id: "snowPants", emoji: "❄️", label: "Snow pants" },
  umbrella: { id: "umbrella", emoji: "☔", label: "Umbrella" },
  sunscreen: { id: "sunscreen", emoji: "🧴", label: "Sunscreen" },
  waterBottle: { id: "waterBottle", emoji: "💧", label: "Water bottle" },
} as const satisfies Record<string, Item>;

/** Brief §6.1 base outfits per feels-like band. */
export const BASE_OUTFIT: Record<Band, Item[]> = {
  hot: [ITEMS.tshirt, ITEMS.shorts, ITEMS.sneakers],
  warm: [ITEMS.tshirt, ITEMS.shorts, ITEMS.sneakers],
  cool: [ITEMS.tshirt, ITEMS.pants, ITEMS.hoodie, ITEMS.sneakers],
  chilly: [ITEMS.longSleeves, ITEMS.pants, ITEMS.jacket, ITEMS.sneakers],
  cold: [ITEMS.longSleeves, ITEMS.pants, ITEMS.winterCoat, ITEMS.warmHat, ITEMS.gloves],
  freezing: [ITEMS.longSleeves, ITEMS.pants, ITEMS.heavyCoat, ITEMS.scarf, ITEMS.warmHat, ITEMS.gloves],
};

/** The removable layer each band "calls for" (brief §6.2). Hot/warm: none. */
export const LAYER_FOR_BAND: Partial<Record<Band, Item>> = {
  cool: ITEMS.hoodie,
  chilly: ITEMS.jacket,
  cold: ITEMS.winterCoat,
  freezing: ITEMS.heavyCoat,
};

/** Items that count as "already has a jacket/coat" for the wind rule. */
export const OUTER_LAYER_IDS: ReadonlySet<string> = new Set([
  ITEMS.hoodie.id, ITEMS.jacket.id, ITEMS.winterCoat.id, ITEMS.heavyCoat.id, ITEMS.raincoat.id, ITEMS.windbreaker.id,
]);

// ---------------------------------------------------------------------------
// Weather phrases (brief §6.7)
// ---------------------------------------------------------------------------
export const BAND_PHRASE: Record<Band, string> = {
  hot: "Hot!",
  warm: "Nice and warm",
  cool: "A little cool",
  chilly: "Chilly",
  cold: "Cold — bundle up",
  freezing: "Freezing! Brrr",
};

export function isSnowCode(code: number): boolean {
  return (code >= 71 && code <= 77) || code === 85 || code === 86;
}

export function weatherPhrase(code: number): string {
  if (code <= 1) return "Sunny";
  if (code === 2) return "Some clouds, some sun";
  if (code === 3) return "Cloudy";
  if (code === 45 || code === 48) return "Foggy — hard to see far";
  if (code >= 51 && code <= 57) return "Drizzly";
  if ((code >= 61 && code <= 67) || (code >= 80 && code <= 82)) return "Rainy";
  if (isSnowCode(code)) return "Snowy!";
  if (code >= 95) return "Stormy";
  return "Cloudy";
}

/** Short form for the headline sentence ("Sunny and nice and warm ☀️"). */
export function weatherWord(code: number): string {
  if (code <= 1) return "Sunny";
  if (code === 2) return "Partly sunny";
  if (code === 3) return "Cloudy";
  if (code === 45 || code === 48) return "Foggy";
  if (code >= 51 && code <= 57) return "Drizzly";
  if ((code >= 61 && code <= 67) || (code >= 80 && code <= 82)) return "Rainy";
  if (isSnowCode(code)) return "Snowy";
  if (code >= 95) return "Stormy";
  return "Cloudy";
}

export function weatherEmoji(code: number): string {
  if (code <= 1) return "☀️";
  if (code === 2) return "⛅";
  if (code === 3) return "☁️";
  if (code === 45 || code === 48) return "🌫️";
  if (code >= 51 && code <= 57) return "🌦️";
  if ((code >= 61 && code <= 67) || (code >= 80 && code <= 82)) return "🌧️";
  if (isSnowCode(code)) return "🌨️";
  if (code >= 95) return "⛈️";
  return "☁️";
}

// Sentences used by the rules engine. Kept here so copy edits never touch logic.
export const COPY = {
  sameAsMorning: "Same as this morning 👍",
  takeOffLayer: (label: string) => `Take off your ${label.toLowerCase()} when it warms up ☀️`,
  putOnLayer: (label: string) => `Put on your ${label.toLowerCase()} when it gets cooler 🧥`,
  raincoatOnLater: "Put your raincoat on before you go outside 🌧️",
  keepRaincoat: "Keep your raincoat on 🌧️",
  stormHeadline: (dayWord: string) => `Storms ${dayWord} — stay cozy inside 🌩️`,
  windHeadline: "Super windy — hold onto your hat! 💨",
  chipRain: (pct: number) => `💧 ${pct}% rain`,
  chipWindy: "💨 windy",
  chipSun: "☀️ strong sun",
} as const;
```

- [ ] **Step 5: Run tests and the type check**

Run: `npx vitest run client/src/widgets/what-to-wear && npm run check`
Expected: vitest PASS; `tsc` exits 0.

- [ ] **Step 6: Commit**

```bash
git add client/src/widgets/what-to-wear/phrases.ts client/src/widgets/what-to-wear/units.ts client/src/widgets/what-to-wear/units.spec.ts
git commit -m "feat(what-to-wear): copy tables, item catalog, and temperature formatting

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 4: Rules engine (`buildAdvice`)

**Files:**
- Create: `client/src/widgets/what-to-wear/advice.ts`
- Test: `client/src/widgets/what-to-wear/advice.spec.ts`

**Interfaces:**
- Consumes: `types.ts`; `selectDay`, `pickHour`, `hoursInRange`, `formatTimeLabel` from `./time-windows`; `EVENING_MIN` from `./settings`; everything exported by `./phrases`.
- Produces: `bandFor(feelsLikeC: number): Band`; `buildAdvice(bundle: ForecastBundle, settings: ResolvedSettings, now: Date): Advice | null` (null when the bundle has no hours for the selected day).

- [ ] **Step 1: Write the failing tests**

`client/src/widgets/what-to-wear/advice.spec.ts`:

```ts
import { describe, expect, test } from "vitest";
import type { ForecastBundle, HourPoint, ResolvedSettings } from "./types";
import { bandFor, buildAdvice } from "./advice";

// 2030-03-12 is a Tuesday. `now` is 07:00 local → "Today" is selected.
const DAY = "2030-03-12";
const NOW = new Date(2030, 2, 12, 7, 0);
const SETTINGS: ResolvedSettings = { zipCode: "", units: "celsius", schoolStartMin: 8 * 60, schoolEndMin: 15 * 60 };

function hour(time: string, over: Partial<HourPoint> = {}): HourPoint {
  return { time, tempC: 15, feelsLikeC: 15, precipChance: 0, precipMm: 0, snowCm: 0, code: 0, windKmh: 10, uv: 2, ...over };
}
/** 24 hours of `dateKey`; `over(h)` customises each hour. */
function bundle(over: (h: number) => Partial<HourPoint> = () => ({})): ForecastBundle {
  const hours = Array.from({ length: 24 }, (_, h) => hour(`${DAY}T${String(h).padStart(2, "0")}:00`, over(h)));
  return { location: "Testville", fetchedAt: NOW.toISOString(), hours };
}
const ids = (items: { id: string }[]) => items.map((i) => i.id);

describe("bandFor", () => {
  test("band edges follow brief §6.1", () => {
    expect(bandFor(24)).toBe("hot");
    expect(bandFor(23.9)).toBe("warm");
    expect(bandFor(18)).toBe("warm");
    expect(bandFor(17.9)).toBe("cool");
    expect(bandFor(12)).toBe("cool");
    expect(bandFor(11.9)).toBe("chilly");
    expect(bandFor(5)).toBe("chilly");
    expect(bandFor(4.9)).toBe("cold");
    expect(bandFor(-5)).toBe("cold");
    expect(bandFor(-5.1)).toBe("freezing");
  });
});

describe("buildAdvice — founder scenarios (brief §8)", () => {
  test("1: cool morning, hot afternoon → shorts + T-shirt + hoodie; take the hoodie off", () => {
    const a = buildAdvice(bundle((h) => ({ feelsLikeC: h <= 10 ? 13 : h >= 13 ? 24 : 18, tempC: h <= 10 ? 13 : 24 })), SETTINGS, NOW)!;
    expect(a.dayLabel).toBe("Today");
    expect(a.weekday).toBe("Tuesday");
    expect(a.windows.map((w) => w.band)).toEqual(["cool", "hot", "hot"]);
    expect(ids(a.wear)).toEqual(expect.arrayContaining(["tshirt", "shorts", "sneakers", "hoodie"]));
    expect(ids(a.wear)).not.toContain("pants");
    expect(a.afternoonNotes).toEqual(["Take off your hoodie when it warms up ☀️"]);
    // Rule 6.6: a hot afternoon always adds a water bottle; nothing else extra.
    expect(ids(a.backpack)).toEqual(["waterBottle"]);
  });

  test("2: dry morning, 65% rain at 15:00 → raincoat packed, afternoon says put it on", () => {
    const a = buildAdvice(bundle((h) => ({ feelsLikeC: 20, precipChance: h >= 14 && h <= 16 ? 65 : 0, code: h >= 14 ? 61 : 2 })), SETTINGS, NOW)!;
    expect(ids(a.wear)).not.toContain("raincoat");
    expect(ids(a.backpack)).toContain("raincoat");
    expect(ids(a.backpack)).not.toContain("umbrella");
    expect(a.afternoonNotes).toContain("Put your raincoat on before you go outside 🌧️");
    expect(a.windows[0].chips).toEqual([]);
    expect(a.windows[1].chips).toContain("💧 65% rain");
  });

  test("3: 80% rain at 08:00 → raincoat worn; umbrella packed, rain boots worn", () => {
    const a = buildAdvice(bundle((h) => ({ feelsLikeC: 14, precipChance: h >= 7 && h <= 9 ? 80 : 10, code: h <= 9 ? 63 : 3 })), SETTINGS, NOW)!;
    expect(ids(a.wear)).toContain("raincoat");
    expect(ids(a.wear)).toContain("rainBoots");
    expect(ids(a.backpack)).toContain("umbrella");
    expect(ids(a.backpack)).not.toContain("raincoat");
    expect(a.windows[0].chips).toContain("💧 80% rain");
  });

  test("4: −8 °C with 3 cm of snow → freezing band, boots, gloves, hat, snow pants", () => {
    const a = buildAdvice(bundle((h) => ({ feelsLikeC: -8, tempC: -6, snowCm: h >= 8 && h <= 13 ? 0.5 : 0, code: 73 })), SETTINGS, NOW)!;
    expect(a.windows[0].band).toBe("freezing");
    expect(ids(a.wear)).toEqual(expect.arrayContaining(["heavyCoat", "boots", "gloves", "warmHat", "snowPants", "pants"]));
    expect(ids(a.wear)).not.toContain("shorts");
    expect(ids(a.wear)).not.toContain("sneakers");
    expect(a.headline).toContain("Snowy");
  });
});

describe("buildAdvice — other rules", () => {
  test("afternoon colder by a band: dress for morning, pack the afternoon layer", () => {
    const a = buildAdvice(bundle((h) => ({ feelsLikeC: h < 12 ? 20 : 14 })), SETTINGS, NOW)!;
    expect(ids(a.wear)).toEqual(expect.arrayContaining(["tshirt", "shorts"]));
    expect(ids(a.backpack)).toContain("hoodie");
    expect(a.afternoonNotes).toContain("Put on your hoodie when it gets cooler 🧥");
  });

  test("same band both windows → 'Same as this morning 👍'", () => {
    const a = buildAdvice(bundle(() => ({ feelsLikeC: 20 })), SETTINGS, NOW)!;
    expect(a.afternoonNotes).toEqual(["Same as this morning 👍"]);
  });

  test("never shorts when the morning is cold, even if the afternoon is warm", () => {
    const a = buildAdvice(bundle((h) => ({ feelsLikeC: h < 12 ? 0 : 20 })), SETTINGS, NOW)!;
    expect(ids(a.wear)).not.toContain("shorts");
    expect(ids(a.wear)).toContain("pants");
    expect(ids(a.wear)).toContain("winterCoat");
  });

  test("thunderstorm in the school day → gentle storm headline", () => {
    const a = buildAdvice(bundle((h) => ({ code: h === 13 ? 95 : 3, precipChance: h === 13 ? 50 : 0 })), SETTINGS, NOW)!;
    expect(a.headline).toBe("Storms today — stay cozy inside 🌩️");
  });

  test("wind ≥ 30 adds a windbreaker when there is no jacket and chips the windy windows; ≥ 45 changes the headline", () => {
    const a = buildAdvice(bundle((h) => ({ feelsLikeC: 20, windKmh: h >= 13 && h <= 16 ? 35 : 5 })), SETTINGS, NOW)!;
    expect(ids(a.wear)).toContain("windbreaker");
    expect(a.windows[0].chips).not.toContain("💨 windy");
    expect(a.windows[1].chips).toContain("💨 windy");
    const b = buildAdvice(bundle(() => ({ feelsLikeC: 20, windKmh: 50 })), SETTINGS, NOW)!;
    expect(b.headline).toBe("Super windy — hold onto your hat! 💨");
  });

  test("wind ≥ 30 does not add a windbreaker when the band already has a jacket", () => {
    const a = buildAdvice(bundle(() => ({ feelsLikeC: 8, windKmh: 35 })), SETTINGS, NOW)!;
    expect(ids(a.wear)).toContain("jacket");
    expect(ids(a.wear)).not.toContain("windbreaker");
  });

  test("UV ≥ 6 packs sunscreen, sun hat, water bottle and chips the sunniest window", () => {
    const a = buildAdvice(bundle((h) => ({ feelsLikeC: 20, uv: h >= 12 && h <= 15 ? 7 : 2 })), SETTINGS, NOW)!;
    expect(ids(a.backpack)).toEqual(expect.arrayContaining(["sunscreen", "sunHat", "waterBottle"]));
    expect(a.windows[1].chips).toContain("☀️ strong sun");
    expect(a.windows[0].chips).not.toContain("☀️ strong sun");
  });

  test("UV 3–5 with a sunny afternoon packs sunscreen only", () => {
    const a = buildAdvice(bundle(() => ({ feelsLikeC: 20, uv: 4, code: 0 })), SETTINGS, NOW)!;
    expect(ids(a.backpack)).toEqual(["sunscreen"]);
    const cloudy = buildAdvice(bundle(() => ({ feelsLikeC: 20, uv: 4, code: 3 })), SETTINGS, NOW)!;
    expect(ids(cloudy.backpack)).toEqual([]);
  });

  test("window summaries carry titles, times, temps, and phrases", () => {
    const a = buildAdvice(bundle(() => ({ feelsLikeC: 20, tempC: 21 })), SETTINGS, NOW)!;
    expect(a.windows.map((w) => w.title)).toEqual(["Morning", "Afternoon", "Evening"]);
    expect(a.windows.map((w) => w.timeLabel)).toEqual(["8:00 AM", "3:00 PM", "6:00 PM"]);
    expect(a.windows[0].tempC).toBe(21);
    expect(a.windows[0].phrase).toBe("Nice and warm");
    expect(a.windows[0].emoji).toBe("☀️");
    expect(a.headline).toBe("Sunny and nice and warm ☀️");
  });

  test("returns null when the bundle has no hours for the selected day", () => {
    const b = bundle();
    expect(buildAdvice(b, SETTINGS, new Date(2030, 2, 12, 16, 0))).toBeNull(); // tomorrow not in fixture
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npx vitest run client/src/widgets/what-to-wear/advice.spec.ts`
Expected: FAIL — cannot resolve `./advice`.

- [ ] **Step 3: Implement advice.ts**

```ts
import type { Advice, Band, ForecastBundle, HourPoint, Item, ResolvedSettings, WindowKey, WindowSummary } from "./types";
import { EVENING_MIN } from "./settings";
import { formatTimeLabel, hoursInRange, pickHour, selectDay } from "./time-windows";
import {
  BAND_PHRASE,
  BASE_OUTFIT,
  COPY,
  ITEMS,
  LAYER_FOR_BAND,
  OUTER_LAYER_IDS,
  isSnowCode,
  weatherEmoji,
  weatherWord,
} from "./phrases";

/** Brief §6.1 — bands on feels-like Celsius. */
export function bandFor(feelsLikeC: number): Band {
  if (feelsLikeC >= 24) return "hot";
  if (feelsLikeC >= 18) return "warm";
  if (feelsLikeC >= 12) return "cool";
  if (feelsLikeC >= 5) return "chilly";
  if (feelsLikeC >= -5) return "cold";
  return "freezing";
}

/** Higher = colder. "At least one band warmer" ⇔ smaller COLDNESS. */
const COLDNESS: Record<Band, number> = { hot: 0, warm: 1, cool: 2, chilly: 3, cold: 4, freezing: 5 };

function addItem(list: Item[], item: Item): void {
  if (!list.some((i) => i.id === item.id)) list.push(item);
}
function removeItem(list: Item[], id: string): void {
  const idx = list.findIndex((i) => i.id === id);
  if (idx !== -1) list.splice(idx, 1);
}
function maxOf(hours: HourPoint[], pick: (h: HourPoint) => number): number {
  return hours.reduce((m, h) => Math.max(m, pick(h)), 0);
}
function lowerFirst(s: string): string {
  return s.charAt(0).toLowerCase() + s.slice(1);
}

interface Window {
  key: WindowKey;
  title: string;
  minutes: number;
  point: HourPoint;
  range: HourPoint[];
}

/**
 * The pure rules engine (brief §6). No DOM, no fetch, no Date.now() — `now`
 * is a parameter so day selection is testable. Returns null only when the
 * bundle has no hours for the selected day (e.g. stale cache); the UI then
 * shows the "can't reach the weather" panel.
 */
export function buildAdvice(bundle: ForecastBundle, settings: ResolvedSettings, now: Date): Advice | null {
  const day = selectDay(now, settings.schoolEndMin);
  const { schoolStartMin: start, schoolEndMin: end } = settings;
  const hours = bundle.hours;

  const morningPt = pickHour(hours, day.dateKey, start);
  const afternoonPt = pickHour(hours, day.dateKey, end);
  const eveningPt = pickHour(hours, day.dateKey, EVENING_MIN);
  if (!morningPt || !afternoonPt || !eveningPt) return null;

  const windows: Window[] = [
    { key: "morning", title: "Morning", minutes: start, point: morningPt, range: hoursInRange(hours, day.dateKey, start - 60, start + 120) },
    { key: "afternoon", title: "Afternoon", minutes: end, point: afternoonPt, range: hoursInRange(hours, day.dateKey, end - 60, end + 120) },
    { key: "evening", title: "Evening", minutes: EVENING_MIN, point: eveningPt, range: hoursInRange(hours, day.dateKey, EVENING_MIN - 60, EVENING_MIN + 120) },
  ];
  const [morning, afternoon] = windows;
  const schoolDay = hoursInRange(hours, day.dateKey, start, end);

  const mBand = bandFor(morningPt.feelsLikeC);
  const aBand = bandFor(afternoonPt.feelsLikeC);
  const wear: Item[] = [];
  const backpack: Item[] = [];
  const afternoonNotes: string[] = [];

  // --- 6.2 layering ------------------------------------------------------
  const mLayer = LAYER_FOR_BAND[mBand];
  const aLayer = LAYER_FOR_BAND[aBand];
  if (COLDNESS[aBand] < COLDNESS[mBand] && mLayer) {
    // Afternoon warmer: afternoon base + the morning's removable layer.
    for (const item of BASE_OUTFIT[aBand]) addItem(wear, item);
    addItem(wear, mLayer);
    if (COLDNESS[mBand] >= COLDNESS.cold) {
      removeItem(wear, ITEMS.shorts.id);
      addItem(wear, ITEMS.pants);
    }
    afternoonNotes.push(COPY.takeOffLayer(mLayer.label));
  } else if (COLDNESS[aBand] > COLDNESS[mBand] && aLayer) {
    // Afternoon colder: dress for morning, pack the afternoon's layer.
    for (const item of BASE_OUTFIT[mBand]) addItem(wear, item);
    addItem(backpack, aLayer);
    afternoonNotes.push(COPY.putOnLayer(aLayer.label));
  } else {
    for (const item of BASE_OUTFIT[mBand]) addItem(wear, item);
  }

  // --- 6.3 rain ----------------------------------------------------------
  const mRain = maxOf(morning.range, (h) => h.precipChance);
  const aRain = maxOf(afternoon.range, (h) => h.precipChance);
  const dayRain = maxOf(schoolDay, (h) => h.precipChance);
  if (mRain >= 40) {
    addItem(wear, ITEMS.raincoat);
    if (aRain >= 40) afternoonNotes.push(COPY.keepRaincoat);
  } else if (aRain >= 40) {
    addItem(backpack, ITEMS.raincoat);
    afternoonNotes.push(COPY.raincoatOnLater);
  }
  if (dayRain >= 70) {
    removeItem(wear, ITEMS.sneakers.id);
    addItem(wear, ITEMS.rainBoots);
    addItem(backpack, ITEMS.umbrella);
  }
  const storm = schoolDay.some((h) => h.code >= 95);

  // --- 6.4 snow ----------------------------------------------------------
  const snowing = schoolDay.some((h) => h.snowCm > 0 || isSnowCode(h.code));
  const snowTotal = schoolDay.reduce((s, h) => s + h.snowCm, 0);
  if (snowing) {
    removeItem(wear, ITEMS.sneakers.id);
    removeItem(wear, ITEMS.rainBoots.id);
    addItem(wear, ITEMS.boots);
    addItem(wear, ITEMS.gloves);
    addItem(wear, ITEMS.warmHat);
  }
  if (snowTotal >= 2) addItem(wear, ITEMS.snowPants);

  // --- 6.5 wind ----------------------------------------------------------
  const dayWind = maxOf(schoolDay, (h) => h.windKmh);
  if (dayWind >= 30 && !wear.some((i) => OUTER_LAYER_IDS.has(i.id))) addItem(wear, ITEMS.windbreaker);

  // --- 6.6 sun / UV ------------------------------------------------------
  const dayUv = maxOf(schoolDay, (h) => h.uv);
  if (dayUv >= 6) {
    addItem(backpack, ITEMS.sunscreen);
    addItem(backpack, ITEMS.sunHat);
    addItem(backpack, ITEMS.waterBottle);
  } else if (dayUv >= 3 && afternoonPt.code <= 1) {
    addItem(backpack, ITEMS.sunscreen);
  }
  if (aBand === "hot") addItem(backpack, ITEMS.waterBottle);

  if (afternoonNotes.length === 0) afternoonNotes.push(COPY.sameAsMorning);

  // --- window cards ------------------------------------------------------
  let sunniest: WindowKey | null = null;
  if (dayUv >= 6) {
    let best = -1;
    for (const w of windows) {
      const uv = maxOf(w.range, (h) => h.uv);
      if (uv > best) {
        best = uv;
        sunniest = w.key;
      }
    }
  }
  const summaries: WindowSummary[] = windows.map((w) => {
    const chips: string[] = [];
    const rain = maxOf(w.range, (h) => h.precipChance);
    if (rain >= 40) chips.push(COPY.chipRain(Math.round(rain)));
    if (maxOf(w.range, (h) => h.windKmh) >= 30) chips.push(COPY.chipWindy);
    if (w.key === sunniest) chips.push(COPY.chipSun);
    const band = bandFor(w.point.feelsLikeC);
    return {
      key: w.key,
      title: w.title,
      timeLabel: formatTimeLabel(w.minutes),
      tempC: w.point.tempC,
      feelsLikeC: w.point.feelsLikeC,
      band,
      code: w.point.code,
      emoji: weatherEmoji(w.point.code),
      phrase: BAND_PHRASE[band],
      chips,
    };
  });

  // --- headline ----------------------------------------------------------
  let headline: string;
  if (storm) headline = COPY.stormHeadline(day.label === "Today" ? "today" : "tomorrow");
  else if (dayWind >= 45) headline = COPY.windHeadline;
  else headline = `${weatherWord(afternoonPt.code)} and ${lowerFirst(BAND_PHRASE[aBand])} ${weatherEmoji(afternoonPt.code)}`;

  return {
    dayLabel: day.label,
    weekday: day.weekday,
    dateKey: day.dateKey,
    headline,
    windows: summaries,
    wear,
    afternoonNotes,
    backpack,
  };
}
```

- [ ] **Step 4: Run to verify pass**

Run: `npx vitest run client/src/widgets/what-to-wear/advice.spec.ts`
Expected: PASS. If scenario 4's `headline` assertion fails, check `weatherWord(73)` returns "Snowy" (code 73 is in 71–77).

- [ ] **Step 5: Commit**

```bash
git add client/src/widgets/what-to-wear/advice.ts client/src/widgets/what-to-wear/advice.spec.ts
git commit -m "feat(what-to-wear): pure outfit rules engine with founder scenarios

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 5: Forecast fetching, normalisation, and storage blob

**Files:**
- Create: `client/src/widgets/what-to-wear/forecast.ts`
- Test: `client/src/widgets/what-to-wear/forecast.spec.ts`

**Interfaces:**
- Consumes: `ForecastBundle`, `HourPoint`, `ResolvedSettings` from `./types`; `fToC` from `./units`; `trimHours` from `./time-windows`.
- Produces:
  - `type ForecastStatus = "ok" | "no-config" | "invalid-zip" | "unreachable"`
  - `interface ZipCoords { lat: number; lon: number; label: string }`
  - `interface StoredState { v: 1; zipCoords: Record<string, ZipCoords>; forecast: ForecastBundle | null }`
  - `emptyStoredState(): StoredState`, `normalizeStoredState(raw: unknown): StoredState`
  - `OPEN_METEO_HOURLY` (string), `openMeteoUrl(lat: number, lon: number): string`, `zipLookupUrl(zip: string): string`
  - `normalizeOpenMeteo(data: unknown, location: string, fetchedAt: string): ForecastBundle | null`
  - `normalizeHostWeather(data: unknown, fetchedAt: string): ForecastBundle | null`
  - `lookupZip(fetchFn: typeof fetch, zip: string): Promise<ZipCoords | "invalid">`
  - `fetchForecast(fetchFn: typeof fetch, settings: ResolvedSettings, state: StoredState, now: Date): Promise<FetchResult>` where `FetchResult = { status: ForecastStatus; bundle: ForecastBundle | null; state: StoredState }`. Never throws.

- [ ] **Step 1: Write the failing tests**

`client/src/widgets/what-to-wear/forecast.spec.ts`:

```ts
import { describe, expect, test } from "vitest";
import type { ResolvedSettings } from "./types";
import {
  emptyStoredState,
  fetchForecast,
  normalizeHostWeather,
  normalizeOpenMeteo,
  normalizeStoredState,
  openMeteoUrl,
  zipLookupUrl,
} from "./forecast";

const NOW = new Date(2030, 2, 12, 7, 0);
const DAY = "2030-03-12";
const base: ResolvedSettings = { zipCode: "", units: "celsius", schoolStartMin: 480, schoolEndMin: 900 };

function openMeteoJson(dateKey = DAY, count = 24) {
  const time = Array.from({ length: count }, (_, i) => `${dateKey}T${String(i).padStart(2, "0")}:00`);
  const fill = (v: number) => time.map(() => v);
  return {
    hourly: {
      time,
      temperature_2m: fill(12),
      apparent_temperature: fill(10.5),
      precipitation_probability: fill(30),
      precipitation: fill(0.2),
      snowfall: fill(0),
      weather_code: fill(2),
      wind_speed_10m: fill(15),
      uv_index: fill(3),
    },
  };
}

/** A fetch stub keyed by URL prefix; records every URL it was asked for. */
function fakeFetch(routes: Record<string, () => Response>): typeof fetch & { calls: string[] } {
  const calls: string[] = [];
  const fn = (async (input: RequestInfo | URL) => {
    const url = String(input);
    calls.push(url);
    const key = Object.keys(routes).find((k) => url.startsWith(k));
    if (!key) throw new Error("network down");
    return routes[key]();
  }) as unknown as typeof fetch & { calls: string[] };
  fn.calls = calls;
  return fn;
}
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

describe("normalizeOpenMeteo", () => {
  test("maps hourly arrays to HourPoints", () => {
    const b = normalizeOpenMeteo(openMeteoJson(), "Testville", NOW.toISOString())!;
    expect(b.location).toBe("Testville");
    expect(b.hours).toHaveLength(24);
    expect(b.hours[8]).toEqual({ time: `${DAY}T08:00`, tempC: 12, feelsLikeC: 10.5, precipChance: 30, precipMm: 0.2, snowCm: 0, code: 2, windKmh: 15, uv: 3 });
  });
  test("nulls become 0 and bad shapes become null", () => {
    const data = openMeteoJson();
    (data.hourly.uv_index as unknown[])[0] = null;
    expect(normalizeOpenMeteo(data, "x", NOW.toISOString())!.hours[0].uv).toBe(0);
    expect(normalizeOpenMeteo({}, "x", NOW.toISOString())).toBeNull();
    expect(normalizeOpenMeteo(null, "x", NOW.toISOString())).toBeNull();
  });
});

describe("normalizeHostWeather", () => {
  const hourly = [{ time: `${DAY}T08:00`, temp: 50, feelsLike: 41, precipChance: 10, precipMm: 0, snowCm: 0, code: 0, windKmh: 5, uv: 1 }];
  test("converts Fahrenheit payloads to Celsius", () => {
    const b = normalizeHostWeather({ enabled: true, units: "fahrenheit", location: "Home", hourly, updatedAt: NOW.toISOString() }, NOW.toISOString())!;
    expect(b.location).toBe("Home");
    expect(b.hours[0].tempC).toBe(10);
    expect(b.hours[0].feelsLikeC).toBe(5);
  });
  test("keeps Celsius payloads and returns null for disabled or hourly-less payloads", () => {
    expect(normalizeHostWeather({ enabled: true, units: "celsius", location: "", hourly }, NOW.toISOString())!.hours[0].tempC).toBe(50);
    expect(normalizeHostWeather({ enabled: false }, NOW.toISOString())).toBeNull();
    expect(normalizeHostWeather({ enabled: true, current: {} }, NOW.toISOString())).toBeNull();
  });
});

describe("normalizeStoredState", () => {
  test("garbage degrades to the empty state", () => {
    expect(normalizeStoredState(null)).toEqual(emptyStoredState());
    expect(normalizeStoredState("nope")).toEqual(emptyStoredState());
    expect(normalizeStoredState({ v: 2 })).toEqual(emptyStoredState());
  });
  test("keeps well-formed coords and forecast", () => {
    const stored = { v: 1, zipCoords: { "00000": { lat: 1, lon: 2, label: "A, B" } }, forecast: { location: "A, B", fetchedAt: NOW.toISOString(), hours: [] } };
    expect(normalizeStoredState(stored)).toEqual(stored);
  });
});

describe("urls", () => {
  test("Open-Meteo URL requests Celsius/kmh/mm, hourly fields, 3 days", () => {
    const u = openMeteoUrl(1.5, -2.25);
    expect(u.startsWith("https://api.open-meteo.com/v1/forecast?")).toBe(true);
    expect(u).toContain("latitude=1.5");
    expect(u).toContain("longitude=-2.25");
    expect(u).toContain("hourly=temperature_2m,apparent_temperature,precipitation_probability,precipitation,snowfall,weather_code,wind_speed_10m,uv_index");
    expect(u).toContain("temperature_unit=celsius");
    expect(u).toContain("wind_speed_unit=kmh");
    expect(u).toContain("precipitation_unit=mm");
    expect(u).toContain("timezone=auto");
    expect(u).toContain("forecast_days=3");
  });
  test("zip lookup URL", () => {
    expect(zipLookupUrl("00000")).toBe("https://api.zippopotam.us/us/00000");
  });
});

describe("fetchForecast", () => {
  test("blank zip + host weather disabled → no-config, no outside calls", async () => {
    const f = fakeFetch({ "/api/weather": () => json({ enabled: false }) });
    const r = await fetchForecast(f, base, emptyStoredState(), NOW);
    expect(r.status).toBe("no-config");
    expect(r.bundle).toBeNull();
    expect(f.calls).toEqual(["/api/weather"]);
  });

  test("blank zip + host hourly → ok, bundle stored", async () => {
    const hourly = Array.from({ length: 24 }, (_, i) => ({ time: `${DAY}T${String(i).padStart(2, "0")}:00`, temp: 10, feelsLike: 9, precipChance: 0, precipMm: 0, snowCm: 0, code: 1, windKmh: 3, uv: 2 }));
    const f = fakeFetch({ "/api/weather": () => json({ enabled: true, units: "celsius", location: "Home", hourly }) });
    const r = await fetchForecast(f, base, emptyStoredState(), NOW);
    expect(r.status).toBe("ok");
    expect(r.bundle?.hours).toHaveLength(24);
    expect(r.state.forecast).toBe(r.bundle);
  });

  test("malformed zip → invalid-zip without any fetch", async () => {
    const f = fakeFetch({});
    const r = await fetchForecast(f, { ...base, zipCode: "1234" }, emptyStoredState(), NOW);
    expect(r.status).toBe("invalid-zip");
    expect(f.calls).toEqual([]);
  });

  test("zip lookup 404 → invalid-zip", async () => {
    const f = fakeFetch({ "https://api.zippopotam.us/us/00000": () => json({}, 404) });
    const r = await fetchForecast(f, { ...base, zipCode: "00000" }, emptyStoredState(), NOW);
    expect(r.status).toBe("invalid-zip");
  });

  test("valid zip → looks up once, caches coords, fetches Open-Meteo with them", async () => {
    const f = fakeFetch({
      "https://api.zippopotam.us/us/00000": () => json({ places: [{ "place name": "Testville", "state abbreviation": "TS", latitude: "1.5", longitude: "-2.25" }] }),
      "https://api.open-meteo.com/v1/forecast": () => json(openMeteoJson()),
    });
    const r1 = await fetchForecast(f, { ...base, zipCode: "00000" }, emptyStoredState(), NOW);
    expect(r1.status).toBe("ok");
    expect(r1.bundle?.location).toBe("Testville, TS");
    expect(r1.state.zipCoords["00000"]).toEqual({ lat: 1.5, lon: -2.25, label: "Testville, TS" });
    expect(f.calls.some((u) => u.includes("latitude=1.5&longitude=-2.25"))).toBe(true);

    const r2 = await fetchForecast(f, { ...base, zipCode: "00000" }, r1.state, NOW);
    expect(r2.status).toBe("ok");
    expect(f.calls.filter((u) => u.startsWith("https://api.zippopotam.us")).length).toBe(1);
  });

  test("Open-Meteo unreachable with a cached forecast → unreachable, cached bundle returned", async () => {
    const state = emptyStoredState();
    state.zipCoords["00000"] = { lat: 1, lon: 2, label: "Cached" };
    state.forecast = { location: "Cached", fetchedAt: NOW.toISOString(), hours: [] };
    const f = fakeFetch({});
    const r = await fetchForecast(f, { ...base, zipCode: "00000" }, state, NOW);
    expect(r.status).toBe("unreachable");
    expect(r.bundle).toBe(state.forecast);
  });

  test("Open-Meteo HTTP error with no cache → unreachable, null bundle", async () => {
    const state = emptyStoredState();
    state.zipCoords["00000"] = { lat: 1, lon: 2, label: "X" };
    const f = fakeFetch({ "https://api.open-meteo.com/v1/forecast": () => json({}, 500) });
    const r = await fetchForecast(f, { ...base, zipCode: "00000" }, state, NOW);
    expect(r.status).toBe("unreachable");
    expect(r.bundle).toBeNull();
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npx vitest run client/src/widgets/what-to-wear/forecast.spec.ts`
Expected: FAIL — cannot resolve `./forecast`.

- [ ] **Step 3: Implement forecast.ts**

```ts
import type { ForecastBundle, HourPoint, ResolvedSettings } from "./types";
import { trimHours } from "./time-windows";
import { fToC } from "./units";

/**
 * Forecast acquisition for What to Wear (brief §4). Two paths produce the
 * same ForecastBundle:
 *   A. zip code set   → zippopotam.us (zip → lat/lon, cached per zip in
 *                       host.storage) then Open-Meteo hourly, via host.fetch
 *   B. zip blank      → the host's own /api/weather, which carries an
 *                       additive `hourly` array + `units` (server-side
 *                       coordinates never reach the client)
 * Exactly two outside hosts, both HTTPS and keyless. The zip code is
 * personal data: it is used only in the lookup URL and never logged.
 */

export type ForecastStatus = "ok" | "no-config" | "invalid-zip" | "unreachable";

export interface ZipCoords {
  lat: number;
  lon: number;
  label: string;
}

/** The host.storage blob. Well under the 64,000-char cap: ≤ 48 hours. */
export interface StoredState {
  v: 1;
  zipCoords: Record<string, ZipCoords>;
  forecast: ForecastBundle | null;
}

export interface FetchResult {
  status: ForecastStatus;
  bundle: ForecastBundle | null;
  state: StoredState;
}

export const OPEN_METEO_HOURLY =
  "temperature_2m,apparent_temperature,precipitation_probability,precipitation,snowfall,weather_code,wind_speed_10m,uv_index";

const FETCH_TIMEOUT_MS = 10_000;
const ZIP_RE = /^\d{5}$/;

export function emptyStoredState(): StoredState {
  return { v: 1, zipCoords: {}, forecast: null };
}

function num(v: unknown): number {
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : 0;
}

function isHourPoint(v: unknown): v is HourPoint {
  if (!v || typeof v !== "object") return false;
  const h = v as Record<string, unknown>;
  return typeof h.time === "string" && ["tempC", "feelsLikeC", "precipChance", "precipMm", "snowCm", "code", "windKmh", "uv"].every((k) => typeof h[k] === "number");
}

function isBundle(v: unknown): v is ForecastBundle {
  if (!v || typeof v !== "object") return false;
  const b = v as Record<string, unknown>;
  return typeof b.location === "string" && typeof b.fetchedAt === "string" && Array.isArray(b.hours) && b.hours.every(isHourPoint);
}

/** Defensively coerces whatever host.storage.get() returned. */
export function normalizeStoredState(raw: unknown): StoredState {
  if (!raw || typeof raw !== "object") return emptyStoredState();
  const r = raw as Record<string, unknown>;
  if (r.v !== 1) return emptyStoredState();
  const zipCoords: Record<string, ZipCoords> = {};
  if (r.zipCoords && typeof r.zipCoords === "object") {
    for (const [zip, c] of Object.entries(r.zipCoords as Record<string, unknown>)) {
      if (!ZIP_RE.test(zip) || !c || typeof c !== "object") continue;
      const cc = c as Record<string, unknown>;
      if (typeof cc.lat === "number" && typeof cc.lon === "number" && typeof cc.label === "string") {
        zipCoords[zip] = { lat: cc.lat, lon: cc.lon, label: cc.label };
      }
    }
  }
  return { v: 1, zipCoords, forecast: isBundle(r.forecast) ? r.forecast : null };
}

export function openMeteoUrl(lat: number, lon: number): string {
  return (
    `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}` +
    `&hourly=${OPEN_METEO_HOURLY}&daily=sunrise,sunset` +
    `&temperature_unit=celsius&wind_speed_unit=kmh&precipitation_unit=mm&timezone=auto&forecast_days=3`
  );
}

export function zipLookupUrl(zip: string): string {
  return `https://api.zippopotam.us/us/${zip}`;
}

/** Open-Meteo hourly JSON → bundle. Null on an unexpected shape. */
export function normalizeOpenMeteo(data: unknown, location: string, fetchedAt: string): ForecastBundle | null {
  const hourly = (data as { hourly?: Record<string, unknown> } | null)?.hourly;
  if (!hourly || !Array.isArray(hourly.time)) return null;
  const col = (key: string): unknown[] => (Array.isArray(hourly[key]) ? (hourly[key] as unknown[]) : []);
  const temp = col("temperature_2m");
  const feels = col("apparent_temperature");
  const pop = col("precipitation_probability");
  const precip = col("precipitation");
  const snow = col("snowfall");
  const code = col("weather_code");
  const wind = col("wind_speed_10m");
  const uv = col("uv_index");
  const hours: HourPoint[] = (hourly.time as unknown[]).map((t, i) => ({
    time: String(t),
    tempC: num(temp[i]),
    feelsLikeC: num(feels[i]),
    precipChance: num(pop[i]),
    precipMm: num(precip[i]),
    snowCm: num(snow[i]),
    code: num(code[i]),
    windKmh: num(wind[i]),
    uv: num(uv[i]),
  }));
  return { location, fetchedAt, hours };
}

/** /api/weather payload (server/services/weatherService.ts) → bundle, with
 *  temperatures normalised to Celsius. Null when weather is disabled or the
 *  server predates the `hourly` field. */
export function normalizeHostWeather(data: unknown, fetchedAt: string): ForecastBundle | null {
  const d = data as { enabled?: boolean; units?: string; location?: string; hourly?: unknown[] } | null;
  if (!d || d.enabled !== true || !Array.isArray(d.hourly)) return null;
  const toC = d.units === "fahrenheit" ? fToC : (x: number) => x;
  const hours: HourPoint[] = d.hourly.map((raw) => {
    const h = (raw ?? {}) as Record<string, unknown>;
    return {
      time: String(h.time ?? ""),
      tempC: toC(num(h.temp)),
      feelsLikeC: toC(num(h.feelsLike)),
      precipChance: num(h.precipChance),
      precipMm: num(h.precipMm),
      snowCm: num(h.snowCm),
      code: num(h.code),
      windKmh: num(h.windKmh),
      uv: num(h.uv),
    };
  });
  return { location: typeof d.location === "string" ? d.location : "", fetchedAt, hours };
}

async function fetchWithTimeout(fetchFn: typeof fetch, url: string): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    return await fetchFn(url, { signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

/** zippopotam.us lookup. "invalid" on 404; throws on network/other errors. */
export async function lookupZip(fetchFn: typeof fetch, zip: string): Promise<ZipCoords | "invalid"> {
  const res = await fetchWithTimeout(fetchFn, zipLookupUrl(zip));
  if (res.status === 404) return "invalid";
  if (!res.ok) throw new Error(`zip lookup HTTP ${res.status}`);
  const data = (await res.json()) as { places?: Array<Record<string, unknown>> };
  const place = data?.places?.[0];
  const lat = Number(place?.latitude);
  const lon = Number(place?.longitude);
  if (!place || !Number.isFinite(lat) || !Number.isFinite(lon)) return "invalid";
  const name = typeof place["place name"] === "string" ? (place["place name"] as string) : "";
  const st = typeof place["state abbreviation"] === "string" ? (place["state abbreviation"] as string) : "";
  const label = [name, st].filter(Boolean).join(", ") || zip;
  return { lat, lon, label };
}

/**
 * Resolves the forecast for the current settings. Never throws; every
 * failure maps to a status, with the last good bundle from `state` returned
 * for "unreachable" so an outage still renders something (brief §3 error
 * states). On "ok" the returned `state` carries the trimmed bundle and any
 * newly learned zip coordinates — the caller persists it via host.storage.
 */
export async function fetchForecast(
  fetchFn: typeof fetch,
  settings: ResolvedSettings,
  state: StoredState,
  now: Date,
): Promise<FetchResult> {
  const fetchedAt = now.toISOString();
  const fail = (status: ForecastStatus): FetchResult => ({ status, bundle: status === "unreachable" ? state.forecast : null, state });
  const ok = (bundle: ForecastBundle, next: StoredState): FetchResult => {
    const trimmed = { ...bundle, hours: trimHours(bundle.hours, now) };
    return { status: "ok", bundle: trimmed, state: { ...next, forecast: trimmed } };
  };

  try {
    if (settings.zipCode === "") {
      const res = await fetchWithTimeout(fetchFn, "/api/weather");
      if (!res.ok) return fail("unreachable");
      const data: unknown = await res.json();
      if ((data as { enabled?: boolean } | null)?.enabled !== true) return fail("no-config");
      const bundle = normalizeHostWeather(data, fetchedAt);
      return bundle ? ok(bundle, state) : fail("unreachable");
    }

    if (!ZIP_RE.test(settings.zipCode)) return fail("invalid-zip");

    let coords = state.zipCoords[settings.zipCode];
    let next = state;
    if (!coords) {
      const looked = await lookupZip(fetchFn, settings.zipCode);
      if (looked === "invalid") return fail("invalid-zip");
      coords = looked;
      next = { ...state, zipCoords: { ...state.zipCoords, [settings.zipCode]: coords } };
    }

    const res = await fetchWithTimeout(fetchFn, openMeteoUrl(coords.lat, coords.lon));
    if (!res.ok) return { ...fail("unreachable"), state: next };
    const bundle = normalizeOpenMeteo(await res.json(), coords.label, fetchedAt);
    return bundle ? ok(bundle, next) : { ...fail("unreachable"), state: next };
  } catch {
    return fail("unreachable");
  }
}
```

- [ ] **Step 4: Run to verify pass**

Run: `npx vitest run client/src/widgets/what-to-wear/forecast.spec.ts && npm run check`
Expected: PASS; `tsc` exits 0.

- [ ] **Step 5: Commit**

```bash
git add client/src/widgets/what-to-wear/forecast.ts client/src/widgets/what-to-wear/forecast.spec.ts
git commit -m "feat(what-to-wear): forecast fetch paths, zip lookup, and storage blob

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 6: Server — additive `hourly` and `units` on `/api/weather`

**Files:**
- Modify: `server/services/weatherService.ts`

**Interfaces:**
- Produces: `WeatherPayload` gains `hourly: WeatherHourly[]` and `units: "celsius" | "fahrenheit"`, where `WeatherHourly = { time: string; temp: number; feelsLike: number; precipChance: number; precipMm: number; snowCm: number; code: number; windKmh: number; uv: number }` with `temp`/`feelsLike` in the server's configured unit. This is exactly what `normalizeHostWeather` (Task 5) reads. No existing field or cache behaviour changes.

There is no server test harness (vitest only includes `client/src`), so verification is `npm run build` plus a dev-server curl.

- [ ] **Step 1: Add the types**

In `server/services/weatherService.ts`, after `WeatherDaily`, add:

```ts
/** One forecast hour for the What to Wear widget (additive, since 1.7.0).
 *  `temp`/`feelsLike` follow WEATHER_UNITS; wind is km/h, precipitation mm,
 *  snowfall cm regardless. The widget normalises to Celsius client-side. */
export interface WeatherHourly {
  time: string; // ISO local time, "YYYY-MM-DDTHH:MM"
  temp: number;
  feelsLike: number;
  precipChance: number; // 0–100
  precipMm: number;
  snowCm: number;
  code: number;
  windKmh: number;
  uv: number;
}
```

and extend `WeatherPayload`:

```ts
export interface WeatherPayload {
  enabled: true;
  current: WeatherCurrent;
  daily: WeatherDaily[];
  /** Next 48 hours from the start of the current local day (additive). */
  hourly: WeatherHourly[];
  /** Unit of `current`, `daily`, and `hourly` temperatures (additive). */
  units: "celsius" | "fahrenheit";
  location: string;
  updatedAt: string;
}
```

- [ ] **Step 2: Extend the upstream request and payload**

Add a constant near the top of the file:

```ts
const HOURLY_FIELDS =
  "temperature_2m,apparent_temperature,precipitation_probability,precipitation,snowfall,weather_code,wind_speed_10m,uv_index";
const HOURLY_COUNT = 48;
```

Change the URL in `fetchForecast` to:

```ts
  const url =
    `https://api.open-meteo.com/v1/forecast` +
    `?latitude=${cfg.lat}&longitude=${cfg.lon}` +
    `&current=temperature_2m,weather_code` +
    `&daily=weather_code,temperature_2m_max,temperature_2m_min` +
    `&hourly=${HOURLY_FIELDS}` +
    `&temperature_unit=${cfg.units}&wind_speed_unit=kmh&precipitation_unit=mm&timezone=auto&forecast_days=7`;
```

Add this helper above `fetchForecast`:

```ts
function num(v: unknown): number {
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : 0;
}

/** Slice the hourly arrays to HOURLY_COUNT entries starting at the first
 *  hour of the current local day (Open-Meteo returns local times with
 *  timezone=auto; the kiosk runs in its location's timezone). Missing or
 *  malformed hourly data yields [] — never a throw. */
function buildHourly(raw: any, now: Date): WeatherHourly[] {
  if (!raw || !Array.isArray(raw.time)) return [];
  const pad = (n: number) => String(n).padStart(2, "0");
  const todayKey = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
  const out: WeatherHourly[] = [];
  for (let i = 0; i < raw.time.length && out.length < HOURLY_COUNT; i++) {
    const time = String(raw.time[i]);
    if (time.slice(0, 10) < todayKey) continue;
    out.push({
      time,
      temp: num(raw.temperature_2m?.[i]),
      feelsLike: num(raw.apparent_temperature?.[i]),
      precipChance: num(raw.precipitation_probability?.[i]),
      precipMm: num(raw.precipitation?.[i]),
      snowCm: num(raw.snowfall?.[i]),
      code: num(raw.weather_code?.[i]),
      windKmh: num(raw.wind_speed_10m?.[i]),
      uv: num(raw.uv_index?.[i]),
    });
  }
  return out;
}
```

And in the `return { enabled: true, ... }` object inside `fetchForecast`, add two fields:

```ts
      daily,
      hourly: buildHourly(data.hourly, new Date()),
      units: cfg.units,
      location: cfg.label,
```

- [ ] **Step 3: Type-check and build**

Run: `npm run check && npm run build`
Expected: both exit 0. `dist/index.js` is rebuilt (the server is bundled; `dist/` is gitignored).

- [ ] **Step 4: Verify against the dev server if weather is configured locally**

If `.env` has `WEATHER_ENABLED=true`, start the dev server through the Browser pane's `preview_start` (never Bash) and fetch `/api/weather`; confirm the JSON now has `hourly` (≤ 48 entries, first entry's `time` starts with today's date) and `units`, and that `current`/`daily` are unchanged. If weather is not configured locally, note that in the task report and rely on the build.

- [ ] **Step 5: Commit**

```bash
git add server/services/weatherService.ts
git commit -m "feat(weather): add hourly forecast and units to /api/weather (additive)

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 7: UI components, widget entry, and registry

**Files:**
- Create: `client/src/widgets/what-to-wear/ItemChip.tsx`
- Create: `client/src/widgets/what-to-wear/WhatToWear.tsx`
- Create: `client/src/widgets/what-to-wear/index.tsx`
- Modify: `client/src/widgets/registry.ts`

**Interfaces:**
- Consumes: `Advice`, `Item`, `Units` from `./types`; `formatTemp` from `./units`; `ForecastStatus`, `StoredState`, `emptyStoredState`, `normalizeStoredState`, `fetchForecast` from `./forecast`; `resolveSettings` from `./settings`; `buildAdvice` from `./advice`; `formatClock` from `./time-windows`; `validateBuiltinManifest`; `RootboardWidget`, `WidgetHost`, `WidgetInstance` from `@/widgets/types`.
- Produces: `export const manifest`, default export `whatToWearWidget: RootboardWidget`; `WhatToWearProps` below.

No unit tests here (there is no React renderer in the test setup, per `use-widget-state.ts`'s note); verification is `npm run check` plus the browser check in Step 6.

- [ ] **Step 1: ItemChip.tsx**

```tsx
import type { LucideIcon } from "lucide-react";
import type { Item } from "./types";

interface ItemChipProps {
  item: Item;
  /** Optional lucide fallback if an emoji turns out not to render on the
   *  kiosk's Firefox (brief §6.8): swap at the call site, one line. */
  icon?: LucideIcon;
  size?: "lg" | "md";
}

/** One "👕 T-shirt" chip. Theme tokens only. */
export function ItemChip({ item, icon: Icon, size = "lg" }: ItemChipProps) {
  const big = size === "lg";
  return (
    <span
      data-testid={`wtw-item-${item.id}`}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: big ? 12 : 8,
        padding: big ? "10px 18px" : "6px 12px",
        borderRadius: 999,
        background: "var(--rb-chip)",
        color: "var(--rb-ink)",
        fontSize: big ? 26 : 20,
        fontWeight: 700,
        lineHeight: 1,
        whiteSpace: "nowrap",
      }}
    >
      {Icon ? <Icon size={big ? 30 : 22} aria-hidden /> : <span style={{ fontSize: big ? 34 : 24 }}>{item.emoji}</span>}
      <span>{item.label}</span>
    </span>
  );
}
```

- [ ] **Step 2: WhatToWear.tsx (presentational)**

```tsx
import type { CSSProperties } from "react";
import type { ForecastStatus } from "./forecast";
import type { Advice, Units, WindowSummary } from "./types";
import { formatTemp } from "./units";
import { ItemChip } from "./ItemChip";

export interface WhatToWearProps {
  loaded: boolean;
  status: ForecastStatus;
  advice: Advice | null;
  location: string;
  units: Units;
  footer: string;
}

const card: CSSProperties = {
  background: "var(--rb-surface)",
  border: "1px solid var(--rb-grid-line)",
  borderRadius: 24,
  padding: 20,
  minHeight: 0,
  display: "flex",
  flexDirection: "column",
};

function MessagePanel({ text, hint }: { text: string; hint?: string }) {
  return (
    <div
      data-testid="wtw-message"
      style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 16, textAlign: "center", padding: 32 }}
    >
      <div style={{ fontSize: 40, fontWeight: 800, color: "var(--rb-ink)", maxWidth: 900, lineHeight: 1.2 }}>{text}</div>
      {hint && <div style={{ fontSize: 22, color: "var(--rb-muted)" }}>{hint}</div>}
    </div>
  );
}

function WindowCard({ w, units }: { w: WindowSummary; units: Units }) {
  return (
    <div data-testid={`wtw-window-${w.key}`} style={{ ...card, flex: 1, alignItems: "center", justifyContent: "center", gap: 6, textAlign: "center" }}>
      <div style={{ fontSize: 24, fontWeight: 800, color: "var(--rb-ink-secondary)" }}>{w.title}</div>
      <div style={{ fontSize: 16, color: "var(--rb-muted)" }}>{w.timeLabel}</div>
      <div style={{ fontSize: 72, lineHeight: 1 }}>{w.emoji}</div>
      <div style={{ fontSize: 56, fontWeight: 900, color: "var(--rb-ink)", lineHeight: 1 }}>{formatTemp(w.tempC, units)}</div>
      <div style={{ fontSize: 24, fontWeight: 700, color: "var(--rb-ink)" }}>{w.phrase}</div>
      {w.chips.length > 0 && (
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", justifyContent: "center" }}>
          {w.chips.map((c) => (
            <span key={c} style={{ fontSize: 18, fontWeight: 700, padding: "4px 12px", borderRadius: 999, background: "var(--rb-info-wash)", color: "var(--rb-ink)" }}>
              {c}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

export function WhatToWear({ loaded, status, advice, location, units, footer }: WhatToWearProps) {
  let body: JSX.Element;
  if (!loaded) {
    body = <MessagePanel text="Checking the weather… ☁️" />;
  } else if (status === "no-config") {
    body = <MessagePanel text="Ask a grown-up to add your zip code in Settings 🙂" hint="Settings is on the nav rail." />;
  } else if (status === "invalid-zip") {
    body = <MessagePanel text="That zip code didn't work — check it in Settings" />;
  } else if (!advice) {
    body = <MessagePanel text="Can't reach the weather right now. Try again in a bit ☁️" />;
  } else {
    body = (
      <>
        {/* 1. Header strip */}
        <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 16 }}>
          <div style={{ display: "flex", alignItems: "baseline", gap: 14 }}>
            <span data-testid="wtw-day" style={{ fontSize: 34, fontWeight: 900, color: "var(--rb-ink)" }}>
              {advice.dayLabel} · {advice.weekday}
            </span>
            {location && <span style={{ fontSize: 20, color: "var(--rb-muted)", fontWeight: 600 }}>{location}</span>}
          </div>
          <span data-testid="wtw-headline" style={{ fontSize: 30, fontWeight: 800, color: "var(--rb-ink)", textAlign: "right" }}>
            {advice.headline}
          </span>
        </div>

        {/* 2. Day-at-a-glance row */}
        <div style={{ display: "flex", gap: 16, flex: 1.1, minHeight: 0 }}>
          {advice.windows.map((w) => (
            <WindowCard key={w.key} w={w} units={units} />
          ))}
        </div>

        {/* 3. Outfit cards */}
        <div style={{ display: "flex", gap: 16, flex: 1, minHeight: 0 }}>
          <div data-testid="wtw-wear" style={{ ...card, flex: 1.3, gap: 14 }}>
            <div style={{ fontSize: 26, fontWeight: 800, color: "var(--rb-ink-secondary)" }}>This morning, wear…</div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 12 }}>
              {advice.wear.map((item) => (
                <ItemChip key={item.id} item={item} />
              ))}
            </div>
          </div>
          <div data-testid="wtw-afternoon" style={{ ...card, flex: 1, gap: 12, background: "var(--rb-accent-wash)" }}>
            <div style={{ fontSize: 26, fontWeight: 800, color: "var(--rb-ink-secondary)" }}>This afternoon…</div>
            {advice.afternoonNotes.map((note) => (
              <div key={note} style={{ fontSize: 28, fontWeight: 700, color: "var(--rb-ink)", lineHeight: 1.25 }}>
                {note}
              </div>
            ))}
          </div>
        </div>

        {/* 4. Backpack strip */}
        <div data-testid="wtw-backpack" style={{ ...card, flexDirection: "row", alignItems: "center", gap: 14, padding: "14px 20px", flexWrap: "wrap" }}>
          <span style={{ fontSize: 26, fontWeight: 800, color: "var(--rb-ink-secondary)" }}>🎒 Put in your backpack:</span>
          {advice.backpack.length === 0 ? (
            <span style={{ fontSize: 24, fontWeight: 700, color: "var(--rb-ink)" }}>Nothing extra today!</span>
          ) : (
            advice.backpack.map((item) => <ItemChip key={item.id} item={item} size="md" />)
          )}
        </div>
      </>
    );
  }

  return (
    <div
      data-testid="wtw-root"
      style={{ height: "100%", display: "flex", flexDirection: "column", gap: 16, padding: 24, overflow: "hidden", background: "var(--rb-canvas)", color: "var(--rb-ink)" }}
    >
      {body}
      {/* 5. Footer line */}
      <div data-testid="wtw-footer" style={{ fontSize: 16, color: "var(--rb-muted)", textAlign: "right" }}>
        {footer}
      </div>
    </div>
  );
}
```

- [ ] **Step 3: index.tsx (contract entry)**

```tsx
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createRoot, type Root } from "react-dom/client";
import { validateBuiltinManifest } from "@/widgets/validate-manifest";
import type { RootboardWidget, WidgetHost, WidgetInstance } from "@/widgets/types";
import rawManifest from "./manifest.json";
import { buildAdvice } from "./advice";
import { emptyStoredState, fetchForecast, normalizeStoredState, type ForecastBundle, type ForecastStatus, type StoredState } from "./forecast";
import { resolveSettings } from "./settings";
import { formatClock } from "./time-windows";
import { WhatToWear } from "./WhatToWear";

/**
 * What to Wear as a contract widget (CONTRACT.md §3–§4; brief at
 * docs/plans/what-to-wear-widget/BRIEF.md). Pure display, no touch
 * interaction in v1. Same bridge pattern as widgets/calendar/index.tsx:
 * the host's RefreshScheduler drives `refresh()` on the manifest's
 * 30-minute cadence (visible + online + awake only); the only private
 * timer is a one-minute clock for the day flip and the "as of" footer,
 * which runs only while visible and is cleared on unmount.
 */
export const manifest = validateBuiltinManifest(rawManifest);

interface Bridge {
  visible: boolean;
  notifyVisible: ((visible: boolean) => void) | null;
  refresh: (() => Promise<void>) | null;
}

function useHostSettings(host: WidgetHost): Record<string, unknown> {
  const [settings, setSettings] = useState<Record<string, unknown>>(() => host.settings.get());
  useEffect(() => {
    setSettings(host.settings.get());
    return host.settings.subscribe(setSettings);
  }, [host]);
  return settings;
}

interface LoadState {
  loaded: boolean;
  status: ForecastStatus;
  bundle: ForecastBundle | null;
}

function WhatToWearApp({ host, bridge }: { host: WidgetHost; bridge: Bridge }) {
  const rawSettings = useHostSettings(host);
  const settings = useMemo(() => resolveSettings(rawSettings), [rawSettings]);
  const settingsRef = useRef(settings);
  settingsRef.current = settings;

  const [visible, setVisible] = useState(bridge.visible);
  const [now, setNow] = useState(() => new Date());
  const [load, setLoad] = useState<LoadState>({ loaded: false, status: "ok", bundle: null });
  const stateRef = useRef<StoredState | null>(null);
  const inflight = useRef<Promise<void> | null>(null);

  const reload = useCallback((): Promise<void> => {
    if (inflight.current) return inflight.current;
    inflight.current = (async () => {
      try {
        if (!stateRef.current) {
          const raw = await host.storage.get<unknown>().catch(() => null);
          stateRef.current = raw === null ? emptyStoredState() : normalizeStoredState(raw);
        }
        const result = await fetchForecast(host.fetch, settingsRef.current, stateRef.current, new Date());
        stateRef.current = result.state;
        if (result.status === "ok") host.storage.set(result.state);
        setLoad({ loaded: true, status: result.status, bundle: result.bundle });
        setNow(new Date());
      } catch {
        // fetchForecast never throws; this guards storage.get/set only.
        setLoad((prev) => ({ loaded: true, status: "unreachable", bundle: prev.bundle ?? stateRef.current?.forecast ?? null }));
      } finally {
        inflight.current = null;
      }
    })();
    return inflight.current;
  }, [host]);

  // Host wiring: visibility + refresh (see Bridge).
  useEffect(() => {
    bridge.notifyVisible = setVisible;
    setVisible(bridge.visible);
    return () => {
      bridge.notifyVisible = null;
    };
  }, [bridge]);
  useEffect(() => {
    bridge.refresh = reload;
    return () => {
      bridge.refresh = null;
    };
  }, [bridge, reload]);

  // Initial load, and again whenever the zip changes (units/times only
  // re-render; they don't need new data).
  useEffect(() => {
    void reload();
  }, [reload, settings.zipCode]);

  // One-minute clock for the day flip + footer, visible only (brief §4.3).
  useEffect(() => {
    if (!visible) return;
    setNow(new Date());
    const id = window.setInterval(() => setNow(new Date()), 60_000);
    return () => window.clearInterval(id);
  }, [visible]);

  const advice = useMemo(() => (load.bundle ? buildAdvice(load.bundle, settings, now) : null), [load.bundle, settings, now]);

  let footer = "";
  if (load.loaded && load.bundle) {
    const at = formatClock(load.bundle.fetchedAt);
    footer = load.status === "ok" ? `Weather as of ${at} · Open-Meteo` : `Weather from earlier — as of ${at}`;
  }

  return (
    <WhatToWear
      loaded={load.loaded}
      status={load.status}
      advice={advice}
      location={load.bundle?.location ?? ""}
      units={settings.units}
      footer={footer}
    />
  );
}

const whatToWearWidget: RootboardWidget = {
  mount(container: HTMLElement, host: WidgetHost): WidgetInstance {
    const root: Root = createRoot(container);
    const bridge: Bridge = { visible: false, notifyVisible: null, refresh: null };
    root.render(<WhatToWearApp host={host} bridge={bridge} />);
    return {
      unmount() {
        root.unmount();
      },
      async refresh() {
        await bridge.refresh?.();
      },
      onVisibilityChange(visible: boolean) {
        bridge.visible = visible;
        bridge.notifyVisible?.(visible);
      },
    };
  },
};

export default whatToWearWidget;
```

Note: `forecast.ts` must re-export the `ForecastBundle` type for this import to work, or import it from `./types` instead. Use `import type { ForecastBundle } from "./types";` and import only `ForecastStatus`/`StoredState` from `./forecast` if `tsc` complains.

- [ ] **Step 4: Register the widget**

In `client/src/widgets/registry.ts`:

```ts
import { CalendarDays, ClipboardCheck, Shirt, UtensilsCrossed, type LucideIcon } from "lucide-react";
...
import whatToWearWidget, { manifest as whatToWearManifest } from "./what-to-wear";
...
export const BUILTIN_WIDGETS: BuiltinWidgetEntry[] = [
  { manifest: calendarManifest, widget: calendarWidget, navIcon: CalendarDays },
  { manifest: choresManifest, widget: choresWidget, navIcon: ClipboardCheck },
  { manifest: dinnerManifest, widget: dinnerWidget, navIcon: UtensilsCrossed },
  { manifest: whatToWearManifest, widget: whatToWearWidget, navIcon: Shirt },
];
```

Also update the doc comment above it: "All three first-party sections" → "All four first-party sections (calendar, chores, dinner, what-to-wear)".

- [ ] **Step 5: Type-check and run all tests**

Run: `npm run check && npm test`
Expected: both green.

- [ ] **Step 6: Browser check (dev server)**

Until Task 8 lands, the widget is only reachable if `data/config/dashboard.json` lists it. For this check, temporarily add `{ "id": "what-to-wear", "enabled": true, "settings": {} }` to the local `data/config/dashboard.json` (gitignored), start the dev server with `preview_start` (name from `.claude/launch.json`; create the entry if missing with `npm run dev` on the server's port), open the Shirt nav item, and confirm:
- With a blank zip and no local weather config: the "Ask a grown-up…" panel.
- Set zip `00000` in Settings → "That zip code didn't work" (zippopotam returns 404 for it).
- Set a fake-but-valid-shaped zip the founder supplies locally, or leave as is; do not commit any zip.
- `read_console_messages` shows no errors; the page does not scroll at 1024×600 (`resize_window` width 1024 height 600).
Take a screenshot for the task report.

- [ ] **Step 7: Commit**

```bash
git add client/src/widgets/what-to-wear/ItemChip.tsx client/src/widgets/what-to-wear/WhatToWear.tsx client/src/widgets/what-to-wear/index.tsx client/src/widgets/registry.ts
git commit -m "feat(what-to-wear): widget entry, layout, and registry entry

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 8: Host — surface built-ins missing from `dashboard.json`

Today `widgetPickerEntries` in `app-shell.tsx` iterates `dashboardConfig.widgets` only, so a built-in widget that an existing kiosk's config predates never appears in the layout picker or nav rail. Community widgets already solve this ("not-yet-added" rows + append-on-enable). Mirror that for built-ins and add the new widget, disabled, to the default config.

**Files:**
- Modify: `shared/dashboard-config.ts` (`defaultDashboardConfig`)
- Modify: `client/src/lib/dashboard-config.spec.ts`
- Modify: `client/src/components/app-shell.tsx` (`widgetPickerEntries`, `toggleWidgetEnabled`)

- [ ] **Step 1: Update the default-config test first**

In `client/src/lib/dashboard-config.spec.ts`, replace the test `"has calendar, chores, dinner in order, all enabled, defaultWidget calendar"` with:

```ts
  test("has calendar, chores, dinner enabled and what-to-wear disabled, defaultWidget calendar", () => {
    const config = defaultDashboardConfig();
    expect(config.configVersion).toBe(1);
    expect(config.defaultWidget).toBe("calendar");
    expect(config.widgets.map((w) => w.id)).toEqual(["calendar", "chores", "dinner", "what-to-wear"]);
    expect(config.widgets.map((w) => w.enabled)).toEqual([true, true, true, false]);
    expect(config.widgets.every((w) => Object.keys(w.settings).length === 0)).toBe(true);
  });
```

Run: `npx vitest run client/src/lib/dashboard-config.spec.ts`
Expected: FAIL on the ids assertion.

- [ ] **Step 2: Update `defaultDashboardConfig`**

```ts
/**
 * The built-in default config: calendar, chores, dinner — all enabled —
 * plus what-to-wear disabled (it needs a zip code or host weather to be
 * useful; a fresh kiosk opts in from the layout picker). Empty settings,
 * calendar as the default widget. Returns a fresh object on every call;
 * callers may mutate the result freely.
 */
export function defaultDashboardConfig(): DashboardConfig {
  return {
    configVersion: 1,
    defaultWidget: "calendar",
    widgets: [
      { id: "calendar", enabled: true, settings: {} },
      { id: "chores", enabled: true, settings: {} },
      { id: "dinner", enabled: true, settings: {} },
      { id: "what-to-wear", enabled: false, settings: {} },
    ],
  };
}
```

Run: `npx vitest run client/src/lib/dashboard-config.spec.ts`
Expected: PASS.

- [ ] **Step 3: List not-yet-added built-ins in the picker**

In `client/src/components/app-shell.tsx`, inside the `widgetPickerEntries` memo, after the `for (const w of dashboardConfig.widgets)` loop and before `return entries;`, add:

```ts
    // A built-in the kiosk's dashboard.json predates (e.g. what-to-wear on
    // a config written by an older build) has no entry above and would
    // otherwise be unreachable from the UI. List it after the in-config
    // rows as a disabled widget; toggling it on appends an entry (see
    // toggleWidgetEnabled) — the same "enable = add" rule community
    // widgets follow (CONTRACT.md §5).
    const inConfig = new Set(dashboardConfig.widgets.map((w) => w.id));
    for (const builtin of BUILTIN_WIDGETS) {
      if (inConfig.has(builtin.manifest.id)) continue;
      entries.push({
        id: builtin.manifest.id,
        label: builtin.manifest.name,
        icon: builtin.navIcon ?? DEFAULT_NAV_ICON,
        enabled: false,
        crashed: crashedWidgets.get(builtin.manifest.id)?.message,
        settings: builtin.manifest.settings,
        settingsValues: undefined,
      });
    }
```

- [ ] **Step 4: Append on enable**

Replace the body of `toggleWidgetEnabled` with:

```ts
  const toggleWidgetEnabled = useCallback(
    (id: string, enabled: boolean) => {
      void updateWidgetLayout((widgets) => {
        const idx = widgets.findIndex((w) => w.id === id);
        if (idx === -1) {
          // Built-in not yet in config (see widgetPickerEntries): enabling
          // appends `{id, enabled: true, settings: {}}`; disabling is a no-op.
          if (!enabled || !builtinById.has(id)) return null;
          return [...widgets, { id, enabled: true, settings: {} }];
        }
        if (!enabled) {
          const target = widgets[idx];
          const enabledCount = widgets.filter((w) => w.enabled).length;
          if (target.enabled && enabledCount <= 1) return null;
        }
        return widgets.map((w) => (w.id === id ? { ...w, enabled } : w));
      });
    },
    [updateWidgetLayout, builtinById],
  );
```

`moveWidget` already returns `null` for an id with no config position, so reorder arrows on a not-yet-added row are harmless no-ops.

- [ ] **Step 5: Type-check, test, and verify in the browser**

Run: `npm run check && npm test`
Expected: green.

Then remove the temporary `what-to-wear` entry added to the local `data/config/dashboard.json` in Task 7 (or restore the file from before that edit), reload the dev preview, open Settings → layout picker, and confirm "What to Wear" appears as a disabled row; toggle it on and confirm it appears in the nav rail and the config file now contains the entry. Toggle it off and confirm the nav item disappears. Screenshot for the task report.

- [ ] **Step 6: Commit**

```bash
git add shared/dashboard-config.ts client/src/lib/dashboard-config.spec.ts client/src/components/app-shell.tsx
git commit -m "feat(shell): surface built-in widgets missing from dashboard.json in the picker

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 9: Documentation, task tracking, and final verification

**Files:**
- Modify: `docs/SPEC.md` (§2.5, §3.1 widget list, new §3.10)
- Create: `docs/decisions/0012-what-to-wear-widget.md`
- Modify: `TASKS.md`
- Modify: `CLAUDE.md` (project-at-a-glance line count of first-party widgets, optional one-line mention)

- [ ] **Step 1: SPEC §2.5**

Replace the §2.5 paragraph with:

```markdown
### 2.5 Weather (`server/services/weatherService.ts`)

Enabled only when `WEATHER_ENABLED="true"` and `WEATHER_LAT`/`WEATHER_LON`
are finite numbers. `WEATHER_UNITS` is `fahrenheit` or defaults to
celsius; `WEATHER_LOCATION_LABEL` defaults to empty. Forecast is fetched
from Open-Meteo and cached server-side for 30 minutes; a failed refresh
serves the last good payload.

Payload: `{ enabled: true, current, daily[7], hourly[≤48], units,
location, updatedAt }`. `hourly` (added for the What to Wear widget,
3.10) carries `time, temp, feelsLike, precipChance, precipMm, snowCm,
code, windKmh, uv` from the first hour of the current local day;
`temp`/`feelsLike` follow `WEATHER_UNITS` (reported in `units`), wind is
km/h, precipitation mm, snowfall cm. The kiosk's coordinates never reach
the client — only the derived forecast does. Outside hosts contacted by
the server: `api.open-meteo.com` only (HTTPS, keyless).
```

- [ ] **Step 2: SPEC §3.1 widget list**

Change "Three first-party widgets ship under `client/src/widgets/`: `calendar/`, `chores/`, `dinner/`" to "Four first-party widgets ship under `client/src/widgets/`: `calendar/`, `chores/`, `dinner/`, `what-to-wear/` (3.10)". Also note, in the same bullet or the dashboard-config bullet, that a built-in absent from `dashboard.json` is listed in the layout picker as disabled and appended on enable (Task 8).

- [ ] **Step 3: SPEC §3.10 (insert before `## 4. Update system`)**

```markdown
### 3.10 What to Wear (`client/src/widgets/what-to-wear/`)

Kid-facing, display-only section: weather for Morning / Afternoon /
Evening, what to wear this morning, what changes this afternoon, and
what to pack. Brief: `docs/plans/what-to-wear-widget/BRIEF.md`;
decision 0012. Disabled in the default config; enable it from the
layout picker.

- **Settings** (manifest, edited in the host Settings UI, persisted in
  `dashboard.json`): `zipCode` (blank = use the kiosk's `/api/weather`),
  `units` (`celsius` default / `fahrenheit`), `schoolStart` / `schoolEnd`
  (`"HH:MM"`, fall back to `08:00` / `15:00` when unparsable or
  inverted). Evening is fixed at 18:00. The zip is treated as personal
  data: never logged, never in an error message, no default.
- **Data paths** (`forecast.ts`): zip set → `api.zippopotam.us` (zip →
  lat/lon, cached per zip in `host.storage`, re-run only when the zip
  changes; 404 = invalid zip) then Open-Meteo hourly direct via
  `host.fetch`, always requested in °C / km/h / mm. Zip blank →
  `/api/weather` `hourly` (2.5), normalised to °C client-side. Both
  yield the same `ForecastBundle`; the last good one (≤ 48 h) plus the
  zip→coords map persist in `host.storage` so a reboot or outage still
  renders. Exactly two outside hosts, both HTTPS, keyless.
- **Cadence:** manifest `refresh.intervalSeconds: 1800` (host-driven,
  visible + online + awake). One private 1-minute timer re-evaluates
  the day flip and footer; it runs only while visible and is cleared on
  unmount. No other polling.
- **Day selection:** before `schoolEnd` → today, otherwise tomorrow
  ("Today · Tuesday"). Windows: Morning = hour nearest `schoolStart`
  (range −1 h…+2 h), Afternoon = nearest `schoolEnd` (same range),
  Evening = 18:00 (17–20). School day (backpack rules) = start…end.
- **Rules** (`advice.ts`, pure, unit-tested): feels-like bands Hot ≥24,
  Warm 18–23, Cool 12–17, Chilly 5–11, Cold −5–4, Freezing <−5 with
  base outfits per band; layering (afternoon ≥1 band warmer → afternoon
  base + the morning band's removable layer, "take it off"; colder →
  morning base + pack the afternoon layer; never shorts when the morning
  is Cold/Freezing); rain (≥40 % morning → raincoat worn; ≥40 %
  afternoon only → raincoat packed; ≥70 % in the school day → rain boots
  worn + umbrella packed; code ≥95 → storm headline); snow (any → boots,
  gloves, hat; ≥2 cm → snow pants); wind (≥30 km/h → windbreaker if no
  outer layer, "windy" chip; ≥45 → headline); UV (≥6 → sunscreen, sun
  hat, water bottle, "strong sun" chip on the sunniest window; 3–5 with
  a clear afternoon → sunscreen; Hot afternoon → water bottle).
- **Copy and emoji** live in `phrases.ts`; single-codepoint emoji only
  (3.3). `ItemChip` takes an optional lucide icon for one-line swaps if
  a glyph is missing on the kiosk.
- **States:** no zip + host weather disabled → "Ask a grown-up to add
  your zip code in Settings"; invalid zip → "That zip code didn't work";
  fetch failed with cache → render it, footer "Weather from earlier — as
  of …"; failed with no cache → "Can't reach the weather right now".
  Nothing throws out of `mount()`/`refresh()`.
- **Layout:** fixed landscape panel, nothing scrolls; theme tokens only.
```

- [ ] **Step 4: Decision record**

`docs/decisions/0012-what-to-wear-widget.md`:

```markdown
# 0012 — What to Wear: widget-side forecast with host fallback, zippopotam lookup, fixed bands
Date: 2026-10-04
Status: accepted (brief founder-approved 2026-10-04)

## Decision

1. The What to Wear widget fetches Open-Meteo hourly data **itself** via
   `host.fetch` when a zip code is set, and falls back to the host's
   `/api/weather` (extended additively with `hourly` + `units`) when the
   zip is blank.
2. Zip → coordinates uses `api.zippopotam.us` (HTTPS, keyless), cached
   per zip in `host.storage`, looked up once per zip.
3. Temperature cutoffs and clothing rules are hard-coded in v1
   (`advice.ts` / `phrases.ts`), not user-tunable.
4. A built-in widget absent from an existing `dashboard.json` is listed
   in the layout picker as disabled and appended on enable; the default
   config includes `what-to-wear` disabled.

## Context and alternatives

- **Server-side only (extend `/api/weather` for everything).** Rejected:
  the kiosk's own location lives in `.env` and the widget needs a
  *different* location per zip. Routing zips through the server would
  add an endpoint and put a per-kid zip on the server path for no gain;
  the contract's v1 trust model already allows widget-side fetches.
- **Widget-side only (no host fallback).** Rejected: a kiosk with
  weather already configured should work on day one with no setup.
- **Open-Meteo's geocoder for zips.** Viable alternative, documented in
  the brief; zippopotam was chosen because it is purpose-built for
  postal codes and returns a clean place/state label. Swap only if it
  proves unreliable, and never call both.
- **User-tunable cutoffs.** Deferred: the brief locks sensible defaults;
  tuning would add settings UI with no on-screen keyboard benefit for a
  display-only widget.
- **Enable the widget by default.** Rejected: without a zip or host
  weather it only shows a setup message; opt-in keeps existing kiosks
  unchanged (value only accrues).

## Consequences

- Two outside hosts total for this widget (`api.open-meteo.com`,
  `api.zippopotam.us`), both documented in SPEC §3.10.
- `/api/weather` gains `hourly` and `units`; existing consumers ignore
  them. Payload grows by ≤ 48 entries.
- Zip is personal data: never logged, never in error text, no default.
- Changing a cutoff is a code change in `advice.ts` with a test update.
```

- [ ] **Step 5: TASKS.md**

Tick the build item:

```markdown
- [x] Build the What to Wear widget (kid-facing school outfit + weather) — brief at `docs/plans/what-to-wear-widget/BRIEF.md` (added 2026-10-04) (done 2026-10-04 — plan at `docs/plans/what-to-wear-widget/PLAN.md`; SPEC §3.10, decision 0012)
```

Add two follow-ups under `## Open`:

```markdown
- [ ] What to Wear kiosk check before release: both fetch paths (zip set / blank), the no-config state, a theme switch, screensaver dim/wake, a 10-minute soak after section switches for timer leaks, and confirm every emoji in `client/src/widgets/what-to-wear/phrases.ts` renders in kiosk Firefox (swap any tofu for a lucide icon via ItemChip's `icon` prop) (added 2026-10-04)
- [ ] After What to Wear ships in a release: add it to the first-party list in awesome-rootboard and mention it in README.md (added 2026-10-04)
```

- [ ] **Step 6: CLAUDE.md**

In "Project at a glance", the widget-system bullet mentions three companion repos; no change needed there. Add one sentence to the theme-engine bullet's neighbour or a new bullet: "Four first-party widgets live in `client/src/widgets/` (calendar, chores, dinner, what-to-wear); What to Wear's brief and plan are under `docs/plans/what-to-wear-widget/`."

- [ ] **Step 7: Full verification**

Run: `npm run check && npm test && npm run build && npm audit --omit=dev`
Expected: all green; audit shows no new high/critical findings (no dependencies were added).

- [ ] **Step 8: Security review and commit**

Run the `CLAUDE.md` review:

```bash
git status
git diff --cached
git diff --cached | grep -n -i -E "private_key|BEGIN PRIVATE KEY|client_email|192\.168\.|10\.0\.|/home/|@gmail\.com|pricing|margin|revenue|trademark" || echo "no hits"
```

Expected: `no hits`, no untracked secret/data files staged. Then:

```bash
git add docs/SPEC.md docs/decisions/0012-what-to-wear-widget.md TASKS.md CLAUDE.md
git commit -m "docs(what-to-wear): SPEC §3.10, decision 0012, task tracking

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

Do **not** push or tag: releasing is a separate step (bump `shared/version.ts`, kiosk rollout per the release-workflow memory). Report to the founder: the brief conflict resolved in favour of the water bottle rule; the emoji-on-Pi check is a kiosk-time task; whether to bump to 1.7.0 now.

---

## Self-review

**Spec coverage.** §2 decisions 1–10 → Tasks 1 (settings, units), 5 (zip lookup, fallback), 7 (layout, emoji), 9 (decision record). §3 layout and states → Task 7. §4.1 both paths → Tasks 5, 6. §4.2 zip caching and 5-digit validation → Task 5. §4.3 cadence, storage cap, one-minute timer → Tasks 1 (manifest), 5 (trim to 48), 7 (timer). §5 windows and day flip → Tasks 2, 4. §6.1–6.6 rules → Task 4. §6.7 phrases, §6.8 emoji → Task 3, Task 7 (`ItemChip.icon`). §7 settings → Task 1. §8 scenarios 1–7 → Tasks 4 (1–4), 2 (5), 1 (6), 3 (7); manifest validation → Task 1; manual kiosk check → TASKS.md follow-up in Task 9. §9 files → all tasks; registry → Task 7; server → Task 6; SPEC/decision/TASKS → Task 9; README/awesome-rootboard → follow-up task. §10 guardrails → Global Constraints. §12 definition of done: picker/nav-rail integration → Tasks 7–8; blank-zip and valid-zip rendering → Tasks 5–7; tests/build green → Task 9. Gap found and closed: existing kiosks could not see a new built-in (Task 8).

**Placeholder scan.** None; every code step is complete.

**Type consistency.** `Item.id` string ids match between `phrases.ts` `ITEMS`, the engine's `removeItem(..., ITEMS.x.id)`, and the spec's `ids()` assertions (`tshirt`, `shorts`, `sneakers`, `hoodie`, `pants`, `raincoat`, `rainBoots`, `umbrella`, `boots`, `gloves`, `warmHat`, `snowPants`, `heavyCoat`, `winterCoat`, `jacket`, `windbreaker`, `sunscreen`, `sunHat`, `waterBottle`). `fetchForecast` signature `(fetchFn, settings, state, now)` matches Task 7's call. `WhatToWearProps` matches the render in `index.tsx`. `WeatherHourly` field names match `normalizeHostWeather`'s reads (`temp`, `feelsLike`, `precipChance`, `precipMm`, `snowCm`, `code`, `windKmh`, `uv`).
