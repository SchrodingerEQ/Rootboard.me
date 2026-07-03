/**
 * Standalone test for normalizeGoogleEventTimes (no test runner configured).
 * Run with:  npx tsx server/services/googleEventTimes.test.ts
 *
 * Reproduces the bug where all-day events showed up across two days in the
 * month view: date-only strings were parsed as UTC midnight (previous local
 * evening in western timezones) and Google's exclusive end was stored raw.
 */
import assert from "node:assert/strict";
import { normalizeGoogleEventTimes, parseDateOnlyLocal } from "./googleEventTimes.ts";

let passed = 0;
const check = (name: string, fn: () => void) => {
  fn();
  passed++;
  console.log(`  ok - ${name}`);
};

const localDay = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

console.log("parseDateOnlyLocal");
check("parses as LOCAL midnight, not UTC", () => {
  const d = parseDateOnlyLocal("2026-05-10");
  assert.equal(localDay(d), "2026-05-10");
  assert.equal(d.getHours(), 0);
  assert.equal(d.getMinutes(), 0);
});

console.log("all-day events");
check("single-day event stays entirely on its own local day", () => {
  // Google: birthday on May 10 → start.date May 10, end.date May 11 (exclusive)
  const t = normalizeGoogleEventTimes({ date: "2026-05-10" }, { date: "2026-05-11" });
  assert.equal(t.isAllDay, true);
  assert.equal(localDay(t.startTime), "2026-05-10", "starts on its day");
  assert.equal(localDay(t.endTime), "2026-05-10", "ends on the SAME day (inclusive)");
  assert.equal(t.endTime.getHours(), 23);
  assert.equal(t.endTime.getMinutes(), 59);
});
check("OLD parsing put the event on the previous local day too (regression proof)", () => {
  // Only meaningful west of UTC (e.g. the Pi kiosk on Pacific time).
  if (new Date(2026, 4, 10).getTimezoneOffset() <= 0) {
    console.log("      (skipped: local timezone is at/east of UTC)");
    return;
  }
  const oldStart = new Date("2026-05-10"); // UTC midnight
  assert.notEqual(localDay(oldStart), "2026-05-10", "old parse landed on May 9 locally");
});
check("multi-day all-day spans exactly its own days", () => {
  // Camp Jul 6–10 → Google end.date Jul 11 (exclusive)
  const t = normalizeGoogleEventTimes({ date: "2026-07-06" }, { date: "2026-07-11" });
  assert.equal(localDay(t.startTime), "2026-07-06");
  assert.equal(localDay(t.endTime), "2026-07-10", "last day is Jul 10, not Jul 11");
});
check("year boundary: Dec 31 event stays on Dec 31", () => {
  const t = normalizeGoogleEventTimes({ date: "2026-12-31" }, { date: "2027-01-01" });
  assert.equal(localDay(t.startTime), "2026-12-31");
  assert.equal(localDay(t.endTime), "2026-12-31");
});
check("missing end collapses to a one-day event", () => {
  const t = normalizeGoogleEventTimes({ date: "2026-05-10" }, undefined);
  assert.equal(localDay(t.endTime), "2026-05-10");
});
check("malformed end before start collapses to a one-day event", () => {
  const t = normalizeGoogleEventTimes({ date: "2026-05-10" }, { date: "2026-05-09" });
  assert.equal(localDay(t.endTime), "2026-05-10");
  assert.ok(t.endTime > t.startTime);
});

console.log("timed events");
check("dateTime instants pass through unchanged", () => {
  const t = normalizeGoogleEventTimes(
    { dateTime: "2026-07-04T15:00:00-07:00" },
    { dateTime: "2026-07-04T16:30:00-07:00" },
  );
  assert.equal(t.isAllDay, false);
  assert.equal(t.startTime.toISOString(), "2026-07-04T22:00:00.000Z");
  assert.equal(t.endTime.toISOString(), "2026-07-04T23:30:00.000Z");
});

console.log(`\nAll ${passed} assertions passed.`);
