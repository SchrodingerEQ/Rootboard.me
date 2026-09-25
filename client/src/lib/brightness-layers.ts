/**
 * How a brightness value is painted (pure; unit-tested in
 * brightness-layers.spec.ts).
 *
 * Dimming used to be `filter: brightness()` on <html>. On the Pi that makes
 * every frame of a slider drag a full-page repaint through a filter — the
 * thumb could not keep up with a finger, and even at rest a root filter makes
 * every repaint dearer. Now:
 *
 * - 100%:   nothing (no overlay, no filter) — the resting state is free.
 * - <100%:  a fixed black overlay whose opacity is 1 - brightness. The
 *           compositor blends one quad; a drag costs nothing.
 * - >100%:  a root filter (there is no cheap way to brighten), applied when
 *           the drag ends — never per tick.
 */

export const BRIGHTNESS_MIN = 0.1;
export const BRIGHTNESS_MAX = 1.5;

export interface BrightnessLayers {
  /** 0..0.9 — opacity of the black dim overlay. */
  overlayOpacity: number;
  /** `filter` value for <html>; "" when none. */
  filter: string;
}

export function brightnessLayers(brightness: number): BrightnessLayers {
  const b = Math.max(BRIGHTNESS_MIN, Math.min(BRIGHTNESS_MAX, brightness));
  if (b <= 1) return { overlayOpacity: +(1 - b).toFixed(3), filter: "" };
  return { overlayOpacity: 0, filter: `brightness(${Math.round(b * 100)}%)` };
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
