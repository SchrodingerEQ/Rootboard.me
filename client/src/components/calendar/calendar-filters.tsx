import { useQuery } from "@tanstack/react-query";
import { Skeleton } from "@/components/ui/skeleton";
import { getCalendarColor, getInitials, type CalendarInfo } from "@/lib/calendar-meta";

interface CalendarFiltersProps {
  onCalendarToggle: (calendarId: string, enabled: boolean) => void;
  enabledCalendars: Set<string>;
  visibleCalendarsInHeader: Set<string>;
}

// Warm family-display profile legend: an avatar + name per calendar. Tapping a
// profile toggles its events; a disabled profile dims out.
export function CalendarFilters({ onCalendarToggle, enabledCalendars, visibleCalendarsInHeader }: CalendarFiltersProps) {
  const { data: calendars, isLoading, error } = useQuery<CalendarInfo[]>({
    queryKey: ['/api/calendar/calendars'],
    enabled: true,
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
  });

  if (error) return null;

  if (isLoading) {
    return (
      <div className="flex gap-5 py-1">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="flex items-center gap-2">
            <Skeleton className="h-7 w-7 rounded-full" />
            <Skeleton className="h-4 w-16" />
          </div>
        ))}
      </div>
    );
  }

  if (!calendars || !Array.isArray(calendars) || calendars.length < 1) return null;

  const visibleCalendars = calendars.filter(c => visibleCalendarsInHeader.has(c.id));
  if (visibleCalendars.length === 0) return null;

  return (
    <div className="flex gap-5 py-1 overflow-x-auto">
      {visibleCalendars.map((calendar) => {
        const isEnabled = enabledCalendars.has(calendar.id);
        const color = getCalendarColor(calendar);
        const initials = getInitials(calendar.summary);

        return (
          <button
            key={calendar.id}
            className="flex items-center gap-2 whitespace-nowrap min-w-fit transition-opacity touch-button"
            style={{ opacity: isEnabled ? 1 : 0.4 }}
            onClick={() => onCalendarToggle(calendar.id, !isEnabled)}
            title={`${isEnabled ? 'Hide' : 'Show'} ${calendar.summary} calendar`}
          >
            <span
              className="rounded-full flex items-center justify-center text-xs font-extrabold text-white"
              style={{ width: 30, height: 30, background: color }}
            >
              {initials}
            </span>
            <span className="text-base font-bold text-[#3a4049]">{calendar.summary}</span>
            {!isEnabled && (
              <span className="text-xs font-bold text-[#b0b5be]">(hidden)</span>
            )}
          </button>
        );
      })}
    </div>
  );
}
