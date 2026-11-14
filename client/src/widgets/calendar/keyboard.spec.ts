import { afterEach, describe, expect, test, vi } from "vitest";
import type { SetStateAction } from "react";
import type { CalendarView } from "@/lib/app-types";
import { createCalendarKeyHandler, stepCalendarDate } from "./keyboard";

// The widget's keydown listener is created once per view and kept while the
// date changes. This fake applies state updates the way React does, so the
// tests below press keys on ONE handler, exactly like the real listener.
function setup(view: CalendarView, start: Date) {
  const state = { date: start, view };
  const setCurrentDate = (update: SetStateAction<Date>) => {
    state.date = typeof update === "function" ? update(state.date) : update;
  };
  const setCurrentView = (next: CalendarView) => {
    state.view = next;
  };
  const handler = createCalendarKeyHandler(view, setCurrentDate, setCurrentView);
  let prevented = 0;
  const press = (key: string) => handler({ key, preventDefault: () => { prevented++; } });
  return { state, press, prevented: () => prevented };
}

const ymd = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

describe("calendar keyboard shortcuts", () => {
  test("three ArrowRight presses in Day view move three days", () => {
    const { state, press } = setup("day", new Date(2026, 10, 14));
    press("ArrowRight");
    press("ArrowRight");
    press("ArrowRight");
    expect(ymd(state.date)).toBe("2026-11-17");
  });

  test("ArrowLeft steps back from the latest date, a week at a time in Week view", () => {
    const { state, press } = setup("week", new Date(2026, 10, 14));
    press("ArrowLeft");
    press("ArrowLeft");
    expect(ymd(state.date)).toBe("2026-10-31");
  });

  test("Month view steps a month per press", () => {
    const { state, press } = setup("month", new Date(2026, 10, 14));
    press("ArrowRight");
    press("ArrowRight");
    expect(ymd(state.date)).toBe("2027-01-14");
  });

  test("arrows call preventDefault; other keys do not", () => {
    const { press, prevented } = setup("day", new Date(2026, 10, 14));
    press("ArrowRight");
    press("ArrowLeft");
    press("2");
    press("x");
    expect(prevented()).toBe(2);
  });

  test("1, 2 and 3 switch views; T returns to today", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 10, 14, 23, 59, 59, 999));
    const { state, press } = setup("day", new Date(2020, 0, 1));
    press("2");
    expect(state.view).toBe("week");
    press("3");
    expect(state.view).toBe("month");
    press("1");
    expect(state.view).toBe("day");
    press("T");
    expect(ymd(state.date)).toBe("2026-11-14");
  });
});

afterEach(() => {
  vi.useRealTimers();
});

describe("stepCalendarDate", () => {
  test("does not change the date it is given", () => {
    const start = new Date(2026, 10, 14);
    stepCalendarDate(start, "day", 1);
    expect(ymd(start)).toBe("2026-11-14");
  });
});
