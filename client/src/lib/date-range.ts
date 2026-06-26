export type CalendarView = "day" | "week" | "month";

/**
 * Compute the [start, end) instant window to fetch events for, given the date
 * being viewed and the active view.
 *
 * Two rules keep this correct:
 *  - `start` is normalized to LOCAL midnight so the window never shifts with the
 *    current time of day. (`currentDate` is typically `new Date()`, which carries
 *    a wall-clock time; without normalization, day/week views silently drop every
 *    event earlier than "now".)
 *  - `end` is EXCLUSIVE — local midnight of the day *after* the last visible day.
 *    The server query is `start_time < end AND end_time > start`, so an exclusive
 *    next-midnight end includes the whole final day.
 */
export function getCalendarDateRange(
  currentDate: Date,
  currentView: CalendarView,
): { start: Date; end: Date } {
  const start = new Date(currentDate);
  start.setHours(0, 0, 0, 0);
  // `end` is seeded from the same local midnight BEFORE `start` is mutated below,
  // so the month branch can still read the viewed month off it.
  const end = new Date(start);

  if (currentView === "month") {
    start.setDate(1);
    start.setDate(start.getDate() - start.getDay()); // Sunday of the first week
    end.setMonth(end.getMonth() + 1, 0); // last day of the viewed month
    end.setDate(end.getDate() + (6 - end.getDay())); // Saturday of the last week
    end.setDate(end.getDate() + 1); // exclusive end → following midnight
  } else if (currentView === "week") {
    start.setDate(start.getDate() - start.getDay()); // Sunday of this week
    end.setTime(start.getTime());
    end.setDate(end.getDate() + 7); // exclusive end → next Sunday midnight (full 7 days)
  } else if (currentView === "day") {
    end.setDate(end.getDate() + 1); // exclusive end → next midnight (full 24h)
  }

  return { start, end };
}
