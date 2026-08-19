import type { ComponentType } from "react";
import { WIDGET_API_VERSION, widgetManifestSchema, type WidgetManifest } from "@shared/widget-manifest";
import type { RootboardWidget } from "./types";

export interface BuiltinWidgetEntry {
  manifest: WidgetManifest;
  widget: RootboardWidget;
  navIcon?: ComponentType<{ size?: number; strokeWidth?: number }>;
}

/**
 * Built-in widgets, registered here as they're ported in Tasks 6-8
 * (calendar, chores, dinner). Empty for now — nothing consumes this yet,
 * and WidgetHostMount (Task 4) has nothing to render until entries land.
 */
export const BUILTIN_WIDGETS: BuiltinWidgetEntry[] = [];

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
