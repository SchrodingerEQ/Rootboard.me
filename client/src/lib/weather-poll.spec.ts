import { describe, expect, test } from "vitest";
import { WEATHER_POLL_MS, WEATHER_RETRY_COLD_MS, WEATHER_RETRY_STALE_MS, weatherRefetchIntervalMs } from "./weather-poll";

// The server only tries Open-Meteo again when a client asks after the
// 30-minute cache expires. On the kiosk's lossy Wi-Fi one failed attempt
// therefore meant 30 minutes without weather; polling faster only while
// the last answer was a failure bounds that gap without hammering anyone
// when everything is healthy.
describe("weatherRefetchIntervalMs", () => {
  const fresh = { enabled: true as const, updatedAt: "2030-03-10T06:29:00.000Z" };

  test("healthy forecast → the normal 30-minute poll", () => {
    expect(weatherRefetchIntervalMs(fresh, false)).toBe(WEATHER_POLL_MS);
    expect(WEATHER_POLL_MS).toBe(30 * 60 * 1000);
  });

  test("weather not configured → normal poll (nothing to retry)", () => {
    expect(weatherRefetchIntervalMs({ enabled: false }, false)).toBe(WEATHER_POLL_MS);
  });

  test("outage with a cold cache (enabled:false, configured:true) → retry every minute", () => {
    expect(weatherRefetchIntervalMs({ enabled: false, configured: true }, false)).toBe(WEATHER_RETRY_COLD_MS);
    expect(WEATHER_RETRY_COLD_MS).toBe(60 * 1000);
  });

  test("outage with the last good forecast re-served (stale:true) → retry every 5 minutes", () => {
    expect(weatherRefetchIntervalMs({ ...fresh, stale: true }, false)).toBe(WEATHER_RETRY_STALE_MS);
    expect(WEATHER_RETRY_STALE_MS).toBe(5 * 60 * 1000);
  });

  test("request itself failed (server restarting) or nothing loaded yet → retry every minute", () => {
    expect(weatherRefetchIntervalMs(undefined, true)).toBe(WEATHER_RETRY_COLD_MS);
    expect(weatherRefetchIntervalMs(fresh, true)).toBe(WEATHER_RETRY_COLD_MS);
    expect(weatherRefetchIntervalMs(undefined, false)).toBe(WEATHER_RETRY_COLD_MS);
  });
});
