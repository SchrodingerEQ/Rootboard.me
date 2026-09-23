// client/src/lib/person-colors.spec.ts
//
// Pin test only for now: asserts the Default theme's --rb-person-* tokens
// match PERSON_PALETTE (client/src/lib/chores-state.ts) exactly, slot for
// slot. No person-colors module exists yet — this just locks the values in
// place ahead of one.
import { describe, expect, test } from "vitest";
import { PERSON_PALETTE } from "@/lib/chores-state";
import { defaultTheme } from "@/themes/default";

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
