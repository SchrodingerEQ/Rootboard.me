/**
 * The colour a calendar gets when Google gives it none: a hash of the
 * calendar id into one palette. The server stamps it on synced events
 * (Month/Week views read `event.color`) and the client uses it for the
 * calendar list, chips and avatars, so both must come from here.
 */
export const CALENDAR_FALLBACK_COLORS = [
  "#2563eb", "#16a34a", "#e11d48", "#ea8c00", "#9333ea",
  "#795548", "#607d8b", "#e91e63", "#4caf50", "#ff5722", "#3f51b5", "#009688",
] as const;

export function calendarFallbackColor(calendarId: string): string {
  let hash = 0;
  for (let i = 0; i < calendarId.length; i++) {
    hash = ((hash << 5) - hash + calendarId.charCodeAt(i)) & 0xffffffff;
  }
  return CALENDAR_FALLBACK_COLORS[Math.abs(hash) % CALENDAR_FALLBACK_COLORS.length];
}
