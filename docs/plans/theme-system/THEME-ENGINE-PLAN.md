# Theme Engine (Phase 1, Slice 1) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship a validated theme engine with a settings-menu picker, config-file persistence, a no-flash boot cache, and two built-in themes (Default, Deep Space), without changing the Default look.

**Architecture:** The shadcn tokens in `:root` become aliases of the `--rb-*` palette, so a theme is one flat map of 76 color tokens validated by a Zod schema in `shared/`. A pure engine module applies a manifest via `setProperty` on `<html>`, notifies subscribers, and mirrors the result to `localStorage` so an inline boot script can repaint before React mounts. The active theme id lives in `data/config/dashboard.json` as a lenient optional field written through the shell's existing optimistic config writer.

**Tech Stack:** TypeScript, React 18, Zod 3.24, Vite, vitest (node environment, no DOM), Tailwind reading `var(--x)`.

**Spec:** [THEME-ENGINE-SPEC.md](THEME-ENGINE-SPEC.md). Read it first. Decision record: `docs/decisions/0009`.

## Global Constraints

- **Default stays visually identical.** Every `--rb-*` value in `:root` keeps its current literal; only the shadcn block is rewritten to aliases. The documented deltas (spec "Fidelity") are the only allowed changes.
- **Every token required.** `THEME_TOKEN_NAMES` has exactly 76 entries (the 75 existing `--rb-*` names plus `--rb-ink-tertiary`). The tokens schema is `.strict()`.
- **Color grammar only:** `#rrggbb`, `#rrggbbaa`, `rgb(r, g, b)`, `rgba(r, g, b, a)`. No `var()`, no named colors, no `url()`.
- **Config field is lenient:** `theme: themeIdSchema.optional().catch(undefined)`. A bad value must never invalidate `dashboard.json`.
- **Cache key:** `localStorage["rootboard.theme-cache"]`. The inline boot script only ever touches properties matching `/^--rb-[a-z0-9-]+$/`.
- **Contrast guard:** new themes ≥ 4.5 on every pair in the matrix; Default is grandfathered at its measured ratios (pinned, no regression). This amends spec §8 (Task 5 updates the spec text).
- **Kiosk touch targets:** picker rows use the existing `.touch-button` class (48 px minimum; the ≥1920 px coarse-pointer media rule in `index.css` overrides it to 44 px).
- **Tests:** vitest, `client/src/**/*.spec.ts`, node environment, no React renderer. Run one file with `npx vitest run <path>`; run everything with `npm test`. Type-check with `npm run check`.
- **Never** `git add -A`. Stage named files. The gitleaks hook runs on commit.
- **Docs are public.** No hostnames, IPs, names, or business info in any file, comment, or commit message.
- **Line endings:** files in this repo are CRLF on disk except `*.sh` and `.githooks/*`. Don't fight it; git normalizes.

---

## File map

| File | Responsibility |
|---|---|
| `client/src/lib/color-utils.ts` | add `relativeLuminance`, `contrastRatio` |
| `shared/theme-manifest.ts` (new) | `THEME_ENGINE_VERSION`, `THEME_TOKEN_NAMES`, `themeIdSchema`, `cssColorSchema`, `themeTokensSchema`, `themeManifestSchema`, `validateThemeManifest` |
| `client/src/lib/theme-stylesheet.ts` (new) | pure parser for `:root` in `index.css` (used by two specs) |
| `client/src/index.css` | shadcn block → aliases; `--rb-ink-tertiary`; `.dark` comment |
| `client/src/themes/default.ts` (new) | the Default manifest — the copyable authoring reference |
| `client/src/themes/deep-space.ts` (new) | the dark proof theme |
| `client/src/themes/index.ts` (new) | `BUILTIN_THEMES: readonly unknown[]` |
| `client/src/lib/theme-engine.ts` (new) | `loadBuiltinThemes`, `resolveTheme`, `applyTheme`, `subscribeTheme`, cache read/write |
| `shared/dashboard-config.ts` | `theme` field |
| `client/index.html` | inline boot script `#rb-theme-boot` |
| `client/src/hooks/use-theme.ts` (new) | React wiring: resolve on config change, apply in effect, `setTheme` |
| `client/src/lib/widget-host-services.ts` | `theme.subscribe` → `subscribeTheme` |
| `client/src/components/app-shell.tsx` | call `useTheme`, build picker entries, pass props |
| `client/src/components/calendar/settings-menu.tsx` | "Theme" and "Theme Errors" sections |
| `docs/plans/widget-system/CONTRACT.md`, `docs/SPEC.md`, this folder's plan/spec | wording + status |

---

### Task 1: `contrastRatio` in color-utils

**Files:**
- Modify: `client/src/lib/color-utils.ts` (append)
- Test: `client/src/lib/color-utils.spec.ts` (new)

**Interfaces:**
- Produces: `relativeLuminance(hex: string): number`, `contrastRatio(hexA: string, hexB: string): number` (WCAG 2.x, symmetric, range 1–21). Both take `#rrggbb` only: the existing `hexToRgb` returns a blue fallback for any other length, so the contrast spec in Task 5 asserts the 6-digit shape before measuring.

- [ ] **Step 1: Write the failing test**

```ts
// client/src/lib/color-utils.spec.ts
import { describe, expect, test } from "vitest";
import { contrastRatio, relativeLuminance } from "./color-utils";

describe("relativeLuminance", () => {
  test("black is 0, white is 1", () => {
    expect(relativeLuminance("#000000")).toBe(0);
    expect(relativeLuminance("#ffffff")).toBeCloseTo(1, 6);
  });
});

describe("contrastRatio", () => {
  test("white on black is 21:1", () => {
    expect(contrastRatio("#ffffff", "#000000")).toBeCloseTo(21, 2);
  });
  test("same color is 1:1", () => {
    expect(contrastRatio("#2b3038", "#2b3038")).toBe(1);
  });
  test("is symmetric", () => {
    expect(contrastRatio("#2b3038", "#f7f6f3")).toBeCloseTo(contrastRatio("#f7f6f3", "#2b3038"), 10);
  });
  test("Default ink on Default canvas is about 12.3:1 (pinned reference value)", () => {
    expect(contrastRatio("#2b3038", "#f7f6f3")).toBeCloseTo(12.28, 1);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run client/src/lib/color-utils.spec.ts`
Expected: FAIL — `contrastRatio` / `relativeLuminance` are not exported.

- [ ] **Step 3: Append the implementation**

Append to `client/src/lib/color-utils.ts`:

```ts

// --- WCAG contrast (theme engine contrast guard) -------------------------

function channelLuminance(channel: number): number {
  const s = channel / 255;
  return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
}

/** WCAG 2.x relative luminance of a `#rrggbb` color, 0 (black) .. 1 (white). */
export function relativeLuminance(hex: string): number {
  const { r, g, b } = hexToRgb(hex);
  return 0.2126 * channelLuminance(r) + 0.7152 * channelLuminance(g) + 0.0722 * channelLuminance(b);
}

