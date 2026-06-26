/**
 * Standalone test for getCalendarDateRange (no test runner configured yet).
 * Run with:  npx tsx client/src/lib/date-range.test.ts
 *
 * Reproduces the bug where events visible in month view went missing in
 * week/day views because the fetch window was shifted by the current time of
 * day (and the week window was only 6 days long).
 */
import assert from "node:assert/strict";
import { getCalendarDateRange, type CalendarView } from "./date-range.ts";

// Standard half-open overlap test, mirroring the server query
// (start_time < end AND end_time > start).
function overlaps(evStart: Date, evEnd: Date, win: { start: Date; end: Date }) {
  return evStart < win.end && evEnd > win.start;
}

// The OLD (buggy) implementation, kept here only to prove the regression.
function oldRange(currentDate: Date, currentView: CalendarView) {
  const start = new Date(currentDate);
  const end = new Date(currentDate);
  if (currentView === "month") {
    start.setDate(1);
    start.setDate(start.getDate() - start.getDay());
    end.setMonth(end.getMonth() + 1, 0);
    end.setDate(end.getDate() + (6 - end.getDay()));
  } else if (currentView === "week") {
    start.setDate(start.getDate() - start.getDay());
    end.setDate(start.getDate() + 6);
  } else if (currentView === "day") {
    end.setDate(end.getDate() + 1);
  }
  return { start, end };
}

const DAY = 24 * 60 * 60 * 1000;
let passed = 0;
const check = (name: string, fn: () => void) => {
  fn();
  passed++;
  console.log(`  ok - ${name}`);
};

// Viewed instant: a weekday afternoon (carries a 17:30 wall-clock time).
const viewed = new Date(2026, 5, 25, 17, 30, 0, 0); // 2026-06-25 17:30 local

console.log("DAY view");
{
  const win = getCalendarDateRange(viewed, "day");
  check("starts at local midnight", () =>
    assert.equal(win.start.getHours() + win.start.getMinutes(), 0),
  );
  check("spans exactly 24h", () =>
    assert.equal(win.end.getTime() - win.start.getTime(), DAY),
  );
  // A 9am event on the viewed day — the classic casualty of the old bug.
  const morn = new Date(2026, 5, 25, 9, 0);
  const mornEnd = new Date(2026, 5, 25, 10, 0);
  check("includes a 9am event on the viewed day", () =>
    assert.ok(overlaps(morn, mornEnd, win)),
  );
  check("OLD logic DROPPED that 9am event (regression proof)", () =>
    assert.ok(!overlaps(morn, mornEnd, oldRange(viewed, "day"))),
  );
}

console.log("WEEK view");
{
  const win = getCalendarDateRange(viewed, "week");
  check("starts on Sunday at local midnight", () => {
    assert.equal(win.start.getDay(), 0);
    assert.equal(win.start.getHours(), 0);
  });
  check("spans exactly 7 days", () =>
    assert.equal(win.end.getTime() - win.start.getTime(), 7 * DAY),
  );
  // Saturday evening event (last day of the week) and Sunday morning event
  // (first day) — both dropped by the old 6-day, time-shifted window.
  const sat = new Date(win.start.getTime() + 6 * DAY); // Saturday 00:00
  const satEve = new Date(sat); satEve.setHours(20, 0);
  const satEveEnd = new Date(sat); satEveEnd.setHours(21, 0);
  const sunMorn = new Date(win.start); sunMorn.setHours(8, 0);
  const sunMornEnd = new Date(win.start); sunMornEnd.setHours(9, 0);
  check("includes Saturday-evening event", () =>
    assert.ok(overlaps(satEve, satEveEnd, win)),
  );
  check("includes Sunday-morning event", () =>
    assert.ok(overlaps(sunMorn, sunMornEnd, win)),
  );
  check("OLD logic DROPPED Saturday-evening event", () =>
    assert.ok(!overlaps(satEve, satEveEnd, oldRange(viewed, "week"))),
  );
  check("OLD logic DROPPED Sunday-morning event", () =>
    assert.ok(!overlaps(sunMorn, sunMornEnd, oldRange(viewed, "week"))),
  );
}

console.log("MONTH view");
{
  const win = getCalendarDateRange(viewed, "month");
  check("starts on a Sunday at local midnight", () => {
    assert.equal(win.start.getDay(), 0);
    assert.equal(win.start.getHours(), 0);
  });
  check("end is a Sunday midnight (exclusive)", () => {
    assert.equal(win.end.getDay(), 0);
    assert.equal(win.end.getHours(), 0);
  });
  check("covers a late event on the last grid day", () => {
    const lastDay = new Date(win.end.getTime() - DAY); // last visible Saturday
    const lateStart = new Date(lastDay); lateStart.setHours(22, 0);
    const lateEnd = new Date(lastDay); lateEnd.setHours(23, 0);
    assert.ok(overlaps(lateStart, lateEnd, win));
  });
}

console.log(`\nAll ${passed} assertions passed.`);
