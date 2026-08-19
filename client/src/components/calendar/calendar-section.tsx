import { useState, useEffect, useMemo } from "react";
import { CalendarHeader } from "@/components/calendar/calendar-header";
import { CalendarFilters } from "@/components/calendar/calendar-filters";
import { MonthView } from "@/components/calendar/month-view";
import { WeekView } from "@/components/calendar/week-view";
import { DayView } from "@/components/calendar/day-view";
import { LoadingIndicator } from "@/components/calendar/loading-indicator";
import { EventDetailsDialog } from "@/components/calendar/event-details-dialog";
import { EventFormDialog } from "@/components/calendar/event-form-dialog";
import { AuthDialog } from "@/components/calendar/auth-dialog";
import { useCalendar } from "@/hooks/use-calendar";
import { useQuery } from "@tanstack/react-query";
import { CalendarEvent } from "@shared/schema";
import type { CalendarView } from "@/lib/app-types";

interface CalendarSectionProps {
  /** section === 'calendar' in the shell. Gates only the visible header+main
   * markup below — everything else (useCalendar, dialogs, keyboard nav,
   * auto-refresh, LoadingIndicator) stays mounted and active regardless of
   * which section is showing, matching the original calendar.tsx where this
   * state lived unconditionally at the page's top level. */
  isVisible: boolean;
  onSleep: () => void;
  isPowerSavingActive: boolean;
  /** Owned by the shell (SettingsMenu writes it); passed down read-only for
   * the header row's visibility + CalendarFilters. */
  visibleCalendarsInHeader: Set<string>;
  /** Owned by the shell (both SettingsMenu and this section's own header-row
   * toggle write it via onCalendarEventToggle); passed down for filtering. */
  enabledCalendars: Set<string>;
  onCalendarEventToggle: (calendarId: string, enabled: boolean) => void;
  /** Hands the shell this section's real manualRefresh (from useCalendar), so
   * SettingsMenu's onSubscribeSuccess can trigger the same sync path — same
   * online guard, isRefreshing/LoadingIndicator, throttle bookkeeping,
   * invalidations, and mutation-based error containment — instead of a
   * hand-rolled duplicate. CalendarSection is always mounted, so this
   * registration is always live. */
  onRegisterRefresh?: (fn: () => void) => void;
}

