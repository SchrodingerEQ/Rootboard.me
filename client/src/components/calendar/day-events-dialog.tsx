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

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md max-h-[32rem] overflow-hidden">
        <DialogHeader>
          <DialogTitle className="text-lg font-medium">
            {dayName}, {monthName} {dayNumber}
          </DialogTitle>
        </DialogHeader>
        
        <div className="overflow-y-auto max-h-96 space-y-2 pr-2 pb-2">
          {events.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4 text-center">
              No events for this day
            </p>
          ) : (
            events.map((event) => (
              <EventItem 
                key={event.id} 
                event={event} 
                compact={false}
                onClick={onEventClick} 
              />
            ))
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}