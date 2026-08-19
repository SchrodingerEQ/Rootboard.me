import { describe, expect, test } from "vitest";
import {
  CONFETTI_COLORS,
  generateConfettiParticles,
} from "./confetti-burst";

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
