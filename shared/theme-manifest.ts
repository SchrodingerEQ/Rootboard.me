import { z } from "zod";

/**
 * Theme engine version the app implements. A manifest with `engineVersion`
 * greater than this is rejected with NEWER_ENGINE_MESSAGE (same policy as
 * widgets' apiVersion). Bump whenever the manifest gains a field.
 *   1 — the 100 colour tokens (v1.6.0).
 *   2 — optional `font`, `shape`, `images` and `confettiShapes`
 *       (docs/decisions/0026).
 *   3 — optional `backing` (text backing per region); the `background`
 *       image paints the whole shell (docs/decisions/0027).
 * Fields added after version 1 are optional; an absent one is filled from
 * Default (the backfill rule, `resolveThemeStyle`), so a v1 manifest stays
 * valid and looks as it did.
 * See docs/plans/theme-system/THEME-ENGINE-SPEC.md §2.
 */
export const THEME_ENGINE_VERSION = 3;

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

// --- Manifest v2: font and shape (docs/decisions/0026) ----------------------

/** A font family name: letters, digits, spaces and hyphens only, so the
 *  CSS value the engine builds from it can never carry anything but a name. */
const FONT_NAME_RE = /^[A-Za-z0-9][A-Za-z0-9 -]{0,39}$/;
/** A bundled woff2 under client/src/assets/fonts/, as `<folder>/<file>.woff2`. */
const FONT_FILE_RE = /^[a-z0-9-]+\/[a-z0-9-]+\.woff2$/;

/** CSS generic family keywords: written unquoted in the built stack. */
const GENERIC_FONT_FAMILIES = new Set([
  "serif", "sans-serif", "monospace", "cursive", "fantasy", "system-ui",
  "ui-serif", "ui-sans-serif", "ui-monospace", "ui-rounded", "math", "emoji",
]);

/**
 * The app's body face. `family` must be declared by an `@font-face` in
 * client/src/fonts.css and `files` names the woff2 files that declaration
 * uses (a spec checks both for every built-in). Sizes and weights stay the
 * app's: a theme picks the face, never the type scale. Nothing is fetched:
 * a family the bundle does not declare simply falls through to `fallback`.
 */
export const themeFontSchema = z
  .object({
    family: z.string().regex(FONT_NAME_RE, { message: "font family must be letters, digits, spaces or hyphens" }),
    fallback: z
      .array(z.string().regex(FONT_NAME_RE, { message: "fallback font must be letters, digits, spaces or hyphens" }))
      .max(8),
    files: z
      .array(z.string().regex(FONT_FILE_RE, { message: "font file must be <folder>/<name>.woff2" }))
      .min(1)
      .max(16),
  })
  .strict();
export type ThemeFont = z.infer<typeof themeFontSchema>;

/**
 * Shape and depth. Both are multipliers on the app's own values, so a theme
 * can go squarer or rounder, harder or softer, without touching layout or
 * any touch-target size.
 * - `radiusScale`: corner radii of cards, cells, panels, dialogs and fields
 *   (0 = square corners, 1 = today, 2 = twice as round). Pills and circles
 *   stay round.
 * - `shadowSoftness`: blur of the card and cell shadows (0 = a crisp edge,
 *   1 = today). The shadow colours themselves are the `--rb-shadow-*` tokens.
 */
export const themeShapeSchema = z
  .object({
    radiusScale: z.number().min(0).max(2),
    shadowSoftness: z.number().min(0).max(3),
  })
  .strict();
export type ThemeShape = z.infer<typeof themeShapeSchema>;

/** Default's font: what client/src/index.css shipped before manifest v2. */
export const DEFAULT_THEME_FONT: ThemeFont = {
  family: "Nunito",
  fallback: ["system-ui", "Segoe UI", "sans-serif"],
  files: [
    "nunito/nunito-latin.woff2",
    "nunito/nunito-latin-ext.woff2",
    "nunito/nunito-cyrillic.woff2",
    "nunito/nunito-cyrillic-ext.woff2",
    "nunito/nunito-vietnamese.woff2",
  ],
};

/** Default's shape: today's radii and shadows exactly. */
export const DEFAULT_THEME_SHAPE: ThemeShape = { radiusScale: 1, shadowSoftness: 1 };

/**
 * The non-colour custom properties a theme drives, declared in
 * client/src/index.css `:root` with Default's values (a spec asserts it).
 */
