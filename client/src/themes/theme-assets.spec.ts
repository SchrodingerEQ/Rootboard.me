import fs from "fs";
import os from "os";
import path from "path";
import { describe, expect, test } from "vitest";
import {
  THEME_IMAGE_EXTENSIONS,
  THEME_IMAGE_SLOTS,
  themeImageBudgetProblem,
  validateThemeManifest,
  type ThemeImageSlot,
} from "@shared/theme-manifest";
import { BUILTIN_THEMES } from "./index";

/**
 * Built-in theme images live in client/src/themes/<theme-id>/<slot>.<ext>
 * (THEME-ASSETS.md). They ship in the public release tarball, so each one
 * must be a known slot, a permitted type, within the slot's byte budget,
 * and free of embedded metadata (EXIF can carry a location or a name).
 */

const THEMES_DIR = import.meta.dirname;

/** Metadata blocks that must be stripped before an image is committed. */
function metadataProblem(file: string, bytes: Buffer): string | null {
  const ext = path.extname(file).slice(1).toLowerCase();
  if (ext === "png") {
    // Walk the chunks: tEXt/zTXt/iTXt carry text, eXIf carries EXIF.
    let at = 8;
    while (at + 8 <= bytes.length) {
      const length = bytes.readUInt32BE(at);
      const type = bytes.toString("latin1", at + 4, at + 8);
      if (["tEXt", "zTXt", "iTXt", "eXIf"].includes(type)) return `${file}: PNG ${type} chunk`;
      at += 12 + length;
    }
    return null;
  }
  if (ext === "jpg" || ext === "jpeg") {
    // APP1 segments carry EXIF and XMP.
    let at = 2;
    while (at + 4 <= bytes.length && bytes[at] === 0xff) {
      const marker = bytes[at + 1];
      if (marker === 0xda) break; // start of scan: no more headers
      if (marker === 0xe1) return `${file}: JPEG APP1 (EXIF/XMP) segment`;
      at += 2 + bytes.readUInt16BE(at + 2);
    }
    return null;
  }
  if (ext === "webp") {
    return bytes.includes(Buffer.from("EXIF")) || bytes.includes(Buffer.from("XMP ")) ? `${file}: WebP EXIF/XMP chunk` : null;
  }
  return null;
}

/** Every problem with one theme's asset folder; [] when it is clean. */
export function themeAssetFolderProblems(dir: string): string[] {
  const problems: string[] = [];
  for (const file of fs.readdirSync(dir)) {
    const full = path.join(dir, file);
    if (fs.statSync(full).isDirectory()) {
      problems.push(`${file}: theme asset folders are flat`);
      continue;
    }
    const dot = file.lastIndexOf(".");
    const slot = file.slice(0, dot) as ThemeImageSlot;
    const ext = file.slice(dot + 1).toLowerCase();
    if (!(THEME_IMAGE_SLOTS as readonly string[]).includes(slot)) {
      problems.push(`${file}: not named after a slot (${THEME_IMAGE_SLOTS.join(", ")})`);
      continue;
    }
    if (!THEME_IMAGE_EXTENSIONS[slot].includes(ext)) {
      problems.push(`${file}: ${slot} must be ${THEME_IMAGE_EXTENSIONS[slot].join(", ")}`);
      continue;
    }
    const bytes = fs.readFileSync(full);
    const budget = themeImageBudgetProblem(slot, bytes.length);
    if (budget) problems.push(`${file}: ${budget}`);
    const meta = metadataProblem(file, bytes);
    if (meta) problems.push(meta);
  }
  return problems;
}

function themeAssetDirs(): string[] {
  return fs
    .readdirSync(THEMES_DIR)
    .filter((name) => fs.statSync(path.join(THEMES_DIR, name)).isDirectory())
    .map((name) => path.join(THEMES_DIR, name));
}

describe("built-in theme images", () => {
  test("every asset folder is a built-in theme's id", () => {
    const ids = BUILTIN_THEMES.map((raw) => {
      const r = validateThemeManifest(raw);
      return r.ok ? r.manifest.id : "<invalid>";
    });
    for (const dir of themeAssetDirs()) expect(ids, path.basename(dir)).toContain(path.basename(dir));
  });

  for (const dir of themeAssetDirs()) {
    test(`${path.basename(dir)}: slot names, types, budget and no metadata`, () => {
      expect(themeAssetFolderProblems(dir)).toEqual([]);
    });
  }
});

describe("the asset check itself", () => {
  const pngHeader = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  function chunk(type: string, data = Buffer.alloc(0)): Buffer {
    const len = Buffer.alloc(4);
    len.writeUInt32BE(data.length);
    return Buffer.concat([len, Buffer.from(type, "latin1"), data, Buffer.alloc(4)]);
  }

  function fixture(files: Record<string, Buffer>): string {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "rb-theme-assets-"));
    for (const [name, bytes] of Object.entries(files)) fs.writeFileSync(path.join(dir, name), bytes);
    return dir;
  }

  test("a clean folder passes", () => {
    const dir = fixture({
      "logo.png": Buffer.concat([pngHeader, chunk("IHDR", Buffer.alloc(13)), chunk("IEND")]),
      "header.jpg": Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x04, 0x00, 0x00, 0xff, 0xda]),
    });
    expect(themeAssetFolderProblems(dir)).toEqual([]);
  });

  test("flags a wrong name, a wrong type, an oversize file and embedded metadata", () => {
    const dir = fixture({
      "footer.jpg": Buffer.alloc(10),
      "logo.jpg": Buffer.alloc(10),
      "sidebar.webp": Buffer.alloc(500_001),
      "background.png": Buffer.concat([pngHeader, chunk("tEXt", Buffer.from("Author\0someone")), chunk("IEND")]),
      "screensaver.jpg": Buffer.from([0xff, 0xd8, 0xff, 0xe1, 0x00, 0x08, 0x45, 0x78, 0x69, 0x66, 0x00, 0x00, 0xff, 0xda]),
    });
    const problems = themeAssetFolderProblems(dir).join("\n");
    expect(problems).toMatch(/footer\.jpg: not named after a slot/);
    expect(problems).toMatch(/logo\.jpg: logo must be png, webp/);
    expect(problems).toMatch(/sidebar\.webp: sidebar image is 500001 bytes/);
    expect(problems).toMatch(/background\.png: PNG tEXt chunk/);
    expect(problems).toMatch(/screensaver\.jpg: JPEG APP1/);
  });
});
