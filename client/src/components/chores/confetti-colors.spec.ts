import { afterEach, describe, expect, test, vi } from "vitest";
import { deepSpaceTheme } from "@/themes/deep-space";
import {
  CONFETTI_COLORS,
  generateConfettiParticles,
} from "./confetti-burst";

const DEEP_SPACE_CONFETTI = [1, 2, 3, 4, 5].map(
  (i) => deepSpaceTheme.tokens[`--rb-confetti-${i}` as keyof typeof deepSpaceTheme.tokens],
);

/** Reads tokens the way computed style returns them (leading space kept). */
function lookupFrom(tokens: Record<string, string>) {
  return (name: string) => (name in tokens ? ` ${tokens[name]}` : "");
}

// The once-only warning is module state, so each case loads a fresh copy of
// the module: the tests pass in any order.
async function freshModule() {
  vi.resetModules();
  return import("./confetti-burst");
}

describe("runtimeConfettiColors (theme tokens at burst time)", () => {
  afterEach(() => vi.restoreAllMocks());

  test("returns exactly the theme's five confetti tokens, trimmed", async () => {
    const { runtimeConfettiColors: fresh } = await freshModule();
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    expect(fresh(lookupFrom(deepSpaceTheme.tokens))).toEqual(DEEP_SPACE_CONFETTI);
    expect(warn).not.toHaveBeenCalled();
  });

  test("one empty token: falls back to CONFETTI_COLORS and warns once, naming it", async () => {
    const { runtimeConfettiColors: fresh } = await freshModule();
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const tokens: Record<string, string> = { ...deepSpaceTheme.tokens, "--rb-confetti-3": "" };
    expect(fresh(lookupFrom(tokens))).toEqual(CONFETTI_COLORS);
    expect(fresh(lookupFrom(tokens))).toEqual(CONFETTI_COLORS);
    expect(warn).toHaveBeenCalledTimes(1);
    expect(warn.mock.calls[0][0]).toContain("--rb-confetti-3");
  });
});

describe("generateConfettiParticles color injection", () => {
  test("defaults to CONFETTI_COLORS", () => {
    const particles = generateConfettiParticles();
    for (const p of particles) expect(CONFETTI_COLORS).toContain(p.color);
  });

  test("uses injected colors, cycling in order", () => {
    const custom = ["#111111", "#222222", "#333333"];
    const particles = generateConfettiParticles(custom);
    particles.forEach((p, i) => expect(p.color).toBe(custom[i % custom.length]));
  });

  test("default constant is unchanged (pinned for themes/tests)", () => {
    expect(CONFETTI_COLORS).toEqual(["#f2655a", "#f5a623", "#16a34a", "#2563eb", "#9333ea"]);
  });
});
