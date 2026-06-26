import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useRef, useMemo } from "react";
import { apiRequest } from "@/lib/queryClient";
import { getCalendarDateRange } from "@/lib/date-range";
import type { CalendarEvent } from "@shared/schema";
import type { CalendarView } from "@/pages/calendar";
import { useOnlineStatus } from "./useOnlineStatus";
import { useScreensaverState } from "./useScreensaverState";

interface AuthStatus {
  authenticated: boolean;
  needsAuth: boolean;
  error?: string | null;
}

interface SyncStatus {
  lastSyncAt: string | null;
  lastSyncError: string | null;
  syncing: boolean;
}

// Minimum time between auto-refreshes (10 minutes) for energy efficiency
const AUTO_REFRESH_INTERVAL = 10 * 60 * 1000;

export function useCalendar(currentDate: Date, currentView: CalendarView) {
  const queryClient = useQueryClient();
  const isOnline = useOnlineStatus();
  const isScreensaverActive = useScreensaverState();
  const lastRefreshTime = useRef<number>(0);
  
  // Only perform queries when online AND screensaver is not active (energy optimization)
  const shouldPerformQueries = isOnline && !isScreensaverActive;

  // Date range to fetch for the current view. Normalized to local midnight with
  // an exclusive end so the window never shifts with the time of day — see
  // getCalendarDateRange for why (week/day views were dropping events otherwise).
  const { start, end } = useMemo(
    () => getCalendarDateRange(currentDate, currentView),
    [currentDate, currentView],
  );

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
        `/api/calendar/events?from=${encodeURIComponent(start.toISOString())}&to=${encodeURIComponent(end.toISOString())}`,
        { credentials: 'include' }
      );
      if (!response.ok) {
        throw new Error('Failed to fetch calendar events');
      }
      return response.json();
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

  // Manual refresh - always available when not already refreshing
  const manualRefresh = useCallback(() => {
    if (!isOnline) {
      console.log('Skipping refresh - device is offline');
      return;
    }
    
    if (syncMutation.isPending) {
      console.log('Refresh already in progress');
      return;
    }
    
    console.log('Executing manual calendar refresh');
    lastRefreshTime.current = Date.now();
    syncMutation.mutate();
  }, [syncMutation, isOnline]);

  // Auto-refresh with throttling for energy efficiency
  const autoRefresh = useCallback(() => {
    const now = Date.now();
    const timeSinceLastRefresh = now - lastRefreshTime.current;
    
    if (!isOnline) {
      return;
    }

    if (isScreensaverActive) {
      return;
    }
    
    if (timeSinceLastRefresh < AUTO_REFRESH_INTERVAL) {
      return;
    }
    
    console.log('Executing auto calendar refresh');
    lastRefreshTime.current = now;
    syncMutation.mutate();
  }, [syncMutation, isOnline, isScreensaverActive]);

  // Auto-sync events when authentication is detected and no events exist
  const hasTriggeredSync = useRef(false);
  useEffect(() => {
    if (authStatus?.authenticated && events.length === 0 && !isLoading && !hasTriggeredSync.current) {
      console.log('Auto-triggering initial calendar sync');
      hasTriggeredSync.current = true;
      syncMutation.mutate();
    }
  }, [authStatus?.authenticated, events.length, isLoading, syncMutation]);

  // Poll sync status so the header can show last-sync timestamp and errors
  const { data: syncStatus } = useQuery<SyncStatus>({
    queryKey: ['/api/calendar/sync-status'],
    queryFn: async () => {
      const response = await fetch('/api/calendar/sync-status', { credentials: 'include' });
      if (!response.ok) {
        throw new Error('Failed to fetch sync status');
      }
      return response.json();
    },
    enabled: shouldPerformQueries,
    refetchInterval: shouldPerformQueries ? 30 * 1000 : false,
    refetchOnWindowFocus: false,
    staleTime: 15 * 1000,
  });

  // When a sync mutation finishes (success or failure), refresh the sync status
  useEffect(() => {
    if (!syncMutation.isPending) {
      queryClient.invalidateQueries({ queryKey: ['/api/calendar/sync-status'] });
    }
  }, [syncMutation.isPending, syncMutation.isSuccess, syncMutation.isError, queryClient]);

  return {
    events,
    isLoading,
    isRefreshing: syncMutation.isPending,
    authStatus,
    syncStatus,
    manualRefresh,
    autoRefresh,
    checkAuthStatus,
    refetch,
  };
}