import { describe, expect, test } from "vitest";
import type { WidgetSettingField } from "@shared/widget-manifest";
import { resolveFieldValue } from "./widget-settings-fields";

// Deliverable #4 (type-coercion safety): resolveFieldValue is the one place
// that decides what a settings-editor field DISPLAYS. It must never surface
// a config value whose type doesn't match the descriptor — that's the guard
// against a hand-edited data/config/dashboard.json silently rendering
// garbage, and (per widget-settings-fields.tsx's per-field commit model)
// resolving to a fallback here must never itself be what writes anything
// back to config.

function stringField(overrides: Partial<WidgetSettingField> = {}): WidgetSettingField {
  return { key: "label", label: "Label", type: "string", ...overrides };
}

function numberField(overrides: Partial<WidgetSettingField> = {}): WidgetSettingField {
  return { key: "count", label: "Count", type: "number", ...overrides };
}

function booleanField(overrides: Partial<WidgetSettingField> = {}): WidgetSettingField {
  return { key: "flag", label: "Flag", type: "boolean", ...overrides };
}

function selectField(overrides: Partial<WidgetSettingField> = {}): WidgetSettingField {
  return {
    key: "theme",
    label: "Theme",
    type: "select",
    options: [
      { value: "light", label: "Light" },
      { value: "dark", label: "Dark" },
    ],
    ...overrides,
  };
}

describe("resolveFieldValue", () => {
  test("string: uses the config value when present and type-correct", () => {
    expect(resolveFieldValue(stringField({ default: "fallback" }), { label: "hi" })).toBe("hi");
  });

  test("string: falls back to the descriptor default when missing from config", () => {
    expect(resolveFieldValue(stringField({ default: "fallback" }), {})).toBe("fallback");
  });

  test("string: falls back to empty when neither config nor default is present", () => {
    expect(resolveFieldValue(stringField(), {})).toBe("");
  });

  test("number: uses the config value when present and type-correct", () => {
    expect(resolveFieldValue(numberField({ default: 10 }), { count: 5 })).toBe(5);
  });

  test("number: a type-mismatched config value (hand-edited) falls through to the default, not the raw value", () => {
    expect(resolveFieldValue(numberField({ default: 10 }), { count: "5" })).toBe(10);
  });

  test("number: NaN/Infinity in config are treated as type-mismatched", () => {
    expect(resolveFieldValue(numberField({ default: 10 }), { count: Number.NaN })).toBe(10);
    expect(resolveFieldValue(numberField({ default: 10 }), { count: Number.POSITIVE_INFINITY })).toBe(10);
  });

  test("number: falls back to empty string when neither config nor default is present", () => {
    expect(resolveFieldValue(numberField(), {})).toBe("");
  });

  test("boolean: uses the config value when present and type-correct, including `false`", () => {
    expect(resolveFieldValue(booleanField({ default: true }), { flag: false })).toBe(false);
  });

  test("boolean: a type-mismatched config value falls through to the default", () => {
    expect(resolveFieldValue(booleanField({ default: true }), { flag: "true" })).toBe(true);
  });

  test("boolean: falls back to false when neither config nor default is present", () => {
    expect(resolveFieldValue(booleanField(), {})).toBe(false);
  });

  test("select: uses the config value when present and a string", () => {
    expect(resolveFieldValue(selectField({ default: "light" }), { theme: "dark" })).toBe("dark");
  });

  test("select: a non-string config value falls through to the default", () => {
    expect(resolveFieldValue(selectField({ default: "light" }), { theme: 1 })).toBe("light");
  });

  test("select: falls back to empty when neither config nor default is present", () => {
    expect(resolveFieldValue(selectField(), {})).toBe("");
  });
});
