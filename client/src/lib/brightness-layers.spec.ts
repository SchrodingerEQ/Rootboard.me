import { describe, expect, test } from "vitest";
import { brightnessLayers, createDimOverlay, DIM_OVERLAY_ID, DIM_OVERLAY_Z } from "./brightness-layers";

// Dimming used to be `filter: brightness()` on <html>: every change forced
// the Pi to repaint the whole 1080p page through a filter, so a touch drag
// on the slider could not keep up. Now 30–100% is a black overlay whose
// opacity the compositor blends for free; only >100% still needs the filter,
// and it is applied when the drag ends, never per tick.

describe("brightnessLayers", () => {
  test("100% is no overlay and no filter (the resting state costs nothing)", () => {
    expect(brightnessLayers(1)).toEqual({ overlayOpacity: 0, filter: "" });
  });

  test("below 100% is a black overlay; opacity is 1 - brightness", () => {
    expect(brightnessLayers(0.2)).toEqual({ overlayOpacity: 0.8, filter: "" });
    expect(brightnessLayers(0.3)).toEqual({ overlayOpacity: 0.7, filter: "" });
    expect(brightnessLayers(0.55)).toEqual({ overlayOpacity: 0.45, filter: "" });
  });

  test("above 100% is a root filter and no overlay", () => {
    expect(brightnessLayers(1.5)).toEqual({ overlayOpacity: 0, filter: "brightness(150%)" });
    expect(brightnessLayers(1.05)).toEqual({ overlayOpacity: 0, filter: "brightness(105%)" });
  });

  test("clamps to the slider's 0.1–1.5 range", () => {
    expect(brightnessLayers(0)).toEqual({ overlayOpacity: 0.9, filter: "" });
    expect(brightnessLayers(9)).toEqual({ overlayOpacity: 0, filter: "brightness(150%)" });
  });

  test("overlay opacity and the old filter agree: black at opacity a leaves 1 - a of the light", () => {
    for (const b of [0.2, 0.5, 0.8, 1]) {
      expect(1 - brightnessLayers(b).overlayOpacity).toBeCloseTo(b, 10);
    }
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
