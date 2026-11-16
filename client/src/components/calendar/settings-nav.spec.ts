import { describe, expect, test } from "vitest";
import {
  SETTINGS_CATEGORIES,
  SETTINGS_SUBVIEWS,
  categoryHasWarning,
  parentView,
  viewLabel,
  type SettingsProblems,
  type SettingsView,
} from "./settings-nav";

const NONE: SettingsProblems = {
  themeErrors: 0,
  widgetFolderErrors: 0,
  communityWidgetProblems: 0,
  googleNeedsSetup: false,
  weatherFailing: false,
};

describe("SETTINGS_CATEGORIES", () => {
  test("five categories in the founder-approved order and wording", () => {
    expect(SETTINGS_CATEGORIES.map((c) => [c.id, c.label])).toEqual([
      ["display", "Display"],
      ["calendars", "Calendars"],
      ["widgets", "Widgets"],
      ["keyboard", "Keyboard"],
      ["system", "System"],
    ]);
  });

  test("ids are unique, non-main views, and every category has a summary and icon", () => {
    const ids = SETTINGS_CATEGORIES.map((c) => c.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const c of SETTINGS_CATEGORIES) {
      const view: SettingsView = c.id;
      expect(view).not.toBe("main");
      expect(c.summary.length).toBeGreaterThan(0);
      expect(c.icon).toBeTruthy();
    }
  });
});

describe("categoryHasWarning", () => {
  test("nothing lights up when there are no problems", () => {
    for (const c of SETTINGS_CATEGORIES) expect(categoryHasWarning(c.id, NONE), c.id).toBe(false);
  });

  const cases: Array<[Partial<SettingsProblems>, SettingsView]> = [
    [{ themeErrors: 1 }, "display"],
    [{ widgetFolderErrors: 2 }, "widgets"],
    [{ communityWidgetProblems: 1 }, "widgets"],
    [{ googleNeedsSetup: true }, "calendars"],
    [{ weatherFailing: true }, "system"],
  ];

  for (const [problem, expected] of cases) {
    test(`${JSON.stringify(problem)} lights only ${expected}`, () => {
      const p = { ...NONE, ...problem };
      for (const c of SETTINGS_CATEGORIES) {
        expect(categoryHasWarning(c.id, p), c.id).toBe(c.id === expected);
      }
    });
  }
});

describe("sub-views (brief 05)", () => {
  test("Diagnostics and Pair a device sit under System", () => {
    expect(parentView("system-diagnostics")).toBe("system");
    expect(parentView("system-pairing")).toBe("system");
    expect(viewLabel("system-diagnostics")).toBe("Diagnostics");
    expect(viewLabel("system-pairing")).toBe("Pair a device");
  });

  test("categories go back to main and keep their label", () => {
    for (const c of SETTINGS_CATEGORIES) {
      expect(parentView(c.id)).toBe("main");
      expect(viewLabel(c.id)).toBe(c.label);
    }
    expect(parentView("main")).toBe("main");
  });

  test("every sub-view's parent is a real category", () => {
    const ids = new Set(SETTINGS_CATEGORIES.map((c) => c.id));
    for (const sub of Object.values(SETTINGS_SUBVIEWS)) expect(ids.has(sub.parent)).toBe(true);
  });
});
