import { describe, expect, test } from "vitest";
import { compositeOver, contrastRatio, deltaE76, hexToLab, relativeLuminance } from "./color-utils";

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
