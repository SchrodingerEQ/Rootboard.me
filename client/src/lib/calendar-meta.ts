import { calendarFallbackColor } from "@shared/calendar-color";

/**
 * Shared calendar metadata helpers: stable per-calendar colors and avatar
 * initials. Used by the profile legend, the agenda Day view, Settings, and
 * anywhere else a calendar needs a face. The hash fallback is the one the
 * server stamps on synced events (shared/calendar-color.ts), so a calendar
 * without a Google color gets the same hue everywhere.
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

// Single fallback color for an *event* (not a calendar) with no color of its
// own. Distinct from the per-calendar palette (shared/calendar-color.ts), which cycles per-calendar
// identity colors. One definition site so every "no color" event matches;
// a theme may override this later.
export const EVENT_FALLBACK_COLOR = "#2563eb";

export function getCalendarColor(calendar: Pick<CalendarInfo, 'id' | 'backgroundColor'>): string {
  return calendar.backgroundColor || calendarFallbackColor(calendar.id);
}

export function getInitials(name: string): string {
  return name.split(' ').map(w => w[0]).join('').substring(0, 2).toUpperCase();
}
