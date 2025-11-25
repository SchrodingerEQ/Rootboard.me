import { useMemo, useRef, useEffect } from "react";
import { EventItem } from "./event-item";
import { Skeleton } from "@/components/ui/skeleton";
import { isToday } from "@/lib/date-utils";
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

export function DayView({ currentDate, events, isLoading, onEventClick, enabledCalendars }: DayViewProps) {
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const TIME_SLOT_HEIGHT = 65; // Height in pixels for each hour slot (12 hours visible)

  const dayEvents = useMemo(() => {
    // Pre-filter by enabled calendars
    const filteredEvents = enabledCalendars && enabledCalendars.size > 0
      ? events.filter(event => enabledCalendars.has(event.calendarId))
      : events;
    
    return filteredEvents.filter(event => {
      const eventStart = new Date(event.startTime);
      const eventEnd = new Date(event.endTime);
      // Include events that start on this day OR span across this day
      return (
        eventStart.toDateString() === currentDate.toDateString() ||
        (eventStart <= currentDate && eventEnd >= currentDate)
      );
    });
  }, [events, currentDate, enabledCalendars]);

  // Separate all-day events from timed events
  const allDayEvents = useMemo(() => {
    return dayEvents.filter(event => event.isAllDay);
  }, [dayEvents]);

  const timedEvents = useMemo(() => {
    return dayEvents.filter(event => !event.isAllDay);
  }, [dayEvents]);

  // Calculate event position (same approach as weekly view)
  const getEventPosition = (event: CalendarEvent): { top: number; height: number } | null => {
    const eventStart = new Date(event.startTime);
    const eventEnd = new Date(event.endTime);
    
    // Create day boundaries (midnight to midnight)
    const dayStart = new Date(currentDate);
    dayStart.setHours(0, 0, 0, 0);
    const dayEnd = new Date(currentDate);
    dayEnd.setHours(23, 59, 59, 999);
    
    // Clamp event times to this day's boundaries
    const clampedStart = eventStart < dayStart ? dayStart : eventStart;
    const clampedEnd = eventEnd > dayEnd ? dayEnd : eventEnd;
    
    // Skip if clamped range has no duration
    if (clampedEnd <= clampedStart) {
      return null;
    }
    
    // Calculate top position based on clamped start time
    const startHour = clampedStart.getHours();
    const startMinutes = clampedStart.getMinutes();
    const top = (startHour + startMinutes / 60) * TIME_SLOT_HEIGHT;
    
    // Calculate height based on clamped duration
    const endHour = clampedEnd.getHours();
    const endMinutes = clampedEnd.getMinutes();
    
    // Handle end-of-day case (23:59:59)
    const endPosition = endHour === 23 && endMinutes === 59 ? 24 : (endHour + endMinutes / 60);
    const durationHours = endPosition - (startHour + startMinutes / 60);
    const height = Math.max(durationHours * TIME_SLOT_HEIGHT, 22); // Minimum height for visibility
    
    return { top, height };
  };

  // Calculate overlapping event layouts (same approach as weekly view)
  const calculateEventLayout = (allEvents: CalendarEvent[], event: CalendarEvent) => {
    const eventStart = new Date(event.startTime);
    const eventEnd = new Date(event.endTime);
    
    const overlappingEvents = allEvents.filter(other => {
      if (other.id === event.id) return false;
      const otherStart = new Date(other.startTime);
      const otherEnd = new Date(other.endTime);
      return eventStart < otherEnd && eventEnd > otherStart;
    });
    
    const totalColumns = overlappingEvents.length + 1;
    const sortedEvents = [event, ...overlappingEvents].sort((a, b) => 
      new Date(a.startTime).getTime() - new Date(b.startTime).getTime()
    );
    const columnIndex = sortedEvents.indexOf(event);
    
    const width = `${100 / totalColumns}%`;
    const left = `${(columnIndex / totalColumns) * 100}%`;
    
    return { width, left };
  };

  // Auto-scroll to 7 AM when loading completes and scroll container exists
  useEffect(() => {
    if (!isLoading && scrollContainerRef.current) {
      const scrollPosition = 7 * TIME_SLOT_HEIGHT; // Scroll to 7 AM
      scrollContainerRef.current.scrollTop = scrollPosition;
    }
  }, [isLoading]);

  const getCurrentTimePosition = () => {
    const now = new Date();
    if (!isToday(currentDate)) return -1;
    
    const hours = now.getHours();
    const minutes = now.getMinutes();
    return (hours * 60 + minutes) / (24 * 60) * 100;
  };

  if (isLoading) {
    return (
      <div className="flex flex-col h-full overflow-hidden">
        {/* Fixed Day Header */}
        <div className="flex bg-white border-b border-border flex-shrink-0 z-10">
          <div className="w-20 bg-[hsl(var(--google-light-gray))] border-r border-border flex-shrink-0 h-12"></div>
          <div className="flex-1 h-12 bg-blue-50 border-b border-border flex items-center justify-center">
            <Skeleton className="h-6 w-48" />
          </div>
        </div>

        {/* Scrollable Content */}
        <div className="flex w-full flex-1 overflow-y-auto">
          {/* Time Column */}
          <div className="w-20 bg-[hsl(var(--google-light-gray))] border-r border-border flex-shrink-0">
            {timeSlots.map((time, i) => (
              <div key={i} className="flex items-center justify-start text-xs text-muted-foreground px-2 border-b border-border" style={{height: '65px'}}>
                {time}
              </div>
            ))}
          </div>
          
          {/* Loading Day Column */}
          <div className="flex-1 relative">
            {timeSlots.map((_, i) => (
              <div key={i} className="time-slot">
                {i % 3 === 0 && (
                  <Skeleton className="h-12 w-5/6 m-2 rounded-lg" />
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  const isTodayDate = isToday(currentDate);
  const timePosition = getCurrentTimePosition();

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Fixed Day Header */}
      <div className="flex bg-white border-b border-border flex-shrink-0 z-10">
        <div className="w-20 bg-[hsl(var(--google-light-gray))] border-r border-border flex-shrink-0 h-12"></div>
        <div className={`flex-1 h-12 border-b border-border flex items-center justify-center ${
          isTodayDate ? 'bg-blue-50' : 'bg-[hsl(var(--google-light-gray))]'
        }`}>
          <h3 className={`text-lg font-medium ${
            isTodayDate ? 'text-[hsl(var(--google-blue))]' : 'text-[hsl(var(--google-gray))]'
          }`}>
            {currentDate.toLocaleDateString('en-US', { 
              weekday: 'long',
              month: 'long', 
              day: 'numeric',
              year: 'numeric' 
            })}
          </h3>
        </div>
      </div>

      {/* All-Day Events Section */}
      {allDayEvents.length > 0 && (
        <div className="flex bg-white border-b border-border flex-shrink-0">
          <div className="w-20 bg-[hsl(var(--google-light-gray))] border-r border-border flex-shrink-0 flex items-center justify-center">
            <span className="text-xs text-muted-foreground">All day</span>
          </div>
          <div className={`flex-1 p-2 min-h-[44px] ${isTodayDate ? 'bg-blue-50/50' : ''}`}>
            <div className="flex flex-wrap gap-1">
              {allDayEvents.map(event => (
                <EventItem 
                  key={event.id} 
                  event={event} 
                  compact 
                  onClick={onEventClick}
                />
              ))}
            </div>
          </div>
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
          <div className="w-20 bg-[hsl(var(--google-light-gray))] border-r border-border flex-shrink-0 flex flex-col">
            {timeSlots.map((time, i) => (
              <div key={i} className="flex items-center justify-start text-xs text-muted-foreground px-2 border-b border-border flex-shrink-0" style={{height: `${TIME_SLOT_HEIGHT}px`}}>
                {time}
              </div>
            ))}
          </div>
          
          {/* Day Events Column - absolute positioning like weekly view */}
          <div 
            className={`flex-1 relative ${isTodayDate ? 'bg-blue-50' : ''}`}
            style={{ minWidth: 0 }}
          >
            {/* Time slot grid lines - using background gradient */}
            <div 
              className="absolute inset-0 pointer-events-none"
              style={{
                backgroundImage: `repeating-linear-gradient(
                  to bottom,
                  transparent 0px,
                  transparent ${TIME_SLOT_HEIGHT - 1}px,
                  hsl(var(--border)) ${TIME_SLOT_HEIGHT - 1}px,
                  hsl(var(--border)) ${TIME_SLOT_HEIGHT}px
                )`,
                backgroundSize: `100% ${TIME_SLOT_HEIGHT}px`,
                zIndex: 0
              }}
            />
            
            {/* Events - absolutely positioned with higher z-index */}
            {timedEvents.map((event, index) => {
              const position = getEventPosition(event);
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
                    top: `${position.top}px`,
                    zIndex: index + 10
                  }}
                />
              );
            })}
            
            {/* Current time indicator */}
            {timePosition >= 0 && (
              <div 
                className="current-time-indicator"
                style={{ top: `${timePosition}%` }}
              />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
