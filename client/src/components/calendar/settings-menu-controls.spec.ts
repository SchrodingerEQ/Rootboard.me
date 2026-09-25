import fs from "fs";
import path from "path";
import { describe, expect, test } from "vitest";

// Source guard for the 2026-09-24 regrouping of the Settings popover into
// category sub-menus. No React renderer exists in this test setup, so this
// asserts the regroup is a pure *move*: every existing control and its
// wiring must still be present in settings-menu.tsx.
const src = fs.readFileSync(path.resolve(import.meta.dirname, "settings-menu.tsx"), "utf-8");

describe("settings-menu.tsx keeps every existing control", () => {
  const mustContain = [
    // trigger + brightness (the slider itself lives in brightness-control.tsx)
    'data-testid="button-settings"',
    "<BrightnessControl",
    // display
    "theme-select-",
    "theme-error-",
    // widgets
    "widget-toggle-",
    "widget-move-up-",
    "widget-settings-toggle-",
    "community-widget-toggle-",
    "Widget Folder Errors",
    // calendars
    "onCalendarToggle",
    "setCalendarToRemove",
    "subscribeMutation",
    "handleCopyEmail",
    // keyboard
    "setOskMode",
    // system
    "onCheckForUpdates",
    "onRollback",
    "APP_VERSION",
  ];
  for (const needle of mustContain) {
    test(needle, () => expect(src).toContain(needle));
  }

  test("navigation: category rows, back button, and a height-capped popover", () => {
    expect(src).toContain("settings-category-");
    expect(src).toContain('data-testid="settings-back"');
    expect(src).toContain("max-h-[var(--radix-popover-content-available-height)]");
    // must stay a class: an inline maxHeight would override the stricter
    // on-screen-keyboard cap in index.css and hide Add Calendar behind it
    expect(src).not.toMatch(/style=\{\{\s*maxHeight/);
    // re-anchor the popover when a shorter sub-menu opens
    expect(src).toContain('if (isOpen) window.dispatchEvent(new Event("resize"));');
    expect(src).toContain("}, [view, isOpen]);");
  });

  test("brightness slider: isolated component, persists on commit not per tick", () => {
    const bc = fs.readFileSync(path.resolve(import.meta.dirname, "brightness-control.tsx"), "utf-8");
    expect(bc).toContain('BRIGHTNESS_STORAGE_KEY = "calendar-brightness"');
    expect(bc).toContain("onValueCommit={handleCommit}");
    // the per-tick handler must not touch localStorage and must paint live
    // (overlay only); the commit handler paints for real (filter allowed)
    const perTick = bc.slice(bc.indexOf("const handleChange"), bc.indexOf("const handleCommit"));
    expect(perTick).not.toContain("localStorage");
    expect(perTick).toContain("applyBrightness(percent, true)");
    const commit = bc.slice(bc.indexOf("const handleCommit"));
    expect(commit).toContain("applyBrightness(value[0], false)");
    // the menu no longer owns slider state or writes brightness itself
    expect(src).not.toContain("calendar-brightness");
    expect(src).not.toMatch(/<Slider[\s>]/); // (SlidersHorizontal is a different icon)
  });

  test("keyboard over Add Calendar: panel stretches upward and re-anchors", () => {
    const css = fs.readFileSync(path.resolve(import.meta.dirname, "../../index.css"), "utf-8");
    const osk = fs.readFileSync(path.resolve(import.meta.dirname, "../keyboard/on-screen-keyboard.tsx"), "utf-8");
    expect(src).toContain("data-settings-panel");
    expect(css).toMatch(/html\[data-osk-open\] \[data-radix-popper-content-wrapper\] \[data-settings-panel\] \{\s*min-height:/);
    expect(osk).toContain('window.dispatchEvent(new Event("resize"));');
  });
});
