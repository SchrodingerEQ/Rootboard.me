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
