import { CalendarDays, ClipboardCheck, Shirt, UtensilsCrossed, type LucideIcon } from "lucide-react";
import type { WidgetManifest } from "@shared/widget-manifest";
import type { RootboardWidget } from "./types";
import calendarWidget, { manifest as calendarManifest } from "./calendar";
import choresWidget, { manifest as choresManifest } from "./chores";
import dinnerWidget, { manifest as dinnerManifest } from "./dinner";
import whatToWearWidget, { manifest as whatToWearManifest } from "./what-to-wear";

export interface BuiltinWidgetEntry {
  manifest: WidgetManifest;
  widget: RootboardWidget;
  navIcon?: LucideIcon;
}

/**
 * Built-in widgets. All four first-party sections (calendar, chores,
 * dinner, what-to-wear) are ported onto the contract as of Task 8 — there is no
 * legacy-rendered section left, and therefore no hardcoded nav
 * icon/label fallback either (nav-rail.tsx's LEGACY_NAV_META is gone).
 * A dashboard-config id with no entry here is an uninstalled widget and
 * is skipped by the shell.
 * Array order here is cosmetic only — nav-rail order comes from
 * dashboard-config (CONTRACT.md §5), not from this array.
 */
export const BUILTIN_WIDGETS: BuiltinWidgetEntry[] = [
  { manifest: calendarManifest, widget: calendarWidget, navIcon: CalendarDays },
  { manifest: choresManifest, widget: choresWidget, navIcon: ClipboardCheck },
  { manifest: dinnerManifest, widget: dinnerWidget, navIcon: UtensilsCrossed },
  { manifest: whatToWearManifest, widget: whatToWearWidget, navIcon: Shirt },
];
