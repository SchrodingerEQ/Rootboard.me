import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Calendar, Clock, MapPin, Pencil } from "lucide-react";
import { CalendarEvent } from "@shared/schema";
import { formatDate, formatTime } from "@/lib/date-utils";
import { EVENT_FALLBACK_COLOR } from "@/lib/calendar-meta";

interface EventDetailsDialogProps {
  event: CalendarEvent | null;
  isOpen: boolean;
  onClose: () => void;
  onEdit?: (event: CalendarEvent) => void;
  calendarName?: string;
  calendarColor?: string;
}

export function EventDetailsDialog({
  event,
  isOpen,
  onClose,
  onEdit,
  calendarName,
  calendarColor
}: EventDetailsDialogProps) {
  if (!event) return null;

  const startDate = new Date(event.startTime);
  const endDate = new Date(event.endTime);
  const isAllDay = event.isAllDay;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="text-lg font-semibold text-rb-ink">
            {event.title}
          </DialogTitle>
        </DialogHeader>
        
        <div className="space-y-4">
          {/* Date and Time */}
          <div className="flex items-start gap-3">
            <Clock className="h-5 w-5 text-rb-muted mt-0.5 flex-shrink-0" />
            <div className="flex-1">
              <div className="font-medium text-rb-ink">
                {formatDate(startDate)}
              </div>
              {!isAllDay && (
                <div className="text-sm text-rb-ink-secondary">
                  {formatTime(startDate)} - {formatTime(endDate)}
                </div>
              )}
              {isAllDay && (
                <div className="text-sm text-rb-ink-secondary">
                  All day
                </div>
              )}
            </div>
          </div>

          {/* Location */}
          {event.location && (
            <div className="flex items-start gap-3">
              <MapPin className="h-5 w-5 text-rb-muted mt-0.5 flex-shrink-0" />
              <div className="flex-1">
                <div className="text-rb-ink">{event.location}</div>
              </div>
            </div>
          )}

          {/* Description */}
          {event.description && (
            <div className="flex items-start gap-3">
              <div className="h-5 w-5 flex-shrink-0" /> {/* Spacer */}
              <div className="flex-1">
                <div className="text-sm text-rb-ink-secondary whitespace-pre-wrap">
                  {event.description}
                </div>
              </div>
            </div>
          )}

          {/* Calendar Source */}
          <div className="flex items-center gap-3">
            <Calendar className="h-5 w-5 text-rb-muted flex-shrink-0" />
            <div className="flex-1">
              <Badge
                variant="secondary"
                className="text-rb-on-color-ink"
                style={{
                  backgroundColor: calendarColor || EVENT_FALLBACK_COLOR,
                  color: 'var(--rb-on-color-ink)'
                }}
              >
                {calendarName || 'Unknown Calendar'}
              </Badge>
            </div>
          </div>
        </div>

        {onEdit && (
          <DialogFooter>
            <Button
              onClick={() => onEdit(event)}
              className="touch-button h-10"
              data-testid="button-edit-event"
            >
              <Pencil className="mr-1" size={16} />
              Edit
            </Button>
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  );
}