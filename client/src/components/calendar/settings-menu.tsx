import { useState } from "react";
import { Settings, Sun, Moon, Calendar, X, Info, RotateCcw, RefreshCw, Plus, Trash2, Copy, Check, AlertTriangle, Keyboard, LayoutGrid, ChevronUp, ChevronDown, Puzzle, SlidersHorizontal, type LucideIcon } from "lucide-react";
import { Link } from "wouter";
import { WidgetSettingsFields } from "@/components/widget-settings-fields";
import type { WidgetSettingField } from "@shared/widget-manifest";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { APP_VERSION } from "@shared/version";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { 
  Popover, 
  PopoverContent, 
  PopoverTrigger 
} from "@/components/ui/popover";
import { Slider } from "@/components/ui/slider";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useOskMode } from "@/hooks/use-osk-mode";
import type { OskMode } from "@/lib/osk";

interface CalendarInfo {
  id: string;
  summary: string;
  primary: boolean;
  backgroundColor?: string;
  foregroundColor?: string;
  selected: boolean;
  accessRole: string;
}

/** One row of the layout picker's "Widgets" section — an installed
 *  (builtin-backed) widget, in `data/config/dashboard.json` order. Sourced
 *  from BUILTIN_WIDGETS resolved through config order by the shell (see
 *  app-shell.tsx's `widgetPickerEntries`); this component imports neither
 *  the registry nor the config schema directly. */
export interface WidgetPickerEntry {
  id: string;
  label: string;
  icon: LucideIcon;
  enabled: boolean;
  /** Present when this widget's `mount()` crashed (threw, or returned
   *  something other than `{ unmount(): void, ... }`) — see
   *  widget-host-mount.tsx's `onWidgetCrash` and app-shell.tsx's
   *  `crashedWidgets`. Short crash message. While set, the row's switch
   *  is force-disabled (there's nothing to toggle back into — the widget
   *  is already excluded from rendering) and clears automatically once
   *  the widget's manifest `version` changes (app-shell.tsx's re-attempt
   *  path), not from anything in this component. */
  crashed?: string;
  /** This widget's manifest `settings` descriptors (Phase 4 Task 5) —
   *  absent/empty hides the row's settings expander entirely. Builtins
   *  currently declare none (their manifests have no `settings` array), so
   *  in practice this only ever populates for a community entry, but the
   *  editor applies to ANY widget whose manifest declares settings. */
  settings?: WidgetSettingField[];
  /** This widget's current persisted settings blob
   *  (data/config/dashboard.json widgets[].settings), handed straight to
   *  WidgetSettingsFields for display — never written here, only read. */
  settingsValues?: Record<string, unknown>;
}

/** One row of the layout picker's "Community Widgets" section (Phase 4) —
 *  every widget discovered under `/widgets/`, whether or not it's currently
 *  in `data/config/dashboard.json`. Sourced by the shell's
 *  `communityWidgetPickerEntries` memo (app-shell.tsx), which merges
 *  `GET /api/widgets` with the config and the dynamic-import load result
 *  for each id. */
export interface CommunityWidgetPickerEntry {
  id: string;
  label: string;
  description?: string;
  /** null when the manifest declares no `icon` — rendered as a generic
   *  Puzzle glyph, never a lucide icon (community widgets don't get one). */
  icon: { kind: "image"; src: string } | null;
  /** True iff this id has a config entry with `enabled: true`. False for
   *  both "disabled" and "not yet added to config" — `installed`
   *  disambiguates those two. */
  enabled: boolean;
  /** True iff this id already has an entry in config.widgets (regardless
   *  of enabled/disabled) — controls whether reorder arrows are shown at
   *  all (nothing to reorder before it has a position). Always false for
   *  a "ghost" row (below) even though it DOES have a config entry: a
   *  ghost has no discovered position to reorder among. */
  installed: boolean;
  /** "not-loaded": disabled (or not yet added to config) and, per
   *  founder-ratified decision A, therefore never imported — nothing to
   *  report except "flip the switch to load it". "loading": enabled,
   *  import in flight. "ready": loaded and mountable — the only status
   *  the enable switch may be turned ON from (a not-loaded row can also
   *  be turned on — that's what triggers the import). "newer-api": listed
   *  per CONTRACT.md §6, computed straight from manifest data (no import
   *  needed), so it applies even while disabled; the switch can never be
   *  turned ON from here but CAN be turned OFF if it happens to be
   *  enabled already. "error": enabled, imported, and failed — same
   *  disable-only-from-here rule; note this NEVER appears for a disabled
   *  row (see IMPORTANT #2 — disabling clears back to "not-loaded", so a
   *  load error is only ever visible after (re-)enabling). "crashed":
   *  imported fine but `mount()` itself threw at runtime — always
   *  disable-only, regardless of enabled state, since there is nothing
   *  useful the switch being ON accomplishes while crashed. "ghost": a
   *  config entry (CONTRACT §5 "unknown widget ids are kept but shown as
   *  unavailable") whose id has no discovered manifest at all — disable-
   *  only, so the user has an escape hatch to remove it from config. */
  status: "not-loaded" | "loading" | "ready" | "newer-api" | "error" | "crashed" | "ghost";
  /** Present for every status except "loading"/"ready" — the reason
   *  string shown under the row. */
  statusMessage?: string;
  /** This widget's manifest `settings` descriptors (Phase 4 Task 5) —
   *  absent/empty (always the case for a "ghost" row, which has no
   *  discovered manifest at all) hides the row's settings expander. Applies
   *  regardless of `status` otherwise — a disabled/not-loaded/crashed/
   *  newer-api/error community widget's settings are still just config
   *  data, editable without the widget itself ever running. */
  settings?: WidgetSettingField[];
  /** This widget's current persisted settings blob
   *  (data/config/dashboard.json widgets[].settings), handed straight to
   *  WidgetSettingsFields for display — never written here, only read. */
  settingsValues?: Record<string, unknown>;
}

