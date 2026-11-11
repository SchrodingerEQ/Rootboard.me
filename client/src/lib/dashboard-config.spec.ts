import { describe, expect, test } from "vitest";
import {
  dashboardConfigSchema,
  defaultDashboardConfig,
} from "@shared/dashboard-config";

const validConfig = {
  configVersion: 1 as const,
  defaultWidget: "calendar",
  widgets: [
    { id: "calendar", enabled: true, settings: {} },
    { id: "chores", enabled: true, settings: {} },
    { id: "dinner", enabled: true, settings: {} },
  ],
};

describe("dashboardConfigSchema", () => {
  test("accepts a valid config", () => {
    const result = dashboardConfigSchema.safeParse(validConfig);
    expect(result.success).toBe(true);
  });

  test("defaults widget settings to {} when omitted", () => {
    const result = dashboardConfigSchema.safeParse({
      configVersion: 1,
      defaultWidget: "calendar",
      widgets: [{ id: "calendar", enabled: true }],
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.widgets[0].settings).toEqual({});
    }
  });

  test("rejects duplicate widget ids", () => {
    const result = dashboardConfigSchema.safeParse({
      ...validConfig,
      widgets: [
        { id: "calendar", enabled: true, settings: {} },
        { id: "calendar", enabled: false, settings: {} },
      ],
    });
    expect(result.success).toBe(false);
  });

  test("rejects a config where every widget is disabled", () => {
    const result = dashboardConfigSchema.safeParse({
      ...validConfig,
      widgets: validConfig.widgets.map((w) => ({ ...w, enabled: false })),
    });
    expect(result.success).toBe(false);
  });

  test("rejects an empty widgets array", () => {
    const result = dashboardConfigSchema.safeParse({ ...validConfig, widgets: [] });
    expect(result.success).toBe(false);
  });

  test("rejects a configVersion other than 1", () => {
    const result = dashboardConfigSchema.safeParse({ ...validConfig, configVersion: 2 });
    expect(result.success).toBe(false);
  });
});

describe("defaultDashboardConfig", () => {
  test("round-trips through its own schema", () => {
    const result = dashboardConfigSchema.safeParse(defaultDashboardConfig());
    expect(result.success).toBe(true);
  });

  test("has calendar, chores, dinner enabled and what-to-wear disabled, defaultWidget calendar", () => {
    const config = defaultDashboardConfig();
    expect(config.configVersion).toBe(1);
    expect(config.defaultWidget).toBe("calendar");
    expect(config.widgets.map((w) => w.id)).toEqual(["calendar", "chores", "dinner", "what-to-wear"]);
    expect(config.widgets.map((w) => w.enabled)).toEqual([true, true, true, false]);
    expect(config.widgets.every((w) => Object.keys(w.settings).length === 0)).toBe(true);
  });

  test("returns a fresh object each call (no shared mutable singleton)", () => {
    const a = defaultDashboardConfig();
    const b = defaultDashboardConfig();
    expect(a).not.toBe(b);
    expect(a.widgets).not.toBe(b.widgets);
    a.widgets[0].enabled = false;
    expect(b.widgets[0].enabled).toBe(true);
  });
});

describe("dashboard config `weather` field (beta-launch brief 01)", () => {
  const weather = { postalCode: "00000", countryCode: "US", label: "Testville, TS", lat: 1.5, lon: -2.25, units: "fahrenheit" as const };

  test("absent from the default config (no location until one is set)", () => {
    expect(defaultDashboardConfig().weather).toBeUndefined();
  });

  test("accepts a well-formed location", () => {
    const parsed = dashboardConfigSchema.parse({ ...validConfig, weather });
    expect(parsed.weather).toEqual(weather);
  });

  test.each([
    ["a string", "garbage"],
    ["a lowercase country", { ...weather, countryCode: "us" }],
    ["an out-of-range latitude", { ...weather, lat: 91 }],
    ["an unknown unit", { ...weather, units: "kelvin" }],
    ["a missing coordinate", { ...weather, lon: undefined }],
    ["an empty postal code", { ...weather, postalCode: "  " }],
  ])("%s becomes undefined and the widget layout still loads", (_name, bad) => {
    const result = dashboardConfigSchema.safeParse({ ...validConfig, weather: bad });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.weather).toBeUndefined();
      expect(result.data.widgets.map((w) => w.id)).toEqual(["calendar", "chores", "dinner"]);
    }
  });
});