export const THEME_STYLE_PROPERTY_NAMES = ["--rb-font-family", "--rb-radius-scale", "--rb-shadow-softness"] as const;
export type ThemeStylePropertyName = (typeof THEME_STYLE_PROPERTY_NAMES)[number];

/** The CSS `font-family` value for a font block: names quoted, generic keywords bare. */
export function fontFamilyValue(font: ThemeFont): string {
  return [font.family, ...font.fallback]
    .map((name) => (GENERIC_FONT_FAMILIES.has(name) ? name : `'${name}'`))
    .join(", ");
}

// --- Manifest v2: image slots and confetti shapes (docs/decisions/0026) -----

/**
 * The five image slots, each separate and optional. An absent slot leaves
 * its region on today's flat colour token. Supply sizes and fit rules:
 * docs/plans/theme-system/THEME-ASSETS.md.
 */
export const THEME_IMAGE_SLOTS = ["background", "header", "sidebar", "screensaver", "logo"] as const;
export type ThemeImageSlot = (typeof THEME_IMAGE_SLOTS)[number];

/** Byte cap per slot (decimal units: 1 MB = 1,000,000 bytes). Bounds the
 *  release tarball; the supply resolution bounds decoded memory. */
export const THEME_IMAGE_BUDGET_BYTES: Record<ThemeImageSlot, number> = {
  background: 3_000_000,
  screensaver: 3_000_000,
  header: 500_000,
  sidebar: 500_000,
  logo: 150_000,
};

/** File types a slot accepts: the logo needs alpha, so PNG or WebP. */
const RASTER_EXTENSIONS = ["jpg", "jpeg", "webp", "png"] as const;
export const THEME_IMAGE_EXTENSIONS: Record<ThemeImageSlot, readonly string[]> = {
  background: RASTER_EXTENSIONS,
  header: RASTER_EXTENSIONS,
  sidebar: RASTER_EXTENSIONS,
  screensaver: RASTER_EXTENSIONS,
  logo: ["png", "webp"],
};

const MIME_BY_EXTENSION: Record<string, string> = { jpg: "jpeg", jpeg: "jpeg", webp: "webp", png: "png" };

/** A same-origin bundle path (what a Vite asset import returns): starts with
 *  one `/`, then path characters only. No scheme, host, query, quote or
 *  parenthesis can appear, so the value is safe inside `url("…")` and an
 *  `<img src>` and can only name a file the app itself serves. */
const BUNDLE_PATH_RE = /^\/(?!\/)[A-Za-z0-9._@/-]+$/;
const DATA_URI_RE = /^data:image\/(png|jpeg|webp);base64,([A-Za-z0-9+/]+={0,2})$/;

/** Bytes a base64 payload decodes to. */
export function base64DecodedBytes(payload: string): number {
  const padding = payload.endsWith("==") ? 2 : payload.endsWith("=") ? 1 : 0;
  return Math.floor((payload.length * 3) / 4) - padding;
}

/** Why `bytes` breaks the slot's budget, or null when it fits. Used by the
 *  validator for inlined images and by the built-in asset test for files. */
export function themeImageBudgetProblem(slot: ThemeImageSlot, bytes: number): string | null {
  const cap = THEME_IMAGE_BUDGET_BYTES[slot];
  return bytes > cap ? `${slot} image is ${bytes} bytes; the cap is ${cap}` : null;
}

/** Why `ref` is not an acceptable image reference for `slot`, or null.
 *  Accepts a bundle path ending in one of the slot's extensions, or a
 *  base64 raster data URI (Vite inlines assets under 4 KB) within budget.
 *  Never an SVG, a remote URL or anything carrying markup. */
export function themeImageRefProblem(slot: ThemeImageSlot, ref: string): string | null {
  const allowed = THEME_IMAGE_EXTENSIONS[slot];
  const data = DATA_URI_RE.exec(ref);
  if (data) {
    if (!allowed.some((ext) => MIME_BY_EXTENSION[ext] === data[1])) return `${slot} must be ${allowed.join(", ")}`;
    return themeImageBudgetProblem(slot, base64DecodedBytes(data[2]));
  }
  if (!BUNDLE_PATH_RE.test(ref) || ref.split("/").includes("..")) {
    return `${slot} must be a bundled image path (no URL, query or "..")`;
  }
  const ext = ref.slice(ref.lastIndexOf(".") + 1).toLowerCase();
  if (!allowed.includes(ext)) return `${slot} must be ${allowed.join(", ")}`;
  return null;
}

