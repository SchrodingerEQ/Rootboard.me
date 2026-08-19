import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { createRoot, type Root } from "react-dom/client";
import { QueryClientProvider, useQuery } from "@tanstack/react-query";
import { queryClient } from "@/lib/queryClient";
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
import { validateBuiltinManifest } from "@/widgets/validate-manifest";
import type { RootboardWidget, WidgetHost, WidgetInstance } from "@/widgets/types";
import type { CalendarEvent } from "@shared/schema";
import type { CalendarView } from "@/lib/app-types";
import {
  CALENDAR_SUBSCRIBE_SUCCESS_EVENT,
  DISABLED_CALENDARS_KEY,
  HIDDEN_CALENDARS_KEY,
  POWER_SAVING_CHANGE_EVENT,
  deriveCalendarVisibility,
  toCalendarIdSet,
  withCalendarId,
  type PowerSavingChangeDetail,
} from "./shell-bridge";
import rawManifest from "./manifest.json";

/**
 * Calendar as a contract widget (CONTRACT.md §3-§5) — the whole of the old
 * `client/src/components/calendar/calendar-section.tsx` moved in here, with
 * three deliberate changes:
 *
 * 1. **No internal 10-minute `setInterval`** (ratified delta 4). The manifest
 *    declares `refresh.intervalSeconds: 600` and the host's RefreshScheduler
 *    calls `instance.refresh()` -> `autoRefresh()` only while the widget is
 *    visible, online and awake — plus one catch-up fire when it becomes
 *    visible with an overdue interval. Net: no background sync while another
 *    section is showing, but never stale on return. `useCalendar`'s own
 *    10-minute throttle inside `autoRefresh()` is left untouched as a second
 *    guard.
 * 2. **Per-calendar visibility comes from `host.settings`** (ratified delta
 *    2) instead of two `Set`s owned by the shell — see `./shell-bridge.ts`
 *    for the shape, the derivations, and why new calendars are visible by
 *    default. Writes go back through the shell (it owns config persistence);
 *    the widget only reads.
 * 3. **Keyboard shortcuts are gated on host visibility.** Everything else
 *    stays mounted while hidden (ratified delta 3, keep-alive) — the host
 *    display-hides the container rather than unmounting, so view state,
 *    scroll positions and the `useCalendar` query instance all survive
 *    navigation. That is why there is no `isVisible &&` around the markup
 *    any more: hiding is the host's job now.
 *
 * The manifest declares NO `settings` field descriptors — see
 * `./shell-bridge.ts` for why (id sets can't be expressed as
 * string/number/boolean/select fields; the Settings popover and the chip row
 * are their editor).
 */
export const manifest = validateBuiltinManifest(rawManifest);

/**
 * Mutable handoff between the imperative `WidgetInstance` the host holds and
 * the React tree inside this widget's own root. `createRoot().render()` is
 * scheduled, not synchronous, so the host can legitimately call
 * `onVisibilityChange(true)` before `CalendarApp` has rendered even once —
 * hence `visible` is stored on the bridge itself (seeding `useState`) rather
 * than only pushed through a callback that may not be registered yet.
 */
interface CalendarBridge {
  visible: boolean;
  notifyVisible: ((visible: boolean) => void) | null;
  refresh: (() => void) | null;
}

/** Live view of this widget's persisted settings blob. */
function useHostSettings(host: WidgetHost): Record<string, unknown> {
  const [settings, setSettings] = useState<Record<string, unknown>>(() => host.settings.get());
  useEffect(() => {
    // Re-read on (re)subscribe: the dashboard-config query may have resolved
    // between this component's first render and this effect.
    setSettings(host.settings.get());
    return host.settings.subscribe(setSettings);
  }, [host]);
  return settings;
}

interface CalendarAppProps {
  host: WidgetHost;
  bridge: CalendarBridge;
}

