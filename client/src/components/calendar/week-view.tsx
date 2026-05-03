import { useMemo, useRef, useEffect } from "react";
import { EventItem } from "./event-item";
import { Skeleton } from "@/components/ui/skeleton";
import { getWeekDays, isToday, formatTime } from "@/lib/date-utils";
import {
  getEventPosition as computeEventPosition,
  calculateEventLayout as computeEventLayout,
} from "@/lib/calendar-layout";
import type { CalendarEvent } from "@shared/schema";

interface WeekViewProps {
  currentDate: Date;
  events: CalendarEvent[];
  isLoading: boolean;
  enabledCalendars?: Set<string>;
  onEventClick?: (event: CalendarEvent) => void;
}

const timeSlots = Array.from({ length: 24 }, (_, i) => {
  const hour = i === 0 ? 12 : i > 12 ? i - 12 : i;
  const ampm = i < 12 ? 'AM' : 'PM';
  return `${hour} ${ampm}`;
});

export function WeekView({ currentDate, events, isLoading, enabledCalendars, onEventClick }: WeekViewProps) {
  const weekDays = useMemo(() => getWeekDays(currentDate), [currentDate]);
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  const TIME_SLOT_HEIGHT = 65; // Height in pixels for each hour slot (12 hours visible)

  // Auto-scroll to 7 AM when loading completes and scroll container exists
  useEffect(() => {
    if (!isLoading && scrollContainerRef.current) {
      const scrollPosition = 7 * TIME_SLOT_HEIGHT; // Scroll to 7 AM
      scrollContainerRef.current.scrollTop = scrollPosition;
    }
  }, [isLoading]);
  
  // Memoize events by day to avoid re-filtering on every render (energy optimization)
  const eventsByDay = useMemo(() => {
    const eventsMap = new Map<string, CalendarEvent[]>();
    
    // Pre-filter by enabled calendars once
    const filteredEvents = enabledCalendars && enabledCalendars.size > 0
      ? events.filter(event => enabledCalendars.has(event.calendarId))
      : events;
    
    weekDays.forEach(date => {
      const dateKey = date.toDateString();
      const dayEvents = filteredEvents.filter(event => {
        const eventStart = new Date(event.startTime);
        const eventEnd = new Date(event.endTime);
        return (
          eventStart.toDateString() === dateKey ||
          (eventStart <= date && eventEnd >= date)
        );
      });
      eventsMap.set(dateKey, dayEvents);
    });
    
    return eventsMap;
  }, [events, enabledCalendars, weekDays]);
  
  const getEventsForDay = (date: Date) => {
    return eventsByDay.get(date.toDateString()) || [];
  };

  // Get all-day events for a specific day
  const getAllDayEventsForDay = (date: Date) => {
    const dayEvents = getEventsForDay(date);
    return dayEvents.filter(event => event.isAllDay);
  };

  // Get timed (non-all-day) events for a day
  const getTimedEventsForDay = (date: Date) => {
    const dayEvents = getEventsForDay(date);
    return dayEvents.filter(event => !event.isAllDay);
  };

  // Position + layout helpers live in @/lib/calendar-layout, shared with day-view.
  const getEventPosition = (event: CalendarEvent, date: Date) =>
    computeEventPosition(event, date, TIME_SLOT_HEIGHT);

  const calculateEventLayout = (timedEvents: CalendarEvent[], currentEvent: CalendarEvent) =>
    computeEventLayout(timedEvents, currentEvent);

  const getCurrentTimePosition = () => {
    const now = new Date();
    const hours = now.getHours();
    const minutes = now.getMinutes();
    return (hours * 60 + minutes) / (24 * 60) * 100;
  };

  if (isLoading) {
    return (
      <div className="flex flex-col h-full overflow-hidden">
        {/* Fixed Week Header */}
        <div className="flex bg-white border-b border-border flex-shrink-0 z-10">
          <div className="w-16 bg-[hsl(var(--google-light-gray))] border-r border-border flex-shrink-0 h-12"></div>
          {Array.from({ length: 7 }).map((_, i) => (
            <div key={i} className="flex-1 text-center py-3 border-r border-border bg-[hsl(var(--google-light-gray))]">
              <Skeleton className="h-4 w-16 mx-auto" />
            </div>
          ))}
        </div>
        
        {/* Scrollable Content - matches actual content structure */}
        <div className="flex w-full flex-1 overflow-y-auto overflow-x-hidden">
          {/* Time Column */}
          <div className="w-16 bg-[hsl(var(--google-light-gray))] border-r border-border flex-shrink-0">
            {timeSlots.map((time, i) => (
              <div key={i} className="flex items-center justify-start text-xs text-muted-foreground px-1 border-b border-border" style={{height: '65px'}}>
                {time}
              </div>
            ))}
          </div>
          
          {/* Events Grid */}
          <div className="flex-1 flex">
            {Array.from({ length: 7 }).map((_, i) => (
              <div key={i} className="flex-1 border-r border-border overflow-x-hidden" style={{ minWidth: 0 }}>
                {timeSlots.map((_, j) => (
                  <div key={j} className="time-slot">
                    {j % 4 === 0 && (
                      <Skeleton className="h-8 w-3/4 m-1 rounded" />
                    )}
                  </div>
                ))}
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Fixed Week Header */}
      <div className="flex bg-white border-b border-border flex-shrink-0 z-10">
        <div className="w-16 bg-[hsl(var(--google-light-gray))] border-r border-border flex-shrink-0 h-12"></div>
        {weekDays.map((date, i) => {
          const isTodayDate = isToday(date);
          return (
            <div 
              key={i} 
              className={`flex-1 text-center py-3 text-sm font-medium border-r border-border bg-[hsl(var(--google-light-gray))] ${
                isTodayDate ? 'bg-blue-50 text-[hsl(var(--google-blue))]' : ''
              }`}
            >
              {date.toLocaleDateString('en-US', { weekday: 'short' })} {date.getDate()}
            </div>
          );
        })}
      </div>

      {/* All-Day Events Section */}
      {weekDays.some(date => getAllDayEventsForDay(date).length > 0) && (
        <div className="flex bg-white border-b border-border flex-shrink-0">
          <div className="w-16 bg-[hsl(var(--google-light-gray))] border-r border-border flex-shrink-0 flex items-center justify-center">
            <span className="text-xs text-muted-foreground">All day</span>
          </div>
          {weekDays.map((date, i) => {
            const allDayEvents = getAllDayEventsForDay(date);
            const isTodayDate = isToday(date);
            return (
              <div 
                key={i} 
                className={`flex-1 border-r border-border p-1 min-h-[40px] overflow-hidden ${
                  isTodayDate ? 'bg-blue-50/50' : ''
                }`}
                style={{ minWidth: 0 }}
              >
                {allDayEvents.map(event => (
                  <EventItem 
                    key={event.id} 
                    event={event} 
                    compact 
                    onClick={onEventClick}
                  />
                ))}
              </div>
            );
          })}
        </div>
      )}

      {/* Scrollable Content - single scroll container for time + events */}
      <div 
        ref={scrollContainerRef}
        className="flex-1 overflow-y-auto overflow-x-hidden scrollbar-thin scrollbar-thumb-gray-400 scrollbar-track-gray-100"
      >
        {/* Inner container - flex row with fixed height based on time slots */}
        <div className="flex w-full" style={{ height: `${24 * TIME_SLOT_HEIGHT}px` }}>
          {/* Time Column */}
          <div className="w-16 bg-[hsl(var(--google-light-gray))] border-r border-border flex-shrink-0 flex flex-col">
            {timeSlots.map((time, i) => (
              <div key={i} className="flex items-center justify-start text-xs text-muted-foreground px-1 border-b border-border flex-shrink-0" style={{height: `${TIME_SLOT_HEIGHT}px`}}>
                {time}
              </div>
            ))}
          </div>
          
          {/* Events Grid - day columns stretch to match time column height */}
          <div className="flex-1 flex">
            {weekDays.map((date, dayIndex) => {
              const timedEvents = getTimedEventsForDay(date);
              const isTodayDate = isToday(date);
              
              return (
                <div 
                  key={dayIndex} 
                  className={`flex-1 border-r border-border relative ${
                    isTodayDate ? 'bg-blue-50' : ''
                  }`}
                  style={{ minWidth: 0 }}
                >
                    {/* Time slot grid lines - using background gradient */}
                    <div 
                      className="absolute inset-0"
                      style={{
                        backgroundImage: `repeating-linear-gradient(
                          to bottom,
                          transparent 0px,
                          transparent ${TIME_SLOT_HEIGHT - 1}px,
                          hsl(var(--border)) ${TIME_SLOT_HEIGHT - 1}px,
                          hsl(var(--border)) ${TIME_SLOT_HEIGHT}px
                        )`,
                        backgroundSize: `100% ${TIME_SLOT_HEIGHT}px`
                      }}
                    />
                    
                    {/* Events - absolutely positioned relative to day column */}
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
                          layout={{
                            ...layout, 
                            height: `${position.height}px`,
                            top: `${position.top}px`
                          }}
                        />
                      );
                    })}
                    
                    {/* Current time indicator */}
                    {isTodayDate && (
                      <div 
                        className="current-time-indicator"
                        style={{ top: `${getCurrentTimePosition()}%` }}
                      />
                    )}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
