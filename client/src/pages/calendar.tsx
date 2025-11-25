import { useState, useEffect, useMemo, useCallback } from "react";
import { CalendarHeader } from "@/components/calendar/calendar-header";
import { CalendarFilters } from "@/components/calendar/calendar-filters";
import { SettingsMenu } from "@/components/calendar/settings-menu";
import { MonthView } from "@/components/calendar/month-view";
import { WeekView } from "@/components/calendar/week-view";
import { DayView } from "@/components/calendar/day-view";
import { LoadingIndicator } from "@/components/calendar/loading-indicator";
import { EventDetailsDialog } from "@/components/calendar/event-details-dialog";
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
  const [authDialogOpen, setAuthDialogOpen] = useState(false);
  const [isPowerSaving, setIsPowerSaving] = useState(false);
  const { toast } = useToast();
  
  // Version checking for updates
  const { showUpdateNotification, latestVersion, dismissUpdate } = useVersionCheck();
  
  // Initialize inactivity timer with 2-minute timeout and brightness control
  const screensaver = useScreensaver({
    inactivityTimeout: 2 * 60 * 1000, // 2 minutes
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

  // Initialize calendars when data is loaded
  useEffect(() => {
    if (calendars && calendars.length > 0) {
      const allCalendarIds = new Set(calendars.map(cal => cal.id));
      setEnabledCalendars(prev => {
        // Only initialize if empty
        if (prev.size === 0) {
          return allCalendarIds;
        }
        return prev;
      });
      
      setVisibleCalendarsInHeader(prev => {
        // Only initialize if empty
        if (prev.size === 0) {
          return allCalendarIds;
        }
        return prev;
      });
    }
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

  useEffect(() => {
    checkAuthStatus();
  }, [checkAuthStatus]);

  // Auto-sync events when authentication becomes available
  useEffect(() => {
    if (authStatus?.authenticated && events.length === 0 && !isRefreshing) {
      console.log('Auto-syncing calendar events on authentication');
      manualRefresh();
    }
  }, [authStatus?.authenticated, events.length, isRefreshing, manualRefresh]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('auth') === 'success') {
      toast({
        title: "Authentication Successful",
        description: "Google Calendar has been connected successfully.",
      });
      window.history.replaceState({}, document.title, window.location.pathname);
    } else if (params.get('auth') === 'error') {
      toast({
        title: "Authentication Failed",
        description: "Failed to connect to Google Calendar. Please try again.",
        variant: "destructive",
      });
      window.history.replaceState({}, document.title, window.location.pathname);
    }
  }, [toast]);

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

  const handleAuth = () => {
    // Open OAuth in a popup to avoid redirect issues
    const popup = window.open('/api/auth/google', 'google-auth', 'width=500,height=600,scrollbars=yes,resizable=yes');
    
    if (popup) {
      // Poll to check if popup closes (indicating completion)
      const checkClosed = setInterval(() => {
        if (popup.closed) {
          clearInterval(checkClosed);
          // Refresh to check auth status
          setTimeout(() => {
            window.location.reload();
          }, 1000);
        }
      }, 1000);
    } else {
      toast({
        title: "Popup Blocked",
        description: "Please allow popups and try again, or use direct navigation.",
        variant: "destructive",
      });
    }
  };

  const handleManualAuth = async (code: string) => {
    try {
      const response = await fetch('/api/auth/google/manual', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ code }),
      });

      if (response.ok) {
        toast({
          title: "Authentication Successful",
          description: "Google Calendar connected successfully!",
        });
        // Refresh events after successful auth
        setTimeout(() => {
          manualRefresh();
        }, 1000);
      } else {
        throw new Error('Authentication failed');
      }
    } catch (error) {
      toast({
        title: "Authentication Failed", 
        description: "Please try again or check the authorization code.",
        variant: "destructive",
      });
    }
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
          isRefreshing={isRefreshing}
          needsAuth={authStatus?.needsAuth}
          settingsButton={authStatus?.authenticated ? (
            <SettingsMenu 
              visibleCalendarsInHeader={visibleCalendarsInHeader}
              onCalendarToggle={handleCalendarHeaderToggle}
              setBrightness={screensaver.setBrightness}
              currentBrightness={screensaver.currentBrightness}
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
        <div className={`view-container h-full ${currentView === 'month' ? 'active' : ''}`}>
          <MonthView 
            currentDate={currentDate} 
            events={events}
            isLoading={isLoading}
            enabledCalendars={enabledCalendars}
            onEventClick={handleEventClick}
          />
        </div>
        
        <div className={`view-container h-full ${currentView === 'week' ? 'active' : ''}`}>
          <WeekView 
            currentDate={currentDate} 
            events={filteredEvents}
            isLoading={isLoading}
            enabledCalendars={enabledCalendars}
            onEventClick={handleEventClick}
          />
        </div>
        
        <div className={`view-container h-full ${currentView === 'day' ? 'active' : ''}`}>
          <DayView 
            currentDate={currentDate} 
            events={filteredEvents}
            isLoading={isLoading}
            onEventClick={handleEventClick}
            enabledCalendars={enabledCalendars}
          />
        </div>
      </main>

      <LoadingIndicator isVisible={isRefreshing} />
      
      <EventDetailsDialog 
        event={selectedEvent}
        isOpen={isDialogOpen}
        onClose={handleDialogClose}
        calendarName={selectedEvent ? calendars?.find((cal: any) => cal.id === selectedEvent.calendarId)?.summary : undefined}
        calendarColor={selectedEvent?.color ?? undefined}
      />

      {/* Authentication Dialog */}
      <AuthDialog 
        open={authDialogOpen && !isPowerSavingActive}
        onOpenChange={setAuthDialogOpen}
      />

      {/* Update Available Notification */}
      <UpdateNotification
        isOpen={showUpdateNotification && !isPowerSavingActive}
        latestVersion={latestVersion}
        onDismiss={dismissUpdate}
      />

      {/* Power Saving Overlay (manual SLEEP button or auto after 2 min inactivity) */}
      <PowerSavingOverlay 
        isActive={isPowerSavingActive}
        onWake={handleWake}
      />
    </div>
  );
}
