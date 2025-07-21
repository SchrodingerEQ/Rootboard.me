import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";

interface CalendarInfo {
  id: string;
  summary: string;
  primary: boolean;
  backgroundColor?: string;
  foregroundColor?: string;
  selected: boolean;
  accessRole: string;
}

interface CalendarFiltersProps {
  onCalendarToggle: (calendarId: string, enabled: boolean) => void;
  enabledCalendars: Set<string>;
  visibleCalendarsInHeader: Set<string>;
}

export function CalendarFilters({ onCalendarToggle, enabledCalendars, visibleCalendarsInHeader }: CalendarFiltersProps) {
  const { data: calendars, isLoading, error } = useQuery<CalendarInfo[]>({
    queryKey: ['/api/calendar/calendars'],
    enabled: true,
    staleTime: 5 * 60 * 1000, // 5 minutes
    refetchOnWindowFocus: false,
  });

  const getCalendarColor = (calendar: CalendarInfo): string => {
    if (calendar.backgroundColor) {
      return calendar.backgroundColor;
    }
    
    // Generate a consistent color based on calendar ID (same logic as backend)
    const colors = [
      '#1a73e8', // Blue
      '#34a853', // Green  
      '#ea4335', // Red
      '#ff9800', // Orange
      '#9c27b0', // Purple
      '#795548', // Brown
      '#607d8b', // Blue Grey
      '#e91e63', // Pink
      '#4caf50', // Light Green
      '#ff5722', // Deep Orange
      '#3f51b5', // Indigo
      '#009688', // Teal
    ];
    
    // Create a simple hash from the calendar ID to get consistent colors
    let hash = 0;
    for (let i = 0; i < calendar.id.length; i++) {
      hash = ((hash << 5) - hash + calendar.id.charCodeAt(i)) & 0xffffffff;
    }
    const index = Math.abs(hash) % colors.length;
    return colors[index];
  };

  const getInitials = (name: string): string => {
    return name
      .split(' ')
      .map(word => word[0])
      .join('')
      .substring(0, 2)
      .toUpperCase();
  };

  if (error) {
    return null; // Hide filter if calendars can't be loaded
  }

  if (isLoading) {
    return (
      <div className="flex gap-2 px-4 py-2 bg-white border-b">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-8 w-16 rounded-full" />
        ))}
      </div>
    );
  }

  if (!calendars || !Array.isArray(calendars) || calendars.length <= 1) {
    return null; // Hide filter if only one calendar
  }

  // Show only calendars that are marked as visible in the header
  const visibleCalendars = calendars.filter((calendar: CalendarInfo) => 
    visibleCalendarsInHeader.has(calendar.id)
  );
  

  




  // If no calendars are visible in header, don't show the filter bar
  if (visibleCalendars.length === 0) {
    return null;
  }

  return (
    <div className="flex gap-1 px-2 py-0.5 bg-white border-b overflow-x-auto">
      {visibleCalendars.map((calendar: CalendarInfo) => {
        const isEnabled = enabledCalendars.has(calendar.id);
        const color = getCalendarColor(calendar);
        const initials = getInitials(calendar.summary);
        
        return (
          <Button
            key={calendar.id}
            variant="outline"
            size="sm"
            className={`
              flex items-center gap-1 whitespace-nowrap min-w-fit rounded-full px-2 py-0.5 text-xs font-medium h-6
              transition-all duration-200 border
              ${isEnabled 
                ? 'opacity-100 shadow-sm' 
                : 'opacity-50 hover:opacity-75'
              }
            `}
            style={{
              backgroundColor: isEnabled ? color : 'white',
              borderColor: color,
              color: isEnabled ? 'white' : color,
            }}
            onClick={() => onCalendarToggle(calendar.id, !isEnabled)}
            title={`${isEnabled ? 'Hide' : 'Show'} ${calendar.summary} calendar`}
          >
            <div 
              className={`
                w-3 h-3 rounded-full flex items-center justify-center text-xs font-bold
                ${isEnabled ? 'bg-white/20' : ''}
              `}
              style={{
                backgroundColor: isEnabled ? 'rgba(255,255,255,0.3)' : color,
                color: isEnabled ? 'white' : 'white',
              }}
            >
              {initials}
            </div>
            <span className="font-medium text-xs">{calendar.summary}</span>
          </Button>
        );
      })}
    </div>
  );
}