import type { CalendarEvent } from "@shared/schema";
import { formatTime } from "@/lib/date-utils";

interface EventItemProps {
  event: CalendarEvent;
  compact?: boolean;
  timeSlot?: boolean;
  detailed?: boolean;
}

export function EventItem({ event, compact = false, timeSlot = false, detailed = false }: EventItemProps) {
  const getEventColorClass = (color: string) => {
    switch (color) {
      case '#1a73e8':
        return 'event-google-blue';
      case '#34a853':
        return 'event-google-green';
      case '#ff9800':
        return 'event-orange';
      case '#9c27b0':
        return 'event-purple';
      case '#ea4335':
        return 'event-red';
      default:
        return 'event-google-blue';
    }
  };

  const eventClass = getEventColorClass(event.color || '#1a73e8');
  const startTime = new Date(event.startTime);
  const endTime = new Date(event.endTime);

  if (detailed) {
    return (
      <div className={`event-item ${eventClass} m-2 p-3 rounded-lg cursor-pointer hover:opacity-90 transition-opacity`}>
        <div className="font-medium">{event.title}</div>
        <div className="text-xs opacity-75">
          {formatTime(startTime)} - {formatTime(endTime)}
        </div>
        {event.location && (
          <div className="text-xs opacity-75">{event.location}</div>
        )}
        {event.description && (
          <div className="text-xs opacity-75 mt-1 line-clamp-2">{event.description}</div>
        )}
      </div>
    );
  }

  if (timeSlot) {
    return (
      <div className={`event-item ${eventClass} m-1 p-2 rounded cursor-pointer hover:opacity-90 transition-opacity`}>
        <div className="font-medium text-sm">{event.title}</div>
        <div className="text-xs opacity-75">
          {formatTime(startTime)} - {formatTime(endTime)}
        </div>
        {event.location && (
          <div className="text-xs opacity-75">{event.location}</div>
        )}
      </div>
    );
  }

  if (compact) {
    return (
      <div 
        className={`event-item ${eventClass} cursor-pointer hover:opacity-90 transition-opacity`}
        title={`${event.title}\n${formatTime(startTime)} - ${formatTime(endTime)}${event.location ? `\n${event.location}` : ''}`}
      >
        {event.title}
      </div>
    );
  }

  return (
    <div className={`event-item ${eventClass} cursor-pointer hover:opacity-90 transition-opacity w-full max-w-full overflow-hidden`}>
      {event.title}
    </div>
  );
}
