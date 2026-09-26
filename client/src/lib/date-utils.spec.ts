import { describe, expect, it } from "vitest";
import { eventOverlapsDay } from "./date-utils";

// Local-time constructor: (year, monthIndex, day, hour, minute)
const t = (d: number, h = 0, m = 0) => new Date(2026, 8, d, h, m);

describe("eventOverlapsDay", () => {
  it("keeps an event that ends exactly at midnight off the next day", () => {
    const start = t(26, 22);
    const end = t(27, 0);
    expect(eventOverlapsDay(start, end, t(26))).toBe(true);
    expect(eventOverlapsDay(start, end, t(27))).toBe(false);
  });

  it("puts an overnight event on both days", () => {
    const start = t(26, 22);
    const end = t(27, 1);
    expect(eventOverlapsDay(start, end, t(26))).toBe(true);
    expect(eventOverlapsDay(start, end, t(27))).toBe(true);
  });

  it("ignores the time of day on the day being checked", () => {
    // Overnight event ending 1 AM; checking at 3 PM used to miss it.
    expect(eventOverlapsDay(t(26, 22), t(27, 1), t(27, 15))).toBe(true);
    // Midnight-ending event; checking the next day at midnight used to include it.
    expect(eventOverlapsDay(t(26, 22), t(27, 0), t(27, 0))).toBe(false);
  });

  it("covers every day of a multi-day event and nothing outside it", () => {
    const start = t(25, 9);
    const end = t(28, 17);
    expect(eventOverlapsDay(start, end, t(24))).toBe(false);
    for (const d of [25, 26, 27, 28]) expect(eventOverlapsDay(start, end, t(d))).toBe(true);
    expect(eventOverlapsDay(start, end, t(29))).toBe(false);
  });

  it("keeps all-day events (stored as local midnight → 23:59:59.999) on their own day", () => {
    const start = t(26);
    const end = new Date(2026, 8, 26, 23, 59, 59, 999);
    expect(eventOverlapsDay(start, end, t(25))).toBe(false);
    expect(eventOverlapsDay(start, end, t(26))).toBe(true);
    expect(eventOverlapsDay(start, end, t(27))).toBe(false);
  });

  it("keeps a zero-length event at midnight on its own day", () => {
    expect(eventOverlapsDay(t(27), t(27), t(26))).toBe(false);
    expect(eventOverlapsDay(t(27), t(27), t(27))).toBe(true);
  });
});
