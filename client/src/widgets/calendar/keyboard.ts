import type { Dispatch, SetStateAction } from "react";
import type { CalendarView } from "@/lib/app-types";

/** One step back (-1) or forward (+1) in the given view: a day, a week or a
 *  month. Returns a new Date; the input is not changed. */
export function stepCalendarDate(date: Date, view: CalendarView, direction: number): Date {
  const next = new Date(date);
  if (view === "month") {
    next.setMonth(next.getMonth() + direction);
  } else if (view === "week") {
    next.setDate(next.getDate() + direction * 7);
  } else {
    next.setDate(next.getDate() + direction);
  }
  return next;
}

type CalendarKeyEvent = { key: string; preventDefault: () => void };

/** The calendar's keyboard shortcuts. The keydown listener lives as long as
 *  the view stays the same, so date steps use a functional state update:
 *  each press steps from the latest date, not the one the listener was
 *  created with. */
export function createCalendarKeyHandler(
  view: CalendarView,
  setCurrentDate: Dispatch<SetStateAction<Date>>,
  setCurrentView: (view: CalendarView) => void,
): (e: CalendarKeyEvent) => void {
  return (e) => {
    switch (e.key) {
      case "ArrowLeft":
        e.preventDefault();
        setCurrentDate((date) => stepCalendarDate(date, view, -1));
        break;
      case "ArrowRight":
        e.preventDefault();
        setCurrentDate((date) => stepCalendarDate(date, view, 1));
        break;
      case "t":
      case "T":
        setCurrentDate(new Date());
        break;
      case "1":
        setCurrentView("day");
        break;
      case "2":
        setCurrentView("week");
        break;
      case "3":
        setCurrentView("month");
        break;
    }
  };
}