/** One row of the layout picker's "Widget Folder Errors" section (Phase 4)
 *  — a `/widgets/<folder>` directory that failed manifest validation
 *  (server/services/widgetDiscovery.ts `invalid` entries). No controls:
 *  there's nothing installable here until the folder itself is fixed. */
export interface InvalidWidgetPickerEntry {
  folder: string;
  /** First validation error only (widgetDiscovery.ts collects all of
   *  them; the picker row shows just enough to point at the problem —
   *  the full list isn't worth the space on a 104px-rail kiosk popover). */
  error: string;
}

interface SettingsMenuProps {
  /** Persisted calendar-widget setting `hiddenCalendars` (see
   *  client/src/widgets/calendar/shell-bridge.ts). A calendar is shown iff
   *  its id is NOT in here — a hidden-LIST, so a calendar the user has never
   *  touched (including one added after this setting was written) is visible
   *  by default. */
  hiddenCalendars: Set<string>;
  /** Writes `hiddenCalendars` through the shell's dashboard-config helper;
   *  persists to data/config/dashboard.json, so it survives a reload. */
  onCalendarToggle: (calendarId: string, visible: boolean) => void;
  setBrightness?: (brightness: number) => void;
  currentBrightness?: number;
  onCheckForUpdates?: () => void;
  onRollback?: () => void;
  onSubscribeSuccess?: () => void;
  onCalendarRemoved?: (calendarId: string) => void;
  /** Compact circular trigger (52px, rail-chip styling) for use in the nav rail, instead of the default header icon button. */
  compactTrigger?: boolean;
  /** Layout picker (Task 9): every installed widget, in config order,
   *  enabled or not. Absent/empty hides the "Widgets" section entirely
   *  (defensive — the shell always has at least the three built-ins). */
  widgetPickerEntries?: WidgetPickerEntry[];
  /** Persists an enable/disable toggle via the shell's PUT-the-whole-config
   *  helper. The shell also re-derives the guard below from live config on
   *  write, but the switch itself is pre-disabled for the last enabled
   *  widget so the user never has to discover the guard by failing. */
  onToggleWidget?: (id: string, enabled: boolean) => void;
  /** Swaps this widget with its neighbor in the picker's displayed order
   *  (direction -1 = up/earlier, +1 = down/later). */
  onMoveWidget?: (id: string, direction: -1 | 1) => void;
  /** Every widget discovered under `/widgets/` (Phase 4), in the shell's
   *  display order (in-config ones first, in config order; then
   *  not-yet-added ones). Absent/empty hides the "Community Widgets"
   *  section entirely — a kiosk with no sideloaded widgets never shows an
   *  empty section. */
  communityWidgetPickerEntries?: CommunityWidgetPickerEntry[];
  /** Enables/disables a community widget. For an id with no config entry
   *  yet, enabling APPENDS `{id, enabled: true, settings: {}}` to
   *  config.widgets (CONTRACT.md §5) rather than requiring a separate
   *  "install" step. */
  onToggleCommunityWidget?: (id: string, enabled: boolean) => void;
  /** Reorders a community widget among the OTHER community widgets that
   *  already have a config position — mirrors onMoveWidget's swap-actual-
   *  array-positions semantics, scoped to the community pool instead of
   *  the builtin pool (app-shell.tsx moveCommunityWidget). */
  onMoveCommunityWidget?: (id: string, direction: -1 | 1) => void;
  /** `/widgets/<folder>` directories that failed manifest validation
   *  (Phase 4). Absent/empty hides the section. */
  invalidWidgetPickerEntries?: InvalidWidgetPickerEntry[];
  /** Commits one settings-field edit for one widget (Phase 4 Task 5) —
   *  wired to the shell's `updateWidgetSettings(widgetId, builder)` merge
   *  pipeline via a single-key builder, so every OTHER key already in that
   *  widget's settings (including ones this editor doesn't know about) is
   *  preserved untouched. Shared by both the "Widgets" and "Community
   *  Widgets" sections — settings storage doesn't distinguish builtin from
   *  community. */
  onPatchWidgetSetting?: (id: string, key: string, value: string | number | boolean) => void;
}

