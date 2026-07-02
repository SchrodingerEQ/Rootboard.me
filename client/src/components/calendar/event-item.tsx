import type { CalendarEvent } from "@shared/schema";
import { formatTime } from "@/lib/date-utils";
import { eventTint, eventTextColor } from "@/lib/color-utils";

interface EventItemProps {
  event: CalendarEvent;
  compact?: boolean;
  timeSlot?: boolean;
  detailed?: boolean;
  layout?: { width: string; left: string; zIndex?: number; height?: string; top?: string };
  onClick?: (event: CalendarEvent) => void;
}

// Compact time for month chips: "4p" on the hour, "4:30" otherwise.
function formatCompactTime(date: Date): string {
  const hours = date.getHours();
  const minutes = date.getMinutes();
  const isPM = hours >= 12;
  const hour12 = hours % 12 || 12;
  return minutes === 0
    ? `${hour12}${isPM ? "p" : "a"}`
    : `${hour12}:${minutes.toString().padStart(2, "0")}`;
}

export function EventItem({
  event,
  compact = false,
  timeSlot = false,
  detailed = false,
  layout,
  onClick,
}: EventItemProps) {
  // Warm family-display treatment: soft tint background + colored accent + dark readable text,
  // derived from whatever hex the calendar/event carries.
  const color = event.color || "#2563eb";
  const tint = eventTint(color);
  const ink = eventTextColor(color);
  const startTime = new Date(event.startTime);
  const endTime = new Date(event.endTime);

  if (detailed) {
    return (
      <div
        className="event-item m-2 p-3 rounded-2xl cursor-pointer transition hover:brightness-95"
        style={{ background: tint, borderLeft: `5px solid ${color}` }}
        onClick={() => onClick?.(event)}
      >
        <div className="font-extrabold" style={{ color: ink }}>{event.title}</div>
        {event.isAllDay ? (
          <div className="text-xs font-semibold" style={{ color: ink, opacity: 0.8 }}>All day</div>
        ) : (
          <div className="text-xs font-semibold" style={{ color: ink, opacity: 0.8 }}>
            {formatTime(startTime)} - {formatTime(endTime)}
          </div>
        )}
        {event.location && (
          <div className="text-xs font-medium" style={{ color: ink, opacity: 0.7 }}>{event.location}</div>
        )}
        {event.description && (
          <div className="text-xs mt-1 line-clamp-2 font-medium" style={{ color: ink, opacity: 0.7 }}>
            {event.description}
          </div>
        )}
      </div>
    );
  }

  if (timeSlot) {
    const baseStyle = {
      background: tint,
      borderLeft: `4px solid ${color}`,
      color: ink,
      minHeight: "20px",
    };

    const layoutStyle = layout
      ? {
          ...baseStyle,
          position: "absolute" as const,
          width: layout.width,
          left: layout.left,
          zIndex: layout.zIndex ?? 1,
          top: layout.top || "0",
          height: layout.height || "100%",
          maxWidth: "100%",
          boxSizing: "border-box" as const,
        }
      : {
          ...baseStyle,
          width: "calc(100% - 4px)",
        };

    return (
      <div
        className={`event-item ${layout ? "absolute" : "mx-0.5"} px-2 py-0.5 rounded-lg cursor-pointer transition hover:brightness-95 text-xs overflow-hidden`}
        style={layoutStyle}
        onClick={() => onClick?.(event)}
        title={`${event.title}\n${formatTime(startTime)} - ${formatTime(endTime)}${event.location ? `\n${event.location}` : ""}`}
      >
        <div className="font-extrabold text-xs truncate w-full" style={{ color: ink }}>{event.title}</div>
        <div className="text-xs font-semibold truncate w-full" style={{ color: ink, opacity: 0.8 }}>
          {formatTime(startTime)} - {formatTime(endTime)}
        </div>
        {event.location && (
          <div className="text-xs font-medium truncate w-full" style={{ color: ink, opacity: 0.7 }}>{event.location}</div>
        )}
      </div>
    );
  }

  if (compact) {
    const timeDisplay = event.isAllDay ? null : formatCompactTime(startTime);

    return (
      <div
        className="event-item cursor-pointer transition hover:brightness-95 px-2 py-0.5 rounded-md text-xs w-full max-w-full overflow-hidden whitespace-nowrap flex items-center gap-1.5"
        style={{ background: tint }}
        title={`${event.title}\n${formatTime(startTime)} - ${formatTime(endTime)}${event.location ? `\n${event.location}` : ""}`}
        onClick={() => onClick?.(event)}
      >
        <span className="flex-shrink-0 rounded-full" style={{ width: 8, height: 8, background: color }} />
        {timeDisplay && (
          <span className="flex-shrink-0 font-extrabold" style={{ color: ink }}>{timeDisplay}</span>
        )}
        <span className="truncate font-semibold" style={{ color: ink }}>{event.title}</span>
      </div>
    );
  }

  return (
    <div
      className="event-item cursor-pointer transition hover:brightness-95 w-full max-w-full overflow-hidden px-2 py-0.5 rounded-md flex items-center gap-1.5"
      style={{ background: tint }}
      onClick={() => onClick?.(event)}
    >
      <span className="flex-shrink-0 rounded-full" style={{ width: 8, height: 8, background: color }} />
      <span className="truncate font-semibold" style={{ color: ink }}>{event.title}</span>
    </div>
  );
}