function imageRefSchema(slot: ThemeImageSlot) {
  return z.string().superRefine((ref, ctx) => {
    const problem = themeImageRefProblem(slot, ref);
    if (problem) ctx.addIssue({ code: z.ZodIssueCode.custom, message: problem });
  });
}

export const themeImagesSchema = z
  .object({
    background: imageRefSchema("background").optional(),
    header: imageRefSchema("header").optional(),
    sidebar: imageRefSchema("sidebar").optional(),
    screensaver: imageRefSchema("screensaver").optional(),
    logo: imageRefSchema("logo").optional(),
  })
  .strict();
export type ThemeImages = z.infer<typeof themeImagesSchema>;

/** The CSS custom properties the four region slots land on (the logo is an
 *  `<img src>` instead). Each holds `url("…")` or `none`. */
export const THEME_IMAGE_PROPERTY_BY_SLOT = {
  background: "--rb-image-background",
  header: "--rb-image-header",
  sidebar: "--rb-image-sidebar",
  screensaver: "--rb-image-screensaver",
} as const satisfies Partial<Record<ThemeImageSlot, string>>;
export const THEME_IMAGE_PROPERTY_NAMES = Object.values(THEME_IMAGE_PROPERTY_BY_SLOT);
export type ThemeImagePropertyName = (typeof THEME_IMAGE_PROPERTY_NAMES)[number];

/** Region image properties for `:root`: `url("…")` for a declared slot,
 *  `none` for an absent one (the flat colour token shows). */
export function resolveThemeImageProperties(manifest: ThemeManifest): Record<ThemeImagePropertyName, string> {
  const images = manifest.images ?? {};
  const out = {} as Record<ThemeImagePropertyName, string>;
  for (const [slot, name] of Object.entries(THEME_IMAGE_PROPERTY_BY_SLOT) as [ThemeImageSlot, ThemeImagePropertyName][]) {
    const ref = images[slot];
    out[name] = ref ? `url("${ref}")` : "none";
  }
  return out;
}

/** Confetti shapes are drawn on this fixed viewBox. */
export const CONFETTI_SHAPE_VIEWBOX = "0 0 24 24";
export const CONFETTI_SHAPE_MAX_BYTES = 4_000;
export const CONFETTI_SHAPE_MAX_COUNT = 5;

const PATH_COMMANDS = "MmLlHhVvCcSsQqTtAaZz";
const isDigit = (c: string | undefined): boolean => c !== undefined && c >= "0" && c <= "9";

/** Index just past the SVG path number starting at `i` (sign, digits,
 *  optional fraction and exponent), or -1 when no number starts there. */
function scanPathNumber(d: string, i: number): number {
  if (d[i] === "+" || d[i] === "-") i++;
  let digits = 0;
  while (isDigit(d[i])) { i++; digits++; }
  if (d[i] === ".") {
    i++;
    while (isDigit(d[i])) { i++; digits++; }
  }
  if (digits === 0) return -1;
  if (d[i] === "e" || d[i] === "E") {
    let j = i + 1;
    if (d[j] === "+" || d[j] === "-") j++;
    if (!isDigit(d[j])) return -1;
    while (isDigit(d[j])) j++;
    i = j;
  }
  return i;
}

/**
 * True when `d` is SVG path data and nothing else: path commands and
 * numbers, separated by spaces or commas, starting with a move. One
 * linear pass, no regular expression to backtrack. Without `<`, `"`, `(` or any letter but
 * a command, no element, attribute or URL can ride in.
 */
function isPathData(d: string): boolean {
  let i = 0;
  let first = true;
  while (i < d.length) {
    const c = d[i];
    if (c === " " || c === "," || c === "\n" || c === "\t" || c === "\r") {
      i++;
      continue;
    }
    if (PATH_COMMANDS.includes(c)) {
      if (first && c !== "M" && c !== "m") return false;
      first = false;
      i++;
      continue;
    }
    if (first) return false;
    const next = scanPathNumber(d, i);
    if (next < 0) return false;
    i = next;
  }
  return !first;
}

/** Why `d` is not an acceptable confetti shape, or null. */
export function confettiShapeProblem(d: unknown): string | null {
  if (typeof d !== "string") return "confetti shape must be a path string";
  if (d.length > CONFETTI_SHAPE_MAX_BYTES) return `confetti shape is ${d.length} bytes; the cap is ${CONFETTI_SHAPE_MAX_BYTES}`;
  if (!isPathData(d) || !/\d/.test(d)) {
    return "confetti shape must be SVG path data (commands and numbers only, starting with M)";
  }
  return null;
}

