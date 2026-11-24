/**
 * SQLiteStorage against a real on-disk database, so the suite loads the
 * native better-sqlite3 module and runs every call the storage makes:
 * new Database, pragma, exec (the schema), prepare().run/get/all, close.
 * A lock bump that ships a broken or mismatched prebuild fails here
 * (WP-03 PR B, decision 0025).
 */
import fs from "fs";
import os from "os";
import path from "path";
import Database from "better-sqlite3";
import { afterEach, beforeEach, describe, expect, test } from "vitest";
import { SQLiteStorage } from "./sqlite-storage";

let dir: string;
let dbPath: string;
let store: SQLiteStorage;

beforeEach(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), "rootboard-sqlite-"));
  dbPath = path.join(dir, "calendar.db");
  store = new SQLiteStorage(dbPath);
});

afterEach(() => {
  // Undefined when the native module failed to load in beforeEach.
  store?.close();
  fs.rmSync(dir, { recursive: true, force: true });
});

const event = (googleEventId: string, start: string, end: string) => ({
  googleEventId,
  calendarId: "primary",
  calendarName: "Primary",
  title: `Event ${googleEventId}`,
  startTime: new Date(start),
  endTime: new Date(end),
});

describe("SQLiteStorage on the native module", () => {
  test("opens the file in WAL mode and creates the schema", () => {
    const probe = new Database(dbPath, { readonly: true });
    try {
      expect(probe.pragma("journal_mode", { simple: true })).toBe("wal");
      const tables = probe
        .prepare("SELECT name FROM sqlite_master WHERE type = 'table' ORDER BY name")
        .all()
        .map((r) => (r as { name: string }).name);
      expect(tables).toEqual(expect.arrayContaining(["app_state", "calendar_events", "users"]));
    } finally {
      probe.close();
    }
  });

  test("events round-trip through insert, range query, update and delete", async () => {
    const a = await store.createCalendarEvent(event("a", "2026-11-24T09:00:00Z", "2026-11-24T10:00:00Z"));
    await store.createCalendarEvent(event("b", "2026-11-25T09:00:00Z", "2026-11-25T10:00:00Z"));

    const day = await store.getCalendarEvents(new Date("2026-11-24T00:00:00Z"), new Date("2026-11-25T00:00:00Z"));
    expect(day.map((e) => e.googleEventId)).toEqual(["a"]);
    expect(day[0].startTime.toISOString()).toBe("2026-11-24T09:00:00.000Z");

    const updated = await store.updateCalendarEvent(a.id, { title: "Renamed", isAllDay: true });
    expect(updated?.title).toBe("Renamed");
    expect(updated?.isAllDay).toBe(true);

    expect(await store.deleteCalendarEventsByCalendarNotIn("primary", ["b"])).toBe(1);
    expect(await store.getCalendarEvent(a.id)).toBeUndefined();
    expect(await store.deleteAllCalendarEvents()).toBe(1);
  });

  test("app state upserts and data survives a reopen", async () => {
    await store.setAppState("chores", "one");
    await store.setAppState("chores", "two");
    store.close();

    store = new SQLiteStorage(dbPath);
    expect(await store.getAppState("chores")).toBe("two");
    expect(await store.getAppState("dinner")).toBeNull();
  });
});
