import { useMemo, useState } from "react";
import { EventItem } from "./event-item";
import { DayEventsDialog } from "./day-events-dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { getMonthCalendar, isToday } from "@/lib/date-utils";
import type { CalendarEvent } from "@shared/schema";

interface MonthViewProps {
  currentDate: Date;
  events: CalendarEvent[];
  isLoading: boolean;
  enabledCalendars?: Set<string>;
  onEventClick?: (event: CalendarEvent) => void;
}

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MAX_VISIBLE = 4;

export function MonthView({ currentDate, events, isLoading, enabledCalendars, onEventClick }: MonthViewProps) {
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

  // Bucket events by date in a single O(events × span) pass.
  const eventsByDate = useMemo(() => {
    const eventsMap = new Map<string, CalendarEvent[]>();
    const dayKeys = monthDays.map(d => d.toDateString());
    const dayStarts = monthDays.map(d => { const x = new Date(d); x.setHours(0, 0, 0, 0); return x.getTime(); });
    const dayEnds = monthDays.map(d => { const x = new Date(d); x.setHours(23, 59, 59, 999); return x.getTime(); });
    dayKeys.forEach(k => eventsMap.set(k, []));

    const usingFilter = enabledCalendars && enabledCalendars.size > 0;

    for (const event of events) {
      if (usingFilter && !enabledCalendars!.has(event.calendarId)) continue;
      const startMs = new Date(event.startTime).getTime();
      const endMs = new Date(event.endTime).getTime();

      let lo = 0;
      while (lo < monthDays.length && dayEnds[lo] < startMs) lo++;
      let hi = monthDays.length - 1;
      while (hi >= 0 && dayStarts[hi] > endMs) hi--;
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
  }, [events, enabledCalendars, monthDays]);

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
        <div className="h-full calendar-grid" style={{ gridAutoRows: '1fr' }}>
          {visibleDays.map((date, index) => {
            const dayEvents = getEventsForDate(date);
            const isCurrentMonth = date.getMonth() === currentDate.getMonth() && date.getFullYear() === currentDate.getFullYear();
            const isTodayDate = isToday(date);
            const isWeekend = date.getDay() === 0 || date.getDay() === 6;

            const cellBg = !isCurrentMonth ? '#f0eee9' : isWeekend ? '#fbfaf7' : '#ffffff';
            const numColor = isTodayDate ? 'var(--rb-accent)' : isCurrentMonth ? '#2b3038' : '#b8bcc4';

            return (
              <div
                key={index}
                className="calendar-cell flex flex-col px-2 py-2"
                style={{
                  background: cellBg,
                  border: isTodayDate ? '3px solid var(--rb-accent)' : '3px solid transparent',
                  boxShadow: isCurrentMonth ? '0 1px 2px rgba(0,0,0,.05)' : 'none',
                }}
                data-testid={isTodayDate ? 'today-cell' : undefined}
              >
                <div className="mb-1">
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
                </div>
                <div className="flex flex-col gap-1 overflow-hidden">
                  {dayEvents.slice(0, MAX_VISIBLE).map((event) => (
                    <EventItem key={event.id} event={event} compact onClick={onEventClick} />
                  ))}
                  {dayEvents.length > MAX_VISIBLE && (
                    <button
                      onClick={(e) => { e.stopPropagation(); handleShowMoreEvents(date); }}
                      className="text-left px-2 text-sm font-bold text-[var(--rb-muted)] hover:text-[#5b626d] transition-colors"
                      aria-label={`Show all ${dayEvents.length} events for ${date.toLocaleDateString()}`}
                    >
                      + {dayEvents.length - MAX_VISIBLE} more
                    </button>
                  )}
                </div>
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
