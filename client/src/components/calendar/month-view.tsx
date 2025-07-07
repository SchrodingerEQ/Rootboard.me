import { useMemo } from "react";
import { EventItem } from "./event-item";
import { Skeleton } from "@/components/ui/skeleton";
import { getMonthCalendar, isSameDay, isToday } from "@/lib/date-utils";
import type { CalendarEvent } from "@shared/schema";

interface MonthViewProps {
  currentDate: Date;
  events: CalendarEvent[];
  isLoading: boolean;
  onEventClick?: (event: CalendarEvent) => void;
}

export function MonthView({ currentDate, events, isLoading, onEventClick }: MonthViewProps) {
  const monthDays = useMemo(() => getMonthCalendar(currentDate), [currentDate]);
  
  const getEventsForDate = (date: Date) => {
    return events.filter(event => 
      isSameDay(new Date(event.startTime), date) ||
      (new Date(event.startTime) <= date && new Date(event.endTime) >= date)
    );
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
      <div className="bg-[hsl(var(--google-light-gray))] border-b border-border">
        <div className="calendar-grid">
          {['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'].map(day => (
            <div key={day} className="px-4 py-3 text-center text-sm font-medium text-[hsl(var(--google-gray))]">
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
            const isCurrentMonth = date.getMonth() === currentDate.getMonth();
            const isTodayDate = isToday(date);
            
            return (
              <div 
                key={index} 
                className={`calendar-cell p-2 ${isTodayDate ? 'bg-blue-50' : ''}`}
              >
                <div className={`text-sm mb-1 ${
                  isCurrentMonth 
                    ? isTodayDate 
                      ? 'font-medium text-[hsl(var(--google-blue))]'
                      : 'font-medium text-foreground'
                    : 'text-muted-foreground'
                }`}>
                  {date.getDate()}
                </div>
                
                <div className="space-y-1">
                  {dayEvents.slice(0, 4).map((event) => (
                    <EventItem key={event.id} event={event} compact onClick={onEventClick} />
                  ))}
                  {dayEvents.length > 4 && (
                    <div className="text-xs text-muted-foreground px-1">
                      +{dayEvents.length - 4} more
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
