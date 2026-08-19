import { z } from "zod";
import { widgetIdSchema } from "./widget-manifest";

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
