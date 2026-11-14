import { describe, expect, test } from "vitest";
import { defaultDashboardConfig } from "@shared/dashboard-config";
import {
  BOOT_NETWORK_GRACE_SECONDS,
  BOOT_WINDOW_SECONDS,
  bootNetworkDecision,
  canSkip,
  connectFailureSentence,
  defaultTimezone,
  filterTimezones,
  formatTimeIn,
  isOpenedFromSettings,
  isPlausibleWifiPassword,
  needsFirstRun,
  recordsCompletion,
  signalBars,
  stepsFor,
} from "./setup-wizard";

describe("steps", () => {
  test("first run and run-again go through every step in order", () => {
    const all = ["welcome", "network", "timezone", "google", "weather", "done"];
    expect(stepsFor("first-run")).toEqual(all);
    expect(stepsFor("rerun")).toEqual(all);
  });

  test("a boot with no network shows the Network step only", () => {
    expect(stepsFor("network-only")).toEqual(["network"]);
  });

  test("Settings' direct entries open one step", () => {
    expect(stepsFor("network")).toEqual(["network"]);
    expect(stepsFor("timezone")).toEqual(["timezone"]);
  });

  test("every step but Network can be skipped", () => {
    expect(canSkip("network")).toBe(false);
    expect(canSkip("timezone")).toBe(true);
    expect(canSkip("google")).toBe(true);
    expect(canSkip("weather")).toBe(true);
  });

  test("only the full runs record completion; only Settings' entries overlay the dashboard", () => {
    expect(recordsCompletion("first-run")).toBe(true);
    expect(recordsCompletion("rerun")).toBe(true);
    expect(recordsCompletion("network-only")).toBe(false);
    expect(isOpenedFromSettings("first-run")).toBe(false);
    expect(isOpenedFromSettings("network-only")).toBe(false);
    expect(isOpenedFromSettings("rerun")).toBe(true);
  });

  test("the wizard runs until a completion record exists", () => {
    expect(needsFirstRun(defaultDashboardConfig())).toBe(true);
    expect(needsFirstRun({ ...defaultDashboardConfig(), setup: { completedAt: "2026-11-14T20:00:00.000Z", version: 1 } })).toBe(false);
  });
});

describe("boot network check", () => {
  const status = (connected: boolean, uptimeSeconds: number, managed = true) => ({ managed, connected, uptimeSeconds });

  test("connected at any point passes", () => {
    expect(bootNetworkDecision(status(true, 10), 10)).toBe("online");
  });

  test("waits out the grace period for a slow router, then opens the Network step", () => {
    expect(bootNetworkDecision(status(false, 40), 40)).toBe("wait");
    expect(bootNetworkDecision(status(false, BOOT_NETWORK_GRACE_SECONDS - 1), 40)).toBe("wait");
    expect(bootNetworkDecision(status(false, BOOT_NETWORK_GRACE_SECONDS), 40)).toBe("offline");
  });

  test("a page loaded well after boot never opens the wizard for a drop", () => {
    expect(bootNetworkDecision(status(false, 86_400), 86_400)).toBe("not-applicable");
    expect(bootNetworkDecision(status(false, BOOT_WINDOW_SECONDS + 1), BOOT_WINDOW_SECONDS + 1)).toBe("not-applicable");
  });

  test("no NetworkManager, or a failed status read, never blocks the dashboard", () => {
    expect(bootNetworkDecision(status(false, 100, false), 100)).toBe("not-applicable");
    expect(bootNetworkDecision(null, null)).toBe("not-applicable");
  });
});

describe("failure copy", () => {
  test("one plain sentence per reason", () => {
    expect(connectFailureSentence("bad-password")).toBe("That password didn't work.");
    expect(connectFailureSentence("not-found")).toBe("Rootboard can't see that network from here.");
    expect(connectFailureSentence("something new")).toBe("Rootboard couldn't join that network.");
  });

  test("password length is checked before asking nmcli", () => {
    expect(isPlausibleWifiPassword("", false)).toBe(true);
    expect(isPlausibleWifiPassword("short", true)).toBe(false);
    expect(isPlausibleWifiPassword("eightchr", true)).toBe(true);
    expect(isPlausibleWifiPassword("a".repeat(64), true)).toBe(true);
    expect(isPlausibleWifiPassword("z".repeat(64), true)).toBe(false);
  });
});

describe("time zone", () => {
  const zones = ["America/Chicago", "America/New_York", "Europe/London", "UTC"];

  test("defaults to the browser's zone, then the system's", () => {
    expect(defaultTimezone(zones, "America/Chicago", "UTC")).toBe("America/Chicago");
    expect(defaultTimezone(zones, "Mars/Base", "Europe/London")).toBe("Europe/London");
    expect(defaultTimezone(zones, undefined, null)).toBe("America/Chicago");
    expect(defaultTimezone([], undefined, null)).toBeNull();
  });

  test("search ignores case and treats spaces as _ or /", () => {
    expect(filterTimezones(zones, "new york")).toEqual(["America/New_York"]);
    expect(filterTimezones(zones, "AMERICA")).toEqual(["America/Chicago", "America/New_York"]);
    expect(filterTimezones(zones, "")).toEqual(zones);
    expect(filterTimezones(zones, "", 2)).toEqual(zones.slice(0, 2));
  });

  test("shows the time in the chosen zone", () => {
    const noonUtc = new Date("2026-11-14T12:00:00Z");
    expect(formatTimeIn("UTC", noonUtc, "en-US")).toBe("12:00 PM");
    expect(formatTimeIn("America/Chicago", noonUtc, "en-US")).toBe("6:00 AM");
  });

  test("signal bars", () => {
    expect([0, 10, 30, 60, 90].map(signalBars)).toEqual([0, 1, 2, 3, 4]);
  });
});
