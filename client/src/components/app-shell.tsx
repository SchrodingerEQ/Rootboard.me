import { useState, useEffect, useCallback, useRef } from "react";
import { SettingsMenu } from "@/components/calendar/settings-menu";
import { PowerSavingOverlay } from "@/components/screensaver/power-saving-overlay";
import { UpdateNotification } from "@/components/calendar/update-notification";
import { NavRail } from "@/components/nav-rail";
import { CalendarSection } from "@/components/calendar/calendar-section";
import ChoresPage from "@/pages/chores";
import DinnerPage from "@/pages/dinner";
import { useChores } from "@/hooks/use-chores";
import { useDinner } from "@/hooks/use-dinner";
import { useScreensaver } from "@/hooks/useScreensaver";
import { useVersionCheck } from "@/hooks/use-version-check";
import { useQuery } from "@tanstack/react-query";
import { useOnlineStatus } from "@/hooks/useOnlineStatus";
import { useScreensaverState } from "@/hooks/useScreensaverState";
import type { Section } from "@/lib/app-types";

const SECTION_STORAGE_KEY = "rootboard-section";

function isSection(value: string | null): value is Section {
  return value === "calendar" || value === "chores" || value === "dinner";
}

interface AuthStatus {
  authenticated: boolean;
  needsAuth: boolean;
  error?: string;
}

export default function AppShell() {
  const [section, setSection] = useState<Section>(() => {
    const saved = localStorage.getItem(SECTION_STORAGE_KEY);
    return isSection(saved) ? saved : "calendar";
  });

  useEffect(() => {
    localStorage.setItem(SECTION_STORAGE_KEY, section);
  }, [section]);

  const [enabledCalendars, setEnabledCalendars] = useState<Set<string>>(new Set());
  const [visibleCalendarsInHeader, setVisibleCalendarsInHeader] = useState<Set<string>>(new Set());
  const [isPowerSaving, setIsPowerSaving] = useState(false);

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

  // Settings coupling #1: SettingsMenu (rendered here in the nav rail) needs
  // authStatus to gate its trigger button. This used to come from
  // CalendarSection's useCalendar() instance; now the shell owns a small,
  // independent query for it (same queryKey, so it shares cache/network
  // with CalendarSection's own auth-status query via react-query). Options
  // below are copied verbatim from use-calendar.ts's auth-status query
  // (lines 43-60) so the two observers on this key never diverge — same
  // online/screensaver gating, retry/backoff, and staleness.
  const isOnline = useOnlineStatus();
  const isScreensaverActive = useScreensaverState();
  const shouldPerformQueries = isOnline && !isScreensaverActive;

  const { data: authStatus } = useQuery<AuthStatus>({
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

  // Hoisted here (rather than inside ChoresPage) so the rail badge stays live
  // while on Calendar/Dinner, not just while the Chores section is showing.
  const chores = useChores();

  // Hoisted here (rather than inside DinnerPage) so switching sections never
  // unmounts the hook: its debounced persist effect would otherwise clear
  // its pending PUT timer without flushing on unmount (losing a vote/edit
  // made within the debounce window), and its in-memory vote cooldown would
  // reset, letting the cooldown be bypassed by bouncing sections.
  const dinner = useDinner();

  // Get calendars for the auto-enable-new-calendars effect below. Same
  // queryKey as CalendarSection's own calendars query, so react-query shares
  // the cache/network request between the two instances.
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

  // Handle calendar removal: prune from all local sets so events vanish immediately
  const handleCalendarRemoved = useCallback((calendarId: string) => {
    seenCalendarIds.current.delete(calendarId);
    setEnabledCalendars(prev => { const s = new Set(prev); s.delete(calendarId); return s; });
    setVisibleCalendarsInHeader(prev => { const s = new Set(prev); s.delete(calendarId); return s; });
  }, []);

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

  // Settings coupling #2: onSubscribeSuccess used to be manualRefresh from
  // CalendarSection's useCalendar() instance. Rather than re-deriving that
  // request sequence by hand (which drifted from the original: no online
  // guard, no isRefreshing/LoadingIndicator, no throttle bookkeeping, no
  // in-flight guard, and an unhandled rejection on sync failure),
  // CalendarSection hands up its real manualRefresh via onRegisterRefresh,
  // and we call it through a ref so SettingsMenu always invokes the current
  // instance without needing manualRefresh to be a stable dependency here.
  const refreshRef = useRef<() => void>(() => {});
  const registerRefresh = useCallback((fn: () => void) => {
    refreshRef.current = fn;
  }, []);

  return (
    <div className="h-screen flex bg-background">
      <NavRail
        active={section}
        onNavigate={setSection}
        choreBadgeCount={chores.openChoreCount}
        settingsButton={authStatus?.authenticated ? (
          <SettingsMenu
            compactTrigger
            visibleCalendarsInHeader={visibleCalendarsInHeader}
            onCalendarToggle={handleCalendarHeaderToggle}
            setBrightness={screensaver.setBrightness}
            currentBrightness={screensaver.currentBrightness}
            onCheckForUpdates={checkForUpdates}
            onRollback={startRollback}
            onSubscribeSuccess={() => refreshRef.current()}
            onCalendarRemoved={handleCalendarRemoved}
          />
        ) : undefined}
      />

      <div className="flex-1 flex flex-col overflow-hidden min-w-0">
        <CalendarSection
          isVisible={section === 'calendar'}
          onSleep={handleSleep}
          isPowerSavingActive={isPowerSavingActive}
          visibleCalendarsInHeader={visibleCalendarsInHeader}
          enabledCalendars={enabledCalendars}
          onCalendarEventToggle={handleCalendarEventToggle}
          onRegisterRefresh={registerRefresh}
        />

        {section === 'chores' && <ChoresPage onSleep={handleSleep} chores={chores} />}
        {section === 'dinner' && <DinnerPage onSleep={handleSleep} dinner={dinner} />}
      </div>

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
