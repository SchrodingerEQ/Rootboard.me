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
                  {timeSlots.map((_, timeIndex) => (
                    <div key={timeIndex} className="time-slot">
                      {/* Events for this time slot */}
                      {dayEvents
                        .filter(event => {
                          const eventHour = new Date(event.startTime).getHours();
                          return eventHour === timeIndex;
                        })
                        .map(event => (
                          <EventItem key={event.id} event={event} timeSlot onClick={onEventClick} />
                        ))
                      }
                    </div>
                  ))}
                  
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
