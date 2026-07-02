import { useMemo, useRef, useEffect } from "react";
import { EventItem } from "./event-item";
import { Skeleton } from "@/components/ui/skeleton";
import { isToday } from "@/lib/date-utils";
import {
  getEventPosition as computeEventPosition,
  calculateEventLayout as computeEventLayout,
} from "@/lib/calendar-layout";
import type { CalendarEvent } from "@shared/schema";

interface DayViewProps {
  currentDate: Date;
  events: CalendarEvent[];
  isLoading: boolean;
  onEventClick?: (event: CalendarEvent) => void;
  enabledCalendars?: Set<string>;
}

const timeSlots = Array.from({ length: 24 }, (_, i) => {
  const hour = i === 0 ? 12 : i > 12 ? i - 12 : i;
  const ampm = i < 12 ? 'AM' : 'PM';
  return `${hour} ${ampm}`;
});

const GRID_LINE = '#ededed';

export function DayView({ currentDate, events, isLoading, onEventClick, enabledCalendars }: DayViewProps) {
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const TIME_SLOT_HEIGHT = 65;

  const dayEvents = useMemo(() => {
    const filteredEvents = enabledCalendars && enabledCalendars.size > 0
      ? events.filter(event => enabledCalendars.has(event.calendarId))
      : events;
    return filteredEvents.filter(event => {
      const eventStart = new Date(event.startTime);
      const eventEnd = new Date(event.endTime);
      return eventStart.toDateString() === currentDate.toDateString() || (eventStart <= currentDate && eventEnd >= currentDate);
    });
  }, [events, currentDate, enabledCalendars]);

  const allDayEvents = useMemo(() => dayEvents.filter(e => e.isAllDay), [dayEvents]);
  const timedEvents = useMemo(() => dayEvents.filter(e => !e.isAllDay), [dayEvents]);

  const getEventPosition = (event: CalendarEvent) => computeEventPosition(event, currentDate, TIME_SLOT_HEIGHT, 22);
  const calculateEventLayout = (allEvents: CalendarEvent[], currentEvent: CalendarEvent) => computeEventLayout(allEvents, currentEvent);

  useEffect(() => {
    if (!isLoading && scrollContainerRef.current) {
      scrollContainerRef.current.scrollTop = 7 * TIME_SLOT_HEIGHT;
    }
  }, [isLoading]);

  const getCurrentTimePosition = () => {
    const now = new Date();
    if (!isToday(currentDate)) return -1;
    return (now.getHours() * 60 + now.getMinutes()) / (24 * 60) * 100;
  };

  const gridLineBg = {
    backgroundImage: `repeating-linear-gradient(to bottom, transparent 0px, transparent ${TIME_SLOT_HEIGHT - 1}px, ${GRID_LINE} ${TIME_SLOT_HEIGHT - 1}px, ${GRID_LINE} ${TIME_SLOT_HEIGHT}px)`,
    backgroundSize: `100% ${TIME_SLOT_HEIGHT}px`,
  };

  if (isLoading) {
    return (
      <div className="flex flex-col h-full overflow-hidden bg-[var(--rb-canvas)]">
        <div className="flex bg-white flex-shrink-0 z-10 border-b border-[var(--border)]">
          <div className="w-20 flex-shrink-0 h-14" />
          <div className="flex-1 h-14 flex items-center justify-center"><Skeleton className="h-6 w-48 rounded-md" /></div>
        </div>
        <div className="flex w-full flex-1 overflow-y-auto">
          <div className="w-20 flex-shrink-0">
            {timeSlots.map((time, i) => (
              <div key={i} className="flex items-start justify-end text-xs font-bold text-[var(--rb-faint)] px-2 pt-1" style={{ height: 65 }}>{time}</div>
            ))}
          </div>
          <div className="flex-1 relative bg-white">
            {timeSlots.map((_, i) => (
              <div key={i} className="time-slot">{i % 3 === 0 && <Skeleton className="h-12 w-5/6 m-2 rounded-xl" />}</div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  const isTodayDate = isToday(currentDate);
  const timePosition = getCurrentTimePosition();

  return (
    <div className="flex flex-col h-full overflow-hidden bg-[var(--rb-canvas)]">
      {/* Fixed Day Header */}
      <div className="flex bg-white flex-shrink-0 z-10 border-b border-[var(--border)]">
        <div className="w-20 flex-shrink-0 h-14" />
        <div className="flex-1 h-14 flex items-center justify-center gap-3" style={{ background: isTodayDate ? 'var(--rb-today-wash)' : 'transparent' }}>
          {isTodayDate && <span className="inline-flex items-center justify-center rounded-full text-base font-extrabold text-white" style={{ width: 34, height: 34, background: 'var(--rb-accent)' }}>{currentDate.getDate()}</span>}
          <h3 className="text-xl font-extrabold text-[#2b3038]">
            {currentDate.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}
          </h3>
        </div>
      </div>

      {/* All-Day Events */}
      {allDayEvents.length > 0 && (
        <div className="flex bg-white flex-shrink-0 border-b border-[var(--border)]">
          <div className="w-20 flex-shrink-0 flex items-center justify-end pr-2">
            <span className="text-[11px] font-bold uppercase tracking-wide text-[var(--rb-faint)]">All&nbsp;day</span>
          </div>
          <div className="flex-1 p-2 min-h-[46px]" style={{ background: isTodayDate ? 'var(--rb-today-col-wash)' : 'transparent' }}>
            <div className="flex flex-wrap gap-1.5">
              {allDayEvents.map(event => <EventItem key={event.id} event={event} compact onClick={onEventClick} />)}
            </div>
          </div>
        </div>
      )}

      {/* Scrollable time grid */}
      <div ref={scrollContainerRef} className="flex-1 overflow-y-auto overflow-x-hidden scrollbar-thin">
        <div className="flex w-full" style={{ height: `${24 * TIME_SLOT_HEIGHT}px` }}>
          <div className="w-20 flex-shrink-0 flex flex-col">
            {timeSlots.map((time, i) => (
              <div key={i} className="flex items-start justify-end text-xs font-bold text-[var(--rb-faint)] px-2 flex-shrink-0" style={{ height: TIME_SLOT_HEIGHT, transform: 'translateY(-7px)' }}>{time}</div>
            ))}
          </div>
          <div className="flex-1 flex">
            <div className="flex-1 relative" style={{ minWidth: 0, background: isTodayDate ? 'var(--rb-today-col-wash)' : '#ffffff' }}>
              <div className="absolute inset-0" style={gridLineBg} />
              {timedEvents.map(event => {
                const position = getEventPosition(event);
                if (!position) return null;
                const layout = calculateEventLayout(timedEvents, event);
                return (
                  <EventItem
                    key={event.id}
                    event={event}
                    timeSlot
                    onClick={onEventClick}
                    layout={{ ...layout, height: `${position.height}px`, top: `${position.top}px` }}
                  />
                );
              })}
              {timePosition >= 0 && <div className="current-time-indicator" style={{ top: `${timePosition}%` }} />}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
