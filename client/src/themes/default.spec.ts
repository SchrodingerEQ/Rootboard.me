import fs from "fs";
import path from "path";
import { describe, expect, test } from "vitest";
import {
  DEFAULT_THEME_FONT,
  DEFAULT_THEME_SHAPE,
  THEME_STYLE_PROPERTY_NAMES,
  THEME_TOKEN_NAMES,
  resolveThemeStyle,
  validateThemeManifest,
} from "@shared/theme-manifest";
import { parseRootDeclarations, resolveRootTokens } from "@/lib/theme-stylesheet";
import { defaultTheme } from "./default";
import { BUILTIN_THEMES } from "./index";

const css = fs.readFileSync(path.resolve(import.meta.dirname, "../index.css"), "utf-8");

describe("default theme", () => {
  test("validates and is called 'default'", () => {
    const result = validateThemeManifest(defaultTheme);
    expect(result.ok, result.ok ? "" : result.message).toBe(true);
    expect(defaultTheme.id).toBe("default");
    expect(defaultTheme.engineVersion).toBe(2);
  });

  test("tokens equal the :root literals exactly (Default stays pixel-identical)", () => {
    const root = resolveRootTokens(css);
    const colours = Object.fromEntries(THEME_TOKEN_NAMES.map((n) => [n, root[n]]));
    expect(defaultTheme.tokens).toEqual(colours);
  });

  test("declares the font and shape every other theme backfills from", () => {
    expect(defaultTheme.font).toEqual(DEFAULT_THEME_FONT);
    expect(defaultTheme.shape).toEqual(DEFAULT_THEME_SHAPE);
  });

  test("its font and shape equal the :root values (no change before the engine runs)", () => {
    const decls = parseRootDeclarations(css);
    const style = resolveThemeStyle(defaultTheme);
    for (const name of THEME_STYLE_PROPERTY_NAMES) expect(decls.get(name), name).toBe(style[name]);
  });

  test("is registered in BUILTIN_THEMES", () => {
    expect(BUILTIN_THEMES).toContain(defaultTheme);
  });
});
