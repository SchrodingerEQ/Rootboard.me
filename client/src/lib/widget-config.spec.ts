import { describe, expect, test } from "vitest";
import { dashboardConfigSchema, type DashboardConfig } from "@shared/dashboard-config";
import { applyWidgetSettingsPatch, sanitizeSettingsPatch } from "./widget-config";

// Guards the one step in the shell's settings-write path that can silently
// corrupt a user's data/config/dashboard.json: the whole document is PUT
// back, so anything this merge drops is destroyed on disk.

function config(): DashboardConfig {
  return {
    configVersion: 1,
    defaultWidget: "calendar",
    widgets: [
      { id: "calendar", enabled: true, settings: { hiddenCalendars: ["work"] } },
      { id: "chores", enabled: false, settings: { theme: "dark" } },
      { id: "dinner", enabled: true, settings: {} },
    ],
  };
}

describe("applyWidgetSettingsPatch", () => {
  test("merges into the target widget's existing settings rather than replacing them", () => {
    const next = applyWidgetSettingsPatch(config(), "calendar", { disabledCalendars: ["family"] });
    expect(next?.widgets[0].settings).toEqual({
      hiddenCalendars: ["work"],
      disabledCalendars: ["family"],
    });
  });

  test("overwrites just the patched key", () => {
    const next = applyWidgetSettingsPatch(config(), "calendar", { hiddenCalendars: [] });
    expect(next?.widgets[0].settings).toEqual({ hiddenCalendars: [] });
  });

  test("leaves every other widget, and the document envelope, untouched", () => {
    const next = applyWidgetSettingsPatch(config(), "calendar", { hiddenCalendars: ["x"] });
    expect(next?.configVersion).toBe(1);
    expect(next?.defaultWidget).toBe("calendar");
    expect(next?.widgets.map((w) => w.id)).toEqual(["calendar", "chores", "dinner"]);
    expect(next?.widgets[1]).toEqual({ id: "chores", enabled: false, settings: { theme: "dark" } });
    expect(next?.widgets[2]).toEqual({ id: "dinner", enabled: true, settings: {} });
    expect(next?.widgets[0].enabled).toBe(true);
  });

  test("returns null for a widget id that has no config entry", () => {
    expect(applyWidgetSettingsPatch(config(), "not-installed", { a: 1 })).toBeNull();
  });

  test("does not mutate the input (it is react-query cache data)", () => {
    const original = config();
    applyWidgetSettingsPatch(original, "calendar", { hiddenCalendars: ["mutated"] });
    expect(original.widgets[0].settings).toEqual({ hiddenCalendars: ["work"] });
  });

  test("result still satisfies the server's schema (the PUT is validated)", () => {
    const next = applyWidgetSettingsPatch(config(), "calendar", {
      hiddenCalendars: ["a"],
      disabledCalendars: ["b"],
    });
    expect(dashboardConfigSchema.safeParse(next).success).toBe(true);
  });
});

// CONTRACT.md §2/§4: "host.settings.patch() ... the host validates and
// persists" — this is that validation, guarding the boundary where a
// widget's (untrusted) builder return value would otherwise reach the
// merge/PUT path in app-shell.tsx's updateWidgetSettings.
describe("sanitizeSettingsPatch", () => {
  test("passes a plain patch object through unchanged", () => {
    expect(sanitizeSettingsPatch({ a: 1 })).toEqual({ a: 1 });
  });

  test("null is the documented no-op and passes through silently", () => {
    expect(sanitizeSettingsPatch(null)).toBeNull();
  });

  test("undefined is also treated as a no-op", () => {
    expect(sanitizeSettingsPatch(undefined)).toBeNull();
  });

  test("a string return value is dropped, not merged", () => {
    // @ts-expect-error — exercising a widget bug at runtime, not a
    // type-correct caller
    expect(sanitizeSettingsPatch("oops")).toBeNull();
  });

  test("an array return value is dropped, not merged", () => {
    // @ts-expect-error — exercising a widget bug at runtime, not a
    // type-correct caller
    expect(sanitizeSettingsPatch(["oops"])).toBeNull();
  });
});
