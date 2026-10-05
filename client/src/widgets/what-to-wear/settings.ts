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
