/**
 * How a brightness value is painted (pure; unit-tested in
 * brightness-layers.spec.ts).
 *
 * Dimming used to be `filter: brightness()` on <html>. Measured on the kiosk
 * (Raspberry Pi 5, 2026-09-24): with that filter present every frame took
 * ~115 ms (<9 fps) versus 17 ms (60 fps) without it — the slider could not
 * keep up with a finger, and every other repaint (scrolling, view switches)
 * paid the same cost while the filter sat on the page.
 *
 * Brightness is now only ever a fixed black overlay whose opacity is
 * 1 - brightness, which the compositor blends as one quad. It is capped at
 * 100% (founder-ratified 2026-09-25, decision 0011): brightening above 100%
 * needed the filter, so that range was removed. 100% paints nothing.
 */

export const BRIGHTNESS_MIN = 0.1;
export const BRIGHTNESS_MAX = 1;

/** Slider range in percent (the idle dim may go lower, to BRIGHTNESS_MIN). */
export const SLIDER_MIN_PERCENT = 30;
export const SLIDER_MAX_PERCENT = 100;

export interface BrightnessLayers {
  /** 0..0.9 — opacity of the black dim overlay. */
  overlayOpacity: number;
}

export function brightnessLayers(brightness: number): BrightnessLayers {
  const b = Math.max(BRIGHTNESS_MIN, Math.min(BRIGHTNESS_MAX, brightness));
  return { overlayOpacity: +(1 - b).toFixed(3) };
}

/**
 * Normalises a slider / saved percentage into the slider's range. A value
 * saved above 100 by a build that still had the 100–150% range comes back
 * as 100.
 */
export function clampBrightnessPercent(percent: number): number {
  if (!Number.isFinite(percent)) return SLIDER_MAX_PERCENT;
  return Math.max(SLIDER_MIN_PERCENT, Math.min(SLIDER_MAX_PERCENT, Math.round(percent)));
}

export const DIM_OVERLAY_ID = "rb-dim-overlay";
/** Above every app layer, including the power-saving overlay (z-[100]), so
 *  dimming applies to everything uniformly — exactly what the root filter did. */
export const DIM_OVERLAY_Z = 110;

/** The single full-screen dim layer, created on first use. Click-through. */
export function createDimOverlay(doc: Document = document): HTMLElement {
  const existing = doc.getElementById(DIM_OVERLAY_ID);
  if (existing) return existing;
  const el = doc.createElement("div");
  el.id = DIM_OVERLAY_ID;
  el.setAttribute("aria-hidden", "true");
  const s = el.style;
  s.position = "fixed";
  s.inset = "0";
  s.pointerEvents = "none";
  s.background = "#000";
  s.opacity = "0";
  s.willChange = "opacity";
  s.zIndex = String(DIM_OVERLAY_Z);
  doc.body.appendChild(el);
  return el;
}

/** Paints `brightness` (0.1–1 fraction) onto the dim overlay. */
export function paintBrightness(brightness: number, doc: Document = document): void {
  createDimOverlay(doc).style.opacity = String(brightnessLayers(brightness).overlayOpacity);
}
