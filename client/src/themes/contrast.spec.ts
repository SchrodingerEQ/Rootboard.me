import { describe, expect, test } from "vitest";
import {
  THEME_BACKING_REGIONS,
  resolveThemeBacking,
  validateThemeManifest,
  type ThemeBacking,
  type ThemeManifest,
  type ThemeTokenName,
} from "@shared/theme-manifest";
import { compositeOver, contrastRatio } from "@/lib/color-utils";
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

const OPAQUE_HEX = /^#[0-9a-f]{6}$/i;

/**
 * A background token as it renders: composited over `--rb-canvas` when it
 * carries alpha (a translucent card or cell over the picture is judged over
 * the canvas colour, THEME-ASSETS.md "Surfaces over a background"). The
 * canvas itself must be opaque.
 */
function renderedBackground(theme: ThemeManifest, token: ThemeTokenName): string {
  const canvas = theme.tokens["--rb-canvas"];
  if (!OPAQUE_HEX.test(canvas)) throw new Error("--rb-canvas must be #rrggbb for contrast checks");
  return compositeOver(theme.tokens[token], canvas);
}

/**
 * The colours a backing can put behind text, each composited over the
 * canvas: the canvas for `none`, the colour for `solid`, both stops for a
 * `gradient` (the whole run lies between them, so the worse stop bounds it).
 */
function backingStops(theme: ThemeManifest, backing: ThemeBacking): string[] {
  const canvas = theme.tokens["--rb-canvas"];
  if (!OPAQUE_HEX.test(canvas)) throw new Error("--rb-canvas must be #rrggbb for contrast checks");
  switch (backing.kind) {
    case "none":
      return [canvas];
    case "solid":
      return [compositeOver(backing.color, canvas)];
    case "gradient":
      return [compositeOver(backing.from, canvas), compositeOver(backing.to, canvas)];
  }
}

/** Worst ink-over-backing ratio across a region's stops. */
function worstBackingRatio(theme: ThemeManifest, ink: ThemeTokenName, backing: ThemeBacking): number {
  return Math.min(...backingStops(theme, backing).map((bg) => contrastRatio(theme.tokens[ink], bg)));
}

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
          expect(a, `${ink} must be #rrggbb for contrast checks`).toMatch(OPAQUE_HEX);
          expect(contrastRatio(a, renderedBackground(theme, bg))).toBeGreaterThanOrEqual(floor);
        });
      }

      // Text backing (manifest v3, decision 0027): the ink over each region's
      // backing as resolved, defaults included.
      const backing = resolveThemeBacking(theme);
      for (const region of THEME_BACKING_REGIONS) {
        test(`--rb-ink/backing.${region} >= ${AA}`, () => {
          expect(worstBackingRatio(theme, "--rb-ink", backing[region])).toBeGreaterThanOrEqual(AA);
        });
      }
    });
  }

  test("there is a deep-space theme", () => {
    expect(themes().map((t) => t.id)).toContain("deep-space");
  });

  test("there is a winter-holiday theme", () => {
    expect(themes().map((t) => t.id)).toContain("winter-holiday");
  });
});

describe("the guard composites translucent surfaces and backings over the canvas", () => {
  const base = themes().find((t) => t.id === "default")!;
  const withTokens = (tokens: Partial<Record<ThemeTokenName, string>>): ThemeManifest => ({
    ...base,
    tokens: { ...base.tokens, "--rb-canvas": "#ffffff", "--rb-ink": "#000000", ...tokens },
  });

  test("a light translucent surface passes only once composited (its raw rgb is the ink itself)", () => {
    const theme = withTokens({ "--rb-surface": "rgba(0, 0, 0, 0.1)" });
    expect(contrastRatio("#000000", "#000000")).toBe(1);
    expect(contrastRatio("#000000", renderedBackground(theme, "--rb-surface"))).toBeGreaterThanOrEqual(AA);
  });

  test("a dark translucent surface fails once composited", () => {
    const theme = withTokens({ "--rb-surface": "#000000e6" });
    expect(contrastRatio("#000000", renderedBackground(theme, "--rb-surface"))).toBeLessThan(AA);
  });

  test("a gradient is judged at its worse stop", () => {
    const theme = withTokens({});
    const fading = { kind: "gradient", from: "rgba(255, 255, 255, 0.8)", to: "rgba(0, 0, 0, 0.9)", direction: "down" } as const;
    expect(backingStops(theme, fading)).toHaveLength(2);
    expect(worstBackingRatio(theme, "--rb-ink", fading)).toBeLessThan(AA);
    const calm = { kind: "gradient", from: "rgba(255, 255, 255, 0.8)", to: "rgba(255, 255, 255, 0)", direction: "down" } as const;
    expect(worstBackingRatio(theme, "--rb-ink", calm)).toBeGreaterThanOrEqual(AA);
  });
});
