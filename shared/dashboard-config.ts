import { z } from "zod";
import { widgetIdSchema } from "./widget-manifest";
import { themeIdSchema } from "./theme-manifest";

const dashboardWidgetEntrySchema = z.object({
  id: widgetIdSchema,
  enabled: z.boolean(),
  settings: z.record(z.unknown()).default({}),
});

export type DashboardWidgetEntry = z.infer<typeof dashboardWidgetEntrySchema>;

/**
 * The kiosk's weather location, set from Settings → System → Weather
 * (beta-launch brief 01). Coordinates come from a postal-code lookup and are
 * stored once; the postal code is kept so the UI can show what was typed.
 * Device-local like the rest of data/ (gitignored, preserved across updates).
 */
export const weatherLocationSchema = z.object({
  postalCode: z.string().trim().min(1).max(16),
  /** ISO 3166-1 alpha-2, upper case (the lookup service's country key). */
  countryCode: z.string().regex(/^[A-Z]{2}$/),
  label: z.string().max(120),
  lat: z.number().min(-90).max(90),
  lon: z.number().min(-180).max(180),
  units: z.enum(["celsius", "fahrenheit"]),
});

export type WeatherLocation = z.infer<typeof weatherLocationSchema>;

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
    /**
     * Weather location. LENIENT like `theme`: a malformed value becomes
     * undefined (→ the WEATHER_* env fallback, else no weather) instead of
     * invalidating the widget layout. Absent on a fresh kiosk.
     */
    weather: weatherLocationSchema.optional().catch(undefined),
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
 * The built-in default config: calendar, chores, dinner — all enabled —
 * plus what-to-wear disabled (it needs a zip code or host weather to be
 * useful; a fresh kiosk opts in from the layout picker). Empty settings,
 * calendar as the default widget. Returns a fresh object on every call;
 * callers may mutate the result freely.
 */
export function defaultDashboardConfig(): DashboardConfig {
  return {
    configVersion: 1,
    defaultWidget: "calendar",
    widgets: [
      { id: "calendar", enabled: true, settings: {} },
      { id: "chores", enabled: true, settings: {} },
      { id: "dinner", enabled: true, settings: {} },
      { id: "what-to-wear", enabled: false, settings: {} },
    ],
  };
}