export function CalendarSection({
  isVisible,
  onSleep,
  isPowerSavingActive,
  visibleCalendarsInHeader,
  enabledCalendars,
  onCalendarEventToggle,
  onRegisterRefresh,
}: CalendarSectionProps) {
  const [currentView, setCurrentView] = useState<CalendarView>("month");
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedEvent, setSelectedEvent] = useState<CalendarEvent | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [formDialogOpen, setFormDialogOpen] = useState(false);
  const [editingEvent, setEditingEvent] = useState<CalendarEvent | null>(null);
  const [authDialogOpen, setAuthDialogOpen] = useState(false);

  const {
    events,
    isLoading,
    isRefreshing,
    authStatus,
    syncStatus,
    manualRefresh,
    autoRefresh,
    checkAuthStatus
  } = useCalendar(currentDate, currentView);

  // Get calendars for dialog metadata
  const { data: calendars } = useQuery<any[]>({
    queryKey: ['/api/calendar/calendars'],
    enabled: true,
    staleTime: 5 * 60 * 1000,
  });

  // Hand the shell this section's real manualRefresh so SettingsMenu's
  // onSubscribeSuccess can reuse it (see onRegisterRefresh prop doc above).
  useEffect(() => {
    onRegisterRefresh?.(manualRefresh);
  }, [onRegisterRefresh, manualRefresh]);

  // Show auth dialog when not authenticated
  useEffect(() => {
    if (authStatus?.needsAuth === true) {
      setAuthDialogOpen(true);
    } else {
      setAuthDialogOpen(false);
    }
  }, [authStatus?.needsAuth]);

  // Handle screensaver exit - return to month view of current month
  useEffect(() => {
    const handleScreensaverExit = () => {
      setCurrentView('month');
      setCurrentDate(new Date());
      // Refresh calendar data when exiting screensaver
      manualRefresh();
    };

    window.addEventListener('screensaver-exit', handleScreensaverExit);
    return () => window.removeEventListener('screensaver-exit', handleScreensaverExit);
  }, [manualRefresh]);

  // Filter events based on enabled calendars
  const filteredEvents = useMemo(() => {
    if (enabledCalendars.size === 0) {
      return []; // Show no events when no calendars are selected
    }
    return events.filter(event => enabledCalendars.has(event.calendarId));
  }, [events, enabledCalendars]);

  const handleEventClick = (event: CalendarEvent) => {
    setSelectedEvent(event);
    setIsDialogOpen(true);
  };

  const handleDialogClose = () => {
    setIsDialogOpen(false);
    setSelectedEvent(null);
  };

  const handleNewEvent = () => {
    setEditingEvent(null);
    setFormDialogOpen(true);
  };

  const handleEditEvent = (event: CalendarEvent) => {
    setIsDialogOpen(false);
    setSelectedEvent(null);
    setEditingEvent(event);
    setFormDialogOpen(true);
  };

  const handleFormOpenChange = (open: boolean) => {
    setFormDialogOpen(open);
    if (!open) {
      setEditingEvent(null);
    }
  };

  useEffect(() => {
    checkAuthStatus();
  }, [checkAuthStatus]);

  // Initial calendar sync on auth is handled by use-calendar.ts (which has a
  // ref-guarded one-shot trigger). Don't duplicate that here — having both
  // effects fire produced two parallel /api/calendar/sync calls on every load.

  // Auto-refresh every 10 minutes
  useEffect(() => {
    const interval = setInterval(() => {
      autoRefresh();
    }, 600000); // 10 minutes

    return () => clearInterval(interval);
  }, [autoRefresh]);

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement) return;

      switch (e.key) {
        case 'ArrowLeft':
          e.preventDefault();
          navigateCalendar(-1);
          break;
        case 'ArrowRight':
          e.preventDefault();
          navigateCalendar(1);
          break;
        case 't':
        case 'T':
          setCurrentDate(new Date());
          break;
        case '1':
          setCurrentView('day');
          break;
        case '2':
          setCurrentView('week');
          break;
        case '3':
          setCurrentView('month');
          break;
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [currentView]);

  const navigateCalendar = (direction: number) => {
    const newDate = new Date(currentDate);

    if (currentView === 'month') {
      newDate.setMonth(newDate.getMonth() + direction);
    } else if (currentView === 'week') {
      newDate.setDate(newDate.getDate() + (direction * 7));
    } else if (currentView === 'day') {
      newDate.setDate(newDate.getDate() + direction);
    }

    setCurrentDate(newDate);
  };

  const goToToday = () => {
    setCurrentDate(new Date());
  };

  const handleRefresh = () => {
    manualRefresh();
  };

  // Service account auth has no interactive sign-in flow — clicking the header's
  // auth button just surfaces the error dialog (which explains how to install
  // the key file). Keep this handler so the header's onAuth prop stays wired.
  const handleAuth = () => {
    setAuthDialogOpen(true);
  };

  return (
    <>
      {isVisible && (
        <>
          <div className="bg-rb-surface border-b border-border shadow-sm">
            {/* Main header row */}
            <CalendarHeader
              currentView={currentView}
              currentDate={currentDate}
              onViewChange={setCurrentView}
              onNavigate={navigateCalendar}
              onToday={goToToday}
              onRefresh={handleRefresh}
              onAuth={handleAuth}
              onSleep={onSleep}
              onNewEvent={authStatus?.authenticated ? handleNewEvent : undefined}
              isRefreshing={isRefreshing}
              needsAuth={authStatus?.needsAuth}
              lastSyncAt={syncStatus?.lastSyncAt ?? null}
              lastSyncError={syncStatus?.lastSyncError ?? null}
            />

            {/* Second row with Calendar Filters */}
            {authStatus?.authenticated && (
              <div className="flex items-center px-3 py-0.5 border-t border-rb-grid-line">
                <CalendarFilters
                  onCalendarToggle={onCalendarEventToggle}
                  enabledCalendars={enabledCalendars}
                  visibleCalendarsInHeader={visibleCalendarsInHeader}
                />
              </div>
            )}
          </div>

          <main className="flex-1 overflow-hidden">
            {currentView === 'month' && (
              <div className="h-full">
                <MonthView
                  currentDate={currentDate}
                  events={filteredEvents}
                  isLoading={isLoading}
                  onEventClick={handleEventClick}
                />
              </div>
            )}

            {currentView === 'week' && (
              <div className="h-full">
                <WeekView
                  currentDate={currentDate}
                  events={filteredEvents}
                  isLoading={isLoading}
                  onEventClick={handleEventClick}
                />
              </div>
            )}

            {currentView === 'day' && (
              <div className="h-full">
                <DayView
                  currentDate={currentDate}
                  events={filteredEvents}
                  isLoading={isLoading}
                  onEventClick={handleEventClick}
                  monthEvents={filteredEvents}
                  calendars={calendars}
                />
              </div>
            )}
          </main>
        </>
      )}

      <LoadingIndicator isVisible={isRefreshing} />

      <EventDetailsDialog
        event={selectedEvent}
        isOpen={isDialogOpen}
        onClose={handleDialogClose}
        onEdit={handleEditEvent}
        calendarName={selectedEvent ? calendars?.find((cal: any) => cal.id === selectedEvent.calendarId)?.summary : undefined}
        calendarColor={selectedEvent?.color ?? undefined}
      />

      {/* No defaultStart: new events always pre-fill with today/now, not the
          date the calendar happens to be navigated to. */}
      <EventFormDialog
        open={formDialogOpen && !isPowerSavingActive}
        onOpenChange={handleFormOpenChange}
        event={editingEvent}
      />

      {/* Authentication Dialog */}
      <AuthDialog
        open={authDialogOpen && !isPowerSavingActive}
        onOpenChange={setAuthDialogOpen}
        error={authStatus?.error}
      />
    </>
  );
}
