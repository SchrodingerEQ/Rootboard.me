// Warm family-display color helpers.
// Calendars/events arrive with arbitrary hex colors (from Google or the
// generated palette in calendar-filters), so we derive a soft tint and a
// legible dark text color from whatever hex we're given at runtime.

export function hexToRgb(hex: string): { r: number; g: number; b: number } {
  let h = (hex || "").replace("#", "").trim();
  if (h.length === 3) h = h.split("").map((c) => c + c).join("");
  if (h.length !== 6) return { r: 37, g: 99, b: 235 }; // fallback: blue
  const num = parseInt(h, 16);
  return { r: (num >> 16) & 255, g: (num >> 8) & 255, b: num & 255 };
}

/** Light wash of the color, used as the background of chips and time blocks. */
export function eventTint(hex: string, alpha = 0.14): string {
  const { r, g, b } = hexToRgb(hex);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

/**
 * How far (0..1) a dark-surface ink is blended toward white, per channel:
 * `c' = c + (255 - c) * DARK_INK_LIGHTEN`. Smallest of 0.5, 0.55, … 0.9 that
 * keeps every FALLBACK_COLORS/Google-palette-sample color's ink at >= 4.5:1
 * against its own tint composited over the Deep Space surface (#141c2e) —
 * see color-utils.spec.ts.
 */
export const DARK_INK_LIGHTEN = 0.5;

export interface EventTextColorOpts {
  /** Surface the ink will sit on. Luminance < 0.2 switches to the lightened dark-surface ink. */
  surface?: string;
  /** Darkening factor for the light-surface path. Defaults to 0.55 (today's behavior). */
  factor?: number;
}

/**
 * A readable ink color for text/icons drawn over an event's own tint.
 * On a light-enough surface (the default, and the only behavior before
 * `opts.surface` existed) this darkens the hex by `factor` — byte-identical
 * to the original single-factor function. On a dark surface
 * (`relativeLuminance(opts.surface) < 0.2`) it instead lightens the hex
 * toward white by `DARK_INK_LIGHTEN`, since darkening further would sink
 * into the dark surface instead of standing out from it.
 */
export function eventTextColor(hex: string, factorOrOpts: number | EventTextColorOpts = 0.55): string {
  const opts: EventTextColorOpts = typeof factorOrOpts === "number" ? { factor: factorOrOpts } : factorOrOpts;
  const { r, g, b } = hexToRgb(hex);

  if (opts.surface !== undefined && relativeLuminance(opts.surface) < 0.2) {
    const lighten = (c: number) => Math.round(c + (255 - c) * DARK_INK_LIGHTEN);
    return `rgb(${lighten(r)}, ${lighten(g)}, ${lighten(b)})`;
  }

  const factor = opts.factor ?? 0.55;
  return `rgb(${Math.round(r * factor)}, ${Math.round(g * factor)}, ${Math.round(b * factor)})`;
}

// --- WCAG contrast (theme engine contrast guard) -------------------------

function channelLuminance(channel: number): number {
  const s = channel / 255;
  return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
}

/** WCAG 2.x relative luminance of a `#rrggbb` color, 0 (black) .. 1 (white). */
export function relativeLuminance(hex: string): number {
  const { r, g, b } = hexToRgb(hex);
  return 0.2126 * channelLuminance(r) + 0.7152 * channelLuminance(g) + 0.0722 * channelLuminance(b);
}

/** WCAG 2.x contrast ratio between two `#rrggbb` colors, 1 .. 21. Symmetric. */
export function contrastRatio(hexA: string, hexB: string): number {
  const a = relativeLuminance(hexA);
  const b = relativeLuminance(hexB);
  const [hi, lo] = a > b ? [a, b] : [b, a];
  return (hi + 0.05) / (lo + 0.05);
}

// --- CIE Lab / ΔE76 (palette distinguishability checks) -------------------

/** D65 reference white, normalized XYZ (Y = 1). */
const D65_WHITE = { x: 0.95047, y: 1.0, z: 1.08883 };
const LAB_EPSILON = 0.008856;
const LAB_KAPPA = 7.787;

function labF(t: number): number {
  return t > LAB_EPSILON ? Math.cbrt(t) : (LAB_KAPPA * t + 16 / 116);
}

/**
 * `#rrggbb` → CIE Lab (D65). Linearizes with the shared sRGB curve
 * (`channelLuminance`), converts to XYZ with the standard sRGB/D65 matrix,
 * normalizes by the D65 white point, then applies the CIE Lab piecewise
 * f(t) (ε = 0.008856, κ = 7.787).
 */
export function hexToLab(hex: string): [number, number, number] {
  const { r, g, b } = hexToRgb(hex);
  const rl = channelLuminance(r);
  const gl = channelLuminance(g);
  const bl = channelLuminance(b);

  const x = rl * 0.4124564 + gl * 0.3575761 + bl * 0.1804375;
  const y = rl * 0.2126729 + gl * 0.7151522 + bl * 0.072175;
  const z = rl * 0.0193339 + gl * 0.119192 + bl * 0.9503041;

  const fx = labF(x / D65_WHITE.x);
  const fy = labF(y / D65_WHITE.y);
  const fz = labF(z / D65_WHITE.z);

  const L = 116 * fy - 16;
  const labA = 500 * (fx - fy);
  const labB = 200 * (fy - fz);
  return [L, labA, labB];
}

/** ΔE76 (Euclidean distance in CIE Lab, D65) between two `#rrggbb` colors. Symmetric. */
export function deltaE76(hexA: string, hexB: string): number {
  const [l1, a1, b1] = hexToLab(hexA);
  const [l2, a2, b2] = hexToLab(hexB);
  return Math.sqrt((l1 - l2) ** 2 + (a1 - a2) ** 2 + (b1 - b2) ** 2);
}

// --- rgba compositing (theme token resolution) -----------------------------

const HEX6_RE = /^#[0-9a-f]{6}$/i;
// Mirrors RGB_COLOR_RE in shared/theme-manifest.ts's cssColorSchema.
const RGBA_RE = /^rgba?\(\s*(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(\d{1,3})\s*(?:,\s*(0|1|0?\.\d+)\s*)?\)$/i;

function toHexByte(n: number): string {
  const clamped = Math.max(0, Math.min(255, Math.round(n)));
  return clamped.toString(16).padStart(2, "0");
}

/**
 * Composites an `rgb()`/`rgba()`/`#rrggbb` foreground color over an opaque
 * `#rrggbb` background, returning a lowercase `#rrggbb`. Accepts the same
 * rgb/rgba grammar as `cssColorSchema` in `shared/theme-manifest.ts`; an
 * opaque `#rrggbb` foreground is returned lowercased as-is. Throws on any
 * other format.
 */
export function compositeOver(rgba: string, bgHex: string): string {
  const v = (rgba || "").trim();

  if (HEX6_RE.test(v)) {
    return v.toLowerCase();
  }

  const m = RGBA_RE.exec(v);
  if (!m) {
    throw new Error(`compositeOver: unsupported color format: ${rgba}`);
  }

  const fgR = Number(m[1]);
  const fgG = Number(m[2]);
  const fgB = Number(m[3]);
  const alpha = m[4] !== undefined ? Number(m[4]) : 1;

  const { r: bgR, g: bgG, b: bgB } = hexToRgb(bgHex);

  const r = fgR * alpha + bgR * (1 - alpha);
  const g = fgG * alpha + bgG * (1 - alpha);
  const b = fgB * alpha + bgB * (1 - alpha);

  return `#${toHexByte(r)}${toHexByte(g)}${toHexByte(b)}`;
}
