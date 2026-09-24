import { describe, expect, test } from "vitest";
import {
  SETTINGS_CATEGORIES,
  categoryHasWarning,
  type SettingsProblems,
  type SettingsView,
} from "./settings-nav";

const NONE: SettingsProblems = {
  themeErrors: 0,
  widgetFolderErrors: 0,
  communityWidgetProblems: 0,
  serviceAccountMissing: false,
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
    [{ serviceAccountMissing: true }, "calendars"],
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
