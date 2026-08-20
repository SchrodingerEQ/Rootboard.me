import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import type { LucideIcon } from "lucide-react";
import { SettingsMenu } from "@/components/calendar/settings-menu";
import { PowerSavingOverlay } from "@/components/screensaver/power-saving-overlay";
import { UpdateNotification } from "@/components/calendar/update-notification";
import { NavRail, DEFAULT_NAV_ICON, COMMUNITY_FALLBACK_ICON, type NavRailItem } from "@/components/nav-rail";
import { WidgetHostMount, type WidgetHostMountEntry } from "@/components/widget-host-mount";
import { WidgetHostErrorBoundary } from "@/components/widget-host-error-boundary";
import { useScreensaver } from "@/hooks/useScreensaver";
import { useVersionCheck } from "@/hooks/use-version-check";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useOnlineStatus } from "@/hooks/useOnlineStatus";
import { useScreensaverState } from "@/hooks/useScreensaverState";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { BUILTIN_WIDGETS } from "@/widgets/registry";
import { createWidgetHost, type WidgetHostHandle } from "@/lib/widget-host-services";
import { applyWidgetSettingsPatch, sanitizeSettingsPatch } from "@/lib/widget-config";
import {
  useCommunityWidgetLoads,
  filterEnabledManifests,
  pruneStaleCrashRecords,
  type CrashRecord,
  type WidgetDiscoveryResponse,
} from "@/lib/community-widgets";
import { WIDGET_API_VERSION, type WidgetManifest, type WidgetSettingField } from "@shared/widget-manifest";
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

