import { useMemo } from "react";
import { EventItem } from "./event-item";
import { Skeleton } from "@/components/ui/skeleton";
import { isToday } from "@/lib/date-utils";
import type { CalendarEvent } from "@shared/schema";

interface DayViewProps {
  currentDate: Date;
  events: CalendarEvent[];
  isLoading: boolean;
}

const timeSlots = Array.from({ length: 24 }, (_, i) => {
  const hour = i === 0 ? 12 : i > 12 ? i - 12 : i;
  const ampm = i < 12 ? 'AM' : 'PM';
  return `${hour} ${ampm}`;
});

export function DayView({ currentDate, events, isLoading }: DayViewProps) {
  const dayEvents = useMemo(() => {
    return events.filter(event => {
      const eventDate = new Date(event.startTime);
      return eventDate.toDateString() === currentDate.toDateString();
    });
  }, [events, currentDate]);

  const getCurrentTimePosition = () => {
    const now = new Date();
    if (!isToday(currentDate)) return -1;
    
    const hours = now.getHours();
    const minutes = now.getMinutes();
    return (hours * 60 + minutes) / (24 * 60) * 100;
  };

  if (isLoading) {
    return (
      <div className="flex h-full">
        {/* Time Column */}
        <div className="w-20 bg-[hsl(var(--google-light-gray))] border-r border-border">
          {timeSlots.map((time, i) => (
            <div key={i} className="text-xs text-muted-foreground px-2 py-4 border-b border-border">
              {time}
            </div>
          ))}
        </div>
        
        {/* Loading Day Column */}
        <div className="flex-1 relative">
          <div className="h-12 bg-blue-50 border-b border-border flex items-center justify-center">
            <Skeleton className="h-6 w-48" />
          </div>
          
          <div className="overflow-y-auto">
            {timeSlots.map((_, i) => (
              <div key={i} className="time-slot">
                {i % 3 === 0 && (
                  <Skeleton className="h-16 w-5/6 m-2 rounded-lg" />
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
    <div className="flex h-full">
      {/* Time Column */}
      <div className="w-20 bg-[hsl(var(--google-light-gray))] border-r border-border">
        {timeSlots.map((time, i) => (
          <div key={i} className="text-xs text-muted-foreground px-2 py-4 border-b border-border">
            {time}
          </div>
        ))}
      </div>
      
      {/* Single Day Column */}
      <div className="flex-1 relative">
        {/* Day Header */}
        <div className={`h-12 border-b border-border flex items-center justify-center ${
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
        
        {/* Day Time Slots */}
        <div className="overflow-y-auto relative">
          {timeSlots.map((_, timeIndex) => {
            const timeEvents = dayEvents.filter(event => {
              const eventStart = new Date(event.startTime);
              const eventEnd = new Date(event.endTime);
              const eventStartHour = eventStart.getHours();
              const eventEndHour = eventEnd.getHours();
              
              // Show event in the time slot where it starts
              return eventStartHour === timeIndex;
            });

            return (
              <div key={timeIndex} className="time-slot relative min-h-[60px] border-b border-border/30">
                {timeEvents.map(event => (
                  <EventItem key={event.id} event={event} detailed timeSlot />
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
