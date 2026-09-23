import { z } from "zod";

/**
 * Theme engine version the app implements. A manifest with `engineVersion`
 * greater than this is rejected with NEWER_ENGINE_MESSAGE (same policy as
 * widgets' apiVersion). Bump when THEME_TOKEN_NAMES changes after first
 * release; slices 1 and 2 ship together at 1.
 * See docs/plans/theme-system/THEME-ENGINE-SPEC.md §2.
 */
export const THEME_ENGINE_VERSION = 1;

export const NEWER_ENGINE_MESSAGE = "built for a newer Rootboard";

/**
 * Every color token a theme must supply — exactly the `--rb-*` custom
 * properties declared in client/src/index.css `:root` (a spec asserts the
 * two sets are equal). Order here is the authoring order used by
 * client/src/themes/default.ts.
 */
export const THEME_TOKEN_NAMES = [
  // Core palette
  "--rb-canvas",
  "--rb-surface",
  "--rb-ink",
  "--rb-muted",
  "--rb-faint",
  "--rb-chip",
  "--rb-chip-hover",
  "--rb-accent",
  "--rb-accent-hover",
  "--rb-today-wash",
  "--rb-today-col-wash",
  "--rb-grid-line",
  // Nav + badge
  "--rb-nav-active-bg",
  "--rb-nav-inactive-ink",
  "--rb-badge",
  "--rb-badge-ink",
  "--rb-shadow-soft",
  "--rb-scrollbar-thumb",
  "--rb-scrollbar-thumb-hover",
  "--rb-screensaver-bg-1",
  "--rb-screensaver-bg-2",
  "--rb-confetti-1",
  "--rb-confetti-2",
  "--rb-confetti-3",
  "--rb-confetti-4",
  "--rb-confetti-5",
  // Ink
  "--rb-ink-secondary",
  "--rb-ink-tertiary",
  "--rb-ink-soft",
  "--rb-ink-disabled",
  "--rb-on-color-ink",
  // Surfaces + borders
  "--rb-surface-sunken",
  "--rb-cell-weekend-bg",
  "--rb-cell-inactive-bg",
  "--rb-field-border",
  "--rb-border-strong",
  "--rb-accent-wash",
  // Buttons
  "--rb-btn-dark-bg",
  "--rb-btn-dark-hover-bg",
  // Status: danger
  "--rb-danger",
  "--rb-danger-hover",
  "--rb-danger-ink",
  "--rb-danger-wash",
  "--rb-danger-wash-hover",
  "--rb-danger-border",
  // Status: success
  "--rb-success",
  "--rb-success-hover",
  "--rb-success-ink",
  "--rb-success-wash",
  // Status: info
  "--rb-info",
  "--rb-info-hover",
  "--rb-info-ink",
  "--rb-info-wash",
  "--rb-info-wash-hover",
  "--rb-info-border",
  // Status: warning
  "--rb-warn",
  "--rb-warn-ink",
  "--rb-warn-wash",
  "--rb-warn-border",
  // Shadows + on-tint overlays
  "--rb-shadow-card",
  "--rb-shadow-accent",
  "--rb-shadow-panel",
  "--rb-on-tint-border",
  "--rb-on-tint-ring",
  "--rb-on-tint-fill",
  "--rb-on-tint-chip",
  "--rb-on-tint-hover-strong",
  "--rb-on-tint-hover",
  // On-screen keyboard
  "--rb-key-panel-bg",
  "--rb-key-panel-border",
  "--rb-key-border",
  "--rb-key-ctrl-bg",
  "--rb-key-ctrl-active-bg",
  "--rb-key-active-bg",
  // Screensaver
  "--rb-screensaver-logo-glow",
  "--rb-power-saving-bg",
  // People (8 identity slots, 1-based, slot order = identity, stable across themes)
  "--rb-person-1-color",
  "--rb-person-1-tint",
  "--rb-person-1-text",
  "--rb-person-2-color",
  "--rb-person-2-tint",
  "--rb-person-2-text",
  "--rb-person-3-color",
  "--rb-person-3-tint",
  "--rb-person-3-text",
  "--rb-person-4-color",
  "--rb-person-4-tint",
  "--rb-person-4-text",
  "--rb-person-5-color",
  "--rb-person-5-tint",
  "--rb-person-5-text",
  "--rb-person-6-color",
  "--rb-person-6-tint",
  "--rb-person-6-text",
  "--rb-person-7-color",
  "--rb-person-7-tint",
  "--rb-person-7-text",
  "--rb-person-8-color",
  "--rb-person-8-tint",
  "--rb-person-8-text",
] as const;

