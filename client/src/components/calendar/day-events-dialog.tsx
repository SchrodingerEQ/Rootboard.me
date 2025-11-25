import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { EventItem } from "./event-item";
import type { CalendarEvent } from "@shared/schema";

interface DayEventsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  date: Date;
  events: CalendarEvent[];
  onEventClick?: (event: CalendarEvent) => void;
}

export function DayEventsDialog({ 
  open, 
  onOpenChange, 
  date, 
  events, 
  onEventClick 
}: DayEventsDialogProps) {
  const dayName = date.toLocaleDateString('en-US', { weekday: 'long' });
  const dayNumber = date.getDate();
  const monthName = date.toLocaleDateString('en-US', { month: 'long' });

  // Sort events: all-day first, then by start time, then by calendar ID
  const sortedEvents = [...events].sort((a, b) => {
    // All-day events come first
    if (a.isAllDay && !b.isAllDay) return -1;
    if (!a.isAllDay && b.isAllDay) return 1;
    
    // Then sort by start time
    const startA = new Date(a.startTime).getTime();
    const startB = new Date(b.startTime).getTime();
    if (startA !== startB) return startA - startB;
    
    // If same start time, sort by calendar ID for stable ordering
    return a.calendarId.localeCompare(b.calendarId);
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md max-h-[32rem] overflow-hidden">
        <DialogHeader>
          <DialogTitle className="text-lg font-medium">
            {dayName}, {monthName} {dayNumber}
          </DialogTitle>
        </DialogHeader>
        
        <div className="overflow-y-auto max-h-96 space-y-2 pr-2 pb-2">
          {sortedEvents.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4 text-center">
              No events for this day
            </p>
          ) : (
            sortedEvents.map((event) => (
              <EventItem 
                key={event.id} 
                event={event} 
                detailed
                onClick={onEventClick} 
              />
            ))
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}