import { describe, expect, test } from "vitest";
import type { HourPoint } from "./types";
import {
  dateKeyOf,
  formatClock,
  formatTimeLabel,
  hoursInRange,
  pickHour,
  selectDay,
  trimHours,
} from "./time-windows";

// 2030-03-12 is a Tuesday. All `now` values are local-time constructors.
const DAY = "2030-03-12";
const NEXT = "2030-03-13";

function hour(time: string, over: Partial<HourPoint> = {}): HourPoint {
  return { time, tempC: 15, feelsLikeC: 15, precipChance: 0, precipMm: 0, snowCm: 0, code: 0, windKmh: 10, uv: 2, ...over };
}
function dayHours(dateKey: string): HourPoint[] {
  return Array.from({ length: 24 }, (_, h) => hour(`${dateKey}T${String(h).padStart(2, "0")}:00`));
}

describe("selectDay (scenario 5)", () => {
  test("14:59 with school end 15:00 selects today", () => {
    const sel = selectDay(new Date(2030, 2, 12, 14, 59), 15 * 60);
    expect(sel).toEqual({ dateKey: DAY, label: "Today", weekday: "Tuesday" });
  });
  test("15:30 with school end 15:00 selects tomorrow", () => {
    const sel = selectDay(new Date(2030, 2, 12, 15, 30), 15 * 60);
    expect(sel).toEqual({ dateKey: NEXT, label: "Tomorrow", weekday: "Wednesday" });
  });
  test("exactly school end selects tomorrow", () => {
    expect(selectDay(new Date(2030, 2, 12, 15, 0), 15 * 60).label).toBe("Tomorrow");
  });
});

describe("pickHour", () => {
  test("picks the nearest hour on the requested date", () => {
    const hours = dayHours(DAY);
    expect(pickHour(hours, DAY, 8 * 60)?.time).toBe(`${DAY}T08:00`);
    expect(pickHour(hours, DAY, 8 * 60 + 29)?.time).toBe(`${DAY}T08:00`);
    expect(pickHour(hours, DAY, 8 * 60 + 31)?.time).toBe(`${DAY}T09:00`);
  });
  test("returns null when the date has no hours", () => {
    expect(pickHour(dayHours(DAY), NEXT, 8 * 60)).toBeNull();
  });
});

describe("hoursInRange", () => {
  test("is inclusive on both ends and scoped to the date", () => {
    const hours = [...dayHours(DAY), ...dayHours(NEXT)];
    const got = hoursInRange(hours, DAY, 7 * 60, 10 * 60).map((h) => h.time);
    expect(got).toEqual([`${DAY}T07:00`, `${DAY}T08:00`, `${DAY}T09:00`, `${DAY}T10:00`]);
  });
  test("clamps a negative start to midnight", () => {
    const got = hoursInRange(dayHours(DAY), DAY, -60, 60).map((h) => h.time);
    expect(got).toEqual([`${DAY}T00:00`, `${DAY}T01:00`]);
  });
});

describe("trimHours", () => {
  test("drops hours before today and caps at 48 entries", () => {
    const hours = [...dayHours("2030-03-11"), ...dayHours(DAY), ...dayHours(NEXT), ...dayHours("2030-03-14")];
    const got = trimHours(hours, new Date(2030, 2, 12, 23, 0));
    expect(got).toHaveLength(48);
    expect(got[0].time).toBe(`${DAY}T00:00`);
    expect(got[47].time).toBe(`${NEXT}T23:00`);
  });
});

describe("labels", () => {
  test("dateKeyOf is zero-padded local", () => {
    expect(dateKeyOf(new Date(2030, 2, 5, 9, 0))).toBe("2030-03-05");
  });
  test("formatTimeLabel renders 12-hour clock", () => {
    expect(formatTimeLabel(8 * 60)).toBe("8:00 AM");
    expect(formatTimeLabel(15 * 60 + 5)).toBe("3:05 PM");
    expect(formatTimeLabel(0)).toBe("12:00 AM");
    expect(formatTimeLabel(12 * 60)).toBe("12:00 PM");
  });
  test("formatClock renders an ISO timestamp's local time", () => {
    const iso = new Date(2030, 2, 12, 7, 30).toISOString();
    expect(formatClock(iso)).toBe("7:30 AM");
  });
});
