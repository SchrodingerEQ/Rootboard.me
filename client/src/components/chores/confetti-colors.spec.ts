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

describe("confetti shapes (theme manifest v2)", () => {
  afterEach(() => vi.restoreAllMocks());
  const STAR = "M12 2l3 7h7l-5.5 4.5 2 7.5-6.5-4.5-6.5 4.5 2-7.5L2 9h7z";
  const SQUARE = "M0 0H24V24H0Z";

  test("a theme with shapes: every particle takes a shape in rotation, colours unchanged", () => {
    const particles = generateConfettiParticles(CONFETTI_COLORS, [STAR, SQUARE]);
    expect(particles.map((p) => p.shape)).toEqual(particles.map((_, i) => (i % 2 === 0 ? STAR : SQUARE)));
    expect(particles.map((p) => p.color)).toEqual(particles.map((_, i) => CONFETTI_COLORS[i % CONFETTI_COLORS.length]));
  });

  test("a theme without shapes: squares and circles, no shape field", () => {
    for (const p of generateConfettiParticles(CONFETTI_COLORS, [])) {
      expect(p.shape).toBeUndefined();
      expect(["50%", "3px"]).toContain(p.radius);
    }
  });

  test("shapes do not change the motion: same random draws give the same flight", () => {
    const seq = Array.from({ length: 200 }, (_, i) => ((i * 7919) % 1000) / 1000);
    const run = (shapes: string[]) => {
      let k = 0;
      vi.spyOn(Math, "random").mockImplementation(() => seq[k++ % seq.length]);
      const out = generateConfettiParticles(CONFETTI_COLORS, shapes).map(({ dx, dy, rot, size }) => ({ dx, dy, rot, size }));
      vi.restoreAllMocks();
      return out;
    };
    expect(run([STAR])).toEqual(run([]));
  });

  test("runtimeConfettiShapes passes valid shapes through without a warning", async () => {
    const { runtimeConfettiShapes } = await freshModule();
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    expect(runtimeConfettiShapes(() => [STAR])).toEqual([STAR]);
    expect(runtimeConfettiShapes(() => [])).toEqual([]);
    expect(warn).not.toHaveBeenCalled();
  });

  test("a malformed shape: plain confetti for the burst, warned once", async () => {
    const { runtimeConfettiShapes } = await freshModule();
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const bad = () => [STAR, '<path d="M0 0"/>'];
    expect(runtimeConfettiShapes(bad)).toEqual([]);
    expect(runtimeConfettiShapes(bad)).toEqual([]);
    expect(warn).toHaveBeenCalledTimes(1);
    expect(warn.mock.calls[0][0]).toMatch(/confetti shape rejected/);
  });
});
