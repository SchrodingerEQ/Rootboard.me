import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useCallback } from "react";
import { apiRequest } from "@/lib/queryClient";
import type { CalendarEvent } from "@shared/schema";
import type { CalendarView } from "@/pages/calendar";

interface AuthStatus {
  authenticated: boolean;
  needsAuth: boolean;
}

export function useCalendar(currentDate: Date, currentView: CalendarView) {
  const queryClient = useQueryClient();

  // Calculate date range based on current view
  const getDateRange = useCallback(() => {
    const start = new Date(currentDate);
    const end = new Date(currentDate);

    if (currentView === 'month') {
      start.setDate(1);
      start.setDate(start.getDate() - start.getDay()); // Start of week containing first day
      end.setMonth(end.getMonth() + 1, 0);
      end.setDate(end.getDate() + (6 - end.getDay())); // End of week containing last day
    } else if (currentView === 'week') {
      start.setDate(start.getDate() - start.getDay());
      end.setDate(start.getDate() + 6);
    } else if (currentView === 'day') {
      end.setDate(end.getDate() + 1);
    }

    return { start, end };
  }, [currentDate, currentView]);

  const { start, end } = getDateRange();

  // Check authentication status
  const {
    data: authStatus,
    refetch: checkAuthStatus
  } = useQuery<AuthStatus>({
    queryKey: ['/api/calendar/auth-status'],
    queryFn: async () => {
      const response = await fetch('/api/calendar/auth-status', { credentials: 'include' });
      if (!response.ok) {
        throw new Error('Failed to check auth status');
      }
      return response.json();
    },
  });

  // Fetch calendar events (enabled only when authenticated)
  const {
    data: events = [],
    isLoading,
    refetch
  } = useQuery<CalendarEvent[]>({
    queryKey: ['/api/calendar/events', start.toISOString(), end.toISOString()],
    queryFn: async () => {
      const response = await fetch(
        `/api/calendar/events?startDate=${start.toISOString()}&endDate=${end.toISOString()}`,
        { credentials: 'include' }
      );
      if (!response.ok) {
        throw new Error('Failed to fetch calendar events');
      }
      return response.json();
    },
    enabled: authStatus?.authenticated === true,
  });

  // Sync calendar events mutation
  const syncMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest('POST', '/api/calendar/sync', {
        startDate: start.toISOString(),
        endDate: end.toISOString(),
      });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ 
        queryKey: ['/api/calendar/events'] 
      });
    },
  });

  const refreshEvents = useCallback(() => {
    syncMutation.mutate();
  }, [syncMutation]);

  return {
    events,
    isLoading,
    isRefreshing: syncMutation.isPending,
    authStatus,
    refreshEvents,
    checkAuthStatus,
    refetch,
  };
}