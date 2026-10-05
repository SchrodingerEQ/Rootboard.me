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