// Stable empty-array identity for widgetsQuery.data?.widgets ?? — an inline
// `?? []` would hand useCommunityWidgetLoads a fresh array (and therefore a
// fresh effect-dependency identity) on every render while the query has no
// data yet, same reasoning as `defaultConfig` below.
const EMPTY_WIDGET_MANIFESTS: WidgetManifest[] = [];
const EMPTY_INVALID_WIDGETS: WidgetDiscoveryResponse["invalid"] = [];

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

  // Community widget discovery (Phase 4, CONTRACT.md §6): re-scans
  // widgets/*/widget.json server-side on every request — same
  // sideload-then-wait pattern as configQuery above (a dropped-in folder
  // over SD card/SSH surfaces here within 60s without a restart, or
  // immediately once the layout picker's own trigger causes a refetch).
  const widgetsQuery = useQuery<WidgetDiscoveryResponse>({
    queryKey: ["/api/widgets"],
    refetchInterval: 60_000,
  });
  const discoveredManifests = widgetsQuery.data?.widgets ?? EMPTY_WIDGET_MANIFESTS;
  const invalidWidgetFolders = widgetsQuery.data?.invalid ?? EMPTY_INVALID_WIDGETS;
  const discoveredById = useMemo(
    () => new Map(discoveredManifests.map((m) => [m.id, m])),
    [discoveredManifests],
  );

  // Founder-ratified (A): a discovered widget's module is imported ONLY
  // once it's enabled in config — a disabled/not-yet-added community
  // widget's code must never execute just because its folder is present
  // (dropping a sideloaded widget onto the SD card is not, by itself,
  // consent to run it). Filters discoveredManifests down to enabled ids
  // BEFORE handing them to useCommunityWidgetLoads below; the picker still
  // reads `discoveredManifests`/`discoveredById` directly for name/icon/
  // description of DISABLED widgets, which is manifest data only and never
  // requires an import (see communityWidgetPickerEntries below).
  const enabledDiscoveredManifests = useMemo(() => {
    const enabledIds = new Set(dashboardConfig.widgets.filter((w) => w.enabled).map((w) => w.id));
    return filterEnabledManifests(discoveredManifests, enabledIds);
  }, [discoveredManifests, dashboardConfig]);

  // Kicks off (and caches) a dynamic import() per ENABLED discovered
  // manifest, gated by apiVersion before any import fires — see
  // client/src/lib/community-widgets.ts. Only settles into `communityById`
  // below once status is "loaded"; "newer-api"/"error" never become
  // renderable (CONTRACT.md §6 — listed, not loadable). A disabled id
  // simply never appears in this hook's input, so it never gets a load
  // result at all — the picker treats that as "not loaded" (see
  // communityWidgetPickerEntries below), never as an error.
  const communityLoads = useCommunityWidgetLoads(enabledDiscoveredManifests);

  // Widgets whose mount() crashed (threw, or returned a malformed
  // instance) — reported by WidgetHostMount via onWidgetCrash. Keyed by
  // id; value carries the manifest `version` at crash time plus a short
  // message, both surfaced in the layout picker (widgetPickerEntries /
  // communityWidgetPickerEntries below) as a disabled "crashed: <message>"
  // row. A crashed id is excluded from renderableEntries below — the pane
  // stays empty (and the id drops off the nav rail) but the rest of the
  // app keeps running; this is the CRITICAL "untrusted lifecycle calls
  // can white-screen the kiosk" fix's app-shell half (widget-host-mount.tsx
  // holds the other half — the per-call try/catch guards).
  const [crashedWidgets, setCrashedWidgets] = useState<Map<string, CrashRecord>>(new Map());

  const handleWidgetCrash = useCallback(
    (id: string, error: unknown) => {
      const manifest = builtinById.get(id)?.manifest ?? discoveredById.get(id);
      const version = manifest?.version ?? "";
      const message = error instanceof Error ? error.message : String(error);
      setCrashedWidgets((prev) => {
        const existing = prev.get(id);
        if (existing && existing.version === version && existing.message === message) return prev;
        const next = new Map(prev);
        next.set(id, { version, message });
        return next;
      });
    },
    [builtinById, discoveredById],
  );

  // Re-attempt path: once a crashed widget's manifest `version` changes
  // (a fixed build re-sideloaded, or an app update for a builtin), its
  // crash record is stale — clear it so the widget is eligible to mount
  // again on the next render instead of staying permanently excluded.
  // Deliberately does NOT clear when the manifest disappears entirely
  // (folder removed) — renderableEntries/the picker already stop showing
  // an uninstalled id through other means, and keeping the crash record
  // around is harmless if the same id/version ever comes back.
  useEffect(() => {
    setCrashedWidgets((prev) =>
      pruneStaleCrashRecords(prev, (id) => (builtinById.get(id)?.manifest ?? discoveredById.get(id))?.version),
    );
  }, [builtinById, discoveredById]);

  const communityById = useMemo(() => {
    const map = new Map<string, { manifest: WidgetManifest; widget: WidgetHostMountEntry["widget"] }>();
    for (const manifest of discoveredManifests) {
      const load = communityLoads.get(manifest.id);
      if (load?.status === "loaded") {
        map.set(manifest.id, { manifest, widget: load.widget });
      }
    }
    return map;
  }, [discoveredManifests, communityLoads]);

  // Ids that are enabled in config, resolve to a discovered community
  // manifest, but haven't settled into communityById yet (still importing,
  // or the apiVersion/module-shape check hasn't run — practically
  // instantaneous, but loadCommunityWidget is still async). Used ONLY by
  // the section-fallback effect below, to hold the current section instead
  // of bouncing away from it while a widget that's about to become
  // renderable is still loading — "newer-api"/"error" are terminal (already
  // in communityLoads with a settled non-loaded status) and are correctly
  // excluded here, so a truly unloadable widget still falls back normally.
  const pendingCommunityIds = useMemo(() => {
    const ids = new Set<string>();
    for (const w of dashboardConfig.widgets) {
      if (!w.enabled) continue;
      if (builtinById.has(w.id)) continue;
      if (communityById.has(w.id)) continue;
      if (!discoveredById.has(w.id)) continue; // not discovered at all — nothing pending
      if (communityLoads.has(w.id)) continue; // settled to newer-api/error — terminal
      ids.add(w.id);
    }
    return ids;
  }, [dashboardConfig, builtinById, communityById, discoveredById, communityLoads]);

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
  //
  // Crash exclusion: an id in `crashedWidgets` (mount() threw, reported by
  // WidgetHostMount's onWidgetCrash) is skipped here regardless of its
  // config `enabled` value — this is what actually stops WidgetHostMount
  // from retrying the crashing mount() on every render (its `entries` prop
  // is built from `renderableIds`/this memo below) and what tears down the
  // widget's host (the enabledBuiltinIds-driven effect further down disposes
  // a host whose id fell out of the enabled set). The layout picker still
  // shows the id — see widgetPickerEntries/communityWidgetPickerEntries —
  // with a disabled "crashed: <message>" row instead of silently vanishing.
  const renderableEntries = useMemo(() => {
    const entries: Array<{ id: string; label: string; icon: NavRailItem["icon"] }> = [];
    for (const w of dashboardConfig.widgets) {
      if (!w.enabled) continue;
      if (crashedWidgets.has(w.id)) continue;
      const builtin = builtinById.get(w.id);
      if (builtin) {
        entries.push({ id: w.id, label: builtin.manifest.name, icon: builtin.navIcon ?? DEFAULT_NAV_ICON });
        continue;
      }
      // Phase 4: a successfully-loaded community widget joins the SAME
      // renderable set as builtins — nav order still comes purely from
      // config array order, source (builtin vs community) is invisible
      // past this point. A community id that's enabled but not yet loaded
      // (or discovered-but-broken) is correctly excluded here — it simply
      // isn't renderable yet/ever.
      const community = communityById.get(w.id);
      if (community) {
        const iconSrc = community.manifest.icon ? `/widgets/${w.id}/${community.manifest.icon}` : undefined;
        entries.push({
          id: w.id,
          label: community.manifest.name,
          icon: iconSrc ? { kind: "image" as const, src: iconSrc } : COMMUNITY_FALLBACK_ICON,
        });
      }
    }
    return entries;
  }, [dashboardConfig, builtinById, communityById, crashedWidgets]);

  const renderableIds = useMemo(() => renderableEntries.map((e) => e.id), [renderableEntries]);

  // Every INSTALLED widget (builtin-backed), enabled or not, in config
  // order — the layout picker's source list (Task 9). Unlike
  // renderableEntries above this does NOT filter on `enabled`: the picker
  // needs to show disabled widgets too, with a switch to re-enable them. An
  // id enabled in config but not installed is still excluded — there is
  // nothing to show a name/icon for (folder-drop widgets, and therefore
  // "uninstalled but configured" entries, arrive in Phase 4).
  const widgetPickerEntries = useMemo(() => {
    const entries: Array<{
      id: string;
      label: string;
      icon: LucideIcon;
      enabled: boolean;
      crashed?: string;
      settings?: WidgetSettingField[];
      settingsValues?: Record<string, unknown>;
    }> = [];
    for (const w of dashboardConfig.widgets) {
      const builtin = builtinById.get(w.id);
      if (!builtin) continue;
      entries.push({
        id: w.id,
        label: builtin.manifest.name,
        icon: builtin.navIcon ?? DEFAULT_NAV_ICON,
        enabled: w.enabled,
        crashed: crashedWidgets.get(w.id)?.message,
        // Phase 4 Task 5: closes CONTRACT §2's "the host renders these in
        // its settings UI" — applies to ANY widget whose manifest declares
        // `settings`, builtin or community alike (today only community
        // manifests do, but nothing here assumes that).
        settings: builtin.manifest.settings,
        settingsValues: w.settings,
      });
    }
    return entries;
  }, [dashboardConfig, builtinById, crashedWidgets]);

  // Layout picker source list (Phase 4): every widget discovered under
  // /widgets/, whether or not it has a config entry yet — in-config ones
  // first (config order, matching widgetPickerEntries' convention above),
  // then not-yet-added ones. See CommunityWidgetPickerEntry's doc comment
  // (settings-menu.tsx) for the status/enabled/installed split.
  //
  // Founder-ratified (A) status derivation: a DISABLED (or not-yet-added)
  // widget's module is never imported (see enabledDiscoveredManifests
  // above), so `communityLoads` never has an entry for it — status "ready"/
  // "error" only ever apply to a currently-ENABLED id. Everything shown for
  // a disabled id (name/description/icon, and the apiVersion gate message)
  // is manifest data straight from discovery, never load-result data, so
  // none of it requires importing anything.
  const communityWidgetPickerEntries = useMemo(() => {
    const configIndex = new Map(dashboardConfig.widgets.map((w) => [w.id, w]));
    const toEntry = (manifest: WidgetManifest, enabled: boolean, installed: boolean) => {
      const crash = crashedWidgets.get(manifest.id);
      let status: "not-loaded" | "loading" | "ready" | "newer-api" | "error" | "crashed";
      let statusMessage: string | undefined;
      if (crash) {
        // A version bump clears the crash record (app-shell's pruning
        // effect above) and this branch stops applying on its own — no
        // separate "retry" control needed here.
        status = "crashed";
        statusMessage = crash.message;
      } else if (manifest.apiVersion > WIDGET_API_VERSION) {
        // Manifest-only check — deliberately NOT gated on `enabled`, so
        // this message shows even for a disabled/not-yet-added widget
        // without ever importing its module (CONTRACT §6's "listed but
        // not loadable" applies before enabling too).
        status = "newer-api";
        statusMessage = "built for a newer Rootboard";
      } else if (!enabled) {
        status = "not-loaded";
        statusMessage = "not loaded — enable to load";
      } else {
        const load = communityLoads.get(manifest.id);
        status = load === undefined ? "loading" : load.status === "loaded" ? "ready" : load.status;
        statusMessage = load?.status === "error" ? load.message : undefined;
      }
      return {
        id: manifest.id,
        label: manifest.name,
        description: manifest.description,
        icon: manifest.icon ? { kind: "image" as const, src: `/widgets/${manifest.id}/${manifest.icon}` } : null,
        enabled,
        installed,
        status,
        statusMessage,
        // Phase 4 Task 5: settings are manifest+config data only, available
        // regardless of load `status` (a disabled/crashed/newer-api/error
        // community widget's settings are still editable — see
        // CommunityWidgetPickerEntry's doc comment).
        settings: manifest.settings,
        settingsValues: configIndex.get(manifest.id)?.settings,
      };
    };
    // Minor #3: a config entry whose id has no matching discovered
    // manifest at all (CONTRACT §5 — "unknown widget ids are kept but
    // shown as unavailable") gets this bare row instead of being silently
    // dropped, so there's a way to disable/remove it from the picker.
    // `installed: false` even though it DOES have a config entry — that
    // field gates the reorder arrows here, and a ghost has no discovered
    // position to reorder among (moveCommunityWidget's pool is
    // `discoveredById`-scoped, which a ghost id is never in).
    const toGhostEntry = (id: string) => ({
      id,
      label: id,
      description: undefined as string | undefined,
      icon: null,
      enabled: true,
      installed: false,
      status: "ghost" as const,
      statusMessage: "not installed — folder missing",
    });

    const entries: Array<ReturnType<typeof toEntry> | ReturnType<typeof toGhostEntry>> = [];
    for (const w of dashboardConfig.widgets) {
      if (builtinById.has(w.id)) continue;
      const manifest = discoveredById.get(w.id);
      if (!manifest) {
        if (w.enabled) entries.push(toGhostEntry(w.id));
        continue;
      }
      entries.push(toEntry(manifest, w.enabled, true));
    }
    for (const manifest of discoveredManifests) {
      if (configIndex.has(manifest.id)) continue;
      entries.push(toEntry(manifest, false, false));
    }
    return entries;
  }, [dashboardConfig, builtinById, discoveredById, discoveredManifests, communityLoads, crashedWidgets]);

  const invalidWidgetPickerEntries = useMemo(
    () => invalidWidgetFolders.map((e) => ({ folder: e.folder, error: e.errors[0] ?? "Invalid widget.json" })),
    [invalidWidgetFolders],
  );

  // Fall back to defaultWidget if the localStorage-remembered (or default
  // "calendar") section can't actually render — mirrors CONTRACT.md §5:
  // "defaultWidget is what survives a browser reset." Validated against
  // renderableIds (not just "enabled in config") so an id that's enabled
  // but not installed (BUILTIN_WIDGETS-missing, non-legacy — reachable via
  // a hand-edited data/config/dashboard.json, a supported SSH workflow),
  // OR that crashed on mount (crashedWidgets — see renderableEntries'
  // exclusion above), can't leave `section` pointing at a pane that never
  // renders. NOTE: this is no longer the ONLY belt against that — an empty
  // renderableEntries also now gets a visible recovery pane in the render
  // below (IMPORTANT #1's belt-and-braces fix) — but it's still the FIRST
  // line of defense whenever at least one OTHER widget can render, moving
  // `section` there instead of showing the recovery pane unnecessarily.
  // Runs even before/without a loaded config: dashboardConfig already
  // falls back to defaultDashboardConfig() while configQuery is pending,
  // so renderableIds is normally non-empty (calendar/chores/dinner) and a
  // garbage localStorage value gets corrected immediately rather than left
  // unvalidated for the whole session — "normally", not "never": the
  // schema requires one enabled widget, but the widget that happens to be
  // enabled can still crash or fail to install, which is exactly the case
  // the recovery pane now covers.
  //
  // Phase 4 addition #1: also hold `section` (skip the fallback) when it
  // names a community widget that's enabled+discovered but still
  // mid-import (`pendingCommunityIds`) — without this, a widget that was
  // the active section on last visit would flash to `defaultWidget` for
  // the ~one tick its dynamic import takes, then flash back once
  // loadCommunityWidget resolves. A widget that never resolves to "loaded"
  // (newer-api/error) is NOT in pendingCommunityIds, so it still falls
  // back normally instead of holding forever on a pane that will never
  // render. Accepted edge case: a widget module whose import() promise
  // never SETTLES at all (e.g. a network request that just hangs, rather
  // than failing) holds `pendingCommunityIds` — and therefore `section` —
  // on that id indefinitely, with no visible content in the pane. The nav
  // rail itself stays fully usable throughout (every OTHER renderable
  // widget's nav button still works), so this is a stuck pane, not a
  // stuck app; not worth a timeout for how narrow the trigger is.
  //
  // Phase 4 addition #2: on a hard page reload, THIS effect's first pass
  // runs before either configQuery or widgetsQuery has ever resolved —
  // dashboardConfig is still the calendar/chores/dinner-only PLACEHOLDER
  // (defaultConfig), which has no entry for a sideloaded id at all, so
  // pendingCommunityIds (which loops dashboardConfig.widgets) can't
  // recognize a stored community-widget section as "pending" either; the
  // fallback would fire immediately and PERMANENTLY overwrite localStorage
  // with defaultWidget before the real data even arrives (caught in Task 4
  // manual verification — a stored community-widget section silently
  // reverted to "calendar" on every hard reload, every time, regardless of
  // how fast the widget itself loaded afterward). Holding until both
  // queries have SETTLED (below) closes that race.
  useEffect(() => {
    if (renderableIds.includes(section)) return;
    // Hold until both queries have settled — success OR error, not merely
    // "has data". The original `!configQuery.data || !widgetsQuery.data`
    // check never releases if a query settles into an error with no prior
    // successful fetch (react-query leaves `data` `undefined` forever in
    // that case), which would strand this effect from ever running on a
    // kiosk that, say, boots offline. `isPending` is react-query's "still
    // loading, no data and no error yet" signal for both queries — it
    // clears the moment either one resolves, including to an error.
    if (configQuery.isPending || widgetsQuery.isPending) return;
    if (pendingCommunityIds.has(section)) return;
    // Schema only guarantees SOME widget is enabled, not that defaultWidget
    // itself is renderable — fall back to the first renderable id in that
    // (config-authoring-error) case, then to "calendar" as a last resort,
    // so this can't loop forever re-setting section to something that will
    // never be in renderableIds.
    const fallback = renderableIds.includes(dashboardConfig.defaultWidget)
      ? dashboardConfig.defaultWidget
      : renderableIds[0] ?? "calendar";
    if (fallback !== section) setSection(fallback);
  }, [renderableIds, pendingCommunityIds, dashboardConfig, section, configQuery.isPending, widgetsQuery.isPending]);

  // `renderableIds` is the set of widget hosts to run — builtin AND
  // successfully-loaded community ids alike (Phase 4: "can render a nav
  // pane" and "needs a WidgetHost" are still the same question; source is
  // invisible past renderableEntries). Name kept from Task 8 for history —
  // callers below don't care that it's no longer builtin-only.
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

      // Cancel any in-flight fetch of this key (in particular configQuery's
      // 60s refetchInterval poll) right after the optimistic write, not
      // before: the read-build-write above must stay synchronous with no
      // `await` in between (see the "Race safety" comment on
      // writeDashboardConfig above) so two same-tick calls each see the
      // other's already-applied optimistic write. `cancelQueries` is itself
      // async, so it has to come after that chain — but it still runs well
      // before the slow part (the network PUT below), which is the actual
      // window an in-flight poll could resolve in and revert this write.
      // Pass revert: false to keep the optimistic data; the transient status:
      // "error" a cancellation sets is cleared by the finally-block
      // invalidate. Residual: the 60s poll can still START a new fetch during
      // the PUT — accepted, the invalidate at the end makes it converge.
      await queryClient.cancelQueries({ queryKey: ["/api/config/dashboard"] }, { revert: false });

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
        // Hand the builder a shallow clone, never the live cache object —
        // a widget holding onto `currentSettings` past this call must not
        // be able to mutate react-query's cache data out from under it.
        let rawPatch: Record<string, unknown> | null;
        try {
          rawPatch = buildPatch({ ...currentSettings });
        } catch (err) {
          console.warn("widget settings builder threw", err);
          return null;
        }
        // CONTRACT.md §2/§4: "host.settings.patch(), which the host
        // validates and persists" — sanitizeSettingsPatch is that
        // validation. A widget is untrusted input past this boundary: a
        // builder that returns anything other than a plain patch object
        // must not reach the merge/PUT path below.
        const patch = sanitizeSettingsPatch(rawPatch);
        if (!patch) return null;
        // Merge is pure + spec'd in client/src/lib/widget-config.spec.ts;
        // null == this widget has no config entry, so nothing to write.
        return applyWidgetSettingsPatch(current, widgetId, patch);
      }, "Couldn't save settings"),
    [writeDashboardConfig],
  );

  // Settings-editor writes (Phase 4 Task 5): commits ONE field's edit for
  // ONE widget, builtin or community, through the SAME merge pipeline as
  // every other settings write (updateWidgetSettings -> sanitizeSettingsPatch
  // -> applyWidgetSettingsPatch). The builder here always returns a
  // single-key object, so the merge preserves every other key already in
  // that widget's settings — including keys this editor's manifest doesn't
  // even know about (a hand-added extra key, or one written by the widget
  // itself via host.settings.patch()).
  const patchWidgetSetting = useCallback(
    (widgetId: string, key: string, value: string | number | boolean) =>
      void updateWidgetSettings(widgetId, () => ({ [key]: value })),
    [updateWidgetSettings],
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
        // Shallow clone: dashboardConfigRef.current is the live react-query
        // cache object — a widget holding onto the return value of
        // host.settings.get() must not be able to mutate it out from under
        // the cache.
        getSettings: () => ({ ...(dashboardConfigRef.current.widgets.find((w) => w.id === id)?.settings ?? {}) }),
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
      listeners.forEach((cb) => cb({ ...settings })); // Clone to prevent cache mutations
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

  // --- Community widget picker writes (Phase 4) ---------------------------
  // Mirrors moveWidget/toggleWidgetEnabled above exactly, scoped to the
  // community pool (`discoveredById.has(w.id) && !builtinById.has(w.id)`)
  // instead of the builtin pool — see onMoveCommunityWidget's doc comment
  // in settings-menu.tsx for why reorder is scoped per-pool rather than
  // across one combined displayed list.
  const moveCommunityWidget = useCallback(
    (id: string, direction: -1 | 1) => {
      void updateWidgetLayout((widgets) => {
        const displayedIds = widgets
          .filter((w) => discoveredById.has(w.id) && !builtinById.has(w.id))
          .map((w) => w.id);
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
    [updateWidgetLayout, discoveredById, builtinById],
  );

  // Same last-enabled-widget guard as toggleWidgetEnabled, plus one thing
  // that has no builtin equivalent: an id with NO config entry yet (a
  // freshly discovered folder the user has never enabled before) is
  // APPENDED to config.widgets — CONTRACT.md §5, "Enabling a
  // discovered-but-not-in-config widget appends {id, enabled: true,
  // settings: {}}". Its position becomes "last", which is why
  // communityWidgetPickerEntries lists not-yet-added widgets after the
  // in-config ones (append order == display order for a brand new entry).
  const toggleCommunityWidgetEnabled = useCallback(
    (id: string, enabled: boolean) => {
      void updateWidgetLayout((widgets) => {
        const idx = widgets.findIndex((w) => w.id === id);
        if (idx === -1) {
          if (!enabled) return null; // nothing to disable — no-op
          return [...widgets, { id, enabled: true, settings: {} }];
        }
        if (!enabled) {
          const target = widgets[idx];
          const enabledCount = widgets.filter((w) => w.enabled).length;
          if (target.enabled && enabledCount <= 1) return null;
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
      if (!handle) continue;
      const builtin = builtinById.get(id);
      if (builtin) {
        entries.push({ manifest: builtin.manifest, widget: builtin.widget, host: handle.host });
        continue;
      }
      // Phase 4: a loaded community widget gets a host exactly like a
      // builtin — createWidgetHost above is already source-agnostic (keys
      // off `id` only), so the only new thing here is resolving
      // manifest+widget from communityById instead of builtinById.
      const community = communityById.get(id);
      if (community) {
        entries.push({ manifest: community.manifest, widget: community.widget, host: handle.host });
      }
    }
    return entries;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabledBuiltinIds, builtinById, communityById, hostsVersion]);

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
            communityWidgetPickerEntries={communityWidgetPickerEntries}
            onToggleCommunityWidget={toggleCommunityWidgetEnabled}
            onMoveCommunityWidget={moveCommunityWidget}
            invalidWidgetPickerEntries={invalidWidgetPickerEntries}
            onPatchWidgetSetting={patchWidgetSetting}
          />
        ) : undefined}
      />

      <div className="flex-1 flex flex-col overflow-hidden min-w-0">
        {renderableEntries.length === 0 ? (
          // IMPORTANT #1's belt: theoretically unreachable now (crashed and
          // uninstalled ids are excluded from renderableEntries, but the
          // section-fallback effect above and the "at least one enabled
          // widget" write-time guards should mean SOMETHING is always left)
          // — kept as a visible recovery path rather than a silent blank
          // screen for whatever future gap those guards don't cover.
          <div className="flex-1 flex items-center justify-center p-8 text-center">
            <p className="text-sm text-rb-muted max-w-xs">
              No widgets available — check Settings or data/config/dashboard.json
            </p>
          </div>
        ) : (
          // Second belt (CRITICAL fix): widget-host-mount.tsx already
          // guards every individual lifecycle call (mount/unmount/refresh/
          // onVisibilityChange) with try/catch, so this boundary should
          // rarely catch anything — it only exists for a render-phase throw
          // those guards can't cover. Scoped to WidgetHostMount alone: it
          // is <NavRail>'s SIBLING here, not its parent, so a catch can
          // only blank the content pane, never the nav rail or settings.
          // `resetKey` is the reset path documented on
          // WidgetHostErrorBoundary itself: a render-phase throw sets
          // `hasError` for this instance, and the boundary clears it again
          // once this string changes WHILE tripped. Joining `renderableIds`
          // means any change to the mounted-widget set (most relevantly:
          // disabling the widget that tripped the boundary, via the picker
          // switch, which is still interactive — the boundary only blanks
          // its sibling content pane) un-blanks the pane — WITHOUT
          // remounting every OTHER widget the way a `key` change would
          // (see resetKey's doc comment for why that was tried and
          // reverted).
          <WidgetHostErrorBoundary resetKey={renderableIds.join(",")}>
            <WidgetHostMount entries={widgetEntries} activeId={section} onWidgetCrash={handleWidgetCrash} />
          </WidgetHostErrorBoundary>
        )}
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
