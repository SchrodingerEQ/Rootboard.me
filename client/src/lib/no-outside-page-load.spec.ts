// client/src/lib/no-outside-page-load.spec.ts
//
// Guards "the kiosk loads nothing from outside the device at page load"
// (Crucible principle: nothing leaves the device unless a feature the owner
// chose needs it). The entry HTML and the global stylesheets once pulled
// Google Fonts and a replit.com script on every load; fonts are now bundled
// in assets/fonts and declared in fonts.css. Feature-driven calls (weather,
// zip lookup) happen in code on use and are not covered here.
import fs from "fs";
import path from "path";
import { describe, expect, test } from "vitest";

const clientRoot = path.resolve(import.meta.dirname, "../..");
const srcRoot = path.join(clientRoot, "src");
const html = fs.readFileSync(path.join(clientRoot, "index.html"), "utf-8");
const fontsCss = fs.readFileSync(path.join(srcRoot, "fonts.css"), "utf-8");

function cssFiles(dir: string): string[] {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) return cssFiles(full);
    return entry.name.endsWith(".css") ? [full] : [];
  });
}

const REMOTE = /(?:https?:)?\/\/[a-z0-9.-]+\.[a-z]{2,}/i;

describe("no outside requests at page load", () => {
  test("the entry HTML loads no remote script, stylesheet, font or image", () => {
    const loadingAttrs = Array.from(html.matchAll(/\b(?:src|href)\s*=\s*"([^"]*)"/g), (m) => m[1]);
    for (const url of loadingAttrs) {
      expect(url, `index.html loads ${url}`).not.toMatch(REMOTE);
    }
  });

  test("no client stylesheet imports or references a remote URL", () => {
    for (const file of cssFiles(srcRoot)) {
      const css = fs.readFileSync(file, "utf-8");
      const refs = Array.from(
        css.matchAll(/(?:@import\s+(?:url\(\s*)?|url\(\s*)['"]?([^'")\s;]+)/g),
        (m) => m[1],
      );
      for (const ref of refs) {
        expect(ref, `${path.relative(clientRoot, file)} references ${ref}`).not.toMatch(REMOTE);
      }
    }
  });

  test("the body face is declared from bundled files that exist", () => {
    expect(fontsCss).toMatch(/font-family:\s*'Nunito'/);
    const sources = Array.from(fontsCss.matchAll(/url\('([^']+)'\)/g), (m) => m[1]);
    expect(sources.length).toBeGreaterThan(0);
    for (const src of sources) {
      expect(fs.existsSync(path.join(srcRoot, src)), `${src} is missing`).toBe(true);
    }
  });

  test("every bundled font family ships its licence", () => {
    const fontsDir = path.join(srcRoot, "assets/fonts");
    for (const family of fs.readdirSync(fontsDir)) {
      expect(fs.existsSync(path.join(fontsDir, family, "OFL.txt")), `${family}/OFL.txt`).toBe(true);
    }
  });
});
