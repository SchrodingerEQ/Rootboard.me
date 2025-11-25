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
}

const timeSlots = Array.from({ length: 24 }, (_, i) => {
  const hour = i === 0 ? 12 : i > 12 ? i - 12 : i;
  const ampm = i < 12 ? 'AM' : 'PM';
  return `${hour} ${ampm}`;
});

export function DayView({ currentDate, events, isLoading, onEventClick }: DayViewProps) {
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const TIME_SLOT_HEIGHT = 65; // Height in pixels for each hour slot (12 hours visible)

  const dayEvents = useMemo(() => {
    return events.filter(event => {
      const eventStart = new Date(event.startTime);
      const eventEnd = new Date(event.endTime);
      // Include events that start on this day OR span across this day
      return (
        eventStart.toDateString() === currentDate.toDateString() ||
        (eventStart <= currentDate && eventEnd >= currentDate)
      );
    });
  }, [events, currentDate]);

  // Separate all-day events from timed events
  const allDayEvents = useMemo(() => {
    return dayEvents.filter(event => event.isAllDay);
  }, [dayEvents]);

  const timedEvents = useMemo(() => {
    return dayEvents.filter(event => !event.isAllDay);
  }, [dayEvents]);

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

      {/* Scrollable Content */}
      <div 
        ref={scrollContainerRef}
        className="flex w-full flex-1 overflow-y-auto scrollbar-thin scrollbar-thumb-gray-400 scrollbar-track-gray-100"
      >
        {/* Time Column */}
        <div className="w-20 bg-[hsl(var(--google-light-gray))] border-r border-border flex-shrink-0">
          {timeSlots.map((time, i) => (
            <div key={i} className="flex items-center justify-start text-xs text-muted-foreground px-2 border-b border-border" style={{height: '65px'}}>
              {time}
            </div>
          ))}
        </div>
        
        {/* Day Time Slots */}
        <div className="flex-1 relative">
          {timeSlots.map((_, timeIndex) => {
            const slotEvents = timedEvents.filter(event => {
              const eventStart = new Date(event.startTime);
              const eventStartHour = eventStart.getHours();
              
              // Show event in the time slot where it starts
              return eventStartHour === timeIndex;
            });

            return (
              <div key={timeIndex} className="time-slot relative">
                {slotEvents.map(event => (
                  <EventItem key={event.id} event={event} detailed timeSlot onClick={onEventClick} />
                ))}
              </div>
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
  );
}
