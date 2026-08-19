import { describe, expect, test } from "vitest";
import {
  deriveCalendarVisibility,
  toCalendarIdSet,
  withCalendarId,
} from "./shell-bridge";

// The calendar widget itself is React and this repo has no renderer in its
// test setup, so its per-calendar visibility model lives in these three pure
// helpers (ratified delta 2 — see shell-bridge.ts). This spec is the
// machine-checked half; the React wiring that calls them (useMemo over
// host.settings + the calendars query) is inspection-only.

describe("toCalendarIdSet", () => {
  test("reads a plain string array", () => {
    expect(Array.from(toCalendarIdSet(["a", "b"]))).toEqual(["a", "b"]);
  });

  test("absent/garbage values degrade to empty, never throw", () => {
    // data/config/dashboard.json is explicitly hand-editable over SSH, and
    // `settings` is `Record<string, unknown>` by schema — a malformed value
    // must not take the kiosk down.
    for (const bad of [undefined, null, "a,b", 7, {}, true]) {
      expect(toCalendarIdSet(bad).size).toBe(0);
    }
  });

  test("non-string entries inside the array are dropped, valid ones kept", () => {
    expect(Array.from(toCalendarIdSet(["a", 3, null, "b", { id: "c" }]))).toEqual(["a", "b"]);
  });
});

describe("withCalendarId", () => {
  test("adds and removes, and is idempotent both ways", () => {
    expect(withCalendarId(new Set(["b"]), "a", true)).toEqual(["a", "b"]);
    expect(withCalendarId(new Set(["a", "b"]), "a", true)).toEqual(["a", "b"]);
    expect(withCalendarId(new Set(["a", "b"]), "a", false)).toEqual(["b"]);
    expect(withCalendarId(new Set(["b"]), "a", false)).toEqual(["b"]);
  });

  test("output is sorted (dashboard.json is a file humans read)", () => {
    expect(withCalendarId(new Set(["z", "m"]), "a", true)).toEqual(["a", "m", "z"]);
  });

  test("does not mutate the input set", () => {
    const ids = new Set(["a"]);
    withCalendarId(ids, "b", true);
    withCalendarId(ids, "a", false);
    expect(Array.from(ids)).toEqual(["a"]);
  });
});

describe("deriveCalendarVisibility", () => {
  const subscribed = ["work", "family", "school"];

  test("nothing hidden or disabled: everything visible and drawing events", () => {
    const { visibleInHeader, eventsOn } = deriveCalendarVisibility(
      subscribed,
      new Set(),
      new Set(),
    );
    expect(Array.from(visibleInHeader)).toEqual(subscribed);
    expect(Array.from(eventsOn)).toEqual(subscribed);
  });

  test("new calendars are visible by default (a hidden LIST, not an enabled list)", () => {
    // The whole point of ratified delta 2: an id nobody has ever toggled is
    // in neither list, so adding a calendar later can't come back hidden —
    // and no `seenCalendarIds` bookkeeping is needed to make that true.
    const { visibleInHeader, eventsOn } = deriveCalendarVisibility(
      [...subscribed, "brand-new"],
      new Set(["work"]),
      new Set(["family"]),
    );
    expect(visibleInHeader.has("brand-new")).toBe(true);
    expect(eventsOn.has("brand-new")).toBe(true);
  });

  test("hidden removes from BOTH the chip row and the events", () => {
    const { visibleInHeader, eventsOn } = deriveCalendarVisibility(
      subscribed,
      new Set(["work"]),
      new Set(),
    );
    expect(visibleInHeader.has("work")).toBe(false);
    expect(eventsOn.has("work")).toBe(false);
  });

  test("disabled keeps the chip but removes the events", () => {
    const { visibleInHeader, eventsOn } = deriveCalendarVisibility(
      subscribed,
      new Set(),
      new Set(["work"]),
    );
    expect(visibleInHeader.has("work")).toBe(true);
    expect(eventsOn.has("work")).toBe(false);
  });

  test("hidden wins over disabled when an id is in both lists", () => {
    const { visibleInHeader, eventsOn } = deriveCalendarVisibility(
      subscribed,
      new Set(["work"]),
      new Set(["work"]),
    );
    expect(visibleInHeader.has("work")).toBe(false);
    expect(eventsOn.has("work")).toBe(false);
  });

  test("every calendar hidden-or-disabled => no events at all", () => {
    const { eventsOn } = deriveCalendarVisibility(
      subscribed,
      new Set(["work"]),
      new Set(["family", "school"]),
    );
    expect(eventsOn.size).toBe(0);
  });

  test("stale ids in either list can only subtract, never add", () => {
    const { visibleInHeader, eventsOn } = deriveCalendarVisibility(
      ["work"],
      new Set(["unsubscribed-long-ago"]),
      new Set(["typo-in-hand-edited-config"]),
    );
    expect(Array.from(visibleInHeader)).toEqual(["work"]);
    expect(Array.from(eventsOn)).toEqual(["work"]);
  });

  test("no subscribed calendars => nothing shown (unchanged pre-widget behavior)", () => {
    const { visibleInHeader, eventsOn } = deriveCalendarVisibility([], new Set(), new Set());
    expect(visibleInHeader.size).toBe(0);
    expect(eventsOn.size).toBe(0);
  });
});
