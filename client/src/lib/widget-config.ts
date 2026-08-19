import type { DashboardConfig } from "@shared/dashboard-config";

/**
 * Pure merge step behind the shell's `updateWidgetSettings` helper
 * (client/src/components/app-shell.tsx). Extracted so the part that can
 * silently corrupt a user's `data/config/dashboard.json` — the merge — is
 * machine-checkable without a React renderer (this repo has none in its
 * test setup); the surrounding read-cache / PUT / invalidate wiring stays
 * inspection-only.
 *
 * Returns `null` when `widgetId` isn't present in the config: a widget with
 * no config entry has nowhere to store settings, and inventing an entry
 * would mean guessing its `enabled` state (which the schema requires).
 * Callers treat `null` as "nothing to write".
 *
 * Semantics that matter:
 *  - The patch is MERGED into that widget's existing settings, not
 *    substituted for them — writing `hiddenCalendars` must never drop a
 *    `disabledCalendars` that was already there (or any future setting).
 *  - Every other field of the config (configVersion, defaultWidget, widget
 *    order, other widgets' enabled/settings) is carried through untouched:
 *    the whole document is PUT back, so anything dropped here is destroyed
 *    on disk.
 *  - Non-destructive: the input config is never mutated (it is react-query
 *    cache data).
 */
export function applyWidgetSettingsPatch(
  config: DashboardConfig,
  widgetId: string,
  patch: Record<string, unknown>,
): DashboardConfig | null {
  if (!config.widgets.some((w) => w.id === widgetId)) return null;
  return {
    ...config,
    widgets: config.widgets.map((w) =>
      w.id === widgetId ? { ...w, settings: { ...w.settings, ...patch } } : w,
    ),
  };
}
