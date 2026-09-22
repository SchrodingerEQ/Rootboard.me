import { z } from "zod";
import { widgetIdSchema } from "./widget-manifest";
import { themeIdSchema } from "./theme-manifest";

const dashboardWidgetEntrySchema = z.object({
  id: widgetIdSchema,
  enabled: z.boolean(),
  settings: z.record(z.unknown()).default({}),
});

export type DashboardWidgetEntry = z.infer<typeof dashboardWidgetEntrySchema>;

export const dashboardConfigSchema = z
  .object({
    configVersion: z.literal(1),
    defaultWidget: widgetIdSchema,
    /**
     * Active theme id (client/src/themes). LENIENT on purpose: a malformed
     * value becomes undefined (→ Default) instead of invalidating the whole
     * file — otherwise a typo here would reset the widget layout too.
     * An unknown-but-well-formed id also resolves to Default at apply time
     * (client/src/lib/theme-engine.ts resolveTheme). Decision 0009.
     */
    theme: themeIdSchema.optional().catch(undefined),
    widgets: z
      .array(dashboardWidgetEntrySchema)
      .min(1)
      .refine((widgets) => new Set(widgets.map((w) => w.id)).size === widgets.length, {
        message: "duplicate widget id",
      }),
  })
  .refine((config) => config.widgets.some((w) => w.enabled), {
    message: "at least one widget must be enabled",
  });

export type DashboardConfig = z.infer<typeof dashboardConfigSchema>;

/**
 * The built-in default config: calendar, chores, dinner — all enabled,
 * empty settings, calendar as the default widget. Returns a fresh
 * object on every call; callers may mutate the result freely.
 */
export function defaultDashboardConfig(): DashboardConfig {
  return {
    configVersion: 1,
    defaultWidget: "calendar",
    widgets: [
      { id: "calendar", enabled: true, settings: {} },
      { id: "chores", enabled: true, settings: {} },
      { id: "dinner", enabled: true, settings: {} },
    ],
  };
}
