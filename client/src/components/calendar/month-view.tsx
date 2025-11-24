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
  
  // Memoize events by date to avoid re-filtering on every render (energy optimization)
  const eventsByDate = useMemo(() => {
    const eventsMap = new Map<string, CalendarEvent[]>();
    
    // Pre-filter by enabled calendars once
    const filteredEvents = enabledCalendars && enabledCalendars.size > 0
      ? events.filter(event => enabledCalendars.has(event.calendarId))
      : events;
    
    // Debug: Check if "Test this" events exist after filtering
    const testFiltered = filteredEvents.filter(e => e.title?.toLowerCase().includes('test'));
    if (testFiltered.length > 0) {
      console.log('[DEBUG MonthView] Filtered events with "test":', testFiltered.map(e => ({
        id: e.id,
        title: e.title,
        calendarId: e.calendarId,
        startTime: e.startTime
      })));
    }
    
    // Group events by date
    monthDays.forEach(date => {
      const dateKey = date.toDateString();
      const dateEvents = filteredEvents.filter(event => {
        const eventStart = new Date(event.startTime);
        const eventEnd = new Date(event.endTime);
        return isSameDay(eventStart, date) || (eventStart <= date && eventEnd >= date);
      });
      
      // Debug: Log when we find "Test this" events for a date
      const testEvents = dateEvents.filter(e => e.title?.toLowerCase() === 'test this');
      if (testEvents.length > 0) {
        console.log(`[DEBUG MonthView] Date ${dateKey} has ${testEvents.length} "Test this" events:`, testEvents.map(e => ({
          id: e.id,
          calendarId: e.calendarId
        })));
        console.log(`[DEBUG MonthView] ${dateKey} total events: ${dateEvents.length}, first 3 ids:`, 
          dateEvents.slice(0, 3).map(e => ({ id: e.id, title: e.title, calendarId: e.calendarId })));
      }
      
      eventsMap.set(dateKey, dateEvents);
    });
    
    return eventsMap;
  }, [events, enabledCalendars, monthDays]);
  
  const getEventsForDate = (date: Date) => {
    return eventsByDate.get(date.toDateString()) || [];
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
      <div className="bg-[hsl(var(--google-light-gray))]">
        <div className="calendar-grid">
          {['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'].map(day => (
            <div key={day} className="px-1 py-0.5 text-center text-xs font-medium text-[hsl(var(--google-gray))]">
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
            const isCurrentMonth = date.getMonth() === currentDate.getMonth() && date.getFullYear() === currentDate.getFullYear();
            const isTodayDate = isToday(date);
            
            return (
              <div 
                key={index} 
                className="calendar-cell p-0.5 flex flex-col justify-start pt-[0px] pb-[0px]"
              >
                <div className={`text-xs mb-0 px-1 ${
                  isCurrentMonth 
                    ? isTodayDate 
                      ? 'font-medium text-[hsl(var(--google-blue))]'
                      : 'font-medium text-black'
                    : 'font-normal text-gray-300 opacity-60'
                }`}>
                  {date.getDate()}
                </div>
                <div className="flex flex-col flex-1 px-0.5">
                  <div className="space-y-0.5 overflow-hidden">
                    {dayEvents.slice(0, 3).map((event) => (
                      <EventItem key={event.id} event={event} compact onClick={onEventClick} />
                    ))}
                    
                    {/* Show more indicator - inline with events */}
                    {dayEvents.length > 3 && (
                      <div className="flex items-center justify-between bg-blue-100 border border-blue-300 rounded px-1 py-0.5 mt-0">
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
                          <ChevronDown className="h-2 w-2 text-blue-700" />
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
