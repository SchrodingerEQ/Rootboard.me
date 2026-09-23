// client/src/lib/person-colors.spec.ts
//
// Pin test for the Default theme's --rb-person-* tokens (matches
// PERSON_PALETTE, client/src/lib/chores-state.ts, slot for slot), plus
// coverage for the person-colors.ts helpers: personSlot, personColorVar,
// personPaletteVars.
import { describe, expect, test } from "vitest";
import { PERSON_PALETTE } from "@/lib/chores-state";
import { defaultTheme } from "@/themes/default";
import { personColorVar, personPaletteVars, personSlot } from "@/lib/person-colors";
import { PERSON_ROLES, THEME_TOKEN_NAMES } from "@shared/theme-manifest";

describe("PERSON_PALETTE pins the Default theme's person tokens", () => {
  for (let i = 0; i < PERSON_PALETTE.length; i++) {
    const slot = i + 1;
    test(`slot ${slot}`, () => {
      const fromTheme = {
        color: defaultTheme.tokens[`--rb-person-${slot}-color` as keyof typeof defaultTheme.tokens],
        tint: defaultTheme.tokens[`--rb-person-${slot}-tint` as keyof typeof defaultTheme.tokens],
        text: defaultTheme.tokens[`--rb-person-${slot}-text` as keyof typeof defaultTheme.tokens],
      };
      expect(fromTheme).toEqual(PERSON_PALETTE[i]);
    });
  }
});

describe("personSlot", () => {
  test.each([
    [0, 1],
    [7, 8],
    [8, 1],
    [-1, 1],
    [2.5, 1],
    [NaN, 1],
    ["3", 1],
    [undefined, 1],
    [null, 1],
    [{}, 1],
  ] as const)("personSlot(%p) === %p", (input, expected) => {
    expect(personSlot(input)).toBe(expected);
  });
});

describe("personColorVar", () => {
  test("slot 4 (colorIdx 3) tint", () => {
    expect(personColorVar(3, "tint")).toBe("var(--rb-person-4-tint, #e8effd)");
  });

  test("falls back to slot 1 for an invalid colorIdx", () => {
    expect(personColorVar("nope", "color")).toBe(`var(--rb-person-1-color, ${PERSON_PALETTE[0].color})`);
  });
});

describe("personPaletteVars", () => {
  test("colorIdx 0 equals the purple (slot 1) var strings", () => {
    expect(personPaletteVars(0)).toEqual({
      color: `var(--rb-person-1-color, ${PERSON_PALETTE[0].color})`,
      tint: `var(--rb-person-1-tint, ${PERSON_PALETTE[0].tint})`,
      text: `var(--rb-person-1-text, ${PERSON_PALETTE[0].text})`,
    });
  });

  test("every token name produced for idx 0..7 x role is in THEME_TOKEN_NAMES", () => {
    for (let idx = 0; idx < 8; idx++) {
      for (const role of PERSON_ROLES) {
        const varString = personColorVar(idx, role);
        const match = /^var\((--rb-person-\d-\w+), /.exec(varString);
        expect(match).not.toBeNull();
        const tokenName = match![1];
        expect(THEME_TOKEN_NAMES as readonly string[]).toContain(tokenName);
      }
    }
  });
});
