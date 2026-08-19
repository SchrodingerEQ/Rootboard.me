import { useMemo, useRef, useEffect } from "react";
import { EventItem } from "./event-item";
import { Skeleton } from "@/components/ui/skeleton";
import { getWeekDays, isToday } from "@/lib/date-utils";
import {
  getEventPosition as computeEventPosition,
  calculateEventLayout as computeEventLayout,
} from "@/lib/calendar-layout";
import { useWeather, dailyKey, type WeatherDaily } from "@/hooks/use-weather";
import type { CalendarEvent } from "@shared/schema";

interface WeekViewProps {
  currentDate: Date;
  events: CalendarEvent[];
  isLoading: boolean;
  onEventClick?: (event: CalendarEvent) => void;
}

const timeSlots = Array.from({ length: 24 }, (_, i) => {
  const hour = i === 0 ? 12 : i > 12 ? i - 12 : i;
  const ampm = i < 12 ? 'AM' : 'PM';
  return `${hour} ${ampm}`;
});

const GRID_LINE = '#ededed';

export function WeekView({ currentDate, events, isLoading, onEventClick }: WeekViewProps) {
  const weekDays = useMemo(() => getWeekDays(currentDate), [currentDate]);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const TIME_SLOT_HEIGHT = 65;

  useEffect(() => {
    if (!isLoading && scrollContainerRef.current) {
      scrollContainerRef.current.scrollTop = 7 * TIME_SLOT_HEIGHT;
    }
  }, [isLoading]);

  const eventsByDay = useMemo(() => {
    const eventsMap = new Map<string, CalendarEvent[]>();

    weekDays.forEach(date => {
      const dateKey = date.toDateString();
      const dayEvents = events.filter(event => {
        const eventStart = new Date(event.startTime);
        const eventEnd = new Date(event.endTime);
        return eventStart.toDateString() === dateKey || (eventStart <= date && eventEnd >= date);
      });
      eventsMap.set(dateKey, dayEvents);
    });
    return eventsMap;
  }, [events, weekDays]);

  const getEventsForDay = (date: Date) => eventsByDay.get(date.toDateString()) || [];
  const getAllDayEventsForDay = (date: Date) => getEventsForDay(date).filter(e => e.isAllDay);
  const getTimedEventsForDay = (date: Date) => getEventsForDay(date).filter(e => !e.isAllDay);

  const getEventPosition = (event: CalendarEvent, date: Date) => computeEventPosition(event, date, TIME_SLOT_HEIGHT);
  const calculateEventLayout = (timedEvents: CalendarEvent[], currentEvent: CalendarEvent) => computeEventLayout(timedEvents, currentEvent);

  const getCurrentTimePosition = () => {
    const now = new Date();
    return (now.getHours() * 60 + now.getMinutes()) / (24 * 60) * 100;
  };

  const gridLineBg = (h: number) => ({
    backgroundImage: `repeating-linear-gradient(to bottom, transparent 0px, transparent ${h - 1}px, ${GRID_LINE} ${h - 1}px, ${GRID_LINE} ${h}px)`,
    backgroundSize: `100% ${h}px`,
  });

  const weather = useWeather();
  const dailyByDate = useMemo(() => {
    const map = new Map<string, WeatherDaily>();
    for (const d of weather.daily) map.set(d.date, d);
    return map;
  }, [weather.daily]);

  // ----- Day header (weekday + date badge + optional hi/lo) -----
  const DayHeader = ({ date }: { date: Date }) => {
    const todayDate = isToday(date);
    const forecast = dailyByDate.get(dailyKey(date));
    return (
      <div
        className="flex-1 flex flex-col items-center gap-1 py-2"
        style={{ background: todayDate ? 'var(--rb-today-wash)' : 'transparent' }}
      >
        <span className="text-sm font-bold uppercase tracking-wide text-[var(--rb-muted)]">
          {date.toLocaleDateString('en-US', { weekday: 'short' })}
        </span>
        <span
          className="inline-flex items-center justify-center rounded-full text-xl font-extrabold"
          style={{
            width: 38, height: 38,
            background: todayDate ? 'var(--rb-accent)' : 'transparent',
            color: todayDate ? '#fff' : '#2b3038',
          }}
        >
          {date.getDate()}
        </span>
        {forecast && (
          <span className="text-[13px] font-bold text-[var(--rb-faint)]" data-testid="week-hilo">
            {forecast.hi}°/{forecast.lo}°
          </span>
        )}
      </div>
    );
  };

  if (isLoading) {
    return (
      <div className="flex flex-col h-full overflow-hidden bg-[var(--rb-canvas)]">
        <div className="flex bg-white flex-shrink-0 z-10 border-b border-[var(--border)]">
          <div className="w-16 flex-shrink-0 h-16" />
          {Array.from({ length: 7 }).map((_, i) => (
            <div key={i} className="flex-1 text-center py-4"><Skeleton className="h-5 w-12 mx-auto rounded-md" /></div>
          ))}
        </div>
        <div className="flex w-full flex-1 overflow-y-auto">
          <div className="w-16 flex-shrink-0">
            {timeSlots.map((time, i) => (
              <div key={i} className="flex items-start justify-end text-xs font-bold text-[var(--rb-faint)] px-2 pt-1" style={{ height: 65 }}>{time}</div>
            ))}
          </div>
          <div className="flex-1 flex">
            {Array.from({ length: 7 }).map((_, i) => (
              <div key={i} className="flex-1 bg-white" style={{ minWidth: 0, marginLeft: 1 }}>
                {timeSlots.map((_, j) => (
                  <div key={j} className="time-slot">{j % 4 === 0 && <Skeleton className="h-8 w-3/4 m-1 rounded-lg" />}</div>
                ))}
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  const hasAllDay = weekDays.some(date => getAllDayEventsForDay(date).length > 0);

  return (
    <div className="flex flex-col h-full overflow-hidden bg-[var(--rb-canvas)]">
      {/* Fixed Week Header */}
      <div className="flex bg-white flex-shrink-0 z-10 border-b border-[var(--border)]">
        <div className="w-16 flex-shrink-0" />
        {weekDays.map((date, i) => <DayHeader key={i} date={date} />)}
      </div>

      {/* All-Day Events */}
      {hasAllDay && (
        <div className="flex bg-white flex-shrink-0 border-b border-[var(--border)]">
          <div className="w-16 flex-shrink-0 flex items-center justify-end pr-2">
            <span className="text-[11px] font-bold uppercase tracking-wide text-[var(--rb-faint)]">All&nbsp;day</span>
          </div>
          {weekDays.map((date, i) => {
            const allDayEvents = getAllDayEventsForDay(date);
            const todayDate = isToday(date);
            return (
              <div key={i} className="flex-1 p-1 min-h-[42px] flex flex-col gap-1" style={{ minWidth: 0, background: todayDate ? 'var(--rb-today-col-wash)' : 'transparent' }}>
                {allDayEvents.map(event => <EventItem key={event.id} event={event} compact onClick={onEventClick} />)}
              </div>
            );
          })}
        </div>
      )}

      {/* Scrollable time grid */}
      <div ref={scrollContainerRef} className="flex-1 overflow-y-auto overflow-x-hidden">
        <div className="flex w-full" style={{ height: `${24 * TIME_SLOT_HEIGHT}px` }}>
          <div className="w-16 flex-shrink-0 flex flex-col">
            {timeSlots.map((time, i) => (
              <div key={i} className="flex items-start justify-end text-xs font-bold text-[var(--rb-faint)] px-2 flex-shrink-0" style={{ height: TIME_SLOT_HEIGHT, transform: 'translateY(-7px)' }}>{time}</div>
            ))}
          </div>
          <div className="flex-1 flex">
            {weekDays.map((date, dayIndex) => {
              const timedEvents = getTimedEventsForDay(date);
              const todayDate = isToday(date);
              return (
                <div
                  key={dayIndex}
                  className="flex-1 relative"
                  style={{ minWidth: 0, marginLeft: 1, background: todayDate ? 'var(--rb-today-col-wash)' : '#ffffff' }}
                >
                  <div className="absolute inset-0" style={gridLineBg(TIME_SLOT_HEIGHT)} />
                  {timedEvents.map(event => {
                    const position = getEventPosition(event, date);
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
                  {todayDate && <div className="current-time-indicator" style={{ top: `${getCurrentTimePosition()}%` }} />}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
