/**
 * Normalize Google Calendar event times into the instants we store locally.
 *
 * Timed events arrive as RFC3339 `dateTime` strings (with offset) — parsed
 * as-is.
 *
 * All-day events arrive as date-only strings (`start.date`, `end.date`) where
 * the END IS EXCLUSIVE (a one-day event on May 10 has end.date May 11). They
 * used to be stored via `new Date("2026-05-10")`, which parses as UTC
 * midnight, with the exclusive end kept raw. Rendered in any timezone west of
 * UTC that becomes "May 9, 5 PM → May 10, 5 PM" — so month/week views
 * bucketed the event onto TWO days (the day before, plus the real day).
 *
 * We store all-day events as:
 *   startTime = LOCAL midnight of start.date
 *   endTime   = LOCAL 23:59:59.999 of the LAST day (exclusive end - 1ms)
 * i.e. an inclusive range entirely within the event's own day(s), which every
 * view's inclusive overlap checks bucket correctly with no special-casing.
 */

interface GoogleEventTimeField {
  dateTime?: string | null;
  date?: string | null;
}

export interface NormalizedEventTimes {
  startTime: Date;
  endTime: Date;
  isAllDay: boolean;
}

/** Parse YYYY-MM-DD as LOCAL midnight (new Date("YYYY-MM-DD") would be UTC). */
export function parseDateOnlyLocal(dateStr: string): Date {
  const [y, m, d] = dateStr.split("-").map(Number);
  return new Date(y, (m || 1) - 1, d || 1);
}

export function normalizeGoogleEventTimes(
  start: GoogleEventTimeField | null | undefined,
  end: GoogleEventTimeField | null | undefined,
): NormalizedEventTimes {
  const isAllDay = !!start?.date;

  if (!isAllDay) {
    return {
      startTime: new Date(start?.dateTime ?? 0),
      endTime: new Date(end?.dateTime ?? 0),
      isAllDay: false,
    };
  }

  const startTime = parseDateOnlyLocal(start!.date!);
  // Exclusive end date → inclusive end-of-last-day (1ms before local midnight).
  const endExclusive = end?.date ? parseDateOnlyLocal(end.date) : null;
  let endTime = endExclusive
    ? new Date(endExclusive.getTime() - 1)
    : new Date(startTime.getTime() + 24 * 60 * 60 * 1000 - 1);
  // Defensive: a malformed end before the start collapses to a one-day event.
  if (endTime < startTime) {
    endTime = new Date(startTime.getTime() + 24 * 60 * 60 * 1000 - 1);
  }
  return { startTime, endTime, isAllDay: true };
}
