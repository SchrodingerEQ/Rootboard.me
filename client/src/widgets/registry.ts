import { ClipboardCheck, UtensilsCrossed, type LucideIcon } from "lucide-react";
import { WIDGET_API_VERSION, widgetManifestSchema, type WidgetManifest } from "@shared/widget-manifest";
import type { RootboardWidget } from "./types";
import choresWidget, { manifest as choresManifest } from "./chores";
import dinnerWidget, { manifest as dinnerManifest } from "./dinner";

export interface BuiltinWidgetEntry {
  manifest: WidgetManifest;
  widget: RootboardWidget;
  navIcon?: LucideIcon;
}

/**
 * Built-in widgets, registered here as they're ported in Tasks 6-8
 * (chores, dinner, calendar). Calendar is still legacy-rendered by
 * AppShell until its own task lands — AppShell's nav-rail resolution falls
 * back to a small hardcoded icon/label map (client/src/components/
 * nav-rail.tsx LEGACY_NAV_META) for any dashboard-config id not found here.
 * Array order here is cosmetic only — nav-rail order comes from
 * dashboard-config (CONTRACT.md §5), not from this array.
 */
export const BUILTIN_WIDGETS: BuiltinWidgetEntry[] = [
  { manifest: choresManifest, widget: choresWidget, navIcon: ClipboardCheck },
  { manifest: dinnerManifest, widget: dinnerWidget, navIcon: UtensilsCrossed },
];

/**
 * Validates a built-in widget's manifest through the same Zod schema used
 * for sideloaded community widgets (CONTRACT.md §6: "same contract,
 * different transport"), plus the apiVersion gate that schema alone can't
 * express relative to this host build. Throws with a clear message on
 * failure — a bad built-in manifest is a build-time bug, not something to
 * degrade gracefully around, so it must fail fast in dev.
 */
export function validateBuiltinManifest(raw: unknown): WidgetManifest {
  const manifest = widgetManifestSchema.parse(raw);
  if (manifest.apiVersion > WIDGET_API_VERSION) {
    throw new Error(
      `Built-in widget "${manifest.id}" targets apiVersion ${manifest.apiVersion}, but this host ` +
        `implements ${WIDGET_API_VERSION}. Built-ins must never target a newer contract version ` +
        `than the host they ship with.`,
    );
  }
  return manifest;
}
