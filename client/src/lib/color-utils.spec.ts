import { describe, expect, test } from "vitest";
import { contrastRatio, relativeLuminance } from "./color-utils";

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
