import { describe, expect, test } from "vitest";
import {
  personTokenName,
  PERSON_SLOT_COUNT,
  validateThemeManifest,
  type ThemeManifest,
} from "@shared/theme-manifest";
import { compositeOver, contrastRatio, deltaE76 } from "@/lib/color-utils";
import { BUILTIN_THEMES } from "./index";

const AA = 4.5;
const AA_LARGE = 3.0;
const MIN_DELTA_E = 20;

/**
 * Default is shipped and must not change (value only accrues), so it is
 * grandfathered: these are its MEASURED ratios rounded down. The rule is
 * "no regression", not "meets AA". Every other theme must meet AA/AA-large
 * on every check. If you ever raise one of these floors, you improved
 * Default — good; never lower one.
 */
const DEFAULT_PERSON_FLOORS: Partial<Record<string, number>> = {
  "2:text/tint": 4.4,
  "3:text/tint": 4.4,
  "2:on-color/color": 3.2,
  "3:on-color/color": 2.5,
  "6:on-color/color": 3.7,
  "8:on-color/color": 4.3,
  "3:color/surface": 2.5,
};

function themes(): ThemeManifest[] {
  return BUILTIN_THEMES.map((raw) => {
    const r = validateThemeManifest(raw);
    if (!r.ok) throw new Error(r.message);
    return r.manifest;
  });
}

describe("built-in theme person palette", () => {
  for (const theme of themes()) {
    describe(theme.id, () => {
      const onColorInk = theme.tokens["--rb-on-color-ink"];
      const onTintChip = theme.tokens["--rb-on-tint-chip"];
      const surface = theme.tokens["--rb-surface"];

      for (let slot = 1; slot <= PERSON_SLOT_COUNT; slot++) {
        const color = theme.tokens[personTokenName(slot, "color")];
        const tint = theme.tokens[personTokenName(slot, "tint")];
        const text = theme.tokens[personTokenName(slot, "text")];

        test(`slot ${slot} tokens are #rrggbb`, () => {
          expect(color, `person-${slot}-color must be #rrggbb`).toMatch(/^#[0-9a-f]{6}$/i);
          expect(tint, `person-${slot}-tint must be #rrggbb`).toMatch(/^#[0-9a-f]{6}$/i);
          expect(text, `person-${slot}-text must be #rrggbb`).toMatch(/^#[0-9a-f]{6}$/i);
        });

        const textTintKey = `${slot}:text/tint`;
        const textTintFloor = theme.id === "default" ? (DEFAULT_PERSON_FLOORS[textTintKey] ?? AA) : AA;
        test(`slot ${slot} text/tint >= ${textTintFloor}`, () => {
          expect(text, `person-${slot}-text must be #rrggbb for contrast checks`).toMatch(/^#[0-9a-f]{6}$/i);
          expect(tint, `person-${slot}-tint must be #rrggbb for contrast checks`).toMatch(/^#[0-9a-f]{6}$/i);
          expect(contrastRatio(text, tint)).toBeGreaterThanOrEqual(textTintFloor);
        });

        const chipKey = `${slot}:text/chip`;
        const chipFloor = theme.id === "default" ? (DEFAULT_PERSON_FLOORS[chipKey] ?? AA) : AA;
        test(`slot ${slot} text/chip-over-tint >= ${chipFloor}`, () => {
          expect(text, `person-${slot}-text must be #rrggbb for contrast checks`).toMatch(/^#[0-9a-f]{6}$/i);
          expect(tint, `person-${slot}-tint must be #rrggbb for contrast checks`).toMatch(/^#[0-9a-f]{6}$/i);
          const chipOverTint = compositeOver(onTintChip, tint);
          expect(contrastRatio(text, chipOverTint)).toBeGreaterThanOrEqual(chipFloor);
        });

        const onColorKey = `${slot}:on-color/color`;
        const onColorFloor = theme.id === "default" ? (DEFAULT_PERSON_FLOORS[onColorKey] ?? AA) : AA;
        test(`slot ${slot} on-color-ink/color >= ${onColorFloor}`, () => {
          expect(onColorInk, "--rb-on-color-ink must be #rrggbb for contrast checks").toMatch(/^#[0-9a-f]{6}$/i);
          expect(color, `person-${slot}-color must be #rrggbb for contrast checks`).toMatch(/^#[0-9a-f]{6}$/i);
          expect(contrastRatio(onColorInk, color)).toBeGreaterThanOrEqual(onColorFloor);
        });

        const colorSurfaceKey = `${slot}:color/surface`;
        const colorSurfaceFloor =
          theme.id === "default" ? (DEFAULT_PERSON_FLOORS[colorSurfaceKey] ?? AA_LARGE) : AA_LARGE;
        test(`slot ${slot} color/surface >= ${colorSurfaceFloor}`, () => {
          expect(color, `person-${slot}-color must be #rrggbb for contrast checks`).toMatch(/^#[0-9a-f]{6}$/i);
          expect(surface, "--rb-surface must be #rrggbb for contrast checks").toMatch(/^#[0-9a-f]{6}$/i);
          expect(contrastRatio(color, surface)).toBeGreaterThanOrEqual(colorSurfaceFloor);
        });
      }

      test(`min pairwise ΔE76 among -color values >= ${MIN_DELTA_E}`, () => {
        const colors = Array.from({ length: PERSON_SLOT_COUNT }, (_, i) =>
          theme.tokens[personTokenName(i + 1, "color")],
        );
        colors.forEach((c, i) => {
          expect(c, `person-${i + 1}-color must be #rrggbb for ΔE76 checks`).toMatch(/^#[0-9a-f]{6}$/i);
        });
        let min = Infinity;
        for (let i = 0; i < colors.length; i++) {
          for (let j = i + 1; j < colors.length; j++) {
            min = Math.min(min, deltaE76(colors[i], colors[j]));
          }
        }
        expect(min).toBeGreaterThanOrEqual(MIN_DELTA_E);
      });
    });
  }
});
