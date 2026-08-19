/**
 * Shared calendar metadata helpers: stable per-calendar colors and avatar
 * initials. Used by the profile legend, the agenda Day view, and anywhere
 * else a calendar needs a face. The hash fallback matches the backend logic
 * so a calendar without a Google color still gets the same hue everywhere.
 */

export interface CalendarInfo {
  id: string;
  summary: string;
  primary: boolean;
  backgroundColor?: string;
  foregroundColor?: string;
  selected: boolean;
  accessRole: string;
}

const FALLBACK_COLORS = [
  '#2563eb', '#16a34a', '#e11d48', '#ea8c00', '#9333ea',
  '#795548', '#607d8b', '#e91e63', '#4caf50', '#ff5722', '#3f51b5', '#009688',
];

// Single fallback color for an *event* (not a calendar) with no color of its
// own. Distinct from FALLBACK_COLORS above, which cycles per-calendar
// identity colors. One definition site so every "no color" event matches;
// a theme may override this later.
export const EVENT_FALLBACK_COLOR = "#2563eb";

export function getCalendarColor(calendar: Pick<CalendarInfo, 'id' | 'backgroundColor'>): string {
  if (calendar.backgroundColor) return calendar.backgroundColor;

  let hash = 0;
  for (let i = 0; i < calendar.id.length; i++) {
    hash = ((hash << 5) - hash + calendar.id.charCodeAt(i)) & 0xffffffff;
  }
  return FALLBACK_COLORS[Math.abs(hash) % FALLBACK_COLORS.length];
}

export function getInitials(name: string): string {
  return name.split(' ').map(w => w[0]).join('').substring(0, 2).toUpperCase();
}
