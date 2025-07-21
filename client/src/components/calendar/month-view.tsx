import { useMemo, useState } from "react";
import { EventItem } from "./event-item";
import { DayEventsDialog } from "./day-events-dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { getMonthCalendar, isSameDay, isToday } from "@/lib/date-utils";
import { ChevronDown } from "lucide-react";
import type { CalendarEvent } from "@shared/schema";

interface MonthViewProps {
  currentDate: Date;
  events: CalendarEvent[];
  isLoading: boolean;
  enabledCalendars?: Set<string>;
  onEventClick?: (event: CalendarEvent) => void;
}

export function MonthView({ currentDate, events, isLoading, enabledCalendars, onEventClick }: MonthViewProps) {
  const monthDays = useMemo(() => getMonthCalendar(currentDate), [currentDate]);
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [dayDialogOpen, setDayDialogOpen] = useState(false);
  
  const getEventsForDate = (date: Date) => {
    const dateEvents = events.filter(event => 
      isSameDay(new Date(event.startTime), date) ||
      (new Date(event.startTime) <= date && new Date(event.endTime) >= date)
    );
    
    // Filter by enabled calendars if provided
    if (enabledCalendars && enabledCalendars.size > 0) {
      return dateEvents.filter(event => enabledCalendars.has(event.calendarId));
    }
    
    return dateEvents;
  };

  const handleShowMoreEvents = (date: Date) => {
    setSelectedDate(date);
    setDayDialogOpen(true);
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
            <div key={day} className="px-2 py-1 text-center text-sm font-medium text-[hsl(var(--google-gray))]">
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
                className={`calendar-cell p-0.5 pb-0 flex flex-col justify-start ${isTodayDate ? 'bg-blue-50' : ''}`}
              >
                <div className={`text-sm mb-0.5 px-1 ${
                  isCurrentMonth 
                    ? isTodayDate 
                      ? 'font-medium text-[hsl(var(--google-blue))]'
                      : 'font-medium text-foreground'
                    : 'text-muted-foreground'
                }`}>
                  {date.getDate()}
                </div>
                
                <div className="flex flex-col h-full px-0.5">
                  <div className="space-y-0.5">
                    {dayEvents.slice(0, 3).map((event) => (
                      <EventItem key={event.id} event={event} compact onClick={onEventClick} />
                    ))}
                    
                    {/* Show more indicator - inline with events */}
                    {dayEvents.length > 3 && (
                      <div className="flex items-center justify-between bg-blue-100 border border-blue-300 rounded px-1 py-0.5 mt-0.5">
                        <div className="text-xs text-blue-700 font-medium">
                          +{dayEvents.length - 3}
                        </div>
                        <button 
                          onClick={(e) => {
                            e.stopPropagation();
                            handleShowMoreEvents(date);
                          }}
                          className="p-0.5 hover:bg-blue-200 rounded transition-colors flex-shrink-0"
                          aria-label={`Show all ${dayEvents.length} events for ${date.toLocaleDateString()}`}
                        >
                          <ChevronDown className="h-2.5 w-2.5 text-blue-700" />
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
      
      {/* Day Events Dialog */}
      {selectedDate && (
        <DayEventsDialog
          open={dayDialogOpen}
          onOpenChange={setDayDialogOpen}
          date={selectedDate}
          events={getEventsForDate(selectedDate)}
          onEventClick={onEventClick}
        />
      )}
    </div>
  );
}
