import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { SettingsMenu } from "@/components/calendar/settings-menu";
import { PowerSavingOverlay } from "@/components/screensaver/power-saving-overlay";
import { UpdateNotification } from "@/components/calendar/update-notification";
import { NavRail, DEFAULT_NAV_ICON, type NavRailItem } from "@/components/nav-rail";
import { WidgetHostMount, type WidgetHostMountEntry } from "@/components/widget-host-mount";
import { useScreensaver } from "@/hooks/useScreensaver";
import { useVersionCheck } from "@/hooks/use-version-check";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useOnlineStatus } from "@/hooks/useOnlineStatus";
import { useScreensaverState } from "@/hooks/useScreensaverState";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { BUILTIN_WIDGETS } from "@/widgets/registry";
import { createWidgetHost, type WidgetHostHandle } from "@/lib/widget-host-services";
import { applyWidgetSettingsPatch } from "@/lib/widget-config";
import {
  CALENDAR_SUBSCRIBE_SUCCESS_EVENT,
  CALENDAR_WIDGET_ID,
  DISABLED_CALENDARS_KEY,
  HIDDEN_CALENDARS_KEY,
  POWER_SAVING_CHANGE_EVENT,
  toCalendarIdSet,
  withCalendarId,
  type PowerSavingChangeDetail,
} from "@/widgets/calendar/shell-bridge";
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
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const configQuery = useQuery<DashboardConfigResponse>({
    queryKey: ["/api/config/dashboard"],
    // CONTRACT.md §5: "hand-edits over SSH are picked up without a restart
    // on the next poll" — the server already re-reads the file on every GET
    // (configService.ts), but until now the client only ever fetched once.
    // Poll here so a hand-edited data/config/dashboard.json surfaces without
    // requiring a reload. react-query's default structural sharing means an
    // unchanged response produces the same object identity, so this can't
    // cause a re-render (or re-run any config-derived memo/effect below)
    // when nothing on disk actually changed.
    refetchInterval: 60_000,
  });
  const dashboardConfig = configQuery.data?.config ?? defaultConfig;

  // BUILTIN_WIDGETS is a static module-level constant — this map never
  // needs to be rebuilt after first render.
  const builtinById = useMemo(() => new Map(BUILTIN_WIDGETS.map((w) => [w.manifest.id, w])), []);

  // Config entries that can actually RENDER a pane: enabled AND ported to
  // the widget contract (BUILTIN_WIDGETS). As of Task 8 that is every
  // first-party section — the LEGACY_NAV_META fallback for not-yet-ported
  // ids is gone. An id enabled in config but not installed (e.g. a
  // hand-edited data/config/dashboard.json referencing a widget that isn't
  // built) is excluded here — this is the exact set navItems renders from
  // below, and the ONLY set a stored/active `section` should ever be
  // validated against (see fallback effect below). Extracted so navItems
  // and that effect share one resolution instead of two independently
  // maintained lists drifting apart.
  const renderableEntries = useMemo(() => {
    const entries: Array<{ id: string; label: string; icon: NavRailItem["icon"] }> = [];
    for (const w of dashboardConfig.widgets) {
      if (!w.enabled) continue;
      const builtin = builtinById.get(w.id);
      if (!builtin) continue;
      entries.push({ id: w.id, label: builtin.manifest.name, icon: builtin.navIcon ?? DEFAULT_NAV_ICON });
    }
    return entries;
  }, [dashboardConfig, builtinById]);

  const renderableIds = useMemo(() => renderableEntries.map((e) => e.id), [renderableEntries]);

  // Every INSTALLED widget (builtin-backed), enabled or not, in config
  // order — the layout picker's source list (Task 9). Unlike
  // renderableEntries above this does NOT filter on `enabled`: the picker
  // needs to show disabled widgets too, with a switch to re-enable them. An
  // id enabled in config but not installed is still excluded — there is
  // nothing to show a name/icon for (folder-drop widgets, and therefore
  // "uninstalled but configured" entries, arrive in Phase 4).
  const widgetPickerEntries = useMemo(() => {
    const entries: Array<{ id: string; label: string; icon: NavRailItem["icon"]; enabled: boolean }> = [];
    for (const w of dashboardConfig.widgets) {
      const builtin = builtinById.get(w.id);
      if (!builtin) continue;
      entries.push({
        id: w.id,
        label: builtin.manifest.name,
        icon: builtin.navIcon ?? DEFAULT_NAV_ICON,
        enabled: w.enabled,
      });
    }
    return entries;
  }, [dashboardConfig, builtinById]);

  // Fall back to defaultWidget if the localStorage-remembered (or default
  // "calendar") section can't actually render — mirrors CONTRACT.md §5:
  // "defaultWidget is what survives a browser reset." Validated against
  // renderableIds (not just "enabled in config") so an id that's enabled
  // but not installed (BUILTIN_WIDGETS-missing, non-legacy — reachable via
  // a hand-edited data/config/dashboard.json, a supported SSH workflow)
  // can't leave `section` pointing at a pane that never renders, which
  // would otherwise blank the app permanently. Runs even before/without a
  // loaded config: dashboardConfig already falls back to
  // defaultDashboardConfig() while configQuery is pending, so
  // renderableIds is never empty (calendar/chores/dinner) and a garbage
  // localStorage value gets corrected immediately rather than left
  // unvalidated for the whole session.
  useEffect(() => {
    if (renderableIds.includes(section)) return;
    // Schema only guarantees SOME widget is enabled, not that defaultWidget
    // itself is renderable — fall back to the first renderable id in that
    // (config-authoring-error) case, then to "calendar" as a last resort,
    // so this can't loop forever re-setting section to something that will
    // never be in renderableIds.
    const fallback = renderableIds.includes(dashboardConfig.defaultWidget)
      ? dashboardConfig.defaultWidget
      : renderableIds[0] ?? "calendar";
    if (fallback !== section) setSection(fallback);
  }, [renderableIds, dashboardConfig, section]);

  // `renderableIds` IS the set of widget hosts to run: since Task 8 every
  // renderable section is a built-in widget, so "can render a nav pane" and
  // "needs a WidgetHost" are the same question. (Before Task 8 these were
  // two lists because calendar could render without being a widget.)
  const enabledBuiltinIds = renderableIds;

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

  // SettingsMenu (rendered here in the nav rail) needs authStatus to gate
  // its trigger button. This used to come from the calendar's useCalendar()
  // instance; now the shell owns a small, independent query for it (same
  // queryKey, so it shares cache/network with the calendar widget's own
  // auth-status query via react-query — note the widget runs its own React
  // root but against the SAME module-singleton QueryClient). Options
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

  // --- Dashboard config writes ---------------------------------------------
  // The shell owns the single read-merge-PUT-invalidate implementation for
  // `data/config/dashboard.json`, shared by both writers below:
  //  - `updateWidgetSettings` merges a patch into ONE widget's `settings`
  //    blob (host.settings.patch(), the Settings popover's per-calendar
  //    switches, unsubscribe).
  //  - `updateWidgetLayout` replaces the whole `widgets` array (the layout
  //    picker's enable/disable + reorder — Task 9).
  // Both share `writeDashboardConfig`'s guard/optimistic-write/PUT/invalidate
  // shell so there is one merge and one race domain no matter which slice of
  // the document is being edited. The optimistic setQueryData is what makes
  // a toggle feel instant AND is what pushes new values into host.settings
  // subscribers immediately (the notify effect below watches this query).
  //
  // `buildNext` receives the CURRENT cached config — read at write time, not
  // from a closure captured when the caller was created — and returns the
  // full next config to PUT, or null for "nothing to write". Two things
  // matter here:
  //  1. Data safety: if the config query has no data (still pending, or
  //     failed — the query never retries), `cached` is undefined and there
  //     is no real on-disk config to merge onto. Writing anyway would PUT
  //     `defaultDashboardConfig()` + edit, silently destroying the user's
  //     actual widget order/settings. So this bails and drops the change
  //     rather than ever writing a config not derived from loaded data,
  //     nudging a refetch so a later attempt can succeed.
  //  2. Race safety: because `buildNext` is called with a fresh cache read on
  //     every invocation, two same-tick calls each see the other's
  //     already-applied optimistic write (the first call's synchronous
  //     `setQueryData` below runs before the second call's `getQueryData`,
  //     since both stay synchronous up to their first `await`). That is what
  //     lets `host.settings.patch()` (and the calendar chip row before it)
  //     derive deltas — add/remove one id — instead of shipping a whole
  //     array built from a stale render's state.
  const writeDashboardConfig = useCallback(
    async (buildNext: (current: DashboardConfig) => DashboardConfig | null, errorTitle: string) => {
      const cached = queryClient.getQueryData<DashboardConfigResponse>(["/api/config/dashboard"]);
      if (!cached?.config) {
        console.warn("[app-shell] config not loaded; change dropped");
        void queryClient.invalidateQueries({ queryKey: ["/api/config/dashboard"] });
        return;
      }
      const next = buildNext(cached.config);
      if (!next) return;

      queryClient.setQueryData<DashboardConfigResponse>(["/api/config/dashboard"], {
        config: next,
        source: cached.source,
      });

      try {
        await apiRequest("PUT", "/api/config/dashboard", next);
      } catch (error) {
        // Never swallow this silently on a kiosk: the optimistic state is
        // about to be rolled back by the refetch below, so the user would
        // otherwise just see their change snap back for no reason.
        toast({
          title: errorTitle,
          description: error instanceof Error ? error.message : "Unknown error",
          variant: "destructive",
        });
      } finally {
        // Re-read the file the server actually wrote (or restore truth after
        // a failed write).
        await queryClient.invalidateQueries({ queryKey: ["/api/config/dashboard"] });
      }
    },
    [queryClient, toast],
  );

  const updateWidgetSettings = useCallback(
    (
      widgetId: string,
      buildPatch: (currentSettings: Record<string, unknown>) => Record<string, unknown> | null,
    ) =>
      writeDashboardConfig((current) => {
        const currentSettings = current.widgets.find((w) => w.id === widgetId)?.settings ?? {};
        const patch = buildPatch(currentSettings);
        if (!patch) return null;
        // Merge is pure + spec'd in client/src/lib/widget-config.spec.ts;
        // null == this widget has no config entry, so nothing to write.
        return applyWidgetSettingsPatch(current, widgetId, patch);
      }, "Couldn't save settings"),
    [writeDashboardConfig],
  );

  // Layout picker writes (Task 9): `mutateWidgets` receives the CURRENT
  // `widgets` array and returns the next one (reordered/toggled), or null
  // for "nothing to write" — same guard/race-safety properties as
  // `updateWidgetSettings` above, since both go through
  // `writeDashboardConfig`. Never builds from defaults; always PUTs the
  // whole loaded document back with just the widgets array edited.
  const updateWidgetLayout = useCallback(
    (mutateWidgets: (widgets: DashboardConfig["widgets"]) => DashboardConfig["widgets"] | null) =>
      writeDashboardConfig((current) => {
        const nextWidgets = mutateWidgets(current.widgets);
        if (!nextWidgets) return null;
        return { ...current, widgets: nextWidgets };
      }, "Couldn't save layout"),
    [writeDashboardConfig],
  );

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
        // `id` is captured from this loop iteration, not supplied by the
        // widget — a widget calling host.settings.patch() can only ever
        // target its own settings entry (see widget-host-services.ts).
        patchSettings: (build) => void updateWidgetSettings(id, build),
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
  }, [enabledBuiltinIds, handleSleep, updateWidgetSettings]);

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

  // --- Layout picker writes (Task 9) --------------------------------------
  // Both callbacks operate on the PICKER'S displayed order (installed,
  // builtin-backed ids — widgetPickerEntries above), not necessarily
  // physically adjacent positions in the underlying `widgets` array: a
  // configured-but-uninstalled id (folder-drop, Phase 4) could sit between
  // two displayed entries. Resolving "the widget below this one" through the
  // displayed id list first, then swapping THOSE two entries' actual array
  // positions, keeps reorder correct even if that ever happens.
  const moveWidget = useCallback(
    (id: string, direction: -1 | 1) => {
      void updateWidgetLayout((widgets) => {
        const displayedIds = widgets.filter((w) => builtinById.has(w.id)).map((w) => w.id);
        const pos = displayedIds.indexOf(id);
        if (pos === -1) return null;
        const targetPos = pos + direction;
        if (targetPos < 0 || targetPos >= displayedIds.length) return null;
        const otherId = displayedIds[targetPos];
        const idxA = widgets.findIndex((w) => w.id === id);
        const idxB = widgets.findIndex((w) => w.id === otherId);
        const next = [...widgets];
        [next[idxA], next[idxB]] = [next[idxB], next[idxA]];
        return next;
      });
    },
    [updateWidgetLayout, builtinById],
  );

  // Guarded client-side too (not just by the picker disabling the switch):
  // the schema requires at least one enabled widget, so refuse to ever build
  // a config that would violate it.
  const toggleWidgetEnabled = useCallback(
    (id: string, enabled: boolean) => {
      void updateWidgetLayout((widgets) => {
        if (!enabled) {
          const target = widgets.find((w) => w.id === id);
          const enabledCount = widgets.filter((w) => w.enabled).length;
          if (target?.enabled && enabledCount <= 1) return null;
        }
        return widgets.map((w) => (w.id === id ? { ...w, enabled } : w));
      });
    },
    [updateWidgetLayout],
  );

  // --- Calendar visibility settings (ratified delta 2) ---------------------
  // Per-calendar visibility used to be two ephemeral Sets right here, reset
  // on every browser restart, plus a `seenCalendarIds` ref to stop refetches
  // from resurrecting calendars the user had turned off. All of that is now
  // two persisted id LISTS in the calendar widget's settings — see
  // client/src/widgets/calendar/shell-bridge.ts for the model. The shell
  // keeps only what its own chrome (the Settings popover) needs to render
  // and write; the widget derives its own view of the same values through
  // host.settings.
  const calendarSettings = useMemo(
    () => dashboardConfig.widgets.find((w) => w.id === CALENDAR_WIDGET_ID)?.settings ?? {},
    [dashboardConfig],
  );
  // `disabledCalendars` has no shell-side reader any more: both handlers
  // below now read hidden/disabled straight from the cache snapshot
  // `updateWidgetSettings` takes at write time (see its doc comment), rather
  // than from a memo of this render's config. Only `hiddenCalendars` still
  // has a reader — the Settings popover's switch state.
  const hiddenCalendars = useMemo(
    () => toCalendarIdSet(calendarSettings[HIDDEN_CALENDARS_KEY]),
    [calendarSettings],
  );

  // Settings popover switch: hides/shows a calendar in the chip row AND its
  // events. Switching one back ON also clears any chip-level disable —
  // matching the pre-widget handler, which wrote both Sets. Reads
  // hidden/disabled from `currentSettings` (the cache snapshot
  // `updateWidgetSettings` takes at write time), NOT from this component's
  // own `hiddenCalendars`/`disabledCalendars` memo, so this can't race a
  // concurrent toggle of a different calendar (see updateWidgetSettings doc).
  const handleCalendarVisibilityToggle = useCallback(
    (calendarId: string, visible: boolean) => {
      void updateWidgetSettings(CALENDAR_WIDGET_ID, (currentSettings) => {
        const hidden = toCalendarIdSet(currentSettings[HIDDEN_CALENDARS_KEY]);
        const disabled = toCalendarIdSet(currentSettings[DISABLED_CALENDARS_KEY]);
        const patch: Record<string, unknown> = {
          [HIDDEN_CALENDARS_KEY]: withCalendarId(hidden, calendarId, !visible),
        };
        if (visible && disabled.has(calendarId)) {
          patch[DISABLED_CALENDARS_KEY] = withCalendarId(disabled, calendarId, false);
        }
        return patch;
      });
    },
    [updateWidgetSettings],
  );

  // Unsubscribe purge: drop the id from BOTH lists so a later re-subscribe
  // comes back visible-by-default instead of inheriting a stale toggle. Same
  // cache-snapshot-at-write-time read as above. Skips the write entirely
  // when the id is in neither list — no-op PUTs are pointless and mask real
  // failures with a spurious network round-trip.
  const handleCalendarRemoved = useCallback(
    (calendarId: string) => {
      void updateWidgetSettings(CALENDAR_WIDGET_ID, (currentSettings) => {
        const hidden = toCalendarIdSet(currentSettings[HIDDEN_CALENDARS_KEY]);
        const disabled = toCalendarIdSet(currentSettings[DISABLED_CALENDARS_KEY]);
        if (!hidden.has(calendarId) && !disabled.has(calendarId)) return null;
        const patch: Record<string, unknown> = {};
        if (hidden.has(calendarId)) {
          patch[HIDDEN_CALENDARS_KEY] = withCalendarId(hidden, calendarId, false);
        }
        if (disabled.has(calendarId)) {
          patch[DISABLED_CALENDARS_KEY] = withCalendarId(disabled, calendarId, false);
        }
        return patch;
      });
    },
    [updateWidgetSettings],
  );

  // Calendar chip taps used to arrive as a window event (CALENDAR_SETTINGS_
  // PATCH_EVENT) — the widget now calls host.settings.patch() directly
  // (founder-ratified 2026-08-19), which is wired straight to
  // updateWidgetSettings above via the per-host `patchSettings` option. No
  // shell-side listener needed any more.

  // The power-saving overlay stays shell-owned, but widgets need to know it
  // is up (the calendar suppresses its event-form/auth dialogs while dimmed
  // — behavior it used to get from an `isPowerSavingActive` prop). A widget
  // container is an opaque HTMLElement, so this is a page-global event, like
  // the existing screensaver-state-change / screensaver-exit signals.
  useEffect(() => {
    const detail: PowerSavingChangeDetail = { isActive: isPowerSavingActive };
    window.dispatchEvent(new CustomEvent(POWER_SAVING_CHANGE_EVENT, { detail }));
  }, [isPowerSavingActive]);

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

  // Nav-rail items, in config order — built from renderableEntries above
  // (every id uses its BUILTIN_WIDGETS manifest name + registry navIcon; an
  // unknown/uninstalled id was already excluded there) plus per-widget
  // badge counts. Kept as its own memo, rather than folded into
  // renderableEntries, so a badge count change doesn't force
  // renderableEntries/renderableIds — and therefore the section-fallback
  // effect above — to recompute.
  const navItems = useMemo<NavRailItem[]>(
    () => renderableEntries.map((e) => ({ ...e, badgeCount: badges[e.id] ?? null })),
    [renderableEntries, badges],
  );

  return (
    <div className="h-screen flex bg-background">
      <NavRail
        items={navItems}
        active={section}
        onNavigate={setSection}
        settingsButton={authStatus?.authenticated ? (
          <SettingsMenu
            compactTrigger
            hiddenCalendars={hiddenCalendars}
            onCalendarToggle={handleCalendarVisibilityToggle}
            setBrightness={screensaver.setBrightness}
            currentBrightness={screensaver.currentBrightness}
            onCheckForUpdates={checkForUpdates}
            onRollback={startRollback}
            onSubscribeSuccess={() =>
              window.dispatchEvent(new CustomEvent(CALENDAR_SUBSCRIBE_SUCCESS_EVENT))
            }
            onCalendarRemoved={handleCalendarRemoved}
            widgetPickerEntries={widgetPickerEntries}
            onToggleWidget={toggleWidgetEnabled}
            onMoveWidget={moveWidget}
          />
        ) : undefined}
      />

      <div className="flex-1 flex flex-col overflow-hidden min-w-0">
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
