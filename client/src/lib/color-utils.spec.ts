import { describe, expect, test } from "vitest";
import {
  DARK_INK_LIGHTEN,
  compositeOver,
  contrastRatio,
  deltaE76,
  eventTextColor,
  eventTint,
  hexToLab,
  relativeLuminance,
} from "./color-utils";

// Copied from calendar-meta.ts FALLBACK_COLORS — keep in sync.
const FALLBACK_COLORS = [
  "#2563eb", "#16a34a", "#e11d48", "#ea8c00", "#9333ea",
  "#795548", "#607d8b", "#e91e63", "#4caf50", "#ff5722", "#3f51b5", "#009688",
];

// A sample of colors Google Calendar assigns to events/calendars.
const GOOGLE_PALETTE_SAMPLE = [
  "#7986cb", "#33b679", "#8e24aa", "#e67c73", "#f6bf26", "#f4511e",
  "#039be5", "#616161", "#3f51b5", "#0b8043", "#d50000", "#1a73e8",
];

const SURFACE_DEEP_SPACE = "#141c2e";

function parseRgb(rgb: string): string {
  const m = /^rgb\((\d{1,3}),\s*(\d{1,3}),\s*(\d{1,3})\)$/.exec(rgb);
  if (!m) throw new Error(`parseRgb: unexpected format: ${rgb}`);
  const toHex = (n: string) => Number(n).toString(16).padStart(2, "0");
  return `#${toHex(m[1])}${toHex(m[2])}${toHex(m[3])}`;
}

describe("relativeLuminance", () => {
  test("black is 0, white is 1", () => {
    expect(relativeLuminance("#000000")).toBe(0);
    expect(relativeLuminance("#ffffff")).toBeCloseTo(1, 6);
  });
});

describe("contrastRatio", () => {
  test("white on black is 21:1", () => {
    expect(contrastRatio("#ffffff", "#000000")).toBeCloseTo(21, 2);
  });
  test("same color is 1:1", () => {
    expect(contrastRatio("#2b3038", "#2b3038")).toBe(1);
  });
  test("is symmetric", () => {
    expect(contrastRatio("#2b3038", "#f7f6f3")).toBeCloseTo(contrastRatio("#f7f6f3", "#2b3038"), 10);
  });
  test("Default ink on Default canvas is about 12.3:1 (pinned reference value)", () => {
    expect(contrastRatio("#2b3038", "#f7f6f3")).toBeCloseTo(12.28, 1);
  });
});

describe("hexToLab", () => {
  test("white is [100, 0, 0]", () => {
    const [l, a, b] = hexToLab("#ffffff");
    expect(l).toBeCloseTo(100, 1);
    expect(a).toBeCloseTo(0, 1);
    expect(b).toBeCloseTo(0, 1);
  });

  test("black is [0, 0, 0]", () => {
    const [l, a, b] = hexToLab("#000000");
    expect(l).toBeCloseTo(0, 1);
    expect(a).toBeCloseTo(0, 1);
    expect(b).toBeCloseTo(0, 1);
  });

  test("red is about [53.24, 80.09, 67.20]", () => {
    const [l, a, b] = hexToLab("#ff0000");
    expect(l).toBeCloseTo(53.24, 1);
    expect(a).toBeCloseTo(80.09, 1);
    expect(b).toBeCloseTo(67.2, 1);
  });
});

describe("deltaE76", () => {
  test("is 0 for identical colors", () => {
    expect(deltaE76("#e11d48", "#e11d48")).toBe(0);
  });

  test("is symmetric", () => {
    expect(deltaE76("#e11d48", "#db2777")).toBeCloseTo(deltaE76("#db2777", "#e11d48"), 10);
  });

  test("red vs pink is about 28.1", () => {
    expect(deltaE76("#e11d48", "#db2777")).toBeCloseTo(28.1, 1);
  });
});

describe("eventTextColor", () => {
  const ALL_COLORS = [...FALLBACK_COLORS, ...GOOGLE_PALETTE_SAMPLE];

  test.each(ALL_COLORS)("%s: no-surface and light-surface opts match the positional-factor default, byte-for-byte", (c) => {
    const base = eventTextColor(c, 0.55);
    expect(eventTextColor(c)).toBe(base);
    expect(eventTextColor(c, { surface: "#ffffff" })).toBe(base);
  });

  test.each(ALL_COLORS)("%s: on Deep Space surface, ink reaches >= 4.5:1 against its own tint", (c) => {
    const ink = eventTextColor(c, { surface: SURFACE_DEEP_SPACE });
    const bg = compositeOver(eventTint(c), SURFACE_DEEP_SPACE);
    expect(contrastRatio(parseRgb(ink), bg)).toBeGreaterThanOrEqual(4.5);
  });

  test("DARK_INK_LIGHTEN is one of the candidate steps 0.5..0.9", () => {
    expect(DARK_INK_LIGHTEN).toBeGreaterThanOrEqual(0.5);
    expect(DARK_INK_LIGHTEN).toBeLessThanOrEqual(0.9);
  });
});

describe("compositeOver", () => {
  test("blends a translucent rgba() over an opaque hex background", () => {
    expect(compositeOver("rgba(255, 255, 255, 0.6)", "#fdf0db")).toBe("#fef9f1");
    expect(compositeOver("rgba(255, 255, 255, 0.1)", "#0b2e1a")).toBe("#234331");
  });

  test("passes an opaque #rrggbb through, lowercased", () => {
    expect(compositeOver("#ABCDEF", "#000000")).toBe("#abcdef");
  });

  test("throws on an unsupported color format", () => {
    expect(() => compositeOver("hsl(0, 100%, 50%)", "#000000")).toThrow();
  });
});