function CalendarApp({ host, bridge }: CalendarAppProps) {
  const [isVisible, setIsVisible] = useState(bridge.visible);
  const [isPowerSavingActive, setIsPowerSavingActive] = useState(false);
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

  // Get calendars for dialog metadata, the chip row, and the visibility
  // derivations below (this is the "subscribed" set).
  const { data: calendars } = useQuery<any[]>({
    queryKey: ['/api/calendar/calendars'],
    enabled: true,
    staleTime: 5 * 60 * 1000,
  });

  // --- Host wiring --------------------------------------------------------

  // Host visibility -> React state (see CalendarBridge for the seeding note).
  useEffect(() => {
    bridge.notifyVisible = setIsVisible;
    setIsVisible(bridge.visible);
    return () => {
      bridge.notifyVisible = null;
    };
  }, [bridge]);

  // Host refresh cadence -> autoRefresh. Routed through a ref so the bridge
  // registration doesn't churn every time useCalendar hands back a new
  // `autoRefresh` identity.
  const autoRefreshRef = useRef(autoRefresh);
  autoRefreshRef.current = autoRefresh;
  useEffect(() => {
    bridge.refresh = () => autoRefreshRef.current();
    return () => {
      bridge.refresh = null;
    };
  }, [bridge]);

  // Shell-owned power-saving overlay -> dialog suppression (see shell-bridge).
  useEffect(() => {
    const handlePowerSavingChange = (event: Event) => {
      const detail = (event as CustomEvent<PowerSavingChangeDetail>).detail;
      setIsPowerSavingActive(!!detail?.isActive);
    };
    window.addEventListener(POWER_SAVING_CHANGE_EVENT, handlePowerSavingChange);
    return () => window.removeEventListener(POWER_SAVING_CHANGE_EVENT, handlePowerSavingChange);
  }, []);

  // Settings popover subscribed to a new calendar -> run OUR manualRefresh.
  useEffect(() => {
    const handleSubscribeSuccess = () => {
      manualRefresh();
    };
    window.addEventListener(CALENDAR_SUBSCRIBE_SUCCESS_EVENT, handleSubscribeSuccess);
    return () => window.removeEventListener(CALENDAR_SUBSCRIBE_SUCCESS_EVENT, handleSubscribeSuccess);
  }, [manualRefresh]);

  // --- Visibility settings (ratified delta 2) -----------------------------

  const settings = useHostSettings(host);
  const hiddenCalendars = useMemo(
    () => toCalendarIdSet(settings[HIDDEN_CALENDARS_KEY]),
    [settings],
  );
  const disabledCalendars = useMemo(
    () => toCalendarIdSet(settings[DISABLED_CALENDARS_KEY]),
    [settings],
  );

  const subscribedIds = useMemo<string[]>(
    () => (calendars ?? []).map((cal: any) => cal.id as string),
    [calendars],
  );

  // visible-in-header = subscribed − hidden;  events-on = ... − disabled.
  // (Pure + spec'd in ./shell-bridge.spec.ts.)
  const { visibleInHeader: visibleCalendarsInHeader, eventsOn: enabledCalendars } = useMemo(
    () => deriveCalendarVisibility(subscribedIds, hiddenCalendars, disabledCalendars),
    [subscribedIds, hiddenCalendars, disabledCalendars],
  );

  // Chip tap -> patch `disabledCalendars` via host.settings.patch()
  // (founder-ratified 2026-08-19; replaces the CALENDAR_SETTINGS_PATCH_EVENT
  // window-event bridge). `build` receives the CURRENT settings, read fresh
  // by the shell at write time — not this component's own `disabledCalendars`
  // snapshot — so two chip taps for different calendars in the same tick
  // don't race (same rationale the old event's doc comment carried; see
  // shell-bridge.ts).
  const handleCalendarEventToggle = useCallback((calendarId: string, enabled: boolean) => {
    host.settings.patch((current) => {
      const disabled = toCalendarIdSet(current[DISABLED_CALENDARS_KEY]);
      return { [DISABLED_CALENDARS_KEY]: withCalendarId(disabled, calendarId, !enabled) };
    });
  }, [host]);

  // --- Everything below is the old CalendarSection, unchanged -------------

  // Show auth dialog when not authenticated
  useEffect(() => {
    if (authStatus?.needsAuth === true) {
      setAuthDialogOpen(true);
    } else {
      setAuthDialogOpen(false);
    }
  }, [authStatus?.needsAuth]);

  // Handle screensaver exit - return to month view of current month. Stays a
  // window event: it is page-global and fired by the shell's screensaver hook.
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

  // Filter events based on enabled calendars. Unchanged rule: with nothing
  // enabled (no calendars loaded yet, or every calendar hidden/disabled) no
  // events are shown.
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

  // Auto-refresh is NOT a timer here any more — the host's RefreshScheduler
  // drives it via the manifest's `refresh.intervalSeconds` (ratified delta 4).
  // See the bridge.refresh registration above.

  // Keyboard navigation — only while this widget is the visible section
  // (keep-alive means it stays mounted behind other sections, and a hidden
  // widget must not eat arrow keys / view shortcuts).
  useEffect(() => {
    if (!isVisible) return;

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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentView, isVisible]);

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
    <div className="h-full flex flex-col">
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
          onSleep={() => host.ui.sleep()}
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

      {/* The sync indicator is screen-level chrome, not calendar content: it
          used to show while any section was on screen. The widget container
          is display:none'd when another section is active, so it is portaled
          to document.body to keep exactly that behavior. The dialogs below
          need no such treatment — Radix already portals them. */}
      {createPortal(<LoadingIndicator isVisible={isRefreshing} />, document.body)}

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
    </div>
  );
}

const calendarWidget: RootboardWidget = {
  mount(container: HTMLElement, host: WidgetHost): WidgetInstance {
    const root: Root = createRoot(container);
    const bridge: CalendarBridge = { visible: false, notifyVisible: null, refresh: null };

    root.render(
      <QueryClientProvider client={queryClient}>
        <CalendarApp host={host} bridge={bridge} />
      </QueryClientProvider>,
    );

    return {
      unmount() {
        root.unmount();
      },
      refresh() {
        bridge.refresh?.();
      },
      onVisibilityChange(visible: boolean) {
        bridge.visible = visible;
        bridge.notifyVisible?.(visible);
      },
    };
  },
};

export default calendarWidget;