/** WCAG 2.x contrast ratio between two `#rrggbb` colors, 1 .. 21. Symmetric. */
export function contrastRatio(hexA: string, hexB: string): number {
  const a = relativeLuminance(hexA);
  const b = relativeLuminance(hexB);
  const [hi, lo] = a > b ? [a, b] : [b, a];
  return (hi + 0.05) / (lo + 0.05);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run client/src/lib/color-utils.spec.ts`
Expected: 5 passed.

- [ ] **Step 5: Commit**

```bash
git add client/src/lib/color-utils.ts client/src/lib/color-utils.spec.ts
git commit -m "feat(theme): add WCAG contrastRatio helper"
```

---

### Task 2: Theme manifest schema in `shared/`

**Files:**
- Create: `shared/theme-manifest.ts`
- Test: `client/src/lib/theme-manifest.spec.ts` (new; lives under client so vitest's include glob picks it up)

**Interfaces:**
- Consumes: nothing.
- Produces:
  - `THEME_ENGINE_VERSION = 1`
  - `THEME_TOKEN_NAMES: readonly [ ...76 literal strings ]`, `ThemeTokenName`
  - `themeIdSchema` (same regex as `widgetIdSchema`)
  - `cssColorSchema`, `themeTokensSchema`, `ThemeTokens`
  - `themeManifestSchema`, `ThemeManifest = { engineVersion: number; id: string; name: string; tokens: ThemeTokens }`
  - `NEWER_ENGINE_MESSAGE = "built for a newer Rootboard"`
  - `validateThemeManifest(raw: unknown): { ok: true; manifest: ThemeManifest } | { ok: false; message: string }`

- [ ] **Step 1: Write the failing test**

```ts
// client/src/lib/theme-manifest.spec.ts
import { describe, expect, test } from "vitest";
import {
  NEWER_ENGINE_MESSAGE,
  THEME_ENGINE_VERSION,
  THEME_TOKEN_NAMES,
  themeManifestSchema,
  validateThemeManifest,
} from "@shared/theme-manifest";

function fullTokens(): Record<string, string> {
  return Object.fromEntries(THEME_TOKEN_NAMES.map((n) => [n, "#123456"]));
}

function manifest(overrides: Record<string, unknown> = {}) {
  return { engineVersion: 1, id: "test-theme", name: "Test", tokens: fullTokens(), ...overrides };
}

describe("THEME_TOKEN_NAMES", () => {
  test("has 76 unique --rb- names including --rb-ink-tertiary", () => {
    expect(THEME_TOKEN_NAMES).toHaveLength(76);
    expect(new Set(THEME_TOKEN_NAMES).size).toBe(76);
    for (const n of THEME_TOKEN_NAMES) expect(n).toMatch(/^--rb-[a-z0-9-]+$/);
    expect(THEME_TOKEN_NAMES).toContain("--rb-ink-tertiary");
  });
});

describe("themeManifestSchema", () => {
  test("accepts a complete manifest", () => {
    expect(themeManifestSchema.safeParse(manifest()).success).toBe(true);
  });

  test("rejects a manifest missing one token, naming it", () => {
    const tokens = fullTokens();
    delete tokens["--rb-badge"];
    const result = validateThemeManifest(manifest({ tokens }));
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.message).toContain("--rb-badge");
  });

  test("rejects an unknown token key (typo protection)", () => {
    const tokens = { ...fullTokens(), "--rb-bagde": "#123456" };
    expect(themeManifestSchema.safeParse(manifest({ tokens })).success).toBe(false);
  });

  test("rejects var(), named colors and url()", () => {
    for (const bad of ["var(--rb-ink)", "red", "url(x.png)", "#12345", "#ggghhh", "hsl(1, 2%, 3%)"]) {
      const tokens = { ...fullTokens(), "--rb-canvas": bad };
      expect(themeManifestSchema.safeParse(manifest({ tokens })).success, bad).toBe(false);
    }
  });

  test("accepts #rrggbb, #rrggbbaa, rgb() and rgba()", () => {
    for (const good of ["#0b1220", "#0B1220", "#0b122080", "rgb(0, 0, 0)", "rgba(255, 255, 255, 0.5)", "rgba(0,0,0,1)"]) {
      const tokens = { ...fullTokens(), "--rb-canvas": good };
      expect(themeManifestSchema.safeParse(manifest({ tokens })).success, good).toBe(true);
    }
  });

  test("rejects a bad id", () => {
    expect(themeManifestSchema.safeParse(manifest({ id: "Bad Id" })).success).toBe(false);
    expect(themeManifestSchema.safeParse(manifest({ id: "../x" })).success).toBe(false);
  });

  test("validateThemeManifest rejects a newer engineVersion with the standard message", () => {
    const result = validateThemeManifest(manifest({ engineVersion: THEME_ENGINE_VERSION + 1 }));
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.message).toContain(NEWER_ENGINE_MESSAGE);
  });

  test("validateThemeManifest returns the parsed manifest on success", () => {
    const result = validateThemeManifest(manifest());
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.manifest.id).toBe("test-theme");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run client/src/lib/theme-manifest.spec.ts`
Expected: FAIL — cannot resolve `@shared/theme-manifest`.

- [ ] **Step 3: Create the schema module**

```ts
// shared/theme-manifest.ts
import { z } from "zod";

/**
 * Theme engine version the app implements. A manifest with `engineVersion`
 * greater than this is rejected with NEWER_ENGINE_MESSAGE (same policy as
 * widgets' apiVersion). Bump when THEME_TOKEN_NAMES gains or loses a name.
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
] as const;

export type ThemeTokenName = (typeof THEME_TOKEN_NAMES)[number];

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
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run client/src/lib/theme-manifest.spec.ts`
Expected: 9 passed. Note: for a missing key Zod's issue path is `tokens.--rb-badge`, so the message contains the token name.

- [ ] **Step 5: Type-check and commit**

Run: `npm run check` — Expected: no errors.

```bash
git add shared/theme-manifest.ts client/src/lib/theme-manifest.spec.ts
git commit -m "feat(theme): add theme manifest schema (every token required)"
```

---

### Task 3: Stylesheet — alias shadcn tokens, add `--rb-ink-tertiary`, guard test

**Files:**
- Create: `client/src/lib/theme-stylesheet.ts`
- Modify: `client/src/index.css:6-27` (shadcn block), `:69` region (Ink group), `:138` (`.dark`)
- Test: `client/src/lib/theme-stylesheet.spec.ts` (new)

**Interfaces:**
- Produces: `stripCssComments(css)`, `extractRootBlock(css)`, `parseRootDeclarations(css): Map<string,string>`, `resolveRootTokens(css): Record<string,string>` (only `--rb-*`, with `var()` references resolved to literals). Task 4's fidelity test uses `resolveRootTokens`.

- [ ] **Step 1: Write the failing test**

```ts
// client/src/lib/theme-stylesheet.spec.ts
import fs from "fs";
import path from "path";
import { describe, expect, test } from "vitest";
import { THEME_TOKEN_NAMES } from "@shared/theme-manifest";
import { parseRootDeclarations, resolveRootTokens } from "./theme-stylesheet";

const css = fs.readFileSync(path.resolve(import.meta.dirname, "../index.css"), "utf-8");

const SHADCN_TOKENS = [
  "--background", "--foreground", "--muted", "--muted-foreground",
  "--popover", "--popover-foreground", "--card", "--card-foreground",
  "--border", "--input", "--primary", "--primary-foreground",
  "--secondary", "--secondary-foreground", "--accent", "--accent-foreground",
  "--destructive", "--destructive-foreground", "--ring",
];

describe("index.css :root vs THEME_TOKEN_NAMES", () => {
  const decls = parseRootDeclarations(css);

  test("the --rb-* names declared in :root equal THEME_TOKEN_NAMES exactly", () => {
    const declared = [...decls.keys()].filter((k) => k.startsWith("--rb-")).sort();
    expect(declared).toEqual([...THEME_TOKEN_NAMES].sort());
  });

  test("every shadcn token is an alias of a --rb-* token", () => {
    for (const name of SHADCN_TOKENS) {
      expect(decls.get(name), name).toMatch(/^var\(--rb-[a-z0-9-]+\)$/);
    }
  });

  test("--rb-ink-tertiary carries the former --muted-foreground value", () => {
    expect(decls.get("--rb-ink-tertiary")).toBe("#787f8c");
  });

  test("resolveRootTokens yields a literal for every token", () => {
    const resolved = resolveRootTokens(css);
    for (const name of THEME_TOKEN_NAMES) {
      expect(resolved[name], name).toMatch(/^(#[0-9a-f]{6}|rgba?\()/i);
    }
    expect(resolved["--rb-nav-active-bg"]).toBe("#fdeae8"); // var(--rb-accent-wash) resolved
  });
});

describe("parser edge cases", () => {
  test("ignores comments and resolves chained var() references", () => {
    const sample = `:root {\n  --rb-a: #111111; /* c */\n  --rb-b: var(--rb-a);\n  --rb-c: var(--rb-b);\n  --x: var(--rb-a);\n}\n.dark {\n  --rb-a: #000000;\n}`;
    expect(resolveRootTokens(sample)).toEqual({ "--rb-a": "#111111", "--rb-b": "#111111", "--rb-c": "#111111" });
  });

  test("throws on a dangling reference", () => {
    expect(() => resolveRootTokens(`:root {\n  --rb-a: var(--rb-nope);\n}`)).toThrow(/--rb-nope/);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run client/src/lib/theme-stylesheet.spec.ts`
Expected: FAIL — module `./theme-stylesheet` not found.

- [ ] **Step 3: Write the parser**

```ts
// client/src/lib/theme-stylesheet.ts
/**
 * Tiny, dependency-free reader for the `:root` block of client/src/index.css.
 * Used ONLY by specs: (a) the guard that keeps THEME_TOKEN_NAMES and the
 * stylesheet in lockstep, (b) the Default-theme fidelity check. Not shipped
 * in the client bundle path (nothing under components/ imports it).
 */

export function stripCssComments(css: string): string {
  return css.replace(/\/\*[\s\S]*?\*\//g, "");
}

/** The body of the first `:root { … }` block (comments removed). */
export function extractRootBlock(css: string): string {
  const match = /:root\s*\{([\s\S]*?)\n\}/.exec(stripCssComments(css));
  if (!match) throw new Error(":root block not found");
  return match[1];
}

/** name -> raw value (trimmed, no trailing semicolon) for every custom property in :root. */
export function parseRootDeclarations(css: string): Map<string, string> {
  const out = new Map<string, string>();
  for (const m of extractRootBlock(css).matchAll(/(--[a-z0-9-]+)\s*:\s*([^;]+);/g)) {
    out.set(m[1], m[2].trim());
  }
  return out;
}

/** Every `--rb-*` token in :root with `var(--x)` references followed to a literal. */
export function resolveRootTokens(css: string): Record<string, string> {
  const decls = parseRootDeclarations(css);
  const resolve = (name: string, seen: Set<string>): string => {
    const value = decls.get(name);
    if (value === undefined) throw new Error(`undefined token ${name}`);
    const ref = /^var\((--[a-z0-9-]+)\)$/.exec(value);
    if (!ref) return value;
    if (seen.has(name)) throw new Error(`cycle at ${name}`);
    seen.add(name);
    return resolve(ref[1], seen);
  };
  const out: Record<string, string> = {};
  for (const name of decls.keys()) {
    if (name.startsWith("--rb-")) out[name] = resolve(name, new Set());
  }
  return out;
}
```

- [ ] **Step 4: Run test — expect only the stylesheet assertions to fail**

Run: `npx vitest run client/src/lib/theme-stylesheet.spec.ts`
Expected: parser edge cases pass; "equal THEME_TOKEN_NAMES" fails (missing `--rb-ink-tertiary`), "alias" fails (shadcn values are `hsl(...)`), "ink-tertiary" fails.

- [ ] **Step 5: Rewrite the shadcn block in `client/src/index.css`**

Replace lines 6–27 (from `:root {` through `/* Rootboard palette */`) with:

```css
:root {
  /* shadcn tokens are ALIASES of the Rootboard palette below. The theme
     engine sets only --rb-* (docs/plans/theme-system/THEME-ENGINE-SPEC.md
     §1); these follow automatically. Never put a literal color here —
     it would be invisible to themes. Former literal values are recorded
     in the spec's "Fidelity" table. */
  --background: var(--rb-canvas);
  --foreground: var(--rb-ink);
  --muted: var(--rb-chip);
  --muted-foreground: var(--rb-ink-tertiary);
  --popover: var(--rb-surface);
  --popover-foreground: var(--rb-ink);
  --card: var(--rb-surface);
  --card-foreground: var(--rb-ink);
  --border: var(--rb-field-border);
  --input: var(--rb-field-border);
  --primary: var(--rb-info);
  --primary-foreground: var(--rb-on-color-ink);
  --secondary: var(--rb-chip);
  --secondary-foreground: var(--rb-ink);
  --accent: var(--rb-chip);
  --accent-foreground: var(--rb-ink);
  --destructive: var(--rb-danger);
  --destructive-foreground: var(--rb-on-color-ink);
  --ring: var(--rb-ink);
  --radius: 0.9rem;

  /* Rootboard palette */
```

Keep every line after that unchanged, except: in the `/* ===== Ink ===== */` group, add one line directly after `--rb-ink-secondary`:

```css
  --rb-ink-tertiary: #787f8c;    /* former shadcn --muted-foreground; quieter than ink-secondary */
```

And directly above `.dark {` add:

```css
/* DEAD BLOCK — `darkMode: ["class"]` is configured in tailwind.config.ts but
   nothing ever adds the `dark` class, so these never apply. Dark looks are
   themes now (Deep Space). Left in place deliberately; do not extend and do
   not rely on it. */
```

- [ ] **Step 6: Run the guard test — expect all green**

Run: `npx vitest run client/src/lib/theme-stylesheet.spec.ts`
Expected: 6 passed.

- [ ] **Step 7: Visual sanity on the dev server**

Start the dev server (Browser pane / `preview_start` with the project's launch config, or `npm run dev`). Load the app. Open the settings popover and one dialog (e.g. the calendar "remove" confirm). Expected: nothing visibly changed from before — same off-white canvas, white cards, ink text. The only shift you might notice is the shadcn `primary` blue in primitives being a touch deeper (`#2563eb`); that is the accepted delta.

- [ ] **Step 8: Commit**

```bash
git add client/src/index.css client/src/lib/theme-stylesheet.ts client/src/lib/theme-stylesheet.spec.ts
git commit -m "refactor(theme): alias shadcn tokens onto --rb-* palette; add --rb-ink-tertiary; guard test"
```

---

### Task 4: Default theme module + fidelity test

**Files:**
- Create: `client/src/themes/default.ts`, `client/src/themes/index.ts`
- Test: `client/src/themes/default.spec.ts` (new)

**Interfaces:**
- Produces: `defaultTheme: ThemeManifest` (id `"default"`), `BUILTIN_THEMES: readonly unknown[]` (Task 5 appends Deep Space).

- [ ] **Step 1: Write the failing test**

```ts
// client/src/themes/default.spec.ts
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run client/src/themes/default.spec.ts`
Expected: FAIL — `./default` not found.

- [ ] **Step 3: Write the Default manifest (copyable authoring reference)**

Values are the `:root` literals with every `var()` resolved. Grouped and commented the same way as `:root` so an author can copy this whole file. The test in Step 1 fails if any value drifts from the stylesheet.

```ts
// client/src/themes/default.ts
import type { ThemeManifest } from "@shared/theme-manifest";

/**
 * DEFAULT THEME — the app's built-in look, and the authoring reference.
 *
 * To make a new theme: copy this file, change `id` and `name`, then edit
 * only the colors you want. Every token is required (the schema rejects a
 * missing one), so starting from a complete copy is the intended workflow.
 * Plain literals only — no var(), no helpers — so the file stays copyable.
 *
 * Contrast: new themes must meet WCAG AA (4.5:1) on the pairs listed in
 * client/src/themes/contrast.spec.ts; Default is grandfathered at its
 * measured values there.
 */
export const defaultTheme: ThemeManifest = {
  engineVersion: 1,
  id: "default",
  name: "Default",
  tokens: {
    // ===== Core palette =====
    "--rb-canvas": "#f7f6f3",          // page background
    "--rb-surface": "#ffffff",         // cards, popovers, dialogs
    "--rb-ink": "#2b3038",             // primary text
    "--rb-muted": "#9aa0aa",           // decorative muted text (not body copy)
    "--rb-faint": "#b0b5be",           // faintest icon/ink
    "--rb-chip": "#f1efea",            // chip / secondary control fill
    "--rb-chip-hover": "#e7e4dd",
    "--rb-accent": "#f2655a",          // brand accent (coral)
    "--rb-accent-hover": "#e8554a",
    "--rb-today-wash": "#fff1ea",      // today cell tint
    "--rb-today-col-wash": "#fff8f2",  // today column tint (week view)
    "--rb-grid-line": "#ededed",

    // ===== Nav + badge =====
    "--rb-nav-active-bg": "#fdeae8",   // = accent-wash
    "--rb-nav-inactive-ink": "#5b626d",// = ink-secondary
    "--rb-badge": "#ea8c00",           // nav-rail count badge
    "--rb-badge-ink": "#ffffff",       // = on-color-ink
    "--rb-shadow-soft": "rgba(0, 0, 0, 0.05)",
    "--rb-scrollbar-thumb": "#d9d5cc",
    "--rb-scrollbar-thumb-hover": "#c4bfb2",
    "--rb-screensaver-bg-1": "#0f0f0f",
    "--rb-screensaver-bg-2": "#1a1a1a",
    "--rb-confetti-1": "#f2655a",
    "--rb-confetti-2": "#f5a623",
    "--rb-confetti-3": "#16a34a",
    "--rb-confetti-4": "#2563eb",
    "--rb-confetti-5": "#9333ea",

    // ===== Ink =====
    "--rb-ink-secondary": "#5b626d",   // control + label ink
    "--rb-ink-tertiary": "#787f8c",    // quiet helper text (shadcn muted-foreground)
    "--rb-ink-soft": "#3a4049",        // names, chips, status
    "--rb-ink-disabled": "#b8bcc4",    // past / out-of-month / disabled
    "--rb-on-color-ink": "#ffffff",    // text + icons on any colored fill

    // ===== Surfaces + borders =====
    "--rb-surface-sunken": "#fbfaf7",  // text inputs, list-row wash
    "--rb-cell-weekend-bg": "#fbfaf7",
    "--rb-cell-inactive-bg": "#f0eee9",
    "--rb-field-border": "#e7e4dd",    // input borders; shadcn --border/--input
    "--rb-border-strong": "#d9d5cc",
    "--rb-accent-wash": "#fdeae8",     // accent tint fill

    // ===== Buttons =====
    "--rb-btn-dark-bg": "#2b3038",     // high-emphasis button fill (= ink in Default)
    "--rb-btn-dark-hover-bg": "#3a4049",

    // ===== Status: danger =====
    "--rb-danger": "#e11d48",
    "--rb-danger-hover": "#c9163d",
    "--rb-danger-ink": "#be123c",
    "--rb-danger-wash": "#fce4ea",
    "--rb-danger-wash-hover": "#f9d2dd",
    "--rb-danger-border": "#f9d2dd",   // = danger-wash-hover

    // ===== Status: success =====
    "--rb-success": "#16a34a",
    "--rb-success-hover": "#15803d",
    "--rb-success-ink": "#15803d",     // = success-hover
    "--rb-success-wash": "#e3f5ea",

    // ===== Status: info =====
    "--rb-info": "#2563eb",            // also shadcn --primary
    "--rb-info-hover": "#1e40af",
    "--rb-info-ink": "#1e40af",        // = info-hover
    "--rb-info-wash": "#eef4ff",
    "--rb-info-wash-hover": "#e1ebff",
    "--rb-info-border": "#cbdcff",

    // ===== Status: warning =====
    "--rb-warn": "#ea8c00",            // = badge
    "--rb-warn-ink": "#b45309",
    "--rb-warn-wash": "#fdf0db",
    "--rb-warn-border": "#f4dcae",

    // ===== Shadows + on-tint overlays =====
    "--rb-shadow-card": "rgba(0, 0, 0, 0.06)",
    "--rb-shadow-accent": "rgba(242, 101, 90, 0.35)",
    "--rb-shadow-panel": "rgba(0, 0, 0, 0.28)",
    "--rb-on-tint-border": "rgba(255, 255, 255, 0.9)",
    "--rb-on-tint-ring": "rgba(255, 255, 255, 0.7)",
    "--rb-on-tint-fill": "rgba(255, 255, 255, 0.65)",
    "--rb-on-tint-chip": "rgba(255, 255, 255, 0.6)",
    "--rb-on-tint-hover-strong": "rgba(255, 255, 255, 0.55)",
    "--rb-on-tint-hover": "rgba(255, 255, 255, 0.5)",

    // ===== On-screen keyboard =====
    "--rb-key-panel-bg": "#e8e6e1",
    "--rb-key-panel-border": "#c9c4b8",
    "--rb-key-border": "#d5d0c6",
    "--rb-key-ctrl-bg": "#d9d5cc",     // = scrollbar-thumb
    "--rb-key-ctrl-active-bg": "#cbc6bb",
    "--rb-key-active-bg": "#2b3038",   // = btn-dark-bg

    // ===== Screensaver =====
    "--rb-screensaver-logo-glow": "rgba(70, 130, 180, 0.3)",
    "--rb-power-saving-bg": "#000000",
  },
};
```

```ts
// client/src/themes/index.ts
import { defaultTheme } from "./default";

/**
 * Built-in theme manifests, RAW. Typed as unknown on purpose: validation
 * happens in client/src/lib/theme-engine.ts `loadBuiltinThemes`, so a
 * malformed module is reported in the settings menu ("Theme Errors")
 * instead of throwing at import time and taking the kiosk down.
 */
export const BUILTIN_THEMES: readonly unknown[] = [defaultTheme];
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run client/src/themes/default.spec.ts`
Expected: 3 passed. If the fidelity test fails, the diff it prints names the drifted token — fix the value in `default.ts`, never in `index.css`.

- [ ] **Step 5: Commit**

```bash
git add client/src/themes/default.ts client/src/themes/index.ts client/src/themes/default.spec.ts
git commit -m "feat(theme): Default theme manifest (authoring reference) + fidelity test"
```

---

### Task 5: Deep Space theme + contrast guard (grandfathered Default)

**Files:**
- Create: `client/src/themes/deep-space.ts`
- Modify: `client/src/themes/index.ts`
- Test: `client/src/themes/contrast.spec.ts` (new)
- Modify: `docs/plans/theme-system/THEME-ENGINE-SPEC.md` §8 (amend the rule)

**Interfaces:**
- Produces: `deepSpaceTheme: ThemeManifest` (id `"deep-space"`); `BUILTIN_THEMES = [defaultTheme, deepSpaceTheme]`.

**Why the rule changes:** measured with Task 1's helper, Default fails a flat 4.5 bar on eight pairs (e.g. white on coral 3.10, white on amber badge 2.55, ink-tertiary on canvas 3.73). Default is shipped and must not change, so it is pinned at its measured values (no regression allowed) while every other theme must meet AA.

- [ ] **Step 1: Write the failing test**

```ts
// client/src/themes/contrast.spec.ts
import { describe, expect, test } from "vitest";
import { validateThemeManifest, type ThemeManifest, type ThemeTokenName } from "@shared/theme-manifest";
import { contrastRatio } from "@/lib/color-utils";
import { BUILTIN_THEMES } from "./index";

/** [ink token, background token] pairs that carry text or icons. */
const PAIRS: ReadonlyArray<readonly [ThemeTokenName, ThemeTokenName]> = [
  ["--rb-ink", "--rb-canvas"],
  ["--rb-ink", "--rb-surface"],
  ["--rb-ink-secondary", "--rb-canvas"],
  ["--rb-ink-secondary", "--rb-surface"],
  ["--rb-ink-tertiary", "--rb-canvas"],
  ["--rb-ink-tertiary", "--rb-surface"],
  ["--rb-ink-soft", "--rb-canvas"],
  ["--rb-ink-soft", "--rb-surface"],
  ["--rb-nav-inactive-ink", "--rb-canvas"],
  ["--rb-on-color-ink", "--rb-accent"],
  ["--rb-on-color-ink", "--rb-badge"],
  ["--rb-on-color-ink", "--rb-danger"],
  ["--rb-on-color-ink", "--rb-success"],
  ["--rb-on-color-ink", "--rb-info"],
  ["--rb-on-color-ink", "--rb-btn-dark-bg"],
  ["--rb-badge-ink", "--rb-badge"],
  ["--rb-danger-ink", "--rb-danger-wash"],
  ["--rb-success-ink", "--rb-success-wash"],
  ["--rb-info-ink", "--rb-info-wash"],
  ["--rb-warn-ink", "--rb-warn-wash"],
];

const AA = 4.5;

/**
 * Default is shipped and must not change (value only accrues), so it is
 * grandfathered: these are its MEASURED ratios rounded down. The rule is
 * "no regression", not "meets AA". Every other theme must meet AA on every
 * pair. If you ever raise one of these floors, you improved Default — good;
 * never lower one.
 */
const DEFAULT_FLOORS: Partial<Record<string, number>> = {
  "--rb-ink-tertiary/--rb-canvas": 3.7,
  "--rb-ink-tertiary/--rb-surface": 4.0,
  "--rb-on-color-ink/--rb-accent": 3.1,
  "--rb-on-color-ink/--rb-badge": 2.5,
  "--rb-on-color-ink/--rb-success": 3.3,
  "--rb-badge-ink/--rb-badge": 2.5,
  "--rb-success-ink/--rb-success-wash": 4.4,
  "--rb-warn-ink/--rb-warn-wash": 4.4,
};

function themes(): ThemeManifest[] {
  return BUILTIN_THEMES.map((raw) => {
    const r = validateThemeManifest(raw);
    if (!r.ok) throw new Error(r.message);
    return r.manifest;
  });
}

describe("built-in theme contrast", () => {
  for (const theme of themes()) {
    describe(theme.id, () => {
      for (const [ink, bg] of PAIRS) {
        const key = `${ink}/${bg}`;
        const floor = theme.id === "default" ? (DEFAULT_FLOORS[key] ?? AA) : AA;
        test(`${key} >= ${floor}`, () => {
          const a = theme.tokens[ink];
          const b = theme.tokens[bg];
          expect(a, `${ink} must be #rrggbb for contrast checks`).toMatch(/^#[0-9a-f]{6}$/i);
          expect(b, `${bg} must be #rrggbb for contrast checks`).toMatch(/^#[0-9a-f]{6}$/i);
          expect(contrastRatio(a, b)).toBeGreaterThanOrEqual(floor);
        });
      }
    });
  }

  test("there is a deep-space theme", () => {
    expect(themes().map((t) => t.id)).toContain("deep-space");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run client/src/themes/contrast.spec.ts`
Expected: Default's 20 pairs pass; "there is a deep-space theme" fails.

- [ ] **Step 3: Write Deep Space**

Original retro-console look: near-black navy canvas, slightly lifted surfaces, deep cyan accent (dark enough for white text), amber badge, cool inks. Every pair below was checked ≥ 4.5 with `contrastRatio` before this plan was written.

```ts
// client/src/themes/deep-space.ts
import type { ThemeManifest } from "@shared/theme-manifest";

/**
 * DEEP SPACE — the built-in dark theme. Original design; no franchise
 * design language. Same file shape as default.ts so the two diff cleanly.
 *
 * Contrast notes: `--rb-on-color-ink` stays light, so every colored fill
 * it sits on (accent, badge, danger, success, info, btn-dark) is kept deep
 * enough for 4.5:1. That is why the accent is a deep cyan rather than a
 * neon one; the neon lives in the confetti and the logo glow.
 */
export const deepSpaceTheme: ThemeManifest = {
  engineVersion: 1,
  id: "deep-space",
  name: "Deep Space",
  tokens: {
    // ===== Core palette =====
    "--rb-canvas": "#0b1220",
    "--rb-surface": "#141c2e",
    "--rb-ink": "#e6edf7",
    "--rb-muted": "#6b7890",
    "--rb-faint": "#4a5568",
    "--rb-chip": "#1c2740",
    "--rb-chip-hover": "#253352",
    "--rb-accent": "#0e7490",
    "--rb-accent-hover": "#155e75",
    "--rb-today-wash": "#10303f",
    "--rb-today-col-wash": "#0f2431",
    "--rb-grid-line": "#1f2a40",

    // ===== Nav + badge =====
    "--rb-nav-active-bg": "#10303f",
    "--rb-nav-inactive-ink": "#aab7cc",
    "--rb-badge": "#b45309",
    "--rb-badge-ink": "#f8fafc",
    "--rb-shadow-soft": "rgba(0, 0, 0, 0.35)",
    "--rb-scrollbar-thumb": "#2c3a55",
    "--rb-scrollbar-thumb-hover": "#3a4a6a",
    "--rb-screensaver-bg-1": "#05080f",
    "--rb-screensaver-bg-2": "#0b1220",
    "--rb-confetti-1": "#22d3ee",
    "--rb-confetti-2": "#f59e0b",
    "--rb-confetti-3": "#34d399",
    "--rb-confetti-4": "#60a5fa",
    "--rb-confetti-5": "#c084fc",

    // ===== Ink =====
    "--rb-ink-secondary": "#aab7cc",
    "--rb-ink-tertiary": "#8e9bb0",
    "--rb-ink-soft": "#cbd5e3",
    "--rb-ink-disabled": "#4f5b70",
    "--rb-on-color-ink": "#f8fafc",

    // ===== Surfaces + borders =====
    "--rb-surface-sunken": "#0f1626",
    "--rb-cell-weekend-bg": "#101828",
    "--rb-cell-inactive-bg": "#0d1424",
    "--rb-field-border": "#2c3a55",
    "--rb-border-strong": "#3a4a6a",
    "--rb-accent-wash": "#10303f",

    // ===== Buttons =====
    "--rb-btn-dark-bg": "#1e293b",
    "--rb-btn-dark-hover-bg": "#2c3a55",

    // ===== Status: danger =====
    "--rb-danger": "#be123c",
    "--rb-danger-hover": "#9f1239",
    "--rb-danger-ink": "#fda4af",
    "--rb-danger-wash": "#3b0d1a",
    "--rb-danger-wash-hover": "#4c1122",
    "--rb-danger-border": "#4c1122",

    // ===== Status: success =====
    "--rb-success": "#15803d",
    "--rb-success-hover": "#166534",
    "--rb-success-ink": "#86efac",
    "--rb-success-wash": "#0b2e1a",

    // ===== Status: info =====
    "--rb-info": "#1d4ed8",
    "--rb-info-hover": "#1e40af",
    "--rb-info-ink": "#93c5fd",
    "--rb-info-wash": "#0f1f45",
    "--rb-info-wash-hover": "#14285a",
    "--rb-info-border": "#1e3a8a",

    // ===== Status: warning =====
    "--rb-warn": "#b45309",
    "--rb-warn-ink": "#fcd34d",
    "--rb-warn-wash": "#3a2a05",
    "--rb-warn-border": "#5a4108",

    // ===== Shadows + on-tint overlays =====
    "--rb-shadow-card": "rgba(0, 0, 0, 0.4)",
    "--rb-shadow-accent": "rgba(14, 116, 144, 0.45)",
    "--rb-shadow-panel": "rgba(0, 0, 0, 0.6)",
    "--rb-on-tint-border": "rgba(255, 255, 255, 0.25)",
    "--rb-on-tint-ring": "rgba(255, 255, 255, 0.2)",
    "--rb-on-tint-fill": "rgba(255, 255, 255, 0.12)",
    "--rb-on-tint-chip": "rgba(255, 255, 255, 0.1)",
    "--rb-on-tint-hover-strong": "rgba(255, 255, 255, 0.18)",
    "--rb-on-tint-hover": "rgba(255, 255, 255, 0.14)",

    // ===== On-screen keyboard =====
    "--rb-key-panel-bg": "#101828",
    "--rb-key-panel-border": "#2c3a55",
    "--rb-key-border": "#2c3a55",
    "--rb-key-ctrl-bg": "#1c2740",
    "--rb-key-ctrl-active-bg": "#253352",
    "--rb-key-active-bg": "#1e293b",

    // ===== Screensaver =====
    "--rb-screensaver-logo-glow": "rgba(34, 211, 238, 0.3)",
    "--rb-power-saving-bg": "#000000",
  },
};
```

Update `client/src/themes/index.ts`:

```ts
import { defaultTheme } from "./default";
import { deepSpaceTheme } from "./deep-space";

/**
 * Built-in theme manifests, RAW. Typed as unknown on purpose: validation
 * happens in client/src/lib/theme-engine.ts `loadBuiltinThemes`, so a
 * malformed module is reported in the settings menu ("Theme Errors")
 * instead of throwing at import time and taking the kiosk down.
 */
export const BUILTIN_THEMES: readonly unknown[] = [defaultTheme, deepSpaceTheme];
```

- [ ] **Step 4: Run all theme tests**

Run: `npx vitest run client/src/themes`
Expected: all pass (Default 20 pairs at floors, Deep Space 20 pairs at 4.5, fidelity, registration).

- [ ] **Step 5: Amend spec §8**

In `docs/plans/theme-system/THEME-ENGINE-SPEC.md`, replace the sentence
"A test asserts ≥ 4.5 for every theme on:" with:

"A test asserts a floor for every theme on the pairs below. **New themes: ≥ 4.5 (WCAG AA).** **Default is grandfathered** — it is shipped and must not change, and it measures below 4.5 on eight pairs (white on coral 3.1, white on amber 2.5, ink-tertiary on canvas 3.7, …), so it is pinned at its measured ratios in `client/src/themes/contrast.spec.ts` with a no-regression rule."

- [ ] **Step 6: Commit**

```bash
git add client/src/themes/deep-space.ts client/src/themes/index.ts client/src/themes/contrast.spec.ts docs/plans/theme-system/THEME-ENGINE-SPEC.md
git commit -m "feat(theme): Deep Space theme + contrast guard (AA for new themes, Default grandfathered)"
```

---

### Task 6: Theme engine (pure module)

**Files:**
- Create: `client/src/lib/theme-engine.ts`
- Test: `client/src/lib/theme-engine.spec.ts` (new)

**Interfaces:**
- Consumes: `validateThemeManifest`, `THEME_TOKEN_NAMES`, `THEME_ENGINE_VERSION`, `ThemeManifest` from `@shared/theme-manifest`.
- Produces:
  - `DEFAULT_THEME_ID = "default"`, `THEME_CACHE_KEY = "rootboard.theme-cache"`
  - `interface ThemeLoadFailure { id: string; message: string }`
  - `interface ThemeLoadResult { ok: ThemeManifest[]; failed: ThemeLoadFailure[] }`
  - `loadBuiltinThemes(raw: readonly unknown[]): ThemeLoadResult`
  - `resolveTheme(id: string | undefined, ok: readonly ThemeManifest[]): ThemeManifest | null`
  - `interface ThemeRoot { style: { setProperty(name: string, value: string): void } }`
  - `interface ThemeStorage { getItem(key: string): string | null; setItem(key: string, value: string): void }`
  - `interface ThemeCache { engineVersion: number; id: string; tokens: Record<string, string> }`
  - `applyTheme(manifest: ThemeManifest, root?: ThemeRoot, storage?: ThemeStorage | null): void`
  - `subscribeTheme(cb: () => void): () => void`
  - `readThemeCache(storage?: ThemeStorage | null): ThemeCache | null`, `writeThemeCache(manifest: ThemeManifest, storage?: ThemeStorage | null): void`

- [ ] **Step 1: Write the failing test**

```ts
// client/src/lib/theme-engine.spec.ts
import { describe, expect, test, vi } from "vitest";
import { THEME_TOKEN_NAMES, type ThemeManifest } from "@shared/theme-manifest";
import {
  DEFAULT_THEME_ID,
  THEME_CACHE_KEY,
  applyTheme,
  loadBuiltinThemes,
  readThemeCache,
  resolveTheme,
  subscribeTheme,
  writeThemeCache,
  type ThemeStorage,
} from "./theme-engine";

function tokens(color = "#123456"): Record<string, string> {
  return Object.fromEntries(THEME_TOKEN_NAMES.map((n) => [n, color]));
}
function manifest(id: string, color?: string): ThemeManifest {
  return { engineVersion: 1, id, name: id, tokens: tokens(color) as ThemeManifest["tokens"] };
}
function memoryStorage(initial: Record<string, string> = {}): ThemeStorage & { data: Record<string, string> } {
  const data = { ...initial };
  return { data, getItem: (k) => (k in data ? data[k] : null), setItem: (k, v) => { data[k] = v; } };
}

describe("loadBuiltinThemes", () => {
  test("splits valid, invalid and duplicate entries; never throws", () => {
    const bad = { engineVersion: 1, id: "broken", name: "Broken", tokens: {} };
    const result = loadBuiltinThemes([manifest("default"), bad, manifest("default"), 42, null]);
    expect(result.ok.map((t) => t.id)).toEqual(["default"]);
    expect(result.failed.map((f) => f.id)).toEqual(["broken", "default", "<unknown>", "<unknown>"]);
    expect(result.failed[0].message).toContain("--rb-");
    expect(result.failed[1].message).toContain("duplicate");
  });
});

describe("resolveTheme", () => {
  const ok = [manifest("default"), manifest("deep-space")];
  test("known id resolves to that theme", () => {
    expect(resolveTheme("deep-space", ok)?.id).toBe("deep-space");
  });
  test("unknown or undefined id resolves to default", () => {
    expect(resolveTheme("nope", ok)?.id).toBe(DEFAULT_THEME_ID);
    expect(resolveTheme(undefined, ok)?.id).toBe(DEFAULT_THEME_ID);
  });
  test("returns null when even default is missing", () => {
    expect(resolveTheme("nope", [manifest("other")])).toBeNull();
  });
});

describe("applyTheme", () => {
  test("sets every token on the root, notifies once, writes the cache", () => {
    const setProperty = vi.fn();
    const storage = memoryStorage();
    const listener = vi.fn();
    const unsubscribe = subscribeTheme(listener);
    applyTheme(manifest("deep-space", "#0b1220"), { style: { setProperty } }, storage);
    expect(setProperty).toHaveBeenCalledTimes(THEME_TOKEN_NAMES.length);
    expect(setProperty).toHaveBeenCalledWith("--rb-canvas", "#0b1220");
    expect(listener).toHaveBeenCalledTimes(1);
    const cached = JSON.parse(storage.data[THEME_CACHE_KEY]);
    expect(cached.id).toBe("deep-space");
    expect(cached.tokens["--rb-canvas"]).toBe("#0b1220");
    unsubscribe();
  });

  test("unsubscribed listeners stop firing; a throwing listener does not block others", () => {
    const setProperty = vi.fn();
    const a = vi.fn(() => { throw new Error("widget bug"); });
    const b = vi.fn();
    const offA = subscribeTheme(a);
    const offB = subscribeTheme(b);
    applyTheme(manifest("x"), { style: { setProperty } }, null);
    expect(a).toHaveBeenCalledTimes(1);
    expect(b).toHaveBeenCalledTimes(1);
    offA();
    applyTheme(manifest("x"), { style: { setProperty } }, null);
    expect(a).toHaveBeenCalledTimes(1);
    expect(b).toHaveBeenCalledTimes(2);
    offB();
  });

  test("a storage that throws does not break apply", () => {
    const storage: ThemeStorage = { getItem: () => null, setItem: () => { throw new Error("quota"); } };
    expect(() => applyTheme(manifest("x"), { style: { setProperty: vi.fn() } }, storage)).not.toThrow();
  });
});

describe("theme cache", () => {
  test("round-trips", () => {
    const storage = memoryStorage();
    writeThemeCache(manifest("deep-space", "#0b1220"), storage);
    const cache = readThemeCache(storage);
    expect(cache?.id).toBe("deep-space");
    expect(cache?.engineVersion).toBe(1);
    expect(cache?.tokens["--rb-ink"]).toBe("#0b1220");
  });
  test("malformed or missing cache reads as null", () => {
    expect(readThemeCache(memoryStorage())).toBeNull();
    expect(readThemeCache(memoryStorage({ [THEME_CACHE_KEY]: "{not json" }))).toBeNull();
    expect(readThemeCache(memoryStorage({ [THEME_CACHE_KEY]: JSON.stringify({ id: 1 }) }))).toBeNull();
    expect(readThemeCache(null)).toBeNull();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run client/src/lib/theme-engine.spec.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Write the engine**

```ts
// client/src/lib/theme-engine.ts
import {
  THEME_ENGINE_VERSION,
  THEME_TOKEN_NAMES,
  validateThemeManifest,
  type ThemeManifest,
} from "@shared/theme-manifest";

/**
 * Theme engine — pure module, no React, no direct `document` reference
 * outside the defaults, so every branch is unit-testable in the node
 * vitest environment. Spec: docs/plans/theme-system/THEME-ENGINE-SPEC.md §4, §6.
 *
 * Flow: loadBuiltinThemes (validate) → resolveTheme (id → manifest, Default
 * fallback) → applyTheme (setProperty on <html>, notify widgets, write the
 * boot cache). The inline script in client/index.html reads that cache
 * before React mounts so a dark theme never flashes light at boot.
 */

export const DEFAULT_THEME_ID = "default";
export const THEME_CACHE_KEY = "rootboard.theme-cache";

export interface ThemeLoadFailure {
  id: string;
  message: string;
}

export interface ThemeLoadResult {
  ok: ThemeManifest[];
  failed: ThemeLoadFailure[];
}

/** Minimal shape of `document.documentElement` this module needs. */
export interface ThemeRoot {
  style: { setProperty(name: string, value: string): void };
}

/** Minimal shape of `localStorage` this module needs. */
export interface ThemeStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

export interface ThemeCache {
  engineVersion: number;
  id: string;
  tokens: Record<string, string>;
}

function bestEffortId(raw: unknown): string {
  if (raw && typeof raw === "object" && typeof (raw as { id?: unknown }).id === "string") {
    return (raw as { id: string }).id;
  }
  return "<unknown>";
}

/** Validates every raw entry. Never throws; problems land in `failed`. */
export function loadBuiltinThemes(raw: readonly unknown[]): ThemeLoadResult {
  const ok: ThemeManifest[] = [];
  const failed: ThemeLoadFailure[] = [];
  const seen = new Set<string>();
  for (const entry of raw) {
    const result = validateThemeManifest(entry);
    if (!result.ok) {
      failed.push({ id: bestEffortId(entry), message: result.message });
      continue;
    }
    if (seen.has(result.manifest.id)) {
      failed.push({ id: result.manifest.id, message: "duplicate theme id" });
      continue;
    }
    seen.add(result.manifest.id);
    ok.push(result.manifest);
  }
  return { ok, failed };
}

/** The theme for `id`, else Default, else null (only if Default itself failed validation). */
export function resolveTheme(id: string | undefined, ok: readonly ThemeManifest[]): ThemeManifest | null {
  return ok.find((t) => t.id === id) ?? ok.find((t) => t.id === DEFAULT_THEME_ID) ?? null;
}

// --- Subscriptions (widget contract `theme.subscribe`) -------------------

type Listener = () => void;
const listeners = new Set<Listener>();

export function subscribeTheme(cb: Listener): () => void {
  listeners.add(cb);
  return () => {
    listeners.delete(cb);
  };
}

function notify(): void {
  for (const cb of Array.from(listeners)) {
    try {
      cb();
    } catch (err) {
      // A widget callback is untrusted; one throwing must not block the rest.
      console.error("[theme] subscriber threw", err);
    }
  }
}

// --- Cache ----------------------------------------------------------------

function defaultStorage(): ThemeStorage | null {
  try {
    return typeof localStorage === "undefined" ? null : localStorage;
  } catch {
    return null;
  }
}

export function readThemeCache(storage: ThemeStorage | null = defaultStorage()): ThemeCache | null {
  if (!storage) return null;
  try {
    const raw = storage.getItem(THEME_CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<ThemeCache> | null;
    if (
      !parsed ||
      typeof parsed !== "object" ||
      typeof parsed.engineVersion !== "number" ||
      typeof parsed.id !== "string" ||
      !parsed.tokens ||
      typeof parsed.tokens !== "object"
    ) {
      return null;
    }
    return { engineVersion: parsed.engineVersion, id: parsed.id, tokens: parsed.tokens as Record<string, string> };
  } catch {
    return null;
  }
}

export function writeThemeCache(manifest: ThemeManifest, storage: ThemeStorage | null = defaultStorage()): void {
  if (!storage) return;
  const cache: ThemeCache = { engineVersion: THEME_ENGINE_VERSION, id: manifest.id, tokens: { ...manifest.tokens } };
  try {
    storage.setItem(THEME_CACHE_KEY, JSON.stringify(cache));
  } catch (err) {
    // Best-effort: a full/blocked storage just means one flash at next boot.
    console.warn("[theme] could not write boot cache", err);
  }
}

// --- Apply ----------------------------------------------------------------

function defaultRoot(): ThemeRoot {
  return document.documentElement;
}

/**
 * Writes every token onto the root element, then notifies subscribers,
 * then mirrors the manifest into the boot cache. Default goes through this
 * same path (no special-casing) so the path is exercised on every boot.
 */
export function applyTheme(
  manifest: ThemeManifest,
  root: ThemeRoot = defaultRoot(),
  storage: ThemeStorage | null = defaultStorage(),
): void {
  for (const name of THEME_TOKEN_NAMES) {
    root.style.setProperty(name, manifest.tokens[name]);
  }
  notify();
  writeThemeCache(manifest, storage);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run client/src/lib/theme-engine.spec.ts`
Expected: 9 passed.

- [ ] **Step 5: Type-check and commit**

Run: `npm run check` — Expected: clean.

```bash
git add client/src/lib/theme-engine.ts client/src/lib/theme-engine.spec.ts
git commit -m "feat(theme): theme engine (load/resolve/apply/subscribe/cache)"
```

---

### Task 7: `theme` field in the dashboard config schema

**Files:**
- Modify: `shared/dashboard-config.ts`
- Test: `client/src/lib/dashboard-config-theme.spec.ts` (new)

**Interfaces:**
- Produces: `DashboardConfig.theme?: string` (lenient; malformed → `undefined`).

- [ ] **Step 1: Write the failing test**

```ts
// client/src/lib/dashboard-config-theme.spec.ts
import { describe, expect, test } from "vitest";
import { dashboardConfigSchema, defaultDashboardConfig } from "@shared/dashboard-config";

describe("dashboard config `theme` field", () => {
  test("absent by default and optional", () => {
    expect(defaultDashboardConfig().theme).toBeUndefined();
    expect(dashboardConfigSchema.safeParse(defaultDashboardConfig()).success).toBe(true);
  });

  test("a valid id survives a round trip", () => {
    const parsed = dashboardConfigSchema.parse({ ...defaultDashboardConfig(), theme: "deep-space" });
    expect(parsed.theme).toBe("deep-space");
  });

  test("a malformed value becomes undefined WITHOUT failing the document (lenient)", () => {
    for (const bad of [123, "../x", "Bad Id", "", null, { id: "x" }]) {
      const result = dashboardConfigSchema.safeParse({ ...defaultDashboardConfig(), theme: bad });
      expect(result.success, String(bad)).toBe(true);
      if (result.success) {
        expect(result.data.theme).toBeUndefined();
        expect(result.data.widgets).toHaveLength(3); // rest of the document intact
      }
    }
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run client/src/lib/dashboard-config-theme.spec.ts`
Expected: FAIL on "a valid id survives a round trip" — Zod strips unknown keys, so `parsed.theme` is `undefined` until the field exists. (The first and third tests pass vacuously for the same reason; that is fine.)

- [ ] **Step 3: Add the field**

In `shared/dashboard-config.ts`, add the import and the field:

```ts
import { z } from "zod";
import { widgetIdSchema } from "./widget-manifest";
import { themeIdSchema } from "./theme-manifest";
```

```ts
export const dashboardConfigSchema = z
  .object({
    configVersion: z.literal(1),
    defaultWidget: widgetIdSchema,
    /**
     * Active theme id (client/src/themes). LENIENT on purpose: a malformed
     * value becomes undefined (→ Default) instead of invalidating the whole
     * file — otherwise a typo here would reset the widget layout too.
     * An unknown-but-well-formed id also resolves to Default at apply time
     * (client/src/lib/theme-engine.ts resolveTheme). Decision 0009.
     */
    theme: themeIdSchema.optional().catch(undefined),
    widgets: z
      .array(dashboardWidgetEntrySchema)
      // …unchanged…
```

Leave `defaultDashboardConfig()` as is (no `theme` key).

- [ ] **Step 4: Run tests**

Run: `npx vitest run client/src/lib/dashboard-config-theme.spec.ts client/src/lib/widget-config.spec.ts`
Expected: all pass (the existing widget-config spec is unaffected: it builds configs without `theme`).

- [ ] **Step 5: Type-check, rebuild server bundle awareness, commit**

Run: `npm run check` — Expected: clean. (The server validates PUT bodies with this same schema, so a `theme` field now survives the write path with no server change. The server bundle is rebuilt by `npm run build` at release time.)

```bash
git add shared/dashboard-config.ts client/src/lib/dashboard-config-theme.spec.ts
git commit -m "feat(theme): lenient optional theme id in dashboard config"
```

---

### Task 8: Inline boot script (no flash)

**Files:**
- Modify: `client/index.html` (add `<script id="rb-theme-boot">` in `<head>`, after the `<style>` block)
- Test: `client/src/lib/theme-boot-script.spec.ts` (new)

**Interfaces:**
- Consumes: the cache shape written by `writeThemeCache` (`{ engineVersion, id, tokens }`) under `rootboard.theme-cache`.
- Produces: nothing importable. The spec extracts the script text by its `id` and runs it against stubs.

- [ ] **Step 1: Write the failing test**

```ts
// client/src/lib/theme-boot-script.spec.ts
import fs from "fs";
import path from "path";
import { describe, expect, test, vi } from "vitest";

const html = fs.readFileSync(path.resolve(import.meta.dirname, "../../index.html"), "utf-8");

function bootScript(): string {
  const m = /<script id="rb-theme-boot">([\s\S]*?)<\/script>/.exec(html);
  if (!m) throw new Error("rb-theme-boot script not found in client/index.html");
  return m[1];
}

function run(stored: string | null) {
  const setProperty = vi.fn();
  const localStorage = { getItem: vi.fn(() => stored) };
  const document = { documentElement: { style: { setProperty } } };
  new Function("localStorage", "document", bootScript())(localStorage, document);
  return setProperty;
}

describe("client/index.html theme boot script", () => {
  test("applies cached --rb-* tokens with valid color values", () => {
    const setProperty = run(JSON.stringify({ engineVersion: 1, id: "deep-space", tokens: { "--rb-canvas": "#0b1220", "--rb-shadow-card": "rgba(0, 0, 0, 0.4)" } }));
    expect(setProperty).toHaveBeenCalledWith("--rb-canvas", "#0b1220");
    expect(setProperty).toHaveBeenCalledWith("--rb-shadow-card", "rgba(0, 0, 0, 0.4)");
    expect(setProperty).toHaveBeenCalledTimes(2);
  });

  test("ignores non --rb- keys and non-color values", () => {
    const setProperty = run(JSON.stringify({ engineVersion: 1, id: "x", tokens: {
      "--background": "#000000",
      "--rb-canvas": "url(javascript:alert(1))",
      "--rb-ink": "var(--rb-canvas)",
      "--rb-surface": 12,
      "--rb-ok": "#ffffff",
    } }));
    expect(setProperty).toHaveBeenCalledTimes(1);
    expect(setProperty).toHaveBeenCalledWith("--rb-ok", "#ffffff");
  });

  test("does nothing and does not throw on missing or malformed cache", () => {
    expect(run(null)).not.toHaveBeenCalled();
    expect(run("{not json")).not.toHaveBeenCalled();
    expect(run(JSON.stringify({ tokens: "nope" }))).not.toHaveBeenCalled();
  });

  test("survives a localStorage that throws", () => {
    const setProperty = vi.fn();
    const localStorage = { getItem: () => { throw new Error("blocked"); } };
    const document = { documentElement: { style: { setProperty } } };
    expect(() => new Function("localStorage", "document", bootScript())(localStorage, document)).not.toThrow();
    expect(setProperty).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run client/src/lib/theme-boot-script.spec.ts`
Expected: FAIL — "rb-theme-boot script not found".

- [ ] **Step 3: Add the script to `client/index.html`**

Insert directly after the closing `</style>` in `<head>` (before `</head>`):

```html
    <!-- Theme boot cache: repaints the last applied theme before React
         mounts so a dark theme never flashes the light Default at boot.
         The cache is written by client/src/lib/theme-engine.ts applyTheme;
         data/config/dashboard.json remains the only source of truth and
         corrects this within one load. Only --rb-* keys with literal color
         values are ever applied. Tested by theme-boot-script.spec.ts. -->
    <script id="rb-theme-boot">
      (function () {
        try {
          var raw = localStorage.getItem("rootboard.theme-cache");
          if (!raw) return;
          var cache = JSON.parse(raw);
          var tokens = cache && cache.tokens;
          if (!tokens || typeof tokens !== "object") return;
          var NAME = /^--rb-[a-z0-9-]+$/;
          var COLOR = /^(#[0-9a-f]{6}([0-9a-f]{2})?|rgba?\(\s*\d{1,3}\s*,\s*\d{1,3}\s*,\s*\d{1,3}\s*(,\s*(0|1|0?\.\d+)\s*)?\))$/i;
          var style = document.documentElement.style;
          for (var key in tokens) {
            if (!Object.prototype.hasOwnProperty.call(tokens, key)) continue;
            var value = tokens[key];
            if (NAME.test(key) && typeof value === "string" && COLOR.test(value)) {
              style.setProperty(key, value);
            }
          }
        } catch (e) {
          /* best-effort; the config load will apply the real theme */
        }
      })();
    </script>
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run client/src/lib/theme-boot-script.spec.ts`
Expected: 4 passed.

- [ ] **Step 5: Confirm Vite keeps the inline script**

Run: `npm run build` then `grep -c "rb-theme-boot" dist/public/index.html` (`vite.config.ts` sets `build.outDir` to `dist/public`).
Expected: `1`. Plain (non-module) inline scripts pass through Vite's HTML pipeline untouched.

- [ ] **Step 6: Commit**

```bash
git add client/index.html client/src/lib/theme-boot-script.spec.ts
git commit -m "feat(theme): inline boot script applies cached theme before React mounts"
```

---

### Task 9: React wiring — `useTheme`, app-shell, widget host subscribe

**Files:**
- Create: `client/src/hooks/use-theme.ts`
- Modify: `client/src/components/app-shell.tsx` (imports; call after `writeDashboardConfig` is defined ~line 615; props on `<SettingsMenu>` ~line 1022)
- Modify: `client/src/lib/widget-host-services.ts:69-75`

**Interfaces:**
- Consumes: `BUILTIN_THEMES`, engine functions (Task 6), `DashboardConfig` (Task 7), app-shell's `writeDashboardConfig(buildNext, errorTitle)`.
- Produces: `useTheme(config, configLoaded, writeConfig): { themes, failed, activeId, setTheme }`; app-shell passes `themePickerEntries`, `activeThemeId`, `onSelectTheme`, `themeErrorEntries` to `SettingsMenu` (Task 10 defines those props — do Task 10's prop additions in the same commit if the type-check demands it; otherwise commit this task first with the four props temporarily commented out, then uncomment in Task 10).

No React renderer exists in the test setup, so this task has no unit test; verification is on the dev server (Step 5).

- [ ] **Step 1: Write the hook**

```ts
// client/src/hooks/use-theme.ts
import { useCallback, useEffect, useMemo } from "react";
import type { DashboardConfig } from "@shared/dashboard-config";
import type { ThemeManifest } from "@shared/theme-manifest";
import { BUILTIN_THEMES } from "@/themes";
import {
  DEFAULT_THEME_ID,
  applyTheme,
  loadBuiltinThemes,
  resolveTheme,
  type ThemeLoadFailure,
} from "@/lib/theme-engine";

export interface UseThemeResult {
  /** Every built-in theme that validated, in registry order. */
  themes: readonly ThemeManifest[];
  /** Built-ins that failed validation — shown in the settings menu "Theme Errors". */
  failed: readonly ThemeLoadFailure[];
  activeId: string;
  /** Persists the choice via the shell's dashboard-config writer; applies on the next render. */
  setTheme: (id: string) => void;
}

type WriteConfig = (
  buildNext: (current: DashboardConfig) => DashboardConfig | null,
  errorTitle: string,
) => unknown;

/**
 * Shell-side theme wiring. Resolution is derived from `config.theme`;
 * applying happens in an effect and is gated on `configLoaded` so the
 * boot cache (client/index.html) is not overwritten with Default while
 * the config request is still in flight — that would reintroduce the
 * flash the cache exists to prevent.
 */
export function useTheme(config: DashboardConfig, configLoaded: boolean, writeConfig: WriteConfig): UseThemeResult {
  const loaded = useMemo(() => loadBuiltinThemes(BUILTIN_THEMES), []);
  const active = useMemo(() => resolveTheme(config.theme, loaded.ok), [config.theme, loaded]);

  useEffect(() => {
    if (!configLoaded || !active) return;
    applyTheme(active);
  }, [active, configLoaded]);

  const setTheme = useCallback(
    (id: string) => {
      void writeConfig((current) => (current.theme === id ? null : { ...current, theme: id }), "Couldn't change theme");
    },
    [writeConfig],
  );

  return {
    themes: loaded.ok,
    failed: loaded.failed,
    activeId: active?.id ?? DEFAULT_THEME_ID,
    setTheme,
  };
}
```

- [ ] **Step 2: Wire it in `app-shell.tsx`**

Add the import near the other hook imports:

```ts
import { useTheme } from "@/hooks/use-theme";
```

Directly **after** the `writeDashboardConfig` `useCallback` definition — it ends at line 619 (`  );`), right after its dependency array `[queryClient, toast],` on line 618 — add:

```ts
  // Theme engine (docs/plans/theme-system/THEME-ENGINE-SPEC.md). Gated on
  // the config having loaded so the boot cache isn't clobbered by Default.
  const theme = useTheme(dashboardConfig, !configQuery.isPending, writeDashboardConfig);
  const themePickerEntries = useMemo(
    () =>
      theme.themes.map((t) => ({
        id: t.id,
        name: t.name,
        swatches: [
          t.tokens["--rb-canvas"],
          t.tokens["--rb-surface"],
          t.tokens["--rb-ink"],
          t.tokens["--rb-accent"],
          t.tokens["--rb-badge"],
        ],
      })),
    [theme.themes],
  );
```

On the `<SettingsMenu … />` element (~line 1022) add four props after `onPatchWidgetSetting={patchWidgetSetting}`:

```tsx
            themePickerEntries={themePickerEntries}
            activeThemeId={theme.activeId}
            onSelectTheme={theme.setTheme}
            themeErrorEntries={theme.failed}
```

- [ ] **Step 3: Make the widget host subscribe real**

In `client/src/lib/widget-host-services.ts` add the import:

```ts
import { subscribeTheme } from "./theme-engine";
```

Replace lines 69–75 with:

```ts
    theme: {
      getToken: (name: string) =>
        getComputedStyle(document.documentElement).getPropertyValue(name).trim(),
      // Fires after every applyTheme (theme switch, and once at boot once
      // the config resolves). Callbacks are guarded inside the engine.
      subscribe: subscribeTheme,
    },
```

- [ ] **Step 4: Type-check**

Run: `npm run check`
Expected: errors only about the four new `SettingsMenu` props not existing (Task 10 adds them). If you prefer a green check per commit, add the four props to `SettingsMenuProps` now exactly as written in Task 10 Step 1 and leave the JSX for Task 10.

- [ ] **Step 5: Dev-server verification**

Start the dev server, open the app. In the browser console:

```js
localStorage.getItem("rootboard.theme-cache")
```
Expected: a JSON string with `"id":"default"` (the effect applied Default and wrote the cache). Then:

```js
fetch("/api/config/dashboard").then(r => r.json()).then(c => fetch("/api/config/dashboard", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...c.config, theme: "deep-space" }) }))
```
Within 60 s (the config poll) the page turns dark without a reload; the cache now says `deep-space`. Reload: the page paints dark immediately with no light flash. Put it back with `theme: "default"`.

- [ ] **Step 6: Commit**

```bash
git add client/src/hooks/use-theme.ts client/src/components/app-shell.tsx client/src/lib/widget-host-services.ts
git commit -m "feat(theme): useTheme wiring in app-shell; real theme.subscribe for widgets"
```

---

### Task 10: Settings menu — "Theme" picker and "Theme Errors"

**Files:**
- Modify: `client/src/components/calendar/settings-menu.tsx` (imports line 2; `SettingsMenuProps` ~line 146; destructure ~line 216; JSX after the Brightness block)

**Interfaces:**
- Produces: exported `ThemePickerEntry { id: string; name: string; swatches: string[] }`, `ThemeErrorEntry { id: string; message: string }`; props `themePickerEntries?`, `activeThemeId?`, `onSelectTheme?`, `themeErrorEntries?`.

- [ ] **Step 1: Add the types and props**

Add `Palette` to the lucide import on line 2 (alphabetical position doesn't matter; append before `type LucideIcon`).

Above `interface SettingsMenuProps` add:

```ts
/** One row of the "Theme" section — a validated built-in theme. */
export interface ThemePickerEntry {
  id: string;
  name: string;
  /** Five preview colors: canvas, surface, ink, accent, badge. */
  swatches: string[];
}

/** One row of the "Theme Errors" section — a built-in that failed
 *  validation (client/src/lib/theme-engine.ts loadBuiltinThemes). No
 *  controls: nothing is selectable until the manifest is fixed. */
export interface ThemeErrorEntry {
  id: string;
  message: string;
}
```

Inside `SettingsMenuProps`, after `onPatchWidgetSetting`, add:

```ts
  /** Validated built-in themes, registry order. Absent/empty hides the
   *  "Theme" section (defensive — Default always validates). */
  themePickerEntries?: ThemePickerEntry[];
  activeThemeId?: string;
  /** Persists the choice through the shell's dashboard-config writer;
   *  the switch itself happens when the config re-renders (use-theme.ts). */
  onSelectTheme?: (id: string) => void;
  /** Built-ins that failed validation. Absent/empty hides the section. */
  themeErrorEntries?: ThemeErrorEntry[];
```

In the destructuring after `onPatchWidgetSetting,` add:

```ts
  themePickerEntries = [],
  activeThemeId,
  onSelectTheme,
  themeErrorEntries = [],
```

- [ ] **Step 2: Add the JSX**

Directly after the Brightness block (it ends with `<p className="text-xs text-rb-muted">{brightness}%</p>` and its closing `</div>`), insert:

```tsx
            {/* Theme picker (theme engine slice 1). Rows are .touch-button
                so they honour the kiosk's 48/44 px minimums. */}
            {themePickerEntries.length > 0 && (
              <>
                <Separator />
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <Palette className="h-4 w-4" />
                    <Label className="text-sm font-medium">Theme</Label>
                  </div>
                  <div className="space-y-1">
                    {themePickerEntries.map((entry) => {
                      const selected = entry.id === activeThemeId;
                      return (
                        <button
                          type="button"
                          key={entry.id}
                          onClick={() => onSelectTheme?.(entry.id)}
                          aria-pressed={selected}
                          data-testid={`theme-select-${entry.id}`}
                          className={`touch-button w-full flex items-center gap-2 rounded-md px-2 text-left ${
                            selected ? "bg-rb-accent-wash" : "hover:bg-rb-chip"
                          }`}
                        >
                          <span className="text-sm flex-1 truncate">{entry.name}</span>
                          <span className="flex gap-1" aria-hidden="true">
                            {entry.swatches.map((color, i) => (
                              <span
                                key={i}
                                className="h-4 w-4 rounded-full border border-rb-border-strong"
                                style={{ background: color }}
                              />
                            ))}
                          </span>
                          {selected ? (
                            <Check className="h-4 w-4 text-rb-accent flex-shrink-0" />
                          ) : (
                            <span className="h-4 w-4 flex-shrink-0" />
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </>
            )}

            {/* Theme Errors — mirrors "Widget Folder Errors": reason only, no controls. */}
            {themeErrorEntries.length > 0 && (
              <>
                <Separator />
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <AlertTriangle className="h-4 w-4 text-rb-warn" />
                    <Label className="text-sm font-medium">Theme Errors</Label>
                  </div>
                  <div className="space-y-1">
                    {themeErrorEntries.map((entry, i) => (
                      <p key={`${entry.id}-${i}`} className="text-xs text-rb-warn-ink leading-snug" data-testid={`theme-error-${entry.id}`}>
                        <span className="font-mono">{entry.id}</span>: {entry.message}
                      </p>
                    ))}
                  </div>
                </div>
              </>
            )}
```

- [ ] **Step 3: Type-check and run the whole suite**

Run: `npm run check` — Expected: clean.
Run: `npm test` — Expected: all legacy scripts and vitest specs pass.

- [ ] **Step 4: Dev-server verification (the real test for this task)**

1. Open Settings. Expected: a "Theme" section under Brightness with two rows, Default checked, each row showing five swatches.
2. Tap "Deep Space". Expected: the whole app goes dark immediately (no reload); the row's check moves; `localStorage["rootboard.theme-cache"]` now has `"id":"deep-space"`.
3. Open a dialog (e.g. remove-calendar confirm), the widget-settings popover, and focus a text input to raise the on-screen keyboard. Expected: all dark — surfaces `#141c2e`, readable text, no white panels.
4. Reload the page. Expected: paints dark from the first frame (boot cache); no light flash.
5. Temporarily break a theme to see the error surface: in `client/src/themes/index.ts` add `{ engineVersion: 99, id: "future", name: "Future", tokens: {} }` to the array. Expected: a "Theme Errors" section reading `future: tokens.--rb-canvas: Required` (or the "newer Rootboard" message if you instead supply full tokens). **Revert before committing.**
6. Tap "Default". Expected: back to the current look.

- [ ] **Step 5: Commit**

```bash
git add client/src/components/calendar/settings-menu.tsx
git commit -m "feat(theme): Theme picker and Theme Errors sections in settings menu"
```

---

### Task 11: Docs — contract wording, SPEC.md, plan status

**Files:**
- Modify: `docs/plans/widget-system/CONTRACT.md:174`
- Modify: `docs/SPEC.md` (~line 304–306 stub sentence; new subsection before `## 4. Update system` ~line 586)
- Modify: `docs/plans/theme-system/THEME-SYSTEM-PLAN.md` (status line), `THEME-ENGINE-SPEC.md` (status line)

- [ ] **Step 1: CONTRACT.md**

Replace line 174 with:

```ts
    subscribe(cb: () => void): () => void;  // fires after every theme switch (and once at boot when the config resolves); callbacks must be idempotent
```

- [ ] **Step 2: SPEC.md — fix the stub sentence**

Replace

```
  `theme.getToken(name)` reads a computed `--rb-*` custom property;
  `theme.subscribe` is a stub (no-op unsubscribe) until the theme
  engine exists.
```

with

```
  `theme.getToken(name)` reads a computed `--rb-*` custom property;
  `theme.subscribe` fires after every theme switch (see "Themes" below).
```

- [ ] **Step 3: SPEC.md — add the Themes subsection**

Insert directly before `## 4. Update system`:

```markdown
### Themes (engine slice 1)

Design: `docs/plans/theme-system/THEME-ENGINE-SPEC.md`; decision 0009.

- **One token layer.** `:root` defines the shadcn tokens (`--background`,
  `--muted-foreground`, …) as `var(--rb-*)` aliases; a theme is a flat map
  of the 76 `--rb-*` tokens. `--rb-ink-tertiary` carries the former
  `--muted-foreground` value. The `.dark` block is dead (never applied).
- **Manifest** (`shared/theme-manifest.ts`): `{ engineVersion, id, name,
  tokens }`, every token required, unknown keys rejected, literal colors
  only. `engineVersion > THEME_ENGINE_VERSION` → "built for a newer
  Rootboard".
- **Built-ins** are bundled modules under `client/src/themes/` (`default`,
  `deep-space`), validated at load by `lib/theme-engine.ts`; a failing one
  is listed under Settings → "Theme Errors" instead of crashing.
  `default.ts` is the copyable authoring reference.
- **Persistence:** `data/config/dashboard.json` `theme` (optional,
  lenient — a malformed value becomes undefined, never invalidating the
  file). Unknown id → Default. Hand-edits land within the 60 s poll.
- **Boot cache:** `applyTheme` mirrors the resolved tokens to
  `localStorage["rootboard.theme-cache"]`; an inline script in
  `client/index.html` (`#rb-theme-boot`) repaints `--rb-*` from it before
  React mounts, so a dark theme does not flash light. The config remains
  the source of truth and corrects the cache on load.
- **Contrast guard** (`themes/contrast.spec.ts`): new themes ≥ 4.5:1 on
  the text/fill pairs listed there; Default is grandfathered at its
  measured ratios (no regression).
- **Widgets:** `host.theme.subscribe` now fires on every switch.
```

Also bump the SPEC's "current as of" stamp if the file has one (check the top of `docs/SPEC.md`).

- [ ] **Step 4: Plan + spec status**

- `THEME-SYSTEM-PLAN.md` status line → "Phase 0 complete. Phase 1 slice 1 (engine + Default + Deep Space) implemented — see THEME-ENGINE-SPEC.md; fonts/assets/confetti/person palettes/Spooky/Winter Holiday are later slices."
- `THEME-ENGINE-SPEC.md` status line → "implemented (unreleased)" — the release workflow flips it to the version number.

- [ ] **Step 5: Security review + commit**

Run: `git diff --cached | grep -nEi "private_key|client_email|192\.168\.|/home/|@gmail\.com|pricing|revenue|trademark"` on the staged docs — expect no hits.

```bash
git add docs/plans/widget-system/CONTRACT.md docs/SPEC.md docs/plans/theme-system/THEME-SYSTEM-PLAN.md docs/plans/theme-system/THEME-ENGINE-SPEC.md
git commit -m "docs: theme engine — contract subscribe wording, SPEC themes section, plan status"
```

---

## After the plan: release

Not part of this plan. Follow the project's release workflow (small single-purpose release; bump `shared/version.ts`; `npm audit`; the pre-push security review in `CLAUDE.md`; tag; verify on the kiosk with the spec's Rollout steps — update, **reboot**, set Deep Space, reboot again and confirm no flash, then the `"theme": "nope"` hand-edit check). Companion-repo contract wording is a separate TASKS.md item.

## Self-review notes

- Spec §1 (aliases, new token, `.dark` comment) → Task 3. §2 (schema) → Task 2. §3 (bundled themes, Default as reference, Deep Space) → Tasks 4–5. §4 (engine) → Task 6. §5 (persistence) → Task 7. §6 (boot cache) → Task 8. §7 (UI) → Tasks 9–10. §8 (contrast) → Task 5, with the grandfather amendment. §9 (widget contract) → Tasks 9, 11. Testing list → every named spec exists above. Rollout → release note.
- Names used consistently across tasks: `loadBuiltinThemes`, `resolveTheme`, `applyTheme`, `subscribeTheme`, `readThemeCache`, `writeThemeCache`, `THEME_CACHE_KEY`, `DEFAULT_THEME_ID`, `ThemeLoadFailure`, `ThemePickerEntry`, `ThemeErrorEntry`, `useTheme(config, configLoaded, writeConfig)`.
