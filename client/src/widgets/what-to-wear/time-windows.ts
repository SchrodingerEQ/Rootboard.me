import type { HourPoint } from "./types";

const WEEKDAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

/** Local "YYYY-MM-DD" for a Date. */
export function dateKeyOf(d: Date): string {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

export function minutesOfDay(d: Date): number {
  return d.getHours() * 60 + d.getMinutes();
}

/** Upstream times are "YYYY-MM-DDTHH:MM" local strings — read them by
 *  slicing, never via Date parsing, so no timezone math can creep in. */
export function hourDateKey(h: HourPoint): string {
  return h.time.slice(0, 10);
}

export function hourMinutes(h: HourPoint): number {
  const hh = Number(h.time.slice(11, 13));
  const mm = Number(h.time.slice(14, 16));
  return (Number.isFinite(hh) ? hh : 0) * 60 + (Number.isFinite(mm) ? mm : 0);
}

export interface DaySelection {
  dateKey: string;
  label: "Today" | "Tomorrow";
  weekday: string;
}

/** Brief §5: before school end → today; otherwise → tomorrow. */
export function selectDay(now: Date, schoolEndMin: number): DaySelection {
  const isToday = minutesOfDay(now) < schoolEndMin;
  const d = new Date(now);
  if (!isToday) d.setDate(d.getDate() + 1);
  return { dateKey: dateKeyOf(d), label: isToday ? "Today" : "Tomorrow", weekday: WEEKDAYS[d.getDay()] };
}

/** Nearest hour (by absolute minute distance) on the given date, or null. */
export function pickHour(hours: HourPoint[], dateKey: string, minutes: number): HourPoint | null {
  let best: HourPoint | null = null;
  let bestDist = Infinity;
  for (const h of hours) {
    if (hourDateKey(h) !== dateKey) continue;
    const dist = Math.abs(hourMinutes(h) - minutes);
    if (dist < bestDist) {
      best = h;
      bestDist = dist;
    }
  }
  return best;
}

/** Hours on `dateKey` with fromMin ≤ minutes ≤ toMin (clamped to the day). */
export function hoursInRange(hours: HourPoint[], dateKey: string, fromMin: number, toMin: number): HourPoint[] {
  const lo = Math.max(0, fromMin);
  const hi = Math.min(23 * 60 + 59, toMin);
  return hours.filter((h) => {
    if (hourDateKey(h) !== dateKey) return false;
    const m = hourMinutes(h);
    return m >= lo && m <= hi;
  });
}

/** Keep hours from the start of today's local date, at most `maxCount`
 *  (48 h covers "tomorrow" even late at night and keeps the storage blob
 *  far under the 64,000-char cap — brief §4.3). */
export function trimHours(hours: HourPoint[], now: Date, maxCount = 48): HourPoint[] {
  const todayKey = dateKeyOf(now);
  return hours.filter((h) => hourDateKey(h) >= todayKey).slice(0, maxCount);
}

/** 480 → "8:00 AM". */
export function formatTimeLabel(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}:${pad2(m)} ${h < 12 ? "AM" : "PM"}`;
}

/** ISO timestamp → local "7:30 AM"; "" if unparsable. */
export function formatClock(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return formatTimeLabel(minutesOfDay(d));
}
