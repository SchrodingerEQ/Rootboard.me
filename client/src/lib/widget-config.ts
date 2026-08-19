import type { DashboardConfig } from "@shared/dashboard-config";

/**
 * Guards a widget-supplied settings patch before it can reach
 * `applyWidgetSettingsPatch`/the PUT. This is CONTRACT.md §2/§4's "host
 * validates" guarantee for `host.settings.patch()`: a widget's builder
 * return value is untrusted input, not a value the host can assume is a
 * well-formed patch object just because its TypeScript type says so.
 *
 * `null`/`undefined`/any other falsy value is the documented "nothing to
 * write" no-op and passes through silently — that's an intentional,
 * expected outcome (e.g. a builder that decides there's no change to
 * make), not a bug worth logging. Anything else that isn't a plain patch
 * object (a string, a number, an array, ...) is dropped with a
 * console.warn instead: that shape can only come from a widget bug, and
 * merging it into `widgets[].settings` would corrupt
 * `data/config/dashboard.json` on the next PUT.
 */
export function sanitizeSettingsPatch(
  patch: Record<string, unknown> | null | undefined,
): Record<string, unknown> | null {
  if (!patch) return null;
  if (typeof patch !== "object" || Array.isArray(patch)) {
    console.warn("[widget-config] settings builder returned a non-object patch; dropped", patch);
    return null;
  }
  return patch;
}

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
