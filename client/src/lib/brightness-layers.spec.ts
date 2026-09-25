import { describe, expect, test } from "vitest";
import {
  BRIGHTNESS_MAX,
  BRIGHTNESS_MIN,
  brightnessLayers,
  clampBrightnessPercent,
  createDimOverlay,
  DIM_OVERLAY_ID,
  DIM_OVERLAY_Z,
} from "./brightness-layers";

// Dimming used to be `filter: brightness()` on <html>. Measured on the kiosk
// (Pi 5, 2026-09-24): with that filter present every frame took ~115 ms
// (<9 fps) versus 17 ms (60 fps) without it. Brightness is now only ever a
// black overlay the compositor blends for free, and it is capped at 100%
// (founder-ratified 2026-09-25, decision 0011) — above 100% needed the
// filter, which slowed the whole kiosk, not just the slider.

describe("brightnessLayers", () => {
  test("100% is no overlay at all (the resting state costs nothing)", () => {
    expect(brightnessLayers(1)).toEqual({ overlayOpacity: 0 });
  });

  test("below 100% is a black overlay; opacity is 1 - brightness", () => {
    expect(brightnessLayers(0.2)).toEqual({ overlayOpacity: 0.8 });
    expect(brightnessLayers(0.3)).toEqual({ overlayOpacity: 0.7 });
    expect(brightnessLayers(0.55)).toEqual({ overlayOpacity: 0.45 });
  });

  test("anything above 100% is treated as 100% — there is no brighten path", () => {
    expect(brightnessLayers(1.2)).toEqual({ overlayOpacity: 0 });
    expect(brightnessLayers(9)).toEqual({ overlayOpacity: 0 });
  });

  test("clamps below to the 10% floor", () => {
    expect(brightnessLayers(0)).toEqual({ overlayOpacity: 0.9 });
  });

  test("range constants", () => {
    expect(BRIGHTNESS_MIN).toBe(0.1);
    expect(BRIGHTNESS_MAX).toBe(1);
  });
});

describe("clampBrightnessPercent (slider / saved-value normaliser)", () => {
  test("a value saved above 100 by an older build comes back as 100", () => {
    expect(clampBrightnessPercent(120)).toBe(100);
    expect(clampBrightnessPercent(150)).toBe(100);
  });

  test("in-range values pass through; the slider floor is 30", () => {
    expect(clampBrightnessPercent(100)).toBe(100);
    expect(clampBrightnessPercent(55)).toBe(55);
    expect(clampBrightnessPercent(30)).toBe(30);
    expect(clampBrightnessPercent(5)).toBe(30);
  });

  test("garbage falls back to 100", () => {
    expect(clampBrightnessPercent(Number.NaN)).toBe(100);
  });
});

describe("createDimOverlay", () => {
  function fakeDocument() {
    const body: { children: unknown[]; appendChild(n: unknown): void } = {
      children: [],
      appendChild(n) {
        body.children.push(n);
      },
    };
    return {
      body,
      createElement: () => ({ id: "", style: {} as Record<string, string>, setAttribute: () => {} }),
      getElementById: () => null,
    };
  }

  test("creates a full-screen, click-through, black, invisible layer above every overlay", () => {
    const doc = fakeDocument();
    const el = createDimOverlay(doc as unknown as Document) as unknown as { id: string; style: Record<string, string> };
    expect(doc.body.children).toHaveLength(1);
    expect(el.id).toBe(DIM_OVERLAY_ID);
    expect(el.style.position).toBe("fixed");
    expect(el.style.inset).toBe("0");
    expect(el.style.pointerEvents).toBe("none");
    expect(el.style.background).toBe("#000");
    expect(el.style.opacity).toBe("0");
    expect(el.style.willChange).toBe("opacity");
    expect(Number(el.style.zIndex)).toBe(DIM_OVERLAY_Z);
    expect(DIM_OVERLAY_Z).toBeGreaterThan(100); // the power-saving overlay is z-[100]
  });

  test("returns the existing layer instead of adding a second one", () => {
    const doc = fakeDocument();
    const first = { id: DIM_OVERLAY_ID, style: {} };
    doc.getElementById = () => first as never;
    expect(createDimOverlay(doc as unknown as Document)).toBe(first);
    expect(doc.body.children).toHaveLength(0);
  });
});
