import { useEffect, useMemo, useRef, useState } from "react";
import { EventItem } from "./event-item";
import { DayEventsDialog } from "./day-events-dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { getMonthCalendar, isToday } from "@/lib/date-utils";
import type { CalendarEvent } from "@shared/schema";

interface MonthViewProps {
  currentDate: Date;
  events: CalendarEvent[];
  isLoading: boolean;
  onEventClick?: (event: CalendarEvent) => void;
}

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MAX_VISIBLE = 4;

// Pixel heights of a day cell's parts (see the markup below), used to fit
// only WHOLE event rows into short cells so the "+ N more" pill is never
// squeezed or clipped on smaller screens.
const CELL_CHROME = 22; // 3px border top+bottom + py-2
const DATE_ROW = 34;    // 30px day number + mb-1
const MORE_PILL = 36;   // 32px pill + mt-1
const EVENT_ROW = 24;   // 20px compact event + gap-1
const EVENT_GAP = 4;    // no gap after the last row

/** How many compact event rows fit in a cell of `cellHeight`, with or without the pill. */
function rowsThatFit(cellHeight: number, withPill: boolean): number {
  const free = cellHeight - CELL_CHROME - DATE_ROW - (withPill ? MORE_PILL : 0) + EVENT_GAP;
  return Math.max(0, Math.floor(free / EVENT_ROW));
}

