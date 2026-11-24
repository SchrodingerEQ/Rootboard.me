import { describe, expect, test } from "vitest";
import { buildFeedbackContext, FEEDBACK_CONTEXT_MAX_BYTES } from "./feedback-context";
import { checkContext } from "@/feedback/feedback-client.js";
import { BUILTIN_WIDGETS } from "@/widgets/registry";

const versions: Record<string, string> = { calendar: "1.0.0", chores: "1.2.0", "user-notes": "0.3.1" };
const versionOf = (id: string) => versions[id];
const bytes = (value: unknown) => new TextEncoder().encode(JSON.stringify(value)).byteLength;

describe("buildFeedbackContext", () => {
  test("lists only the enabled widgets, in config order, as widget@version", () => {
    const context = buildFeedbackContext(
      [
        { id: "chores", enabled: true },
        { id: "dinner", enabled: false },
        { id: "calendar", enabled: true },
      ],
      versionOf,
      "deep-space",
    );
    expect(context).toEqual({ widgets: ["chores@1.2.0", "calendar@1.0.0"], theme: "deep-space" });
  });

  test("a widget with no known manifest is reported by id alone", () => {
    expect(buildFeedbackContext([{ id: "gone-folder", enabled: true }], versionOf, "default").widgets).toEqual(["gone-folder"]);
  });

  test("passes the service's identifier-key rule, even for a widget named user-notes", () => {
    // Widget ids are values, never keys, so a forbidden word in a community
    // widget's name cannot get the report refused.
    const context = buildFeedbackContext([{ id: "user-notes", enabled: true }], versionOf, "default");
    expect(context.widgets).toEqual(["user-notes@0.3.1"]);
    expect(checkContext({ ...context })).toBeNull();
  });

  test("every built-in enabled stays well under the 2 KB cap", () => {
    const all = BUILTIN_WIDGETS.map((w) => ({ id: w.manifest.id, enabled: true }));
    const context = buildFeedbackContext(all, (id) => BUILTIN_WIDGETS.find((w) => w.manifest.id === id)?.manifest.version, "default");
    expect(context.widgets).toHaveLength(BUILTIN_WIDGETS.length);
    expect(bytes(context)).toBeLessThan(FEEDBACK_CONTEXT_MAX_BYTES);
    expect(checkContext({ ...context })).toBeNull();
  });

  test("a kiosk with very many widgets is cut to fit the cap and says how many were left out", () => {
    const many = Array.from({ length: 200 }, (_, i) => ({ id: `community-widget-number-${i}`, enabled: true }));
    const context = buildFeedbackContext(many, () => "10.20.30", "default");
    expect(bytes(context)).toBeLessThanOrEqual(FEEDBACK_CONTEXT_MAX_BYTES);
    expect(checkContext({ ...context })).toBeNull();
    const last = context.widgets[context.widgets.length - 1];
    const shown = context.widgets.length - 1;
    expect(last).toBe(`+${200 - shown} more`);
    expect(context.widgets[0]).toBe("community-widget-number-0@10.20.30");
  });
});
