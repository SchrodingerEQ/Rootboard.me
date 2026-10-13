import { describe, expect, test } from "vitest";
import { describeWeatherStatus } from "./weather-status";

const NOW = new Date(2030, 2, 12, 16, 0); // Tuesday
const at = (d: number, h: number, m = 0) => new Date(2030, 2, d, h, m).toISOString();

describe("describeWeatherStatus", () => {
  test("hidden when weather isn't set up or the status hasn't loaded", () => {
    expect(describeWeatherStatus(undefined, NOW)).toBeNull();
    expect(describeWeatherStatus({ configured: false, lastSuccessAt: null, lastError: null }, NOW)).toBeNull();
  });

  test("healthy: last update, no error", () => {
    expect(describeWeatherStatus({ configured: true, lastSuccessAt: at(12, 15, 30), lastError: null }, NOW)).toEqual({
      failing: false,
      lastUpdate: "3:30 PM",
      lastError: "",
    });
  });

  test("failing: an error newer than the last success, with its day", () => {
    const v = describeWeatherStatus(
      { configured: true, lastSuccessAt: at(10, 6, 29), lastError: { at: at(12, 15, 30), reason: "Timed out (ETIMEDOUT)" } },
      NOW,
    );
    expect(v).toEqual({ failing: true, lastUpdate: "Sun 6:29 AM", lastError: "3:30 PM — Timed out (ETIMEDOUT)" });
  });

  test("failing when it has never succeeded since the app started", () => {
    const v = describeWeatherStatus({ configured: true, lastSuccessAt: null, lastError: { at: at(12, 9), reason: "Network error" } }, NOW)!;
    expect(v.failing).toBe(true);
    expect(v.lastUpdate).toBe("not yet, since the app started");
  });

  test("recovered: an older error is still shown but not flagged", () => {
    const v = describeWeatherStatus(
      { configured: true, lastSuccessAt: at(12, 15, 30), lastError: { at: at(11, 7), reason: "Network error" } },
      NOW,
    )!;
    expect(v.failing).toBe(false);
    expect(v.lastError).toBe("Mon 7:00 AM — Network error");
  });
});
