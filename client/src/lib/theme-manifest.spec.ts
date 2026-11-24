import { describe, expect, test } from "vitest";
import {
  DEFAULT_THEME_FONT,
  DEFAULT_THEME_SHAPE,
  NEWER_ENGINE_MESSAGE,
  PERSON_ROLES,
  PERSON_SLOT_COUNT,
  THEME_ENGINE_VERSION,
  THEME_STYLE_PROPERTY_NAMES,
  THEME_TOKEN_NAMES,
  fontFamilyValue,
  personTokenName,
  resolveThemeStyle,
  themeManifestSchema,
  validateThemeManifest,
} from "@shared/theme-manifest";

function fullTokens(): Record<string, string> {
  return Object.fromEntries(THEME_TOKEN_NAMES.map((n) => [n, "#123456"]));
}

function manifest(overrides: Record<string, unknown> = {}) {
  return { engineVersion: 1, id: "test-theme", name: "Test", tokens: fullTokens(), ...overrides };
}

function expectedPersonTokenNames(): string[] {
  const out: string[] = [];
  for (let slot = 1; slot <= PERSON_SLOT_COUNT; slot++) {
    for (const role of PERSON_ROLES) out.push(`--rb-person-${slot}-${role}`);
  }
  return out;
}

describe("THEME_TOKEN_NAMES", () => {
  test("has 100 unique --rb- names including --rb-ink-tertiary", () => {
    expect(THEME_TOKEN_NAMES).toHaveLength(100);
    expect(new Set(THEME_TOKEN_NAMES).size).toBe(100);
    for (const n of THEME_TOKEN_NAMES) expect(n).toMatch(/^--rb-[a-z0-9-]+$/);
    expect(THEME_TOKEN_NAMES).toContain("--rb-ink-tertiary");
  });

  test("the last 24 names are the slot-major person tokens", () => {
    expect(THEME_TOKEN_NAMES.slice(-24)).toEqual(expectedPersonTokenNames());
  });
});

describe("personTokenName", () => {
  test("builds the --rb-person-{slot}-{role} name", () => {
    expect(personTokenName(3, "tint")).toBe("--rb-person-3-tint");
  });

  test("throws RangeError outside the 1..8 slot range", () => {
    expect(() => personTokenName(0, "color")).toThrow(RangeError);
    expect(() => personTokenName(9, "color")).toThrow(RangeError);
  });
});

describe("themeManifestSchema", () => {
  test("accepts a complete manifest", () => {
    expect(themeManifestSchema.safeParse(manifest()).success).toBe(true);
  });

  test("rejects a manifest missing one token, naming it", () => {
    const tokens = fullTokens();
    delete tokens["--rb-badge"];
    const result = validateThemeManifest(manifest({ tokens }));
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.message).toContain("--rb-badge");
  });

  test("rejects an unknown token key (typo protection)", () => {
    const tokens = { ...fullTokens(), "--rb-bagde": "#123456" };
    expect(themeManifestSchema.safeParse(manifest({ tokens })).success).toBe(false);
  });

  test("rejects var(), named colors and url()", () => {
    for (const bad of ["var(--rb-ink)", "red", "url(x.png)", "#12345", "#ggghhh", "hsl(1, 2%, 3%)"]) {
      const tokens = { ...fullTokens(), "--rb-canvas": bad };
      expect(themeManifestSchema.safeParse(manifest({ tokens })).success, bad).toBe(false);
    }
  });

  test("accepts #rrggbb, #rrggbbaa, rgb() and rgba()", () => {
    for (const good of ["#0b1220", "#0B1220", "#0b122080", "rgb(0, 0, 0)", "rgba(255, 255, 255, 0.5)", "rgba(0,0,0,1)"]) {
      const tokens = { ...fullTokens(), "--rb-canvas": good };
      expect(themeManifestSchema.safeParse(manifest({ tokens })).success, good).toBe(true);
    }
  });

  test("rejects a bad id", () => {
    expect(themeManifestSchema.safeParse(manifest({ id: "Bad Id" })).success).toBe(false);
    expect(themeManifestSchema.safeParse(manifest({ id: "../x" })).success).toBe(false);
  });

  test("validateThemeManifest rejects a newer engineVersion with the standard message", () => {
    const result = validateThemeManifest(manifest({ engineVersion: THEME_ENGINE_VERSION + 1 }));
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.message).toContain(NEWER_ENGINE_MESSAGE);
  });

  test("validateThemeManifest returns the parsed manifest on success", () => {
    const result = validateThemeManifest(manifest());
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.manifest.id).toBe("test-theme");
  });
});

