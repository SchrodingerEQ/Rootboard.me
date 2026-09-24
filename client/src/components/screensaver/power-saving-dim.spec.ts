import { describe, expect, test } from "vitest";
import {
  POWER_SAVING_DIM,
  POWER_SAVING_HINT_OPACITY,
  POWER_SAVING_LOGO_OPACITY,
  powerSavingOverlayFilter,
} from "./power-saving-dim";

// The logo was effectively invisible in power-saving mode since v1.0.0:
// overlay brightness 0.2 x logo opacity 0.4, and on the idle path the whole
// page was ALSO at brightness 0.2 — the logo rendered at ~rgb(1,2,3).
// The rule now: the overlay's content is dimmed exactly once, to
// POWER_SAVING_DIM, whichever way power-saving was entered.

/** Brightness multiplier applied to the overlay's content, all layers combined. */
function effectiveDim(pageDimmed: boolean): number {
  const page = pageDimmed ? POWER_SAVING_DIM : 1; // useScreensaver dims <html> on idle
  const filter = powerSavingOverlayFilter(pageDimmed);
  const overlay = filter === undefined ? 1 : Number(/^brightness\(([\d.]+)\)$/.exec(filter)![1]);
  return page * overlay;
}

describe("power-saving overlay dimming", () => {
  test("idle path (page already dimmed) adds no second dim", () => {
    expect(powerSavingOverlayFilter(true)).toBeUndefined();
  });

  test("manual Sleep path (page not dimmed) dims the overlay itself", () => {
    expect(powerSavingOverlayFilter(false)).toBe(`brightness(${POWER_SAVING_DIM})`);
  });

  test("both entry paths end up at the same single dim", () => {
    expect(effectiveDim(true)).toBeCloseTo(POWER_SAVING_DIM, 10);
    expect(effectiveDim(false)).toBeCloseTo(POWER_SAVING_DIM, 10);
  });

  test("logo stays faintly visible: its brightest pixels land in a visible band on black", () => {
    // Brightest opaque pixels of the logo average ~213/255 per channel.
    const brightest = 213 * effectiveDim(true) * POWER_SAVING_LOGO_OPACITY;
    expect(brightest).toBeGreaterThanOrEqual(30); // perceptible on black in a dark room
    expect(brightest).toBeLessThanOrEqual(60); // still a night-time screen, not a lamp
  });

  test("wake hint is faint but readable", () => {
    const hint = 255 * effectiveDim(false) * POWER_SAVING_HINT_OPACITY;
    expect(hint).toBeGreaterThanOrEqual(30);
    expect(hint).toBeLessThanOrEqual(60);
  });
});
