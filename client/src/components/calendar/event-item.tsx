import type { CalendarEvent } from "@shared/schema";
import { formatTime } from "@/lib/date-utils";

interface EventItemProps {
  event: CalendarEvent;
  compact?: boolean;
  timeSlot?: boolean;
  detailed?: boolean;
  onClick?: (event: CalendarEvent) => void;
}

export function EventItem({ event, compact = false, timeSlot = false, detailed = false, onClick }: EventItemProps) {
  const getTextColor = (backgroundColor: string): string => {
    // Convert hex to RGB to determine if we need light or dark text
    const hex = backgroundColor.replace('#', '');
    const r = parseInt(hex.substr(0, 2), 16);
    const g = parseInt(hex.substr(2, 2), 16);
    const b = parseInt(hex.substr(4, 2), 16);
    
    // Calculate brightness using standard formula
    const brightness = (r * 299 + g * 587 + b * 114) / 1000;
    
    // Return white text for dark backgrounds, black for light backgrounds
    return brightness < 128 ? '#ffffff' : '#000000';
  };

  const backgroundColor = event.color || '#1a73e8';
  const textColor = getTextColor(backgroundColor);
  const startTime = new Date(event.startTime);
  const endTime = new Date(event.endTime);

  if (detailed) {
    return (
      <div 
        className="event-item m-2 p-3 rounded-lg cursor-pointer hover:opacity-90 transition-opacity"
        style={{ backgroundColor, color: textColor }}
        onClick={() => onClick?.(event)}
      >
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
      <div 
        className="event-item px-1 py-1 rounded cursor-pointer hover:opacity-90 transition-opacity w-full"
        style={{ backgroundColor, color: textColor }}
        onClick={() => onClick?.(event)}
      >
        <div className="font-medium text-xs truncate">{event.title}</div>
        <div className="text-xs opacity-75 truncate">
          {formatTime(startTime)} - {formatTime(endTime)}
        </div>
        {event.location && (
          <div className="text-xs opacity-75 truncate">{event.location}</div>
        )}
      </div>
    );
  }

  if (compact) {
    return (
      <div 
        className="event-item cursor-pointer hover:opacity-90 transition-opacity px-2 py-1 rounded text-xs truncate w-full max-w-full overflow-hidden whitespace-nowrap"
        style={{ backgroundColor, color: textColor }}
        title={`${event.title}\n${formatTime(startTime)} - ${formatTime(endTime)}${event.location ? `\n${event.location}` : ''}`}
        onClick={() => onClick?.(event)}
      >
        {event.title}
      </div>
    );
  }

  return (
    <div 
      className="event-item cursor-pointer hover:opacity-90 transition-opacity w-full max-w-full overflow-hidden"
      style={{ backgroundColor, color: textColor }}
      onClick={() => onClick?.(event)}
    >
      {event.title}
    </div>
  );
}