describe("manifest v2: font and shape (docs/decisions/0026)", () => {
  const font = { family: "Nunito", fallback: ["system-ui", "Segoe UI", "sans-serif"], files: ["nunito/nunito-latin.woff2"] };

  test("the engine is at version 2", () => {
    expect(THEME_ENGINE_VERSION).toBe(2);
  });

  test("a v1 manifest with neither block still validates", () => {
    expect(validateThemeManifest(manifest()).ok).toBe(true);
  });

  test("accepts a font block and a shape block", () => {
    const result = validateThemeManifest(manifest({ engineVersion: 2, font, shape: { radiusScale: 0.5, shadowSoftness: 2 } }));
    expect(result.ok, result.ok ? "" : result.message).toBe(true);
  });

  test("rejects a font family or fallback that could carry CSS", () => {
    for (const family of ["Nunito'; color: red", "Nunito, serif", "url(x)", ""]) {
      expect(validateThemeManifest(manifest({ font: { ...font, family } })).ok, family).toBe(false);
    }
    expect(validateThemeManifest(manifest({ font: { ...font, fallback: ["serif;"] } })).ok).toBe(false);
  });

  test("rejects font files that are not bundled woff2 paths", () => {
    for (const files of [[], ["../x.woff2"], ["nunito/x.ttf"], ["https://example.invalid/a.woff2"]]) {
      expect(validateThemeManifest(manifest({ font: { ...font, files } })).ok, JSON.stringify(files)).toBe(false);
    }
  });

  test("rejects a wrong type, out-of-range value or unknown key in shape", () => {
    expect(validateThemeManifest(manifest({ shape: { radiusScale: "1", shadowSoftness: 1 } })).ok).toBe(false);
    expect(validateThemeManifest(manifest({ shape: { radiusScale: -1, shadowSoftness: 1 } })).ok).toBe(false);
    expect(validateThemeManifest(manifest({ shape: { radiusScale: 3, shadowSoftness: 1 } })).ok).toBe(false);
    expect(validateThemeManifest(manifest({ shape: { radiusScale: 1 } })).ok).toBe(false);
    expect(validateThemeManifest(manifest({ shape: { radiusScale: 1, shadowSoftness: 1, depth: 2 } })).ok).toBe(false);
    expect(validateThemeManifest(manifest({ font: "Nunito" })).ok).toBe(false);
  });
});

describe("resolveThemeStyle (the backfill rule)", () => {
  test("an absent font or shape takes Default's values", () => {
    expect(resolveThemeStyle(themeManifestSchema.parse(manifest()))).toEqual({
      "--rb-font-family": fontFamilyValue(DEFAULT_THEME_FONT),
      "--rb-radius-scale": String(DEFAULT_THEME_SHAPE.radiusScale),
      "--rb-shadow-softness": String(DEFAULT_THEME_SHAPE.shadowSoftness),
    });
  });

  test("a declared font and shape win", () => {
    const parsed = themeManifestSchema.parse(
      manifest({ font: { family: "Some Face", fallback: ["serif"], files: ["some/face.woff2"] }, shape: { radiusScale: 0.25, shadowSoftness: 0 } }),
    );
    expect(resolveThemeStyle(parsed)).toEqual({
      "--rb-font-family": "'Some Face', serif",
      "--rb-radius-scale": "0.25",
      "--rb-shadow-softness": "0",
    });
  });

  test("names THEME_STYLE_PROPERTY_NAMES exactly", () => {
    expect(Object.keys(resolveThemeStyle(themeManifestSchema.parse(manifest()))).sort()).toEqual([...THEME_STYLE_PROPERTY_NAMES].sort());
  });
});
