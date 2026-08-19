import { describe, expect, test } from "vitest";
import { LEGACY_KEY_ALIASES } from "./widget-host-services";
import { validateBuiltinManifest } from "@/widgets/registry";

describe("LEGACY_KEY_ALIASES", () => {
  test("maps chores and dinner to their unprefixed legacy app_state keys", () => {
    expect(LEGACY_KEY_ALIASES).toEqual({ chores: "chores", dinner: "dinner" });
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
