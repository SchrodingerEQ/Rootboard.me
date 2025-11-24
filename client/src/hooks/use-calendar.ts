import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useRef, useMemo } from "react";
import { apiRequest } from "@/lib/queryClient";
import type { CalendarEvent } from "@shared/schema";
import type { CalendarView } from "@/pages/calendar";
import { useOnlineStatus } from "./useOnlineStatus";
import { useScreensaverState } from "./useScreensaverState";

interface AuthStatus {
  authenticated: boolean;
  needsAuth: boolean;
}

// Minimum time between refreshes (5 minutes) for energy efficiency
const MIN_REFRESH_INTERVAL = 5 * 60 * 1000;

export function useCalendar(currentDate: Date, currentView: CalendarView) {
  const queryClient = useQueryClient();
  const isOnline = useOnlineStatus();
  const isScreensaverActive = useScreensaverState();
  const lastRefreshTime = useRef<number>(0);
  
  // Only perform queries when online AND screensaver is not active (energy optimization)
  const shouldPerformQueries = isOnline && !isScreensaverActive;

  // Calculate date range based on current view (memoized to reduce recalculation)
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

  const { start, end } = useMemo(() => getDateRange(), [getDateRange]);

  // Check authentication status (with offline detection, screensaver pause, and backoff)
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
    enabled: shouldPerformQueries, // Pause when offline or screensaver active
    retry: isOnline ? 3 : false,
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
    refetchOnWindowFocus: false,
    staleTime: 60 * 1000,
  });

  // Fetch calendar events (enabled only when authenticated, paused during screensaver)
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
      const data = await response.json();
      
      // Debug: Log events with 'test' in title from API response
      const testEvents = data.filter((e: any) => e.title?.toLowerCase().includes('test'));
      if (testEvents.length > 0) {
        console.log('[DEBUG useCalendar] API returned test events:', testEvents.map((e: any) => ({
          id: e.id,
          title: e.title,
          calendarId: e.calendarId,
          googleEventId: e.googleEventId
        })));
      }
      
      return data;
    },
    enabled: authStatus?.authenticated === true && shouldPerformQueries,
    retry: isOnline ? 3 : false,
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
    refetchOnWindowFocus: false,
    staleTime: 5 * 60 * 1000, // 5 minutes for energy efficiency
  });

  // Sync calendar events mutation - uses expanded date range to capture all events
  const syncMutation = useMutation({
    mutationFn: async () => {
      // Use a much wider sync window: 3 months in the past + 12 months in the future
      // This ensures all events are captured regardless of current view
      const syncStart = new Date();
      syncStart.setMonth(syncStart.getMonth() - 3);
      syncStart.setDate(1);
      
      const syncEnd = new Date();
      syncEnd.setMonth(syncEnd.getMonth() + 12);
      syncEnd.setDate(0); // Last day of that month
      
      const response = await apiRequest('POST', '/api/calendar/sync', {
        startDate: syncStart.toISOString(),
        endDate: syncEnd.toISOString(),
      });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ 
        queryKey: ['/api/calendar/events'] 
      });
    },
  });

  // Throttled refresh to prevent excessive API calls (energy optimization)
  const refreshEvents = useCallback(() => {
    const now = Date.now();
    const timeSinceLastRefresh = now - lastRefreshTime.current;
    
    // If we're offline, don't even attempt to sync
    if (!isOnline) {
      console.log('Skipping refresh - device is offline');
      return;
    }
    
    // Enforce minimum 5-minute interval between refreshes
    if (timeSinceLastRefresh < MIN_REFRESH_INTERVAL) {
      const remainingTime = Math.ceil((MIN_REFRESH_INTERVAL - timeSinceLastRefresh) / 1000);
      console.log(`Refresh throttled. Next refresh available in ${remainingTime} seconds`);
      return;
    }
    
    console.log('Executing calendar refresh');
    lastRefreshTime.current = now;
    syncMutation.mutate();
  }, [syncMutation, isOnline]);

  // Auto-sync events when authentication is detected and no events exist
  const hasTriggeredSync = useRef(false);
  useEffect(() => {
    if (authStatus?.authenticated && events.length === 0 && !isLoading && !hasTriggeredSync.current) {
      console.log('Auto-triggering initial calendar sync');
      hasTriggeredSync.current = true;
      syncMutation.mutate();
    }
  }, [authStatus?.authenticated, events.length, isLoading, syncMutation]);

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