import fs from "fs";
import path from "path";
import { describe, expect, test } from "vitest";
import { validateThemeManifest } from "@shared/theme-manifest";
import { resolveRootTokens } from "@/lib/theme-stylesheet";
import { defaultTheme } from "./default";
import { BUILTIN_THEMES } from "./index";

const css = fs.readFileSync(path.resolve(import.meta.dirname, "../index.css"), "utf-8");

describe("default theme", () => {
  test("validates and is called 'default'", () => {
    const result = validateThemeManifest(defaultTheme);
    expect(result.ok, result.ok ? "" : result.message).toBe(true);
    expect(defaultTheme.id).toBe("default");
    expect(defaultTheme.engineVersion).toBe(1);
  });

  test("tokens equal the :root literals exactly (Default stays pixel-identical)", () => {
    expect(defaultTheme.tokens).toEqual(resolveRootTokens(css));
  });

  test("is registered in BUILTIN_THEMES", () => {
    expect(BUILTIN_THEMES).toContain(defaultTheme);
  });
});
