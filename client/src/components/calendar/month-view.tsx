import { useMemo, useState } from "react";
import { EventItem } from "./event-item";
import { DayEventsDialog } from "./day-events-dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { getMonthCalendar, isToday } from "@/lib/date-utils";
import { ChevronDown } from "lucide-react";
import type { CalendarEvent } from "@shared/schema";

interface MonthViewProps {
  currentDate: Date;
  events: CalendarEvent[];
  isLoading: boolean;
  enabledCalendars?: Set<string>;
  onEventClick?: (event: CalendarEvent) => void;
}

export function MonthView({ currentDate, events, isLoading, enabledCalendars, onEventClick }: MonthViewProps) {
  const monthDays = useMemo(() => getMonthCalendar(currentDate), [currentDate]);
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [dayDialogOpen, setDayDialogOpen] = useState(false);
  
  // Bucket events by date in a single O(events × span) pass instead of
  // re-scanning the entire event list once per visible day. For a Pi kiosk
  // with thousands of events across 42 visible days, this is ~40x faster.
  const eventsByDate = useMemo(() => {
    const eventsMap = new Map<string, CalendarEvent[]>();

    // Build the set of visible day keys and their boundaries up front.
    const dayKeys: string[] = monthDays.map(d => d.toDateString());
    const dayStarts: number[] = monthDays.map(d => {
      const x = new Date(d);
      x.setHours(0, 0, 0, 0);
      return x.getTime();
    });
    const dayEnds: number[] = monthDays.map(d => {
      const x = new Date(d);
      x.setHours(23, 59, 59, 999);
      return x.getTime();
    });
    dayKeys.forEach(k => eventsMap.set(k, []));

    const usingFilter = enabledCalendars && enabledCalendars.size > 0;

    // Single pass over events: for each event, find the day-index range it
    // intersects and append to those buckets.
    for (const event of events) {
      if (usingFilter && !enabledCalendars!.has(event.calendarId)) continue;

      const startMs = new Date(event.startTime).getTime();
      const endMs = new Date(event.endTime).getTime();

      // Find first visible day this event touches.
      let lo = 0;
      while (lo < monthDays.length && dayEnds[lo] < startMs) lo++;
      // Find last visible day this event touches.
      let hi = monthDays.length - 1;
      while (hi >= 0 && dayStarts[hi] > endMs) hi--;

      if (lo > hi) continue;

      for (let i = lo; i <= hi; i++) {
        eventsMap.get(dayKeys[i])!.push(event);
      }
    }

    // Sort each bucket once: all-day first, then by start time, then by calendarId.
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
  
  const getEventsForDate = (date: Date) => {
    return eventsByDate.get(date.toDateString()) || [];
  };

  const handleShowMoreEvents = (date: Date) => {
    setSelectedDate(date);
    setDayDialogOpen(true);
  };

  if (isLoading) {
    return (
      <div className="h-full flex flex-col">
        {/* Days of Week Header */}
        <div className="bg-[hsl(var(--google-light-gray))] border-b border-border">
          <div className="calendar-grid">
            {['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'].map(day => (
              <div key={day} className="px-4 py-3 text-center text-sm font-medium text-[hsl(var(--google-gray))]">
                {day}
              </div>
            ))}
          </div>
        </div>
        
        {/* Loading Calendar Grid */}
        <div className="flex-1 overflow-hidden">
          <div className="calendar-grid h-full">
            {Array.from({ length: 42 }).map((_, i) => (
              <div key={i} className="calendar-cell p-2">
                <Skeleton className="h-4 w-8 mb-2" />
                <Skeleton className="h-3 w-full mb-1" />
                <Skeleton className="h-3 w-3/4" />
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      {/* Days of Week Header */}
      <div className="bg-[hsl(var(--google-light-gray))]">
        <div className="calendar-grid">
          {['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'].map(day => (
            <div key={day} className="px-1 py-0.5 text-center text-xs font-medium text-[hsl(var(--google-gray))]">
              {day}
            </div>
          ))}
        </div>
      </div>
      {/* Calendar Grid */}
      <div className="flex-1 overflow-hidden">
        <div className="calendar-grid h-full">
          {monthDays.map((date, index) => {
            const dayEvents = getEventsForDate(date);
            const isCurrentMonth = date.getMonth() === currentDate.getMonth() && date.getFullYear() === currentDate.getFullYear();
            const isTodayDate = isToday(date);
            
            return (
              <div 
                key={index} 
                className={`calendar-cell p-0.5 flex flex-col justify-start pt-[0px] pb-[0px] ${
                  isTodayDate ? 'bg-amber-200' : 'bg-white'
                }`}
                data-testid={isTodayDate ? 'today-cell' : undefined}
              >
                <div className={`text-xs mb-0 px-1 ${
                  isCurrentMonth 
                    ? isTodayDate 
                      ? 'font-bold text-[hsl(var(--google-blue))]'
                      : 'font-medium text-black'
                    : 'font-normal text-gray-300 opacity-60'
                }`}>
                  {date.getDate()}
                </div>
                <div className="flex flex-col flex-1 px-0.5">
                  <div className="space-y-0.5 overflow-hidden">
                    {dayEvents.slice(0, 5).map((event) => (
                      <EventItem key={event.id} event={event} compact onClick={onEventClick} />
                    ))}
                    
                    {/* Show more indicator - inline with events */}
                    {dayEvents.length > 5 && (
                      <div className="flex items-center justify-between bg-blue-100 border border-blue-300 rounded px-1 py-0.5 mt-0">
                        <div className="text-xs text-blue-700 font-medium">
                          +{dayEvents.length - 5}
                        </div>
                        <button 
                          onClick={(e) => {
                            e.stopPropagation();
                            handleShowMoreEvents(date);
                          }}
                          className="p-0.5 hover:bg-blue-200 rounded transition-colors flex-shrink-0"
                          aria-label={`Show all ${dayEvents.length} events for ${date.toLocaleDateString()}`}
                        >
                          <ChevronDown className="h-2 w-2 text-blue-700" />
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
      {/* Day Events Dialog */}
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