export function SettingsMenu({
  hiddenCalendars,
  onCalendarToggle,
  setBrightness: externalSetBrightness,
  currentBrightness = 1.0,
  onCheckForUpdates,
  onRollback,
  onSubscribeSuccess,
  onCalendarRemoved,
  compactTrigger = false,
  widgetPickerEntries = [],
  onToggleWidget,
  onMoveWidget,
  communityWidgetPickerEntries = [],
  onToggleCommunityWidget,
  onMoveCommunityWidget,
  invalidWidgetPickerEntries = [],
  onPatchWidgetSetting,
}: SettingsMenuProps) {
  // IMPORTANT #1: only count widgets that actually RENDER a pane toward
  // the "at least one widget must stay enabled" guard — a builtin always
  // counts once enabled (nothing gates it further), but a community entry
  // only counts while "ready" (actually loaded and mountable). An enabled-
  // but-ghost/crashed/newer-api/error/not-loaded community row contributes
  // nothing to the app's actual renderable set, so counting it would let
  // the guard fail OPEN — blocking the user from disabling the one real
  // widget that's propping the count up, while never blocking the useless
  // entry itself. Failing closed here also resolves the cosmetic mismatch
  // the pre-fix version had: this count could disagree with
  // renderableEntries.length in app-shell.tsx by exactly the number of
  // enabled-but-unrenderable community rows.
  const enabledWidgetCount =
    widgetPickerEntries.filter((e) => e.enabled && !e.crashed).length +
    communityWidgetPickerEntries.filter((e) => e.enabled && e.status === "ready").length;
  const installedCommunityEntries = communityWidgetPickerEntries.filter((e) => e.installed);
  const [isOpen, setIsOpen] = useState(false);
  // Minor #4: per-id "this icon's src failed to load" state, so a broken
  // sideloaded icon (bad path, corrupt file) falls back to the generic
  // Puzzle glyph instead of sitting as a permanently broken <img> box.
  // Keyed by id -> the specific src that failed, not a bare boolean, so a
  // later manifest update with a fixed path automatically retries instead
  // of staying stuck on the fallback.
  const [failedIconSrc, setFailedIconSrc] = useState<Map<string, string>>(new Map());
  // Phase 4 Task 5: which widget rows have their settings expander open,
  // by id. Shared across both "Widgets" and "Community Widgets" sections —
  // an id collision between a builtin and a community widget can't happen
  // (widgetIdSchema-validated ids are globally unique in config), so one
  // Set is enough. Local-only (not persisted) — a reopen of the popover
  // always starts collapsed.
  const [expandedSettings, setExpandedSettings] = useState<Set<string>>(new Set());
  const toggleSettingsExpanded = (id: string) => {
    setExpandedSettings((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };
  const [brightness, setBrightness] = useState(() => {
    const saved = localStorage.getItem('calendar-brightness');
    return saved ? parseInt(saved) : Math.round(currentBrightness * 100);
  });
  const [oskMode, setOskMode] = useOskMode();
  const [calendarIdInput, setCalendarIdInput] = useState('');
  const [subscribeError, setSubscribeError] = useState<string | null>(null);
  const [calendarToRemove, setCalendarToRemove] = useState<CalendarInfo | null>(null);
  const [emailCopied, setEmailCopied] = useState(false);
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const subscribeMutation = useMutation({
    mutationFn: async (calendarId: string) => {
      const res = await fetch('/api/calendar/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ calendarId }),
        credentials: 'include',
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(body?.message ?? `Request failed (${res.status})`);
      }
      return body;
    },
    onSuccess: (data) => {
      setCalendarIdInput('');
      setSubscribeError(null);
      toast({ title: `Added "${data.summary || data.id}"`, description: 'Syncing events now…' });
      queryClient.invalidateQueries({ queryKey: ['/api/calendar/calendars'] });
      queryClient.invalidateQueries({ queryKey: ['/api/calendar/events'] });
      queryClient.invalidateQueries({ queryKey: ['/api/calendar/sync-status'] });
      onSubscribeSuccess?.();
    },
    onError: (error: any) => {
      const msg = error?.message ?? 'Failed to subscribe to calendar.';
      setSubscribeError(msg);
    },
  });

  const handleSubscribe = () => {
    const id = calendarIdInput.trim();
    if (!id) return;
    setSubscribeError(null);
    subscribeMutation.mutate(id);
  };

  const unsubscribeMutation = useMutation({
    mutationFn: async (calendarId: string) => {
      const res = await fetch(`/api/calendar/calendars/${encodeURIComponent(calendarId)}`, {
        method: 'DELETE',
        credentials: 'include',
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(body?.message ?? `Request failed (${res.status})`);
      }
      return body;
    },
    onSuccess: () => {
      const removedId = calendarToRemove?.id;
      const name = calendarToRemove?.summary || removedId || 'Calendar';
      setCalendarToRemove(null);
      toast({ title: `Removed "${name}"`, description: 'Calendar unsubscribed.' });
      if (removedId) onCalendarRemoved?.(removedId);
      queryClient.invalidateQueries({ queryKey: ['/api/calendar/calendars'] });
      queryClient.invalidateQueries({ queryKey: ['/api/calendar/events'] });
    },
    onError: (error: any) => {
      setCalendarToRemove(null);
      toast({ title: 'Failed to remove calendar', description: error?.message ?? 'Unknown error', variant: 'destructive' });
    },
  });

  // Get calendars for selection
  const { data: calendars, isLoading } = useQuery<CalendarInfo[]>({
    queryKey: ['/api/calendar/calendars'],
    enabled: true,
    staleTime: 5 * 60 * 1000,
  });

  const { data: serviceAccountData, isError: serviceAccountError } = useQuery<{ email: string }>({
    queryKey: ['/api/calendar/service-account-email'],
    enabled: isOpen,
    staleTime: Infinity,
    retry: false,
  });
  const serviceAccountEmail = serviceAccountData?.email ?? null;

  const handleCopyEmail = () => {
    if (!serviceAccountEmail) return;
    navigator.clipboard.writeText(serviceAccountEmail).then(() => {
      setEmailCopied(true);
      setTimeout(() => setEmailCopied(false), 2000);
    });
  };

  const handleBrightnessChange = (value: number[]) => {
    const newBrightness = value[0];
    setBrightness(newBrightness);
    localStorage.setItem('calendar-brightness', newBrightness.toString());
    
    // Use external brightness control if available (screensaver integration)
    if (externalSetBrightness) {
      externalSetBrightness(newBrightness / 100); // Convert to 0-1 scale
    } else {
      // Fallback to direct DOM manipulation
      document.documentElement.style.filter = `brightness(${newBrightness}%)`;
    }
  };

  const getCalendarColor = (calendar: CalendarInfo): string => {
    if (calendar.backgroundColor) {
      return calendar.backgroundColor;
    }
    
    // Generate consistent color based on calendar ID
    const colors = [
      '#1a73e8', '#34a853', '#ea4335', '#ff9800', '#9c27b0', 
      '#795548', '#607d8b', '#e91e63', '#4caf50', '#ff5722', 
      '#3f51b5', '#009688'
    ];
    
    let hash = 0;
    for (let i = 0; i < calendar.id.length; i++) {
      hash = ((hash << 5) - hash + calendar.id.charCodeAt(i)) & 0xffffffff;
    }
    const index = Math.abs(hash) % colors.length;
    return colors[index];
  };

  // Apply brightness on component mount
  useState(() => {
    document.documentElement.style.filter = `brightness(${brightness}%)`;
  });

  return (
    <>
      <AlertDialog open={!!calendarToRemove} onOpenChange={(open) => { if (!open) setCalendarToRemove(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove calendar?</AlertDialogTitle>
            <AlertDialogDescription>
              This will unsubscribe <strong>{calendarToRemove?.summary || calendarToRemove?.id}</strong> from the service account. Events from this calendar will no longer appear. You can re-add it at any time.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={unsubscribeMutation.isPending}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-rb-danger hover:bg-rb-danger-hover text-rb-on-color-ink"
              disabled={unsubscribeMutation.isPending}
              onClick={() => calendarToRemove && unsubscribeMutation.mutate(calendarToRemove.id)}
            >
              {unsubscribeMutation.isPending ? 'Removing…' : 'Remove'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Popover open={isOpen} onOpenChange={setIsOpen}>
        <PopoverTrigger asChild>
          {compactTrigger ? (
            <button
              className="flex items-center justify-center rounded-full bg-[var(--rb-chip)] text-rb-ink-secondary hover:bg-[var(--rb-chip-hover)] transition-colors"
              style={{ width: 52, height: 52, touchAction: "manipulation" }}
              title="Settings"
              data-testid="button-settings"
            >
              <Settings size={22} />
            </button>
          ) : (
            <Button
              variant="ghost"
              size="icon"
              className="h-12 w-12 text-rb-ink-secondary hover:text-rb-ink-soft hover:bg-rb-chip"
            >
              <Settings className="h-6 w-6" />
            </Button>
          )}
        </PopoverTrigger>
        <PopoverContent className="w-[416px] p-0" align="end">
          <div className="p-4 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-sm">Settings</h3>
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6"
                onClick={() => setIsOpen(false)}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>

            <Separator />

            {/* Brightness Control */}
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Sun className="h-4 w-4" />
                <Label className="text-sm font-medium">Brightness</Label>
              </div>
              <div className="flex items-center gap-3">
                <Moon className="h-3 w-3 text-rb-faint" />
                <Slider
                  value={[brightness]}
                  onValueChange={handleBrightnessChange}
                  max={150}
                  min={30}
                  step={5}
                  className="flex-1"
                />
                <Sun className="h-4 w-4 text-rb-ink-secondary" />
              </div>
              <p className="text-xs text-rb-muted">{brightness}%</p>
            </div>

            <Separator />

            {/* On-screen keyboard */}
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Keyboard className="h-4 w-4" />
                <Label className="text-sm font-medium">On-screen keyboard</Label>
              </div>
              <div className="flex gap-1.5">
                {([
                  { value: 'auto', label: 'Auto' },
                  { value: 'on', label: 'Always' },
                  { value: 'off', label: 'Off' },
                ] as { value: OskMode; label: string }[]).map((opt) => (
                  <Button
                    key={opt.value}
                    size="sm"
                    variant={oskMode === opt.value ? 'default' : 'outline'}
                    className="flex-1 h-8"
                    onClick={() => setOskMode(opt.value)}
                  >
                    {opt.label}
                  </Button>
                ))}
              </div>
              <p className="text-xs text-rb-faint leading-snug">
                Auto shows a touch keyboard on touchscreens only (e.g. the Pi kiosk).
              </p>
            </div>

            <Separator />

            {/* Widgets — layout picker (Task 9): enable/disable + reorder */}
            {widgetPickerEntries.length > 0 && (
              <>
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <LayoutGrid className="h-4 w-4" />
                    <Label className="text-sm font-medium">Widgets</Label>
                  </div>
                  <div className="space-y-1">
                    {widgetPickerEntries.map((entry, index) => {
                      const Icon = entry.icon;
                      const isCrashed = !!entry.crashed;
                      // A crashed widget's own switch is force-disabled
                      // (see WidgetPickerEntry's `crashed` doc) and never
                      // counts toward the guard (enabledWidgetCount above
                      // already excludes it) — so it can't itself be the
                      // reason another row's switch is guard-locked.
                      const lastEnabled = !isCrashed && entry.enabled && enabledWidgetCount <= 1;
                      // Phase 4 Task 5: the settings expander is available
                      // regardless of enabled/crashed state — settings are
                      // just config data, editable whether or not the
                      // widget is currently rendering (deliverable #2).
                      const hasSettings = !!entry.settings && entry.settings.length > 0;
                      const settingsOpen = hasSettings && expandedSettings.has(entry.id);
                      return (
                        <div key={entry.id} className="space-y-0.5">
                          <div className="flex items-center gap-1">
                            <Icon className="h-4 w-4 text-rb-ink-secondary flex-shrink-0" />
                            <span className="text-sm flex-1 truncate">{entry.label}</span>
                            <button
                              type="button"
                              className="touch-button flex items-center justify-center rounded-md text-rb-ink-secondary hover:bg-rb-chip disabled:opacity-30 disabled:pointer-events-none"
                              onClick={() => onMoveWidget?.(entry.id, -1)}
                              disabled={index === 0}
                              title="Move up"
                              data-testid={`widget-move-up-${entry.id}`}
                            >
                              <ChevronUp className="h-5 w-5" />
                            </button>
                            <button
                              type="button"
                              className="touch-button flex items-center justify-center rounded-md text-rb-ink-secondary hover:bg-rb-chip disabled:opacity-30 disabled:pointer-events-none"
                              onClick={() => onMoveWidget?.(entry.id, 1)}
                              disabled={index === widgetPickerEntries.length - 1}
                              title="Move down"
                              data-testid={`widget-move-down-${entry.id}`}
                            >
                              <ChevronDown className="h-5 w-5" />
                            </button>
                            {hasSettings && (
                              <button
                                type="button"
                                className="touch-button flex items-center justify-center rounded-md text-rb-ink-secondary hover:bg-rb-chip flex-shrink-0"
                                onClick={() => toggleSettingsExpanded(entry.id)}
                                title="Widget settings"
                                aria-expanded={settingsOpen}
                                data-testid={`widget-settings-toggle-${entry.id}`}
                              >
                                <SlidersHorizontal className="h-5 w-5" />
                              </button>
                            )}
                            <label
                              className="touch-button flex items-center justify-center flex-shrink-0"
                              title={
                                isCrashed
                                  ? entry.crashed
                                  : lastEnabled
                                    ? "At least one widget must stay enabled"
                                    : undefined
                              }
                            >
                              <Switch
                                checked={entry.enabled}
                                disabled={isCrashed || lastEnabled}
                                onCheckedChange={(checked) => onToggleWidget?.(entry.id, checked)}
                                data-testid={`widget-toggle-${entry.id}`}
                              />
                            </label>
                          </div>
                          {isCrashed && (
                            <p className="text-xs text-rb-danger leading-snug truncate pl-5">
                              crashed: {entry.crashed}
                            </p>
                          )}
                          {settingsOpen && (
                            <WidgetSettingsFields
                              fields={entry.settings!}
                              values={entry.settingsValues ?? {}}
                              onPatch={(key, value) => onPatchWidgetSetting?.(entry.id, key, value)}
                            />
                          )}
                        </div>
                      );
                    })}
                  </div>
                  {enabledWidgetCount <= 1 && (
                    <p className="text-xs text-rb-faint leading-snug">
                      At least one widget must stay enabled.
                    </p>
                  )}
                </div>

                <Separator />
              </>
            )}

            {/* Community Widgets — folder-drop picker (Phase 4): every
                widget discovered under /widgets/, whether or not it's
                already in config. Reorder is scoped to this pool only
                (see onMoveCommunityWidget's doc comment above) — a
                not-yet-installed entry has no position, so it gets no
                arrows at all. */}
            {communityWidgetPickerEntries.length > 0 && (
              <>
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <Puzzle className="h-4 w-4" />
                    <Label className="text-sm font-medium">Community Widgets</Label>
                  </div>
                  <div className="space-y-1.5">
                    {communityWidgetPickerEntries.map((entry) => {
                      const ready = entry.status === "ready";
                      const isCrashed = entry.status === "crashed";
                      const isGhost = entry.status === "ghost";
                      // "Turn ON" is blocked for newer-api/crashed/ghost —
                      // none of them can be helped by flipping the switch
                      // while off. "Turn OFF" is ALWAYS allowed whenever
                      // currently enabled (crashed/ghost/newer-api/error/
                      // loading alike) so a misbehaving or broken widget
                      // can never trap the user out of disabling it — this
                      // mirrors "error"'s pre-existing disable-only rule
                      // (ghost/crashed are new instances of the same
                      // pattern, not a new rule).
                      const canToggleOn = entry.status !== "newer-api" && !isCrashed && !isGhost;
                      const switchDisabled = !canToggleOn && !entry.enabled;
                      const iconSrc = entry.icon?.src;
                      const iconFailed = iconSrc !== undefined && failedIconSrc.get(entry.id) === iconSrc;
                      const installedIndex = installedCommunityEntries.findIndex((e) => e.id === entry.id);
                      // Only a "ready" (actually rendering) entry counts
                      // toward the last-enabled guard — see
                      // enabledWidgetCount's doc comment above for why.
                      const guardBlocksDisable = ready && entry.enabled && enabledWidgetCount <= 1;
                      // Phase 4 Task 5: available for any status except
                      // "ghost" (a ghost row's `entry.settings` is never
                      // populated — no discovered manifest to read
                      // descriptors from — so `hasSettings` is naturally
                      // false there without a separate isGhost check).
                      const hasSettings = !!entry.settings && entry.settings.length > 0;
                      const settingsOpen = hasSettings && expandedSettings.has(entry.id);
                      return (
                        <div key={entry.id} className="space-y-0.5">
                          <div className="flex items-center gap-1">
                            {entry.icon && !iconFailed ? (
                              <img
                                src={entry.icon.src}
                                alt=""
                                className="h-4 w-4 flex-shrink-0"
                                style={{ objectFit: "contain" }}
                                onError={() =>
                                  setFailedIconSrc((prev) => {
                                    if (prev.get(entry.id) === iconSrc) return prev;
                                    const next = new Map(prev);
                                    next.set(entry.id, iconSrc!);
                                    return next;
                                  })
                                }
                              />
                            ) : (
                              <Puzzle className="h-4 w-4 text-rb-ink-secondary flex-shrink-0" />
                            )}
                            <span className="text-sm flex-1 truncate">{entry.label}</span>
                            {entry.installed && (
                              <>
                                <button
                                  type="button"
                                  className="touch-button flex items-center justify-center rounded-md text-rb-ink-secondary hover:bg-rb-chip disabled:opacity-30 disabled:pointer-events-none"
                                  onClick={() => onMoveCommunityWidget?.(entry.id, -1)}
                                  disabled={installedIndex <= 0}
                                  title="Move up"
                                  data-testid={`community-widget-move-up-${entry.id}`}
                                >
                                  <ChevronUp className="h-5 w-5" />
                                </button>
                                <button
                                  type="button"
                                  className="touch-button flex items-center justify-center rounded-md text-rb-ink-secondary hover:bg-rb-chip disabled:opacity-30 disabled:pointer-events-none"
                                  onClick={() => onMoveCommunityWidget?.(entry.id, 1)}
                                  disabled={installedIndex === installedCommunityEntries.length - 1}
                                  title="Move down"
                                  data-testid={`community-widget-move-down-${entry.id}`}
                                >
                                  <ChevronDown className="h-5 w-5" />
                                </button>
                              </>
                            )}
                            {hasSettings && (
                              <button
                                type="button"
                                className="touch-button flex items-center justify-center rounded-md text-rb-ink-secondary hover:bg-rb-chip flex-shrink-0"
                                onClick={() => toggleSettingsExpanded(entry.id)}
                                title="Widget settings"
                                aria-expanded={settingsOpen}
                                data-testid={`community-widget-settings-toggle-${entry.id}`}
                              >
                                <SlidersHorizontal className="h-5 w-5" />
                              </button>
                            )}
                            <label
                              className="touch-button flex items-center justify-center flex-shrink-0"
                              title={
                                guardBlocksDisable
                                  ? "At least one widget must stay enabled"
                                  : switchDisabled
                                    ? (entry.statusMessage ?? "Not loadable")
                                    : undefined
                              }
                            >
                              <Switch
                                checked={entry.enabled}
                                disabled={switchDisabled || guardBlocksDisable}
                                onCheckedChange={(checked) => onToggleCommunityWidget?.(entry.id, checked)}
                                data-testid={`community-widget-toggle-${entry.id}`}
                              />
                            </label>
                          </div>
                          {/* Description is manifest data — shown for a
                              disabled/not-loaded row too (discovery-
                              derived info, no import required), not just
                              a ready one. */}
                          {entry.description && (
                            <p className="text-xs text-rb-faint leading-snug truncate pl-5">{entry.description}</p>
                          )}
                          {!ready && (
                            <p
                              className={`text-xs leading-snug truncate pl-5 ${
                                isCrashed ? "text-rb-danger" : "text-rb-warn"
                              }`}
                            >
                              {entry.status === "loading"
                                ? "Loading…"
                                : isCrashed
                                  ? `crashed: ${entry.statusMessage}`
                                  : entry.statusMessage}
                            </p>
                          )}
                          {settingsOpen && (
                            <WidgetSettingsFields
                              fields={entry.settings!}
                              values={entry.settingsValues ?? {}}
                              onPatch={(key, value) => onPatchWidgetSetting?.(entry.id, key, value)}
                            />
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>

                <Separator />
              </>
            )}

            {/* Widget Folder Errors — folders under /widgets/ that failed
                manifest validation (Phase 4). No controls: nothing to
                install until the folder itself is fixed. */}
            {invalidWidgetPickerEntries.length > 0 && (
              <>
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <AlertTriangle className="h-4 w-4 text-rb-warn" />
                    <Label className="text-sm font-medium">Widget Folder Errors</Label>
                  </div>
                  <div className="space-y-1">
                    {invalidWidgetPickerEntries.map((entry) => (
                      <p key={entry.folder} className="text-xs text-rb-warn-ink leading-snug">
                        <span className="font-mono">{entry.folder}</span>: {entry.error}
                      </p>
                    ))}
                  </div>
                </div>

                <Separator />
              </>
            )}

            {/* Calendar Selection */}
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <Calendar className="h-4 w-4" />
                <Label className="text-sm font-medium">Calendar Visibility</Label>
              </div>
              {serviceAccountError ? (
                <div className="rounded-md bg-rb-warn-wash border border-rb-warn-border px-3 py-2 flex items-start gap-2">
                  <AlertTriangle className="h-3.5 w-3.5 text-rb-warn flex-shrink-0 mt-0.5" />
                  <p className="text-xs text-rb-warn-ink leading-snug">
                    Key file not found —{" "}
                    <Link href="/setup" onClick={() => setIsOpen(false)} className="underline font-medium hover:text-rb-warn-ink">
                      visit the Setup Guide to get started
                    </Link>
                  </p>
                </div>
              ) : serviceAccountEmail ? (
                <div className="rounded-md bg-rb-canvas border border-rb-chip-hover px-3 py-2 space-y-1">
                  <p className="text-xs text-rb-muted">Share a Google Calendar with this email to make it available here.</p>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-mono text-rb-ink-secondary truncate flex-1 select-all">{serviceAccountEmail}</span>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6 flex-shrink-0 text-rb-faint hover:text-rb-ink-secondary"
                      onClick={handleCopyEmail}
                      title="Copy email"
                    >
                      {emailCopied ? <Check className="h-3.5 w-3.5 text-rb-success" /> : <Copy className="h-3.5 w-3.5" />}
                    </Button>
                  </div>
                </div>
              ) : null}
              <div className="space-y-2 max-h-40 overflow-y-auto pr-6 [&::-webkit-scrollbar]:w-4 [&::-webkit-scrollbar-track]:bg-rb-chip [&::-webkit-scrollbar-thumb]:bg-rb-scrollbar-thumb [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:border-2 [&::-webkit-scrollbar-thumb]:border-rb-chip">
                {isLoading ? (
                  <div className="text-xs text-rb-muted">Loading calendars...</div>
                ) : calendars && calendars.length > 0 ? (
                  calendars.map((calendar) => {
                    const isVisible = !hiddenCalendars.has(calendar.id);
                    const color = getCalendarColor(calendar);
                    
                    return (
                      <div key={calendar.id} className="flex items-center justify-between gap-1">
                        <div className="flex items-center gap-2 flex-1 min-w-0">
                          <div 
                            className="w-3 h-3 rounded-full flex-shrink-0"
                            style={{ backgroundColor: color }}
                          />
                          <span className="text-sm truncate">{calendar.summary}</span>
                        </div>
                        <div className="flex items-center gap-1 flex-shrink-0">
                          <Switch
                            checked={isVisible}
                            onCheckedChange={(checked) => 
                              onCalendarToggle(calendar.id, checked)
                            }
                          />
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 text-rb-faint hover:text-rb-danger hover:bg-rb-danger-wash"
                            onClick={() => setCalendarToRemove(calendar)}
                            title="Remove calendar"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </div>
                    );
                  })
                ) : (
                  <div className="text-xs text-rb-muted">No calendars available</div>
                )}
              </div>
            </div>

            {/* Add Calendar by ID */}
            <div className="space-y-1.5">
              {/* 44px-tall input/button: kiosk touch targets, and roomier when
                  the on-screen keyboard is driving this field. */}
              <div className="flex gap-2">
                <Input
                  value={calendarIdInput}
                  onChange={(e) => { setCalendarIdInput(e.target.value); setSubscribeError(null); }}
                  onKeyDown={(e) => e.key === 'Enter' && handleSubscribe()}
                  placeholder="email@example.com or calendar ID"
                  className="text-sm h-11 flex-1"
                  disabled={subscribeMutation.isPending}
                />
                <Button
                  size="sm"
                  className="h-11 px-4 bg-rb-success hover:bg-rb-success-hover text-rb-on-color-ink font-bold"
                  onClick={handleSubscribe}
                  disabled={!calendarIdInput.trim() || subscribeMutation.isPending}
                >
                  <Plus className="h-5 w-5" />
                  Add
                </Button>
              </div>
              {subscribeError && (
                <p className="text-xs text-rb-danger leading-snug">{subscribeError}</p>
              )}
              <p className="text-xs text-rb-faint leading-snug">
                Find Calendar ID in Google Calendar → Settings → Integrate calendar
              </p>
            </div>

            <Separator />

            {/* Update Controls */}
            <div className="space-y-2">
              <div className="flex gap-2">
                {onCheckForUpdates && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="flex-1 text-rb-info hover:text-rb-info-hover hover:bg-rb-info-wash"
                    onClick={() => { onCheckForUpdates(); setIsOpen(false); }}
                  >
                    <RefreshCw className="h-4 w-4 mr-2" />
                    Check for Updates
                  </Button>
                )}
                {onRollback && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="flex-1 text-rb-warn hover:text-rb-warn-ink hover:bg-rb-warn-wash"
                    onClick={() => { onRollback(); setIsOpen(false); }}
                  >
                    <RotateCcw className="h-4 w-4 mr-2" />
                    Roll Back
                  </Button>
                )}
              </div>
            </div>

            <Separator />

            {/* Version Info */}
            <div className="flex items-center justify-between text-xs text-rb-muted">
              <div className="flex items-center gap-1">
                <Info className="h-3 w-3" />
                <span>Version {APP_VERSION}</span>
              </div>
            </div>
          </div>
        </PopoverContent>
      </Popover>
    </>
  );
}