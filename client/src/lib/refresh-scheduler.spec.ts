import { describe, expect, test, vi } from "vitest";
import { RefreshScheduler } from "./refresh-scheduler";

// A tiny controllable clock: starts at `t`, advanced explicitly by tests
// so scheduler behavior can be asserted deterministically without relying
// on wall-clock time or vi.useFakeTimers() (the scheduler itself has no
// timers of its own — the host calls tick() every 30s).
function makeClock(start = 0) {
  let now = start;
  return {
    now: () => now,
    advance: (ms: number) => {
      now += ms;
    },
  };
}

describe("RefreshScheduler", () => {
  test("fires onRefresh on tick() when due and eligible (visible, online, awake)", () => {
    const clock = makeClock(0);
    const onRefresh = vi.fn();
    const scheduler = new RefreshScheduler({ intervalSeconds: 30, onRefresh, now: clock.now });
    scheduler.setVisible(true);
    scheduler.setOnline(true);
    scheduler.setAwake(true);

    clock.advance(29_999);
    scheduler.tick();
    expect(onRefresh).not.toHaveBeenCalled();

    clock.advance(1);
    scheduler.tick();
    expect(onRefresh).toHaveBeenCalledTimes(1);
  });

  test("does not fire when hidden", () => {
    const clock = makeClock(0);
    const onRefresh = vi.fn();
    const scheduler = new RefreshScheduler({ intervalSeconds: 30, onRefresh, now: clock.now });
    scheduler.setVisible(false);
    scheduler.setOnline(true);
    scheduler.setAwake(true);

    clock.advance(60_000);
    scheduler.tick();
    expect(onRefresh).not.toHaveBeenCalled();
  });

  test("does not fire when offline", () => {
    const clock = makeClock(0);
    const onRefresh = vi.fn();
    const scheduler = new RefreshScheduler({ intervalSeconds: 30, onRefresh, now: clock.now });
    scheduler.setVisible(true);
    scheduler.setOnline(false);
    scheduler.setAwake(true);

    clock.advance(60_000);
    scheduler.tick();
    expect(onRefresh).not.toHaveBeenCalled();
  });

  test("does not fire when asleep (screensaver active)", () => {
    const clock = makeClock(0);
    const onRefresh = vi.fn();
    const scheduler = new RefreshScheduler({ intervalSeconds: 30, onRefresh, now: clock.now });
    scheduler.setVisible(true);
    scheduler.setOnline(true);
    scheduler.setAwake(false);

    clock.advance(60_000);
    scheduler.tick();
    expect(onRefresh).not.toHaveBeenCalled();
  });

  test("becoming visible fires immediately (catch-up) when the interval is overdue", () => {
    const clock = makeClock(0);
    const onRefresh = vi.fn();
    const scheduler = new RefreshScheduler({ intervalSeconds: 30, onRefresh, now: clock.now });
    scheduler.setVisible(false);
    scheduler.setOnline(true);
    scheduler.setAwake(true);

    clock.advance(31_000); // overdue while hidden
    expect(onRefresh).not.toHaveBeenCalled();

    scheduler.setVisible(true);
    expect(onRefresh).toHaveBeenCalledTimes(1);
  });

  test("becoming awake fires immediately (catch-up) when the interval is overdue", () => {
    const clock = makeClock(0);
    const onRefresh = vi.fn();
    const scheduler = new RefreshScheduler({ intervalSeconds: 30, onRefresh, now: clock.now });
    scheduler.setVisible(true);
    scheduler.setOnline(true);
    scheduler.setAwake(false);

    clock.advance(31_000); // overdue while asleep
    expect(onRefresh).not.toHaveBeenCalled();

    scheduler.setAwake(true);
    expect(onRefresh).toHaveBeenCalledTimes(1);
  });

  test("no catch-up when becoming visible but not overdue", () => {
    const clock = makeClock(0);
    const onRefresh = vi.fn();
    const scheduler = new RefreshScheduler({ intervalSeconds: 30, onRefresh, now: clock.now });
    scheduler.setVisible(false);
    scheduler.setOnline(true);
    scheduler.setAwake(true);

    clock.advance(5_000); // not overdue yet
    scheduler.setVisible(true);
    expect(onRefresh).not.toHaveBeenCalled();
  });

  test("no catch-up when becoming awake but not overdue", () => {
    const clock = makeClock(0);
    const onRefresh = vi.fn();
    const scheduler = new RefreshScheduler({ intervalSeconds: 30, onRefresh, now: clock.now });
    scheduler.setVisible(true);
    scheduler.setOnline(true);
    scheduler.setAwake(false);

    clock.advance(5_000); // not overdue yet
    scheduler.setAwake(true);
    expect(onRefresh).not.toHaveBeenCalled();
  });

  test("noteRefreshed() resets the clock so tick() does not immediately re-fire", () => {
    const clock = makeClock(0);
    const onRefresh = vi.fn();
    const scheduler = new RefreshScheduler({ intervalSeconds: 30, onRefresh, now: clock.now });
    scheduler.setVisible(true);
    scheduler.setOnline(true);
    scheduler.setAwake(true);

    clock.advance(40_000);
    scheduler.tick();
    expect(onRefresh).toHaveBeenCalledTimes(1);

    scheduler.noteRefreshed();
    clock.advance(10_000); // well under the 30s interval since noteRefreshed
    scheduler.tick();
    expect(onRefresh).toHaveBeenCalledTimes(1);

    clock.advance(20_001); // now past 30s since noteRefreshed
    scheduler.tick();
    expect(onRefresh).toHaveBeenCalledTimes(2);
  });

  test("no interval configured -> never fires, even when overdue by any measure", () => {
    const clock = makeClock(0);
    const onRefresh = vi.fn();
    const scheduler = new RefreshScheduler({ onRefresh, now: clock.now });
    scheduler.setVisible(true);
    scheduler.setOnline(true);
    scheduler.setAwake(true);

    clock.advance(1_000_000);
    scheduler.tick();
    expect(onRefresh).not.toHaveBeenCalled();

    scheduler.setVisible(false);
    scheduler.setVisible(true); // would be a catch-up if an interval were set
    expect(onRefresh).not.toHaveBeenCalled();
  });

  test("lastRefresh is initialized to construction time — a freshly mounted widget does not instantly refresh", () => {
    const clock = makeClock(1_000);
    const onRefresh = vi.fn();
    const scheduler = new RefreshScheduler({ intervalSeconds: 30, onRefresh, now: clock.now });
    scheduler.setVisible(true);
    scheduler.setOnline(true);
    scheduler.setAwake(true);

    // Immediately tick at construction time — nothing due yet.
    scheduler.tick();
    expect(onRefresh).not.toHaveBeenCalled();
  });

  test("setOnline(true) catch-up follows the same overdue rule as visible/awake", () => {
    const clock = makeClock(0);
    const onRefresh = vi.fn();
    const scheduler = new RefreshScheduler({ intervalSeconds: 30, onRefresh, now: clock.now });
    scheduler.setVisible(true);
    scheduler.setOnline(false);
    scheduler.setAwake(true);

    clock.advance(31_000);
    scheduler.setOnline(true);
    // Coming back online is not one of the two catch-up triggers per spec
    // (visible/awake only) — assert current documented behavior: no fire
    // from setOnline alone, but the next tick() will fire since eligible+due.
    expect(onRefresh).not.toHaveBeenCalled();
    scheduler.tick();
    expect(onRefresh).toHaveBeenCalledTimes(1);
  });
});
