import { describe, expect, test } from "vitest";
import { IDLE_RETRY, RETRY_DELAYS_MS, nextRetryState, retryDelayMs } from "./retry";

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

// The counter/next-due bookkeeping that index.tsx used to keep in two refs
// and an inner closure, so the sequence itself is machine-checked.
describe("nextRetryState", () => {
  const t0 = 1_000_000;

  test("success clears any pending retry", () => {
    expect(nextRetryState({ failures: 2, retryAt: t0 }, { unreachable: false, retry: true }, t0)).toEqual(IDLE_RETRY);
  });

  test("a host-driven or initial failure starts the sequence at one minute", () => {
    expect(nextRetryState(IDLE_RETRY, { unreachable: true, retry: false }, t0)).toEqual({ failures: 1, retryAt: t0 + 60_000 });
  });

  test("retry failures walk 2 then 5 minutes, then stop until the host refreshes", () => {
    const s1 = nextRetryState(IDLE_RETRY, { unreachable: true, retry: false }, t0);
    const s2 = nextRetryState(s1, { unreachable: true, retry: true }, t0 + 60_000);
    const s3 = nextRetryState(s2, { unreachable: true, retry: true }, t0 + 180_000);
    const s4 = nextRetryState(s3, { unreachable: true, retry: true }, t0 + 480_000);
    expect(s2).toEqual({ failures: 2, retryAt: t0 + 60_000 + 120_000 });
    expect(s3).toEqual({ failures: 3, retryAt: t0 + 180_000 + 300_000 });
    expect(s4).toEqual({ failures: 4, retryAt: null });
  });

  test("a host-driven failure after the sequence ended restarts it", () => {
    expect(nextRetryState({ failures: 4, retryAt: null }, { unreachable: true, retry: false }, t0)).toEqual({ failures: 1, retryAt: t0 + 60_000 });
  });
});
