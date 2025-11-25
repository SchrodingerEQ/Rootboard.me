import type { CalendarEvent } from "@shared/schema";
import { formatTime } from "@/lib/date-utils";

interface EventItemProps {
  event: CalendarEvent;
  compact?: boolean;
  timeSlot?: boolean;
  detailed?: boolean;
  layout?: { width: string; left: string; zIndex: number; height?: string };
  onClick?: (event: CalendarEvent) => void;
}

// Format time for compact display: "4p" for on-the-hour, "4:30" for off-hour
function formatCompactTime(date: Date): string {
  const hours = date.getHours();
  const minutes = date.getMinutes();
  const isPM = hours >= 12;
  const hour12 = hours % 12 || 12;
  
  if (minutes === 0) {
    // On the hour: show as "4p" or "4a"
    return `${hour12}${isPM ? 'p' : 'a'}`;
  } else {
    // Not on the hour: show as "4:30"
    return `${hour12}:${minutes.toString().padStart(2, '0')}`;
  }
}

export function EventItem({ event, compact = false, timeSlot = false, detailed = false, layout, onClick }: EventItemProps) {
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
    const baseStyle = {
      backgroundColor,
      color: textColor,
      minHeight: '20px'
    };

    const layoutStyle = layout ? {
      ...baseStyle,
      position: 'absolute' as const,
      width: layout.width,
      left: layout.left,
      zIndex: layout.zIndex,
      top: '0',
      height: layout.height || '100%'
    } : {
      ...baseStyle,
      width: 'calc(100% - 4px)'
    };

    return (
      <div 
        className={`event-item ${layout ? 'absolute' : 'mx-0.5'} px-0.5 py-0.5 rounded cursor-pointer hover:opacity-90 transition-opacity text-xs`}
        style={layoutStyle}
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
    // For all-day events, don't show time
    const timeDisplay = event.isAllDay ? null : formatCompactTime(startTime);
    
    return (
      <div 
        className="event-item cursor-pointer hover:opacity-90 transition-opacity px-1 py-0.5 rounded text-xs w-full max-w-full overflow-hidden whitespace-nowrap flex items-center gap-1"
        style={{ backgroundColor, color: textColor }}
        title={`${event.title}\n${formatTime(startTime)} - ${formatTime(endTime)}${event.location ? `\n${event.location}` : ''}`}
        onClick={() => onClick?.(event)}
      >
        {timeDisplay && (
          <span className="flex-shrink-0 font-medium">{timeDisplay}</span>
        )}
        <span className="truncate">{event.title}</span>
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
