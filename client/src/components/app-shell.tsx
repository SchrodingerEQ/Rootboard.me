import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { SettingsMenu } from "@/components/calendar/settings-menu";
import { PowerSavingOverlay } from "@/components/screensaver/power-saving-overlay";
import { UpdateNotification } from "@/components/calendar/update-notification";
import { NavRail, LEGACY_NAV_META, DEFAULT_NAV_ICON, type NavRailItem } from "@/components/nav-rail";
import { CalendarSection } from "@/components/calendar/calendar-section";
import { WidgetHostMount, type WidgetHostMountEntry } from "@/components/widget-host-mount";
import DinnerPage from "@/pages/dinner";
import { useDinner } from "@/hooks/use-dinner";
import { useScreensaver } from "@/hooks/useScreensaver";
import { useVersionCheck } from "@/hooks/use-version-check";
import { useQuery } from "@tanstack/react-query";
import { useOnlineStatus } from "@/hooks/useOnlineStatus";
import { useScreensaverState } from "@/hooks/useScreensaverState";
import { BUILTIN_WIDGETS } from "@/widgets/registry";
import { createWidgetHost, type WidgetHostHandle } from "@/lib/widget-host-services";
import { defaultDashboardConfig, type DashboardConfig } from "@shared/dashboard-config";

const SECTION_STORAGE_KEY = "rootboard-section";

interface AuthStatus {
  authenticated: boolean;
  needsAuth: boolean;
  error?: string;
}

interface DashboardConfigResponse {
  config: DashboardConfig;
  source: "file" | "default";
}

