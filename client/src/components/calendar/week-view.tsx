import { useMemo, useRef, useEffect } from "react";
import { EventItem } from "./event-item";
import { Skeleton } from "@/components/ui/skeleton";
import { getWeekDays, isToday, formatTime } from "@/lib/date-utils";
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

  // Get timed (non-all-day) events for a specific time slot
  const getEventsForTimeSlot = (date: Date, timeIndex: number) => {
    const dayEvents = getEventsForDay(date);
    return dayEvents.filter(event => {
      // Skip all-day events - they go in the all-day section
      if (event.isAllDay) return false;
      
      const eventStart = new Date(event.startTime);
      const eventStartHour = eventStart.getHours();
      
      // Only show event in its starting time slot
      return eventStartHour === timeIndex;
    });
  };

  const getEventHeight = (event: CalendarEvent, timeIndex: number) => {
    const eventStart = new Date(event.startTime);
    const eventEnd = new Date(event.endTime);
    const eventStartHour = eventStart.getHours();
    const eventEndHour = eventEnd.getHours();
    
    // Calculate how many time slots this event spans
    const duration = Math.max(1, eventEndHour - eventStartHour);
    return duration * TIME_SLOT_HEIGHT; // 65px per time slot
  };

  const getOverlappingEventsForTimeSlot = (date: Date, timeIndex: number, currentEvent: CalendarEvent) => {
    const dayEvents = getEventsForDay(date).filter(event => 
      // Filter out all-day events and apply calendar filter
      !event.isAllDay && (!enabledCalendars || enabledCalendars.has(event.calendarId))
    );
    
    // Get all timed events that overlap with the current time slot
    const timeSlotEvents = dayEvents.filter(event => {
      const eventStart = new Date(event.startTime);
      const eventEnd = new Date(event.endTime);
      const eventStartHour = eventStart.getHours();
      const eventEndHour = eventEnd.getHours();
      
      return eventStartHour <= timeIndex && eventEndHour > timeIndex;
    });
    
    // Find all events that have any time overlap with the current event
    const currentEventStart = new Date(currentEvent.startTime);
    const currentEventEnd = new Date(currentEvent.endTime);
    
    const overlappingEvents = timeSlotEvents.filter(event => {
      const eventStart = new Date(event.startTime);
      const eventEnd = new Date(event.endTime);
      
      // Check if events overlap in time at all
      return currentEventStart < eventEnd && currentEventEnd > eventStart;
    });
    
    return overlappingEvents.length > 0 ? overlappingEvents : [currentEvent];
  };

  const calculateEventLayout = (allOverlappingEvents: CalendarEvent[], currentEvent: CalendarEvent) => {
    if (allOverlappingEvents.length === 1) {
      return { width: '100%', left: '0%', zIndex: 1 };
    }
    
    // Sort events by start time, then by duration (longer events first)
    const sortedEvents = [...allOverlappingEvents].sort((a, b) => {
      const startDiff = new Date(a.startTime).getTime() - new Date(b.startTime).getTime();
      if (startDiff !== 0) return startDiff;
      
      const aDuration = new Date(a.endTime).getTime() - new Date(a.startTime).getTime();
      const bDuration = new Date(b.endTime).getTime() - new Date(b.startTime).getTime();
      return bDuration - aDuration; // Longer events first
    });
    
    const eventIndex = sortedEvents.findIndex(e => e?.id === currentEvent?.id);
    const totalEvents = sortedEvents.length;
    
    // Calculate width and position with better spacing
    const availableWidth = 98; // Leave 2% for margins
    const eventWidth = availableWidth / totalEvents;
    const leftOffset = (eventIndex * eventWidth) + 1; // 1% left margin
    
    return {
      width: `${Math.max(eventWidth - 0.5, 15)}%`, // Minimum 15% width with small gap
      left: `${leftOffset}%`,
      zIndex: totalEvents - eventIndex // Earlier/longer events have higher z-index
    };
  };

  const getCurrentTimePosition = () => {
    const now = new Date();
    const hours = now.getHours();
    const minutes = now.getMinutes();
    return (hours * 60 + minutes) / (24 * 60) * 100;
  };

  if (isLoading) {
    return (
      <div className="flex h-full overflow-hidden">
        {/* Time Column */}
        <div className="w-16 bg-[hsl(var(--google-light-gray))] border-r border-border flex-shrink-0">
          <div className="h-12 border-b border-border"></div>
          {timeSlots.map((time, i) => (
            <div key={i} className="flex items-center justify-start text-xs text-muted-foreground px-1 border-b border-border" style={{height: '65px'}}>
              {time}
            </div>
          ))}
        </div>
        
        {/* Loading Days Grid */}
        <div className="flex-1 overflow-hidden">
          <div className="h-12 flex border-b border-border bg-[hsl(var(--google-light-gray))]">
            {Array.from({ length: 7 }).map((_, i) => (
              <div key={i} className="flex-1 text-center py-3 border-r border-border">
                <Skeleton className="h-4 w-16 mx-auto" />
              </div>
            ))}
          </div>
          
          <div className="flex-1 overflow-y-auto">
            <div className="flex">
              {Array.from({ length: 7 }).map((_, i) => (
                <div key={i} className="flex-1 border-r border-border">
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
                className={`flex-1 border-r border-border p-1 min-h-[40px] ${
                  isTodayDate ? 'bg-blue-50/50' : ''
                }`}
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

      {/* Scrollable Content */}
      <div 
        ref={scrollContainerRef}
        className="flex w-full flex-1 overflow-y-auto scrollbar-thin scrollbar-thumb-gray-400 scrollbar-track-gray-100"
      >
        {/* Time Column */}
        <div className="w-16 bg-[hsl(var(--google-light-gray))] border-r border-border flex-shrink-0">
          {timeSlots.map((time, i) => (
            <div key={i} className="flex items-center justify-start text-xs text-muted-foreground px-1 border-b border-border" style={{height: '65px'}}>
              {time}
            </div>
          ))}
        </div>
        
        {/* Events Grid */}
        <div className="flex-1 flex relative">
          {weekDays.map((date, dayIndex) => {
            const dayEvents = getEventsForDay(date);
            const isTodayDate = isToday(date);
            
            return (
              <div 
                key={dayIndex} 
                className={`flex-1 border-r border-border relative overflow-hidden ${
                  isTodayDate ? 'bg-blue-50' : ''
                }`}
              >
                  {timeSlots.map((_, timeIndex) => {
                    const timeSlotEvents = getEventsForTimeSlot(date, timeIndex);
                    
                    return (
                      <div key={timeIndex} className="time-slot relative">
                        {/* Events for this time slot */}
                        {timeSlotEvents.map(event => {
                          const allOverlappingEvents = getOverlappingEventsForTimeSlot(date, timeIndex, event);
                          const layout = calculateEventLayout(allOverlappingEvents, event);
                          const height = getEventHeight(event, timeIndex);
                          return (
                            <EventItem 
                              key={event.id} 
                              event={event} 
                              timeSlot 
                              onClick={onEventClick}
                              layout={{...layout, height: `${height}px`}}
                            />
                          );
                        })}
                      </div>
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
  );
}