export const confettiShapeSchema = z.string().superRefine((d, ctx) => {
  const problem = confettiShapeProblem(d);
  if (problem) ctx.addIssue({ code: z.ZodIssueCode.custom, message: problem });
});

// --- Manifest v3: text backing (docs/decisions/0027) -----------------------

/** A parsed colour from the manifest grammar (`cssColorSchema`). Channels
 *  0–255, alpha 0–1. */
export interface RgbaColor {
  r: number;
  g: number;
  b: number;
  a: number;
}

/** Parses `#rrggbb`, `#rrggbbaa`, `rgb()` or `rgba()`; null for anything
 *  else (the schema never lets anything else through). */
export function parseCssColor(value: string): RgbaColor | null {
  if (HEX_COLOR_RE.test(value)) {
    const h = value.slice(1);
    const byte = (i: number) => parseInt(h.slice(i, i + 2), 16);
    return { r: byte(0), g: byte(2), b: byte(4), a: h.length === 8 ? byte(6) / 255 : 1 };
  }
  if (RGB_COLOR_RE.test(value)) {
    const parts = value.slice(value.indexOf("(") + 1, -1).split(",").map((p) => Number(p.trim()));
    if (parts.slice(0, 3).some((c) => c > 255)) return null;
    return { r: parts[0], g: parts[1], b: parts[2], a: parts.length === 4 ? parts[3] : 1 };
  }
  return null;
}

/** `color` as `rgba()` with its alpha multiplied by `alpha` (0–1). Returns
 *  `color` unchanged if it cannot be parsed. */
export function colorWithAlpha(color: string, alpha: number): string {
  const c = parseCssColor(color);
  if (!c) return color;
  const a = Number((c.a * alpha).toFixed(3));
  return `rgba(${c.r}, ${c.g}, ${c.b}, ${a})`;
}

/** The regions that carry text over the picture and take a theme backing. */
export const THEME_BACKING_REGIONS = ["header", "rail", "voteStrip"] as const;
export type ThemeBackingRegion = (typeof THEME_BACKING_REGIONS)[number];

/**
 * What sits behind a region's text. Colours use the manifest colour grammar
 * (never `url()`, `var()` or a CSS string); the engine builds the CSS.
 * - `none`: transparent, the picture shows through.
 * - `solid`: one colour; `rgba()` or `#rrggbbaa` makes it semi-transparent.
 * - `gradient`: two stops, fading `down` (a bar) or `right` (the rail).
 */
export const themeBackingSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("none") }).strict(),
  z.object({ kind: z.literal("solid"), color: cssColorSchema }).strict(),
  z
    .object({
      kind: z.literal("gradient"),
      from: cssColorSchema,
      to: cssColorSchema,
      direction: z.enum(["down", "right"]),
    })
    .strict(),
]);
export type ThemeBacking = z.infer<typeof themeBackingSchema>;

export const themeBackingBlockSchema = z
  .object({
    header: themeBackingSchema.optional(),
    rail: themeBackingSchema.optional(),
    voteStrip: themeBackingSchema.optional(),
  })
  .strict();
export type ThemeBackingBlock = z.infer<typeof themeBackingBlockSchema>;

/** Alpha of the default header and rail backing when a theme sets a
 *  background image but no `backing`: its canvas colour at 70 %. */
export const DEFAULT_BACKING_ALPHA_OVER_IMAGE = 0.7;

/** CSS custom-property stem per region: `--rb-backing-<stem>-color` and
 *  `--rb-backing-<stem>-image`. */
const BACKING_PROPERTY_STEM: Record<ThemeBackingRegion, string> = {
  header: "header",
  rail: "rail",
  voteStrip: "vote-strip",
};

/**
 * The shell-layer custom properties a theme drives, declared in
 * client/src/index.css `:root` with the no-image defaults (a spec asserts
 * it): per backing region a colour layer and an image layer (`none` or a
 * `linear-gradient(…)`), plus `--rb-view-fill`, the fill of each view's
 * root (the canvas colour, or `transparent` when the background image
 * paints the shell behind it).
 */