export function MonthView({ currentDate, events, isLoading, onEventClick }: MonthViewProps) {
  const monthDays = useMemo(() => getMonthCalendar(currentDate), [currentDate]);

  // Limit the grid to 5 rows: drop trailing week(s) that fall entirely in the
  // next month, so the calendar takes less vertical space. Months that genuinely
  // span 6 weeks (current-month days in the 6th row) are left intact.
  const visibleDays = useMemo(() => {
    const weeks: Date[][] = [];
    for (let i = 0; i < monthDays.length; i += 7) weeks.push(monthDays.slice(i, i + 7));
    while (weeks.length > 5) {
      const last = weeks[weeks.length - 1];
      const allOutside = last.every(
        d => d.getMonth() !== currentDate.getMonth() || d.getFullYear() !== currentDate.getFullYear()
      );
      if (allOutside) weeks.pop();
      else break;
    }
    return weeks.flat();
  }, [monthDays, currentDate]);

  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [dayDialogOpen, setDayDialogOpen] = useState(false);

  // Track the rendered cell height (all cells share it: 1fr grid rows).
  const gridRef = useRef<HTMLDivElement>(null);
  const [cellHeight, setCellHeight] = useState<number | null>(null);
  useEffect(() => {
    const grid = gridRef.current;
    if (!grid || typeof ResizeObserver === 'undefined') return;
    const measure = () => {
      const cell = grid.firstElementChild as HTMLElement | null;
      // 0 while the widget is display:none'd behind another section; keep the
      // last real size (the observer fires again once it's visible).
      const height = cell?.getBoundingClientRect().height ?? 0;
      if (height > 0) setCellHeight(height);
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(grid);
    return () => observer.disconnect();
  }, [isLoading]);

  const maxWithoutPill = cellHeight === null ? MAX_VISIBLE : Math.min(MAX_VISIBLE, rowsThatFit(cellHeight, false));
  const maxWithPill = cellHeight === null ? MAX_VISIBLE - 1 : Math.min(MAX_VISIBLE - 1, rowsThatFit(cellHeight, true));

  // Bucket events by date in a single O(events × span) pass.
  const eventsByDate = useMemo(() => {
    const eventsMap = new Map<string, CalendarEvent[]>();
    const dayKeys = monthDays.map(d => d.toDateString());
    const dayStarts = monthDays.map(d => { const x = new Date(d); x.setHours(0, 0, 0, 0); return x.getTime(); });
    const dayEnds = monthDays.map(d => { const x = new Date(d); x.setHours(23, 59, 59, 999); return x.getTime(); });
    dayKeys.forEach(k => eventsMap.set(k, []));

    for (const event of events) {
      // Same rule as eventOverlapsDay (lib/date-utils): half-open, so an
      // event ending exactly at midnight stays off the next day; a
      // zero-length event counts as 1 ms so it isn't dropped.
      const startMs = new Date(event.startTime).getTime();
      const endMs = Math.max(new Date(event.endTime).getTime(), startMs + 1);

      let lo = 0;
      while (lo < monthDays.length && dayEnds[lo] < startMs) lo++;
      let hi = monthDays.length - 1;
      while (hi >= 0 && dayStarts[hi] >= endMs) hi--;
      if (lo > hi) continue;
      for (let i = lo; i <= hi; i++) eventsMap.get(dayKeys[i])!.push(event);
    }

    eventsMap.forEach(dateEvents => {
      dateEvents.sort((a, b) => {
        if (a.isAllDay && !b.isAllDay) return -1;
        if (!a.isAllDay && b.isAllDay) return 1;
        const startA = new Date(a.startTime).getTime();
        const startB = new Date(b.startTime).getTime();
        if (startA !== startB) return startA - startB;
        return a.calendarId.localeCompare(b.calendarId);
      });
    });

    return eventsMap;
  }, [events, monthDays]);

  const getEventsForDate = (date: Date) => eventsByDate.get(date.toDateString()) || [];

  const handleShowMoreEvents = (date: Date) => {
    setSelectedDate(date);
    setDayDialogOpen(true);
  };

  if (isLoading) {
    return (
      <div className="h-full flex flex-col bg-[var(--rb-canvas)]">
        <div className="grid grid-cols-7 px-6 pt-3 pb-1">
          {WEEKDAYS.map(day => (
            <div key={day} className="text-center text-sm font-bold uppercase tracking-wide text-[var(--rb-muted)]">
              {day}
            </div>
          ))}
        </div>
        <div className="flex-1 px-6 pb-5 overflow-hidden">
          <div className="h-full calendar-grid" style={{ gridAutoRows: '1fr' }}>
            {Array.from({ length: 35 }).map((_, i) => (
              <div key={i} className="calendar-cell p-2">
                <Skeleton className="h-7 w-7 rounded-full mb-2" />
                <Skeleton className="h-4 w-full mb-1 rounded-md" />
                <Skeleton className="h-4 w-3/4 rounded-md" />
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col bg-[var(--rb-canvas)]">
      {/* Weekday header */}
      <div className="grid grid-cols-7 px-6 pt-3 pb-1">
        {WEEKDAYS.map(day => (
          <div key={day} className="text-center text-sm font-bold uppercase tracking-wide text-[var(--rb-muted)]">
            {day}
          </div>
        ))}
      </div>

      {/* Calendar grid */}
      <div className="flex-1 px-6 pb-5 overflow-hidden">
        <div ref={gridRef} className="h-full calendar-grid" style={{ gridAutoRows: '1fr' }}>
          {visibleDays.map((date, index) => {
            const dayEvents = getEventsForDate(date);
            const isCurrentMonth = date.getMonth() === currentDate.getMonth() && date.getFullYear() === currentDate.getFullYear();
            const isTodayDate = isToday(date);
            const isWeekend = date.getDay() === 0 || date.getDay() === 6;

            // When a day overflows, the "+ N more" pill takes the last event
            // row so it always has room to be a full-size touch target.
            const hasOverflow = dayEvents.length > maxWithoutPill;
            const shownEvents = dayEvents.slice(0, hasOverflow ? maxWithPill : maxWithoutPill);
            const hiddenCount = dayEvents.length - shownEvents.length;

            const cellBg = !isCurrentMonth ? 'var(--rb-cell-inactive-bg)' : isWeekend ? 'var(--rb-cell-weekend-bg)' : 'var(--rb-surface)';
            const numColor = isTodayDate ? 'var(--rb-accent)' : isCurrentMonth ? 'var(--rb-ink)' : 'var(--rb-ink-disabled)';

            return (
              <div
                key={index}
                className="calendar-cell flex flex-col px-2 py-2"
                style={{
                  background: cellBg,
                  border: isTodayDate ? '3px solid var(--rb-accent)' : '3px solid transparent',
                  boxShadow: isCurrentMonth ? '0 1px 2px var(--rb-shadow-soft)' : 'none',
                }}
                data-testid={isTodayDate ? 'today-cell' : undefined}
              >
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); handleShowMoreEvents(date); }}
                  className="mb-1 flex w-full flex-shrink-0 items-center text-left"
                  aria-label={`Show all events for ${date.toLocaleDateString()}`}
                >
                  <span
                    className="inline-flex items-center justify-center rounded-full text-base font-extrabold"
                    style={{
                      minWidth: 30,
                      height: 30,
                      padding: '0 6px',
                      background: 'transparent',
                      color: numColor,
                    }}
                  >
                    {date.getDate()}
                  </span>
                </button>
                <div className="flex min-h-0 flex-col gap-1 overflow-hidden">
                  {shownEvents.map((event) => (
                    <EventItem key={event.id} event={event} compact onClick={onEventClick} />
                  ))}
                </div>
                {/* Outside the clipped event list so it can never be cut off
                    (a half-hidden 20px text link used to miss taps). */}
                {hasOverflow && (
                  <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); handleShowMoreEvents(date); }}
                    className="mt-1 flex min-h-[32px] w-full flex-shrink-0 items-center rounded-md bg-[var(--rb-chip)] px-2 text-left text-sm font-bold text-rb-ink-secondary transition-colors hover:bg-[var(--rb-chip-hover)]"
                    aria-label={`Show all ${dayEvents.length} events for ${date.toLocaleDateString()}`}
                    data-testid="month-more-events"
                  >
                    + {hiddenCount} more
                  </button>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {selectedDate && (
        <DayEventsDialog
          open={dayDialogOpen}
          onOpenChange={setDayDialogOpen}
          date={selectedDate}
          events={getEventsForDate(selectedDate)}
          onEventClick={onEventClick}
        />
      )}
    </div>
  );
}
