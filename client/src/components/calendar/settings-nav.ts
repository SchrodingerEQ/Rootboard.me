import { Calendar, Keyboard, LayoutGrid, Palette, RefreshCw, type LucideIcon } from "lucide-react";

/**
 * Settings popover navigation (founder-approved 2026-09-24).
 *
 * The popover grew taller than the kiosk screen once the Theme section was
 * added, pushing its header and the Brightness slider off the top edge. It is
 * now a main screen (Brightness + five category rows + version) and five
 * short sub-menus opened with a tap and closed with Back. Pure data + one
 * predicate here so the structure is unit-testable without a React renderer.
 */

export type SettingsCategoryId = "display" | "calendars" | "widgets" | "keyboard" | "system";

/** Screens one level below a category (beta-launch brief 05); Back returns to the parent. */
export type SettingsSubView = "system-diagnostics" | "system-pairing";

export type SettingsView = "main" | SettingsCategoryId | SettingsSubView;

export interface SettingsCategory {
  id: SettingsCategoryId;
  label: string;
  /** One muted line under the label on the main screen. */
  summary: string;
  icon: LucideIcon;
}

export const SETTINGS_CATEGORIES: readonly SettingsCategory[] = [
  { id: "display", label: "Display", summary: "Theme picker, theme errors", icon: Palette },
  { id: "calendars", label: "Calendars", summary: "Share email, show/hide, remove, add by ID", icon: Calendar },
  { id: "widgets", label: "Widgets", summary: "Built-in layout + settings, community, folder errors", icon: LayoutGrid },
  { id: "keyboard", label: "Keyboard", summary: "On-screen keyboard: Auto/Always/Off", icon: Keyboard },
  { id: "system", label: "System", summary: "Updates, setup, weather, diagnostics, pair a device", icon: RefreshCw },
];

export const SETTINGS_SUBVIEWS: Readonly<Record<SettingsSubView, { label: string; parent: SettingsCategoryId }>> = {
  "system-diagnostics": { label: "Diagnostics", parent: "system" },
  "system-pairing": { label: "Pair a device", parent: "system" },
};

/** Where Back goes from `view`. */
export function parentView(view: SettingsView): SettingsView {
  if (view === "main") return "main";
  if (view in SETTINGS_SUBVIEWS) return SETTINGS_SUBVIEWS[view as SettingsSubView].parent;
  return "main";
}

/** The header label for `view` (the Back button's text). */
export function viewLabel(view: SettingsView): string {
  if (view in SETTINGS_SUBVIEWS) return SETTINGS_SUBVIEWS[view as SettingsSubView].label;
  return SETTINGS_CATEGORIES.find((c) => c.id === view)?.label ?? "Settings";
}

/** Problems the main screen must surface so they are never hidden inside a closed category. */
export interface SettingsProblems {
  themeErrors: number;
  widgetFolderErrors: number;
  /** Community widgets whose status is "crashed" or "error". */
  communityWidgetProblems: number;
  /** The Google service-account key file is missing (calendar setup needed). */
  serviceAccountMissing: boolean;
  /** The server's latest Open-Meteo fetch failed (weather-status.ts). */
  weatherFailing: boolean;
}

export function categoryHasWarning(id: SettingsView, p: SettingsProblems): boolean {
  switch (id) {
    case "display":
      return p.themeErrors > 0;
    case "widgets":
      return p.widgetFolderErrors > 0 || p.communityWidgetProblems > 0;
    case "calendars":
      return p.serviceAccountMissing;
    case "system":
      return p.weatherFailing;
    default:
      return false;
  }
}
