import { useMemo } from "react";
import { EventItem } from "./event-item";
import { Skeleton } from "@/components/ui/skeleton";
import { getWeekDays, isToday, formatTime } from "@/lib/date-utils";
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

export function WeekView({ currentDate, events, isLoading, onEventClick }: WeekViewProps) {
  const weekDays = useMemo(() => getWeekDays(currentDate), [currentDate]);
  
  const getEventsForDay = (date: Date) => {
    return events.filter(event => {
      const eventStart = new Date(event.startTime);
      const eventEnd = new Date(event.endTime);
      return (
        eventStart.toDateString() === date.toDateString() ||
        (eventStart <= date && eventEnd >= date)
      );
    });
  };

  const getEventsForTimeSlot = (date: Date, timeIndex: number) => {
    const dayEvents = getEventsForDay(date);
    return dayEvents.filter(event => {
      const eventStart = new Date(event.startTime);
      const eventEnd = new Date(event.endTime);
      const eventStartHour = eventStart.getHours();
      const eventEndHour = eventEnd.getHours();
      
      // Check if event spans this time slot
      return eventStartHour <= timeIndex && eventEndHour > timeIndex;
    });
  };

  const calculateEventLayout = (timeSlotEvents: any[], currentEvent: any) => {
    if (timeSlotEvents.length === 1) {
      return { width: '100%', left: '0%', zIndex: 1 };
    }
    
    // Sort events by start time, then by duration (longer events first)
    const sortedEvents = [...timeSlotEvents].sort((a, b) => {
      const startDiff = new Date(a.startTime).getTime() - new Date(b.startTime).getTime();
      if (startDiff !== 0) return startDiff;
      
      const aDuration = new Date(a.endTime).getTime() - new Date(a.startTime).getTime();
      const bDuration = new Date(b.endTime).getTime() - new Date(b.startTime).getTime();
      return bDuration - aDuration; // Longer events first
    });
    
    const eventIndex = sortedEvents.findIndex(e => e.id === currentEvent.id);
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
            <div key={i} className="flex items-center justify-start text-xs text-muted-foreground px-1 border-b border-border" style={{height: '30px'}}>
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
    <div className="flex h-full overflow-hidden">
      {/* Time Column */}
      <div className="w-16 bg-[hsl(var(--google-light-gray))] border-r border-border flex-shrink-0">
        <div className="h-12 border-b border-border"></div>
        {timeSlots.map((time, i) => (
          <div key={i} className="flex items-center justify-start text-xs text-muted-foreground px-1 border-b border-border" style={{height: '30px'}}>
            {time}
          </div>
        ))}
      </div>
      
      {/* Days Grid */}
      <div className="flex-1 overflow-hidden">
        {/* Week Header */}
        <div className="h-12 flex border-b border-border bg-[hsl(var(--google-light-gray))]">
          {weekDays.map((date, i) => {
            const isTodayDate = isToday(date);
            return (
              <div 
                key={i} 
                className={`flex-1 text-center py-3 text-sm font-medium border-r border-border ${
                  isTodayDate ? 'bg-blue-50 text-[hsl(var(--google-blue))]' : ''
                }`}
              >
                {date.toLocaleDateString('en-US', { weekday: 'short' })} {date.getDate()}
              </div>
            );
          })}
        </div>
        
        {/* Time Grid */}
        <div className="flex-1 overflow-y-auto">
          <div className="flex relative">
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
                          const layout = calculateEventLayout(timeSlotEvents, event);
                          return (
                            <EventItem 
                              key={event.id} 
                              event={event} 
                              timeSlot 
                              onClick={onEventClick}
                              layout={layout}
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
    </div>
  );
}
