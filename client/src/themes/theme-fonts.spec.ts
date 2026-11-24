import fs from "fs";
import path from "path";
import { describe, expect, test } from "vitest";
import { validateThemeManifest } from "@shared/theme-manifest";
import { BUILTIN_THEMES } from "./index";

const srcDir = path.resolve(import.meta.dirname, "..");
const fontsCss = fs.readFileSync(path.join(srcDir, "fonts.css"), "utf-8");

/** family -> the woff2 files its @font-face rules point at. */
function declaredFaces(css: string): Map<string, Set<string>> {
  const out = new Map<string, Set<string>>();
  for (const m of Array.from(css.matchAll(/@font-face\s*\{([\s\S]*?)\}/g))) {
    const family = /font-family:\s*'([^']+)'/.exec(m[1])?.[1];
    const file = /url\('\.\/assets\/fonts\/([^']+)'\)/.exec(m[1])?.[1];
    if (!family || !file) continue;
    if (!out.has(family)) out.set(family, new Set());
    out.get(family)!.add(file);
  }
  return out;
}

describe("built-in theme fonts are bundled, never fetched", () => {
  const faces = declaredFaces(fontsCss);

  for (const raw of BUILTIN_THEMES) {
    const result = validateThemeManifest(raw);
    if (!result.ok || !result.manifest.font) continue;
    const { id, font } = result.manifest;

    test(`${id}: family '${font.family}' is declared in fonts.css`, () => {
      expect(faces.has(font.family), `no @font-face for ${font.family}`).toBe(true);
    });

    test(`${id}: every listed file exists and belongs to that @font-face`, () => {
      for (const file of font.files) {
        expect(fs.existsSync(path.join(srcDir, "assets/fonts", file)), file).toBe(true);
        expect(faces.get(font.family)?.has(file), `${file} is not one of ${font.family}'s faces`).toBe(true);
      }
    });
  }
});
