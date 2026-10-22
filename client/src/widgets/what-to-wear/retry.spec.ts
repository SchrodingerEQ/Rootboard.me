import { describe, expect, test } from "vitest";
import { RETRY_DELAYS_MS, retryDelayMs } from "./retry";

// The host refreshes the widget every 30 minutes; on the kiosk's lossy
// Wi-Fi one "unreachable" result used to leave the panel on "Can't reach
// the weather" for the whole half hour. The widget now retries a few
// times, spaced out, then waits for the host again. The retry is driven
// from the widget's existing one-minute clock (index.tsx); that wiring has
// no React renderer to test under and is inspection-only — this spec
// covers the schedule.
describe("retryDelayMs", () => {
  test("backs off 1, 2, then 5 minutes after consecutive failures", () => {
    expect(retryDelayMs(1)).toBe(60_000);
    expect(retryDelayMs(2)).toBe(2 * 60_000);
    expect(retryDelayMs(3)).toBe(5 * 60_000);
    expect(RETRY_DELAYS_MS).toEqual([60_000, 2 * 60_000, 5 * 60_000]);
  });

  test("stops after the third retry until the host's next refresh", () => {
    expect(retryDelayMs(4)).toBeNull();
    expect(retryDelayMs(99)).toBeNull();
  });

  test("no failures → no retry scheduled", () => {
    expect(retryDelayMs(0)).toBeNull();
  });
});