export type ThemeTokenName = (typeof THEME_TOKEN_NAMES)[number];

/** Number of person identity slots (1-based). Slot order = identity, same
 *  across every theme: 1 purple, 2 green, 3 orange, 4 blue, 5 rose/red,
 *  6 teal, 7 pink, 8 slate (see PERSON_PALETTE, client/src/lib/chores-state.ts). */
export const PERSON_SLOT_COUNT = 8;

export const PERSON_ROLES = ["color", "tint", "text"] as const;
export type PersonRole = (typeof PERSON_ROLES)[number];

/** Builds a `--rb-person-{slot}-{role}` token name. `slot` is 1-based
 *  (1..PERSON_SLOT_COUNT); throws RangeError outside that range. */
export function personTokenName(slot: number, role: PersonRole): ThemeTokenName {
  if (!Number.isInteger(slot) || slot < 1 || slot > PERSON_SLOT_COUNT) {
    throw new RangeError(`slot must be an integer in [1, ${PERSON_SLOT_COUNT}], got ${slot}`);
  }
  return `--rb-person-${slot}-${role}` as ThemeTokenName;
}

export const themeIdSchema = z
  .string()
  .regex(/^[a-z0-9][a-z0-9-]{1,40}$/, {
    message: "id must be lowercase alphanumeric/hyphen, 2-41 chars, starting with a letter or digit",
  });

const HEX_COLOR_RE = /^#[0-9a-f]{6}([0-9a-f]{2})?$/i;
const RGB_COLOR_RE = /^rgba?\(\s*\d{1,3}\s*,\s*\d{1,3}\s*,\s*\d{1,3}\s*(,\s*(0|1|0?\.\d+)\s*)?\)$/;

/** A manifest is data, never CSS: literal colors only. */
export const cssColorSchema = z.string().refine((v) => HEX_COLOR_RE.test(v) || RGB_COLOR_RE.test(v), {
  message: "must be #rrggbb, #rrggbbaa, rgb(r, g, b) or rgba(r, g, b, a)",
});

const tokensShape = Object.fromEntries(THEME_TOKEN_NAMES.map((name) => [name, cssColorSchema])) as Record<
  ThemeTokenName,
  typeof cssColorSchema
>;

/** Every token required; unknown keys rejected so a typo surfaces. */
export const themeTokensSchema = z.object(tokensShape).strict();
export type ThemeTokens = z.infer<typeof themeTokensSchema>;

export const themeManifestSchema = z.object({
  engineVersion: z.number().int().positive(),
  id: themeIdSchema,
  name: z.string().min(1).max(40),
  tokens: themeTokensSchema,
});
export type ThemeManifest = z.infer<typeof themeManifestSchema>;

export type ThemeValidation = { ok: true; manifest: ThemeManifest } | { ok: false; message: string };

/**
 * Schema check plus the engine-version gate, producing a short message
 * suitable for the settings menu's "Theme Errors" list. Never throws.
 */
export function validateThemeManifest(raw: unknown): ThemeValidation {
  const parsed = themeManifestSchema.safeParse(raw);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    const where = issue.path.length ? issue.path.join(".") : "manifest";
    return { ok: false, message: `${where}: ${issue.message}` };
  }
  if (parsed.data.engineVersion > THEME_ENGINE_VERSION) {
    return {
      ok: false,
      message: `${NEWER_ENGINE_MESSAGE} (engineVersion ${parsed.data.engineVersion} > ${THEME_ENGINE_VERSION})`,
    };
  }
  return { ok: true, manifest: parsed.data };
}
