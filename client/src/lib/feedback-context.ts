// The `context` object Rootboard adds to a feedback report (beta brief 04
// decision 3; Crucible feedback contract v1 §3). Two keys, both shown to the
// owner on the review screen before anything is sent:
//
//   widgets: the enabled widgets as "<widget>@<version>" strings
//   theme:   the active theme's id
//
// Widget ids go in as VALUES, never as keys: the feedback service refuses any
// context key that is or contains an identifier word (`id`, `name`, `user`,
// `device`, …), and a community widget may well be called `user-notes`.
// Nothing else goes in: no calendar content, no account, no location.

import type { DashboardWidgetEntry } from "@shared/dashboard-config";

/** The service's cap on `context`, serialized (contract §3). */
export const FEEDBACK_CONTEXT_MAX_BYTES = 2048;

export interface FeedbackContext {
  widgets: string[];
  theme: string;
}

/**
 * @param configWidgets  `dashboard.json` widgets, in config order; only the
 *   enabled ones are reported.
 * @param versionOf      The widget's manifest version (built-in registry or
 *   `GET /api/widgets`), or undefined when no manifest is known (a widget
 *   whose folder is gone): that one is reported by id alone.
 * @param themeId        The active theme.
 */
export function buildFeedbackContext(
  configWidgets: readonly Pick<DashboardWidgetEntry, "id" | "enabled">[],
  versionOf: (widgetId: string) => string | undefined,
  themeId: string,
): FeedbackContext {
  const widgets = configWidgets
    .filter((w) => w.enabled)
    .map((w) => {
      const version = versionOf(w.id);
      return version ? `${w.id}@${version}` : w.id;
    });
  return { widgets: fitUnderCap(widgets, themeId), theme: themeId };
}

/** A kiosk with dozens of community widgets could pass the 2 KB cap, and the
 *  client refuses to build a report whose context the service would reject.
 *  Keep as many entries as fit and say how many were left out. */
function fitUnderCap(widgets: string[], themeId: string): string[] {
  const size = (list: string[]) => byteLength(JSON.stringify({ widgets: list, theme: themeId }));
  if (size(widgets) <= FEEDBACK_CONTEXT_MAX_BYTES) return widgets;
  const kept = [...widgets];
  let left = 0;
  do {
    kept.pop();
    left += 1;
  } while (kept.length > 0 && size([...kept, moreLabel(left)]) > FEEDBACK_CONTEXT_MAX_BYTES);
  return [...kept, moreLabel(left)];
}

function moreLabel(count: number): string {
  return `+${count} more`;
}

function byteLength(text: string): number {
  return new TextEncoder().encode(text).byteLength;
}
