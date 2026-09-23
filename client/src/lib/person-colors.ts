// client/src/lib/person-colors.ts
//
// Turns a person's colorIdx into theme-token CSS var() strings, so
// components read person colors through the theme engine (with the Default
// PERSON_PALETTE hex as a static fallback) instead of indexing
// PERSON_PALETTE directly. chores-state.ts stays dependency-free (its own
// normalizeColorIdx clamps persisted state); this module is the seam that
// turns a raw colorIdx into what the UI paints with.
import { PERSON_PALETTE, type PersonPaletteEntry } from "@/lib/chores-state";
import { personTokenName, PERSON_ROLES, type PersonRole } from "@shared/theme-manifest";

/**
 * Maps a person's colorIdx to a 1-based person slot (1..PERSON_PALETTE.length).
 * A non-negative integer wraps via (idx % 8) + 1 — matching the historical
 * `PERSON_PALETTE[idx % length]` indexing, so colorIdx 8 wraps back to slot 1.
 * Anything else (negative, fractional, NaN, non-number) falls back to slot 1,
 * the same "don't white-screen on bad persisted data" posture as
 * chores-state.ts's normalizeColorIdx.
 */
export function personSlot(colorIdx: unknown): number {
  if (typeof colorIdx === "number" && Number.isInteger(colorIdx) && colorIdx >= 0) {
    return (colorIdx % PERSON_PALETTE.length) + 1;
  }
  return 1;
}

/**
 * CSS `var(--rb-person-{slot}-{role}, <fallback>)` string for a person's
 * color role. The fallback is the Default theme's PERSON_PALETTE hex for
 * that slot, so the color is still correct before the theme engine's CSS
 * custom properties are in place (e.g. server-rendered markup, or a theme
 * missing the token — which validateThemeManifest rejects, but the var()
 * fallback is cheap insurance either way).
 */
export function personColorVar(colorIdx: unknown, role: PersonRole): string {
  const slot = personSlot(colorIdx);
  const fallback = PERSON_PALETTE[slot - 1][role];
  return `var(${personTokenName(slot, role)}, ${fallback})`;
}

/** All three CSS var() strings for a person's slot, shaped like a PersonPaletteEntry. */
export function personPaletteVars(colorIdx: unknown): PersonPaletteEntry {
  const [color, tint, text] = PERSON_ROLES.map((role) => personColorVar(colorIdx, role));
  return { color, tint, text };
}
