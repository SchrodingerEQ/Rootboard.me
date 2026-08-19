import { describe, expect, test } from "vitest";
import {
  WIDGET_API_VERSION,
  widgetIdSchema,
  widgetManifestSchema,
  widgetSettingFieldSchema,
} from "@shared/widget-manifest";

const validManifest = {
  id: "grocery-list",
  name: "Grocery List",
  version: "1.0.0",
  apiVersion: 1,
  entry: "index.js",
  slots: ["section"],
};

describe("WIDGET_API_VERSION", () => {
  test("is 1", () => {
    expect(WIDGET_API_VERSION).toBe(1);
  });
});

describe("widgetManifestSchema", () => {
  test("accepts a minimal valid manifest", () => {
    const result = widgetManifestSchema.safeParse(validManifest);
    expect(result.success).toBe(true);
  });

  test("accepts a fully-populated valid manifest", () => {
    const result = widgetManifestSchema.safeParse({
      ...validManifest,
      description: "Track groceries",
      icon: "icon.svg",
      refresh: { intervalSeconds: 300 },
      settings: [
        {
          key: "sortMode",
          label: "Sort",
          type: "select",
          default: "manual",
          options: [
            { value: "manual", label: "Manual" },
            { value: "alpha", label: "A-Z" },
          ],
        },
      ],
    });
    expect(result.success).toBe(true);
  });

  test("rejects a bad id (uppercase)", () => {
    const result = widgetManifestSchema.safeParse({ ...validManifest, id: "GroceryList" });
    expect(result.success).toBe(false);
  });

  test("rejects a bad id (too short / single char)", () => {
    const result = widgetManifestSchema.safeParse({ ...validManifest, id: "g" });
    expect(result.success).toBe(false);
  });

  test("rejects a bad semver", () => {
    const result = widgetManifestSchema.safeParse({ ...validManifest, version: "1.0" });
    expect(result.success).toBe(false);
  });

  test("rejects a non-positive apiVersion", () => {
    const result = widgetManifestSchema.safeParse({ ...validManifest, apiVersion: 0 });
    expect(result.success).toBe(false);
  });

  test("rejects a negative apiVersion", () => {
    const result = widgetManifestSchema.safeParse({ ...validManifest, apiVersion: -1 });
    expect(result.success).toBe(false);
  });

  test("rejects slots missing the required 'section' slot", () => {
    const result = widgetManifestSchema.safeParse({ ...validManifest, slots: ["tile"] });
    expect(result.success).toBe(false);
  });

  test("rejects empty slots array", () => {
    const result = widgetManifestSchema.safeParse({ ...validManifest, slots: [] });
    expect(result.success).toBe(false);
  });

  test("rejects '..' segments in entry", () => {
    const result = widgetManifestSchema.safeParse({ ...validManifest, entry: "../evil.js" });
    expect(result.success).toBe(false);
  });

  test("rejects '..' segments in icon", () => {
    const result = widgetManifestSchema.safeParse({ ...validManifest, icon: "../../etc/passwd" });
    expect(result.success).toBe(false);
  });

  test("rejects refresh.intervalSeconds below 30", () => {
    const result = widgetManifestSchema.safeParse({
      ...validManifest,
      refresh: { intervalSeconds: 10 },
    });
    expect(result.success).toBe(false);
  });

  test("accepts name at exactly 40 characters", () => {
    const name40 = "a".repeat(40);
    const result = widgetManifestSchema.safeParse({ ...validManifest, name: name40 });
    expect(result.success).toBe(true);
  });

  test("rejects empty name", () => {
    const result = widgetManifestSchema.safeParse({ ...validManifest, name: "" });
    expect(result.success).toBe(false);
  });

  test("rejects name exceeding 40 characters", () => {
    const name41 = "a".repeat(41);
    const result = widgetManifestSchema.safeParse({ ...validManifest, name: name41 });
    expect(result.success).toBe(false);
  });

  test("accepts description at exactly 200 characters", () => {
    const desc200 = "x".repeat(200);
    const result = widgetManifestSchema.safeParse({
      ...validManifest,
      description: desc200,
    });
    expect(result.success).toBe(true);
  });

  test("rejects description exceeding 200 characters", () => {
    const desc201 = "x".repeat(201);
    const result = widgetManifestSchema.safeParse({
      ...validManifest,
      description: desc201,
    });
    expect(result.success).toBe(false);
  });

  test("accepts refresh.intervalSeconds at exactly 30", () => {
    const result = widgetManifestSchema.safeParse({
      ...validManifest,
      refresh: { intervalSeconds: 30 },
    });
    expect(result.success).toBe(true);
  });

  test("rejects refresh.intervalSeconds below 30", () => {
    const result = widgetManifestSchema.safeParse({
      ...validManifest,
      refresh: { intervalSeconds: 29 },
    });
    expect(result.success).toBe(false);
  });

  test("rejects non-integer refresh.intervalSeconds", () => {
    const result = widgetManifestSchema.safeParse({
      ...validManifest,
      refresh: { intervalSeconds: 60.5 },
    });
    expect(result.success).toBe(false);
  });

  test("rejects entry with mid-path traversal '..'", () => {
    const result = widgetManifestSchema.safeParse({ ...validManifest, entry: "a/../b" });
    expect(result.success).toBe(false);
  });

  test("accepts entry with dots in filename (not traversal)", () => {
    const result = widgetManifestSchema.safeParse({ ...validManifest, entry: "a..b" });
    expect(result.success).toBe(true);
  });
});

describe("widgetIdSchema", () => {
  test("accepts a valid id", () => {
    expect(widgetIdSchema.safeParse("chores").success).toBe(true);
  });

  test("rejects an id starting with a hyphen", () => {
    expect(widgetIdSchema.safeParse("-chores").success).toBe(false);
  });
});

describe("widgetSettingFieldSchema", () => {
  test("accepts a non-select field without options", () => {
    const result = widgetSettingFieldSchema.safeParse({
      key: "showIcons",
      label: "Show icons",
      type: "boolean",
    });
    expect(result.success).toBe(true);
  });

  test("rejects a select field without options", () => {
    const result = widgetSettingFieldSchema.safeParse({
      key: "sortMode",
      label: "Sort",
      type: "select",
    });
    expect(result.success).toBe(false);
  });

  test("rejects a select field with empty options", () => {
    const result = widgetSettingFieldSchema.safeParse({
      key: "sortMode",
      label: "Sort",
      type: "select",
      options: [],
    });
    expect(result.success).toBe(false);
  });

  test("rejects a non-select field that has options", () => {
    const result = widgetSettingFieldSchema.safeParse({
      key: "showIcons",
      label: "Show icons",
      type: "boolean",
      options: [{ value: "a", label: "A" }],
    });
    expect(result.success).toBe(false);
  });

  test("rejects a bad key", () => {
    const result = widgetSettingFieldSchema.safeParse({
      key: "1bad",
      label: "Bad",
      type: "boolean",
    });
    expect(result.success).toBe(false);
  });
});