export const THEME_LAYER_PROPERTY_NAMES = [
  "--rb-backing-header-color",
  "--rb-backing-header-image",
  "--rb-backing-rail-color",
  "--rb-backing-rail-image",
  "--rb-backing-vote-strip-color",
  "--rb-backing-vote-strip-image",
  "--rb-view-fill",
] as const;
export type ThemeLayerPropertyName = (typeof THEME_LAYER_PROPERTY_NAMES)[number];

/**
 * Each region's backing after the defaults:
 * - an explicit `backing.<region>` wins;
 * - no background image: header and rail are `solid` `--rb-surface`, the
 *   vote strip `none` (today's look exactly);
 * - a background image: header and rail are `solid` `--rb-canvas` at 70 %,
 *   the vote strip `none`.
 */
export function resolveThemeBacking(manifest: ThemeManifest): Record<ThemeBackingRegion, ThemeBacking> {
  const hasImage = Boolean(manifest.images?.background);
  const bar: ThemeBacking = hasImage
    ? { kind: "solid", color: colorWithAlpha(manifest.tokens["--rb-canvas"], DEFAULT_BACKING_ALPHA_OVER_IMAGE) }
    : { kind: "solid", color: manifest.tokens["--rb-surface"] };
  const defaults: Record<ThemeBackingRegion, ThemeBacking> = { header: bar, rail: bar, voteStrip: { kind: "none" } };
  const set = manifest.backing ?? {};
  return {
    header: set.header ?? defaults.header,
    rail: set.rail ?? defaults.rail,
    voteStrip: set.voteStrip ?? defaults.voteStrip,
  };
}

/** The colour layer and image layer for one backing. */
export function backingLayers(backing: ThemeBacking): { color: string; image: string } {
  switch (backing.kind) {
    case "none":
      return { color: "transparent", image: "none" };
    case "solid":
      return { color: backing.color, image: "none" };
    case "gradient": {
      const to = backing.direction === "down" ? "to bottom" : "to right";
      return { color: "transparent", image: `linear-gradient(${to}, ${backing.from}, ${backing.to})` };
    }
  }
}

/** The shell-layer properties for `:root` (THEME_LAYER_PROPERTY_NAMES). */
export function resolveThemeLayerProperties(manifest: ThemeManifest): Record<ThemeLayerPropertyName, string> {
  const resolved = resolveThemeBacking(manifest);
  const out = {} as Record<ThemeLayerPropertyName, string>;
  for (const region of THEME_BACKING_REGIONS) {
    const { color, image } = backingLayers(resolved[region]);
    const stem = BACKING_PROPERTY_STEM[region];
    out[`--rb-backing-${stem}-color` as ThemeLayerPropertyName] = color;
    out[`--rb-backing-${stem}-image` as ThemeLayerPropertyName] = image;
  }
  out["--rb-view-fill"] = manifest.images?.background ? "transparent" : manifest.tokens["--rb-canvas"];
  return out;
}

export const themeManifestSchema = z.object({
  engineVersion: z.number().int().positive(),
  id: themeIdSchema,
  name: z.string().min(1).max(40),
  tokens: themeTokensSchema,
  /** v2, optional: absent = Default's font. */
  font: themeFontSchema.optional(),
  /** v2, optional: absent = Default's shape. */
  shape: themeShapeSchema.optional(),
  /** v2, optional: each slot separate; absent = the flat colour token. */
  images: themeImagesSchema.optional(),
  /** v2, optional: 1–5 path strings on a 24×24 viewBox, filled with
   *  `--rb-confetti-1…5` in rotation; absent = squares and circles. */
  confettiShapes: z.array(confettiShapeSchema).min(1).max(CONFETTI_SHAPE_MAX_COUNT).optional(),
  /** v3, optional: per-region text backing; absent = the defaults in
   *  `resolveThemeBacking`. */
  backing: themeBackingBlockSchema.optional(),
});
export type ThemeManifest = z.infer<typeof themeManifestSchema>;

/**
 * The backfill rule: every field newer than manifest v1 is optional, and an
 * absent one takes Default's value. Returns the custom properties to set on
 * `:root` alongside the colour tokens.
 */
export function resolveThemeStyle(manifest: ThemeManifest): Record<ThemeStylePropertyName, string> {
  const font = manifest.font ?? DEFAULT_THEME_FONT;
  const shape = manifest.shape ?? DEFAULT_THEME_SHAPE;
  return {
    "--rb-font-family": fontFamilyValue(font),
    "--rb-radius-scale": String(shape.radiusScale),
    "--rb-shadow-softness": String(shape.shadowSoftness),
  };
}

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
