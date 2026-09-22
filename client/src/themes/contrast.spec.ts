import { describe, expect, test } from "vitest";
import { validateThemeManifest, type ThemeManifest, type ThemeTokenName } from "@shared/theme-manifest";
import { contrastRatio } from "@/lib/color-utils";
import { BUILTIN_THEMES } from "./index";

/** [ink token, background token] pairs that carry text or icons. */
const PAIRS: ReadonlyArray<readonly [ThemeTokenName, ThemeTokenName]> = [
  ["--rb-ink", "--rb-canvas"],
  ["--rb-ink", "--rb-surface"],
  ["--rb-ink-secondary", "--rb-canvas"],
  ["--rb-ink-secondary", "--rb-surface"],
  ["--rb-ink-tertiary", "--rb-canvas"],
  ["--rb-ink-tertiary", "--rb-surface"],
  ["--rb-ink-soft", "--rb-canvas"],
  ["--rb-ink-soft", "--rb-surface"],
  ["--rb-nav-inactive-ink", "--rb-canvas"],
  ["--rb-on-color-ink", "--rb-accent"],
  ["--rb-on-color-ink", "--rb-badge"],
  ["--rb-on-color-ink", "--rb-danger"],
  ["--rb-on-color-ink", "--rb-success"],
  ["--rb-on-color-ink", "--rb-info"],
  ["--rb-on-color-ink", "--rb-btn-dark-bg"],
  ["--rb-badge-ink", "--rb-badge"],
  ["--rb-danger-ink", "--rb-danger-wash"],
  ["--rb-success-ink", "--rb-success-wash"],
  ["--rb-info-ink", "--rb-info-wash"],
  ["--rb-warn-ink", "--rb-warn-wash"],
];

const AA = 4.5;

/**
 * Default is shipped and must not change (value only accrues), so it is
 * grandfathered: these are its MEASURED ratios rounded down. The rule is
 * "no regression", not "meets AA". Every other theme must meet AA on every
 * pair. If you ever raise one of these floors, you improved Default — good;
 * never lower one.
 */
const DEFAULT_FLOORS: Partial<Record<string, number>> = {
  "--rb-ink-tertiary/--rb-canvas": 3.7,
  "--rb-ink-tertiary/--rb-surface": 4.0,
  "--rb-on-color-ink/--rb-accent": 3.0,
  "--rb-on-color-ink/--rb-badge": 2.5,
  "--rb-on-color-ink/--rb-success": 3.2,
  "--rb-badge-ink/--rb-badge": 2.5,
  "--rb-success-ink/--rb-success-wash": 4.4,
  "--rb-warn-ink/--rb-warn-wash": 4.4,
};

function themes(): ThemeManifest[] {
  return BUILTIN_THEMES.map((raw) => {
    const r = validateThemeManifest(raw);
    if (!r.ok) throw new Error(r.message);
    return r.manifest;
  });
}

describe("built-in theme contrast", () => {
  for (const theme of themes()) {
    describe(theme.id, () => {
      for (const [ink, bg] of PAIRS) {
        const key = `${ink}/${bg}`;
        const floor = theme.id === "default" ? (DEFAULT_FLOORS[key] ?? AA) : AA;
        test(`${key} >= ${floor}`, () => {
          const a = theme.tokens[ink];
          const b = theme.tokens[bg];
          expect(a, `${ink} must be #rrggbb for contrast checks`).toMatch(/^#[0-9a-f]{6}$/i);
          expect(b, `${bg} must be #rrggbb for contrast checks`).toMatch(/^#[0-9a-f]{6}$/i);
          expect(contrastRatio(a, b)).toBeGreaterThanOrEqual(floor);
        });
      }
    });
  }

  test("there is a deep-space theme", () => {
    expect(themes().map((t) => t.id)).toContain("deep-space");
  });
});
