/**
 * One colour per calendar everywhere (brief 02, closes the TASKS.md
 * "duplicate calendar-color fallback" item): the server stamps synced
 * events (Month/Week read `event.color`) and the client draws Settings,
 * chips and avatars from the same function.
 */
import fs from "fs";
import path from "path";
import { describe, expect, test } from "vitest";
import { CALENDAR_FALLBACK_COLORS, calendarFallbackColor } from "@shared/calendar-color";
import { getCalendarColor } from "./calendar-meta";

const root = path.resolve(import.meta.dirname, "../../..");
const read = (p: string) => fs.readFileSync(path.join(root, p), "utf-8");

describe("calendar fallback colour", () => {
  test("stable per id, from the palette, and Google's own colour wins", () => {
    const id = "family@group.calendar.example.test";
    expect(calendarFallbackColor(id)).toBe(calendarFallbackColor(id));
    expect(CALENDAR_FALLBACK_COLORS).toContain(calendarFallbackColor(id));
    expect(getCalendarColor({ id })).toBe(calendarFallbackColor(id));
    expect(getCalendarColor({ id, backgroundColor: "#123456" })).toBe("#123456");
  });

  test("Settings and the server have no palette of their own", () => {
    const settings = read("client/src/components/calendar/settings-menu.tsx");
    expect(settings).toContain('import { getCalendarColor, type CalendarInfo } from "@/lib/calendar-meta"');
    expect(settings).not.toMatch(/const getCalendarColor\s*=/);
    expect(settings).not.toContain("'#1a73e8', '#34a853'");
    const server = read("server/services/googleCalendar.ts");
    expect(server).toMatch(/return calendarFallbackColor\(calendarId\);/);
  });
});
