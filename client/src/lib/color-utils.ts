// Warm family-display color helpers.
// Calendars/events arrive with arbitrary hex colors (from Google or the
// generated palette in calendar-filters), so we derive a soft tint and a
// legible dark text color from whatever hex we're given at runtime.

export function hexToRgb(hex: string): { r: number; g: number; b: number } {
  let h = (hex || "").replace("#", "").trim();
  if (h.length === 3) h = h.split("").map((c) => c + c).join("");
  if (h.length !== 6) return { r: 37, g: 99, b: 235 }; // fallback: blue
  const num = parseInt(h, 16);
  return { r: (num >> 16) & 255, g: (num >> 8) & 255, b: num & 255 };
}

/** Light wash of the color, used as the background of chips and time blocks. */
export function eventTint(hex: string, alpha = 0.14): string {
  const { r, g, b } = hexToRgb(hex);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

/** A darkened version of the color that stays readable on top of its own tint. */
export function eventTextColor(hex: string, factor = 0.55): string {
  const { r, g, b } = hexToRgb(hex);
  return `rgb(${Math.round(r * factor)}, ${Math.round(g * factor)}, ${Math.round(b * factor)})`;
}

// Shared Rootboard UI tokens so components don't re-type the literals.
export const RB = {
  canvas: "#f7f6f3",
  surface: "#ffffff",
  ink: "#2b3038",
  muted: "#9aa0aa",
  faint: "#b0b5be",
  chip: "#f1efea",
  chipHover: "#e7e4dd",
  accent: "#f2655a",
  accentHover: "#e8554a",
  todayWash: "#fff1ea",
  todayColumnWash: "#fff8f2",
  gridLine: "#ededed",
} as const;
