import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { CalendarHeader } from "@/components/calendar/calendar-header";
import { CalendarFilters } from "@/components/calendar/calendar-filters";
import { SettingsMenu } from "@/components/calendar/settings-menu";
import { MonthView } from "@/components/calendar/month-view";
import { WeekView } from "@/components/calendar/week-view";
import { DayView } from "@/components/calendar/day-view";
import { LoadingIndicator } from "@/components/calendar/loading-indicator";
import { EventDetailsDialog } from "@/components/calendar/event-details-dialog";
import { EventFormDialog } from "@/components/calendar/event-form-dialog";
import { AuthDialog } from "@/components/calendar/auth-dialog";
import { PowerSavingOverlay } from "@/components/screensaver/power-saving-overlay";
import { UpdateNotification } from "@/components/calendar/update-notification";
import { useCalendar } from "@/hooks/use-calendar";
import { useToast } from "@/hooks/use-toast";
import { useScreensaver } from "@/hooks/useScreensaver";
import { useVersionCheck } from "@/hooks/use-version-check";
import { useQuery } from "@tanstack/react-query";
import { CalendarEvent } from "@shared/schema";

export type CalendarView = "day" | "week" | "month";

export default function CalendarPage() {
  const [currentView, setCurrentView] = useState<CalendarView>("month");
  const [currentDate, setCurrentDate] = useState(new Date());
  const [enabledCalendars, setEnabledCalendars] = useState<Set<string>>(new Set());
  const [visibleCalendarsInHeader, setVisibleCalendarsInHeader] = useState<Set<string>>(new Set());
  const [selectedEvent, setSelectedEvent] = useState<CalendarEvent | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [formDialogOpen, setFormDialogOpen] = useState(false);
  const [editingEvent, setEditingEvent] = useState<CalendarEvent | null>(null);
  const [authDialogOpen, setAuthDialogOpen] = useState(false);
  const [isPowerSaving, setIsPowerSaving] = useState(false);
  const { toast } = useToast();
  
  // Version checking for updates
  const { showUpdateNotification, latestVersion, releaseNotes, releaseName, releaseUrl, dismissUpdate, startUpdate, startRollback, updateStatus, isUpdating, checkForUpdates } = useVersionCheck();
  
  // Initialize inactivity timer with 5-minute timeout and brightness control
  const screensaver = useScreensaver({
    inactivityTimeout: 5 * 60 * 1000, // 5 minutes
    dimBrightness: 0.2, // 20% brightness during power saving
    originalBrightness: (() => {
      const saved = localStorage.getItem('calendar-brightness');
      return saved ? parseInt(saved) / 100 : 1.0;
    })() // Load saved brightness or default to 100%
  });
  
  // Manual sleep button handler
  const handleSleep = useCallback(() => {
    setIsPowerSaving(true);
  }, []);
  
  // Wake from power saving mode (both manual and automatic)
  const handleWake = useCallback(() => {
    setIsPowerSaving(false);
    screensaver.exitScreensaver();
  }, [screensaver]);
  
  // Power saving is active if manually triggered OR auto-triggered by inactivity
  const isPowerSavingActive = isPowerSaving || screensaver.isActive;

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

  // Track calendar IDs we have already seen so we only auto-enable genuinely
  // new ones. This prevents a normal refetch (or post-subscribe invalidation)
  // from re-enabling calendars the user intentionally toggled off.
  const seenCalendarIds = useRef<Set<string>>(new Set());

  useEffect(() => {
    if (!calendars || calendars.length === 0) return;

    const newIds = calendars
      .map(cal => cal.id)
      .filter(id => !seenCalendarIds.current.has(id));

    if (newIds.length === 0) return; // nothing new — don't touch toggle state

    // Record them so future refetches don't re-enable them
    for (const id of newIds) seenCalendarIds.current.add(id);

    setEnabledCalendars(prev => {
      const next = new Set(prev);
      for (const id of newIds) next.add(id);
      return next;
    });
    setVisibleCalendarsInHeader(prev => {
      const next = new Set(prev);
      for (const id of newIds) next.add(id);
      return next;
    });
  }, [calendars]);

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

  // Handle header button clicks - toggles event visibility
  const handleCalendarEventToggle = (calendarId: string, enabled: boolean) => {
    setEnabledCalendars(prev => {
      const newSet = new Set(prev);
      if (enabled) {
        newSet.add(calendarId);
      } else {
        newSet.delete(calendarId);
      }
      return newSet;
    });
  };

  // Handle settings menu toggles - controls both header visibility AND event visibility
  const handleCalendarHeaderToggle = (calendarId: string, visible: boolean) => {
    // Update header visibility
    setVisibleCalendarsInHeader(prev => {
      const newSet = new Set(prev);
      if (visible) {
        newSet.add(calendarId);
      } else {
        newSet.delete(calendarId);
      }
      return newSet;
    });
    
    // Also update event visibility to match
    setEnabledCalendars(prev => {
      const newSet = new Set(prev);
      if (visible) {
        newSet.add(calendarId);
      } else {
        newSet.delete(calendarId);
      }
      return newSet;
    });
  };

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
    <div className="h-screen flex flex-col bg-background">
      <div className="bg-white border-b border-border shadow-sm">
        {/* Main header row */}
        <CalendarHeader
          currentView={currentView}
          currentDate={currentDate}
          onViewChange={setCurrentView}
          onNavigate={navigateCalendar}
          onToday={goToToday}
          onRefresh={handleRefresh}
          onAuth={handleAuth}
          onSleep={handleSleep}
          onNewEvent={authStatus?.authenticated ? handleNewEvent : undefined}
          isRefreshing={isRefreshing}
          needsAuth={authStatus?.needsAuth}
          lastSyncAt={syncStatus?.lastSyncAt ?? null}
          lastSyncError={syncStatus?.lastSyncError ?? null}
          settingsButton={authStatus?.authenticated ? (
            <SettingsMenu 
              visibleCalendarsInHeader={visibleCalendarsInHeader}
              onCalendarToggle={handleCalendarHeaderToggle}
              setBrightness={screensaver.setBrightness}
              currentBrightness={screensaver.currentBrightness}
              onCheckForUpdates={checkForUpdates}
              onRollback={startRollback}
              onSubscribeSuccess={manualRefresh}
            />
          ) : undefined}
        />
        
        {/* Second row with Calendar Filters */}
        {authStatus?.authenticated && (
          <div className="flex items-center px-3 py-0.5 border-t border-gray-100">
            <CalendarFilters 
              onCalendarToggle={handleCalendarEventToggle}
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
              events={events}
              isLoading={isLoading}
              enabledCalendars={enabledCalendars}
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
              enabledCalendars={enabledCalendars}
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
              enabledCalendars={enabledCalendars}
            />
          </div>
        )}
      </main>

      <LoadingIndicator isVisible={isRefreshing} />
      
      <EventDetailsDialog 
        event={selectedEvent}
        isOpen={isDialogOpen}
        onClose={handleDialogClose}
        onEdit={handleEditEvent}
        calendarName={selectedEvent ? calendars?.find((cal: any) => cal.id === selectedEvent.calendarId)?.summary : undefined}
        calendarColor={selectedEvent?.color ?? undefined}
      />

      <EventFormDialog
        open={formDialogOpen && !isPowerSavingActive}
        onOpenChange={handleFormOpenChange}
        event={editingEvent}
        defaultStart={currentDate}
      />

      {/* Authentication Dialog */}
      <AuthDialog 
        open={authDialogOpen && !isPowerSavingActive}
        onOpenChange={setAuthDialogOpen}
        error={authStatus?.error}
      />

      {/* Update Available Notification */}
      <UpdateNotification
        isOpen={(showUpdateNotification || isUpdating) && !isPowerSavingActive}
        latestVersion={latestVersion}
        releaseNotes={releaseNotes}
        releaseName={releaseName}
        releaseUrl={releaseUrl}
        onDismiss={dismissUpdate}
        onUpdate={startUpdate}
        onRollback={startRollback}
        updateStatus={updateStatus}
        isUpdating={isUpdating}
      />

      {/* Power Saving Overlay (manual SLEEP button or auto after 2 min inactivity) */}
      <PowerSavingOverlay 
        isActive={isPowerSavingActive}
        onWake={handleWake}
      />
    </div>
  );
}
