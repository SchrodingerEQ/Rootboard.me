// client/src/components/chores/person-palette-usage.spec.ts
//
// Source guard: the three Chores components that paint per-person color must
// read person colors through the theme-token helper (personPaletteVars),
// never by indexing PERSON_PALETTE directly. No React renderer exists in
// this test setup, so this spec asserts on source text rather than behavior.
import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";

const FILES = ["person-column.tsx", "edit-people.tsx", "reset-confirm-dialog.tsx"];

describe("chores components use personPaletteVars, not PERSON_PALETTE", () => {
  for (const file of FILES) {
    it(`${file} has no PERSON_PALETTE reference and imports personPaletteVars`, () => {
      const source = fs.readFileSync(path.resolve(import.meta.dirname, file), "utf-8");
      expect(source).not.toContain("PERSON_PALETTE");
      expect(source).toContain("personPaletteVars");
    });
  }
});
