import type { CalendarEvent } from "@shared/schema";

export interface EventPosition {
  top: number;
  height: number;
}

export interface EventLayout {
  width: string;
  left: string;
  zIndex: number;
}

/**
 * Compute the vertical position and height (in pixels) of an event within
 * a single day column, clamping multi-day events to that day's boundaries.
 * Returns null if the event has no duration on this day.
 */
export function getEventPosition(
  event: CalendarEvent,
  date: Date,
  timeSlotHeight: number,
  minHeight: number = timeSlotHeight / 2
): EventPosition | null {
  const eventStart = new Date(event.startTime);
  const eventEnd = new Date(event.endTime);

  const dayStart = new Date(date);
  dayStart.setHours(0, 0, 0, 0);
  const dayEnd = new Date(date);
  dayEnd.setHours(23, 59, 59, 999);

  const clampedStart = eventStart < dayStart ? dayStart : eventStart;
  const clampedEnd = eventEnd > dayEnd ? dayEnd : eventEnd;

  if (clampedEnd <= clampedStart) {
    return null;
  }

  const startHour = clampedStart.getHours();
  const startMinutes = clampedStart.getMinutes();
  const top = (startHour + startMinutes / 60) * timeSlotHeight;

  const endHour = clampedEnd.getHours();
  const endMinutes = clampedEnd.getMinutes();
  const endPosition =
    endHour === 23 && endMinutes === 59 ? 24 : endHour + endMinutes / 60;
  const durationHours = endPosition - (startHour + startMinutes / 60);
  const height = Math.max(durationHours * timeSlotHeight, minHeight);

  return { top, height };
}

/**
 * Find every event in the list that overlaps in time with the given event.
 */
export function getOverlappingEvents(
  events: CalendarEvent[],
  currentEvent: CalendarEvent
): CalendarEvent[] {
  const currentStart = new Date(currentEvent.startTime);
  const currentEnd = new Date(currentEvent.endTime);

  return events.filter(event => {
    const eventStart = new Date(event.startTime);
    const eventEnd = new Date(event.endTime);
    return currentStart < eventEnd && currentEnd > eventStart;
  });
}

/**
 * Compute the horizontal layout for an event amongst its overlapping siblings.
 * Returns width/left/zIndex CSS values for side-by-side staggered columns.
 */
export function calculateEventLayout(
  events: CalendarEvent[],
  currentEvent: CalendarEvent
): EventLayout {
  const overlappingEvents = getOverlappingEvents(events, currentEvent);

  if (overlappingEvents.length === 1) {
    return { width: '100%', left: '0%', zIndex: 1 };
  }

  const sortedEvents = [...overlappingEvents].sort((a, b) => {
    const startDiff = new Date(a.startTime).getTime() - new Date(b.startTime).getTime();
    if (startDiff !== 0) return startDiff;
    const aDuration = new Date(a.endTime).getTime() - new Date(a.startTime).getTime();
    const bDuration = new Date(b.endTime).getTime() - new Date(b.startTime).getTime();
    return bDuration - aDuration;
  });

  const eventIndex = sortedEvents.findIndex(e => e?.id === currentEvent?.id);
  const totalEvents = sortedEvents.length;

  const availableWidth = 98;
  const eventWidth = availableWidth / totalEvents;
  const leftOffset = eventIndex * eventWidth + 1;

  return {
    width: `${Math.max(eventWidth - 0.5, 15)}%`,
    left: `${leftOffset}%`,
    zIndex: eventIndex + 1,
  };
}