export default function AppShell() {
  // Widened to `string` now that nav sections are config-driven (any
  // enabled dashboard-config widget id), not a fixed 3-way union. Same
  // localStorage key/values as before — a stored "calendar"/"chores"/
  // "dinner" still round-trips unchanged.
  const [section, setSection] = useState<string>(() => {
    return localStorage.getItem(SECTION_STORAGE_KEY) ?? "calendar";
  });

  useEffect(() => {
    localStorage.setItem(SECTION_STORAGE_KEY, section);
  }, [section]);

  // Dashboard config — source of truth for nav order/enabled state
  // (CONTRACT.md §5). `defaultDashboardConfig()` stands in as a stable
  // placeholder while the query is still loading (its own object identity
  // is fixed via useMemo so config-derived useMemo/useEffect deps below
  // don't churn every render before real data arrives).
  const defaultConfig = useMemo(() => defaultDashboardConfig(), []);
  const configQuery = useQuery<DashboardConfigResponse>({
    queryKey: ["/api/config/dashboard"],
  });
  const dashboardConfig = configQuery.data?.config ?? defaultConfig;

  // Once the real config has loaded, fall back to defaultWidget if the
  // localStorage-remembered (or default "calendar") section isn't a
  // currently-enabled widget id — mirrors CONTRACT.md §5: "defaultWidget
  // is what survives a browser reset."
  useEffect(() => {
    if (!configQuery.data) return;
    const enabledIds = dashboardConfig.widgets.filter((w) => w.enabled).map((w) => w.id);
    if (enabledIds.includes(section)) return;
    // Schema only guarantees SOME widget is enabled, not that defaultWidget
    // itself is one of them — fall back to the first enabled id in that
    // (config-authoring-error) case so this can't loop forever re-setting
    // section to a defaultWidget that will never be in enabledIds.
    const fallback = enabledIds.includes(dashboardConfig.defaultWidget)
      ? dashboardConfig.defaultWidget
      : enabledIds[0];
    if (fallback && fallback !== section) setSection(fallback);
  }, [configQuery.data, dashboardConfig, section]);

  // BUILTIN_WIDGETS is a static module-level constant — this map never
  // needs to be rebuilt after first render.
  const builtinById = useMemo(() => new Map(BUILTIN_WIDGETS.map((w) => [w.manifest.id, w])), []);

  // Config ids that are both enabled AND actually ported to the widget
  // contract (i.e. have a BUILTIN_WIDGETS entry) — this is what drives
  // WidgetHostMount. Calendar/dinner are enabled-in-config but not yet
  // built-in (Tasks 7-8), so they never appear here; they stay legacy-
  // rendered below.
  const enabledBuiltinIds = useMemo(
    () => dashboardConfig.widgets.filter((w) => w.enabled && builtinById.has(w.id)).map((w) => w.id),
    [dashboardConfig, builtinById],
  );

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

  // --- Widget hosts -------------------------------------------------------
  // One WidgetHost per enabled built-in widget, owned by the shell (per
  // WidgetHostMount's contract: it never creates/disposes hosts itself —
  // see client/src/components/widget-host-mount.tsx). Kept in a plain ref
  // (not React state) because host identity must stay stable across
  // renders; `hostsVersion` is bumped only when a host is actually
  // created/disposed, so effects/memos that need to react to that can
  // depend on it without depending on the ref itself (which never changes
  // identity).
  const hostsRef = useRef(new Map<string, WidgetHostHandle>());
  const settingsListenersRef = useRef(new Map<string, Set<(next: Record<string, unknown>) => void>>());
  const dashboardConfigRef = useRef(dashboardConfig);
  dashboardConfigRef.current = dashboardConfig;
  const [hostsVersion, setHostsVersion] = useState(0);

  // Per-widget-id badge counts, fed by each host's `ui.setBadge` callback
  // (replaces the old hoisted-useChores -> NavRail `choreBadgeCount` prop).
  const [badges, setBadges] = useState<Record<string, number | null>>({});

  useEffect(() => {
    const enabledSet = new Set(enabledBuiltinIds);
    let changed = false;

    for (const id of enabledBuiltinIds) {
      if (hostsRef.current.has(id)) continue;
      const handle = createWidgetHost({
        widgetId: id,
        getSettings: () => dashboardConfigRef.current.widgets.find((w) => w.id === id)?.settings ?? {},
        subscribeSettings: (cb) => {
          let listeners = settingsListenersRef.current.get(id);
          if (!listeners) {
            listeners = new Set();
            settingsListenersRef.current.set(id, listeners);
          }
          listeners.add(cb);
          return () => listeners!.delete(cb);
        },
        setBadge: (count) => {
          setBadges((prev) => (prev[id] === count ? prev : { ...prev, [id]: count }));
        },
        sleep: handleSleep,
      });
      hostsRef.current.set(id, handle);
      changed = true;
    }

    // Dispose ONLY hosts for widgets that left the enabled set (disabled or
    // uninstalled) — flush() runs before dispose() inside WidgetHostHandle.
    for (const [id, handle] of Array.from(hostsRef.current.entries())) {
      if (enabledSet.has(id)) continue;
      handle.dispose();
      hostsRef.current.delete(id);
      settingsListenersRef.current.delete(id);
      setBadges((prev) => {
        if (!(id in prev)) return prev;
        const next = { ...prev };
        delete next[id];
        return next;
      });
      changed = true;
    }

    if (changed) setHostsVersion((v) => v + 1);
  }, [enabledBuiltinIds, handleSleep]);

  // Notify each widget's settings subscribers when the dashboard config
  // actually changes (real query data only — never fire off the initial
  // placeholder-default render before the first real load completes).
  useEffect(() => {
    if (!configQuery.data) return;
    Array.from(settingsListenersRef.current.entries()).forEach(([id, listeners]) => {
      const settings = dashboardConfig.widgets.find((w) => w.id === id)?.settings ?? {};
      listeners.forEach((cb) => cb(settings));
    });
  }, [configQuery.data, dashboardConfig]);

  // App-shutdown safety net — the kiosk normally runs for the app's whole
  // life, but if AppShell itself ever unmounts, flush+dispose whatever
  // hosts are still live rather than leaking their timers.
  useEffect(() => {
    return () => {
      Array.from(hostsRef.current.values()).forEach((handle) => handle.dispose());
      hostsRef.current.clear();
    };
  }, []);

  // Entries for WidgetHostMount — memoized per its contract (a fresh array
  // identity every render is harmless but wasteful). `hostsVersion` is a
  // synthetic dependency: hostsRef mutates imperatively (see above) so this
  // must be told to recompute whenever a host is created/disposed even
  // though hostsRef's own identity never changes.
  const widgetEntries = useMemo<WidgetHostMountEntry[]>(() => {
    const entries: WidgetHostMountEntry[] = [];
    for (const id of enabledBuiltinIds) {
      const handle = hostsRef.current.get(id);
      const builtin = builtinById.get(id);
      if (!handle || !builtin) continue;
      entries.push({ manifest: builtin.manifest, widget: builtin.widget, host: handle.host });
    }
    return entries;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabledBuiltinIds, builtinById, hostsVersion]);

  // Nav-rail items, in config order: a BUILTIN_WIDGETS entry (chores) uses
  // its manifest name + registry navIcon; an id not yet ported to the
  // widget contract (calendar, dinner) falls back to LEGACY_NAV_META so it
  // keeps rendering with today's exact icon/label; any other unknown id
  // (references a widget that isn't installed) is skipped in v1.
  const navItems = useMemo<NavRailItem[]>(() => {
    const items: NavRailItem[] = [];
    for (const w of dashboardConfig.widgets) {
      if (!w.enabled) continue;
      const builtin = builtinById.get(w.id);
      if (builtin) {
        items.push({
          id: w.id,
          label: builtin.manifest.name,
          icon: builtin.navIcon ?? DEFAULT_NAV_ICON,
          badgeCount: badges[w.id] ?? null,
        });
        continue;
      }
      const legacy = LEGACY_NAV_META[w.id];
      if (legacy) {
        items.push({ id: w.id, label: legacy.label, icon: legacy.icon, badgeCount: badges[w.id] ?? null });
      }
    }
    return items;
  }, [dashboardConfig, builtinById, badges]);

  return (
    <div className="h-screen flex bg-background">
      <NavRail
        items={navItems}
        active={section}
        onNavigate={setSection}
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

        {section === 'dinner' && <DinnerPage onSleep={handleSleep} dinner={dinner} />}

        <WidgetHostMount entries={widgetEntries} activeId={section} />
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
