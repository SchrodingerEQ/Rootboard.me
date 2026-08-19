import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { LEGACY_KEY_ALIASES, createWidgetHost } from "./widget-host-services";
import { validateBuiltinManifest } from "@/widgets/registry";

describe("LEGACY_KEY_ALIASES", () => {
  test("maps chores and dinner to their unprefixed legacy app_state keys", () => {
    expect(LEGACY_KEY_ALIASES).toEqual({ chores: "chores", dinner: "dinner" });
  });
});

describe("createWidgetHost — settings.patch", () => {
  // vitest.config.ts runs specs in a plain node environment (no DOM) — fine
  // for every other spec here, but createWidgetHost unconditionally binds
  // `host.fetch` to `window.fetch` at construction time (widget-host-
  // services.ts), which is otherwise unrelated to what this test checks
  // (settings.patch delegation). Node 18+ has a native global `fetch`, so
  // aliasing `window` to `globalThis` is enough to satisfy that one line
  // without pulling in jsdom for the whole suite. Scoped to this describe's
  // beforeEach/afterEach (rather than a describe-body-level call) so the
  // stub can't leak into specs in other files sharing this test run.
  beforeEach(() => {
    vi.stubGlobal("window", globalThis);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  function makeHost(patchSettings = vi.fn()) {
    const handle = createWidgetHost({
      widgetId: "chores",
      getSettings: () => ({}),
      subscribeSettings: () => () => {},
      patchSettings,
      setBadge: () => {},
      sleep: () => {},
    });
    return { handle, patchSettings };
  }

  test("host.settings.patch delegates straight to the opts.patchSettings callback", () => {
    const { handle, patchSettings } = makeHost();
    const build = (current: Record<string, unknown>) => ({ ...current, x: 1 });
    handle.host.settings.patch(build);
    expect(patchSettings).toHaveBeenCalledTimes(1);
    expect(patchSettings).toHaveBeenCalledWith(build);
  });

  test("the widget never supplies its own widgetId to the patch path — only opts.widgetId is baked into the host, patch takes no id argument", () => {
    const { handle, patchSettings } = makeHost();
    handle.host.settings.patch(() => null);
    // The delegated callback receives exactly one argument (the builder) —
    // there is no id parameter a widget could use to target another
    // widget's settings entry.
    expect(patchSettings.mock.calls[0]).toHaveLength(1);
    expect(handle.host.widgetId).toBe("chores");
  });
});

const validManifest = {
  id: "calendar",
  name: "Calendar",
  version: "1.0.0",
  apiVersion: 1,
  entry: "index.tsx",
  slots: ["section"],
};

describe("validateBuiltinManifest", () => {
  test("accepts a valid manifest and returns the parsed value", () => {
    const result = validateBuiltinManifest(validManifest);
    expect(result).toEqual(validManifest);
  });

  test("rejects a manifest whose apiVersion is newer than WIDGET_API_VERSION", () => {
    expect(() => validateBuiltinManifest({ ...validManifest, apiVersion: 2 })).toThrow();
  });

  test("rejects a schema-invalid manifest (bad id)", () => {
    expect(() => validateBuiltinManifest({ ...validManifest, id: "Calendar" })).toThrow();
  });

  test("rejects a schema-invalid manifest (missing required field)", () => {
    const { slots: _slots, ...withoutSlots } = validManifest;
    expect(() => validateBuiltinManifest(withoutSlots)).toThrow();
  });
});
