# Theme Person Palettes (Slice 2) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:subagent-driven-development. Steps use checkbox (`- [ ]`) syntax.

**Status:** implemented (unreleased) (branch `theme-people`, 2026-09-23). Ships in the same release as slice 1.

**Goal:** Each theme supplies an 8-slot person palette as `--rb-person-{1..8}-{color,tint,text}` tokens; Chores reads them; calendar event ink stays readable on dark surfaces.

**Architecture:** Person colours become 24 more required theme tokens (100 total), so the engine, boot cache, stylesheet guard, fidelity test and `host.theme.getToken` cover them with no widget-API change. Chores components swap hardcoded hexes for `var(--rb-person-N-role, <Default hex>)` strings. Calendar ink gains a surface-aware path fed by a new active-theme snapshot.

**Tech Stack:** TypeScript, React 18, Zod 3.24, vitest (node env, no React renderer), legacy `tsx` tests.

**Design record:** plan file for this slice (founder-approved 2026-09-23); spec `THEME-ENGINE-SPEC.md`; decision `0009`, new `0010`.

## Global Constraints

- `THEME_ENGINE_VERSION` **stays 1** (slices 1 and 2 ship together; nothing released).
- Token names: `--rb-person-{N}-{role}`, N = 1..8 (1-based), role ∈ `color`, `tint`, `text`, appended to `THEME_TOKEN_NAMES` **slot-major** (`1-color, 1-tint, 1-text, 2-color, …`). Total names **100**.
- Slot order = identity, same in every theme: 1 purple, 2 green, 3 orange, 4 blue, 5 rose/red, 6 teal, 7 pink, 8 slate.
- **Default stays pixel-identical.** Default person tokens are exactly `PERSON_PALETTE` in `client/src/lib/chores-state.ts` (lowercase hex). `:root` declares them; `default.ts` carries them.
- **Deep Space person values (exact, pre-verified against every rule below):**

  | slot | color | tint | text |
  |---|---|---|---|
  | 1 | `#9333ea` | `#2a1540` | `#d8b4fe` |
  | 2 | `#15803d` | `#0b2e1a` | `#86efac` |
  | 3 | `#b45309` | `#3a2205` | `#fdba74` |
  | 4 | `#2563eb` | `#0f1f45` | `#93c5fd` |
  | 5 | `#d4163f` | `#3b0d1a` | `#fda4af` |
  | 6 | `#0f766e` | `#062a27` | `#5eead4` |
  | 7 | `#c0266d` | `#3a0f25` | `#f9a8d4` |
  | 8 | `#5b6b82` | `#1e2836` | `#cbd5e1` |

- **Person contrast rules** (every theme, every slot): `text`/`tint` ≥ 4.5; `text` / (`--rb-on-tint-chip` composited over `tint`) ≥ 4.5; `--rb-on-color-ink`/`color` ≥ 4.5; `color`/`--rb-surface` ≥ 3.0. **Default floors** (measured, rounded down, never lower): text/tint slot 2 = 4.4, slot 3 = 4.4; on-color/color slot 2 = 3.2, slot 3 = 2.5, slot 6 = 3.7, slot 8 = 4.3; color/surface slot 3 = 2.5.
- **Distinguishability:** min pairwise ΔE76 (CIE Lab, D65) between the eight `-color` values ≥ **20** in every theme (Default 28.1, Deep Space 30.7). Tints not checked.
- Calendar: `FALLBACK_COLORS` in `client/src/lib/calendar-meta.ts` **must not change** (the server hashes to the same list). `eventTextColor` light-surface output **byte-identical** to today.
- No change to `WidgetHost` / `WIDGET_API_VERSION`.
- Tests: vitest `client/src/**/*.spec.ts` (`npx vitest run <file>`), full `npm test`, type-check `npm run check`. This tsconfig rejects `for…of` over Map/Set/matchAll iterators (TS2802) — wrap with `Array.from`.
- Commits: stage files by name (never `git add -A`); gitleaks hook runs. Commit with a message file (`git commit -F <file>`), trailer on its own line: `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`. Files are CRLF on disk; don't convert.
- Docs are public: no hostnames, IPs, real names, business info.

---

### Task 1: Person tokens in manifest, stylesheet and both themes (atomic)

**Files:** modify `shared/theme-manifest.ts`, `client/src/index.css`, `client/src/themes/default.ts`, `client/src/themes/deep-space.ts`, `client/src/lib/theme-manifest.spec.ts`; create `client/src/lib/person-colors.spec.ts` (pin test only for now).

**Interfaces produced:** in `shared/theme-manifest.ts`: `PERSON_SLOT_COUNT = 8`, `PERSON_ROLES = ["color", "tint", "text"] as const`, `type PersonRole`, `personTokenName(slot: number, role: PersonRole): ThemeTokenName` (slot 1..8; throws `RangeError` outside). The 24 names are written as **string literals** in `THEME_TOKEN_NAMES` (so the `ThemeTokenName` union keeps them), under a comment `// People (8 identity slots, 1-based, slot order = identity, stable across themes)`, placed at the end of the array.

- [ ] Red: in `theme-manifest.spec.ts` change both `76` expectations to `100`; add a test that `THEME_TOKEN_NAMES.slice(-24)` equals the slot-major list, and that `personTokenName(3, "tint") === "--rb-person-3-tint"` and `personTokenName(0, "color")` / `personTokenName(9, "color")` throw. Create `person-colors.spec.ts` with a test: for i in 0..7, `PERSON_PALETTE[i]` deep-equals `{ color, tint, text }` read from `defaultTheme.tokens["--rb-person-" + (i+1) + "-<role>"]`. Run both → fail.
- [ ] `shared/theme-manifest.ts`: add names + exports; update the `THEME_ENGINE_VERSION` comment to: "Bump when THEME_TOKEN_NAMES changes **after first release**; slices 1 and 2 ship together at 1."
- [ ] `client/src/index.css` `:root`: delete the five `--p-*` lines **and** their comment `/* Person/profile palette (Google calendars override these at runtime) */`. Add, just before the `:root` closing brace (indented two spaces like siblings), a `/* ===== People (8 identity slots; slot order = identity) ===== */` block with the 24 declarations using `PERSON_PALETTE`'s exact values, one comment per slot (`/* 1 purple */` …).
- [ ] `default.ts`: add `// ===== People (8 identity slots) =====` group at the end of `tokens`, same values, a hue comment per slot. Header comment gains: "The People group is where per-person colours come from for every widget (`--rb-person-N-color/-tint/-text`); keep slot order — it is a person's identity."
- [ ] `deep-space.ts`: same group with the Deep Space table values.
- [ ] Green: `npx vitest run client/src/lib client/src/themes` all pass (stylesheet guard, fidelity, manifest, pin, existing contrast); `npm run check` clean; `npm test` green.
- [ ] Commit: `feat(theme): person palette tokens (--rb-person-{1..8}-{color,tint,text}) in Default and Deep Space`

### Task 2: Lab / ΔE76 / rgba compositing helpers

**Files:** modify `client/src/lib/color-utils.ts`, `client/src/lib/color-utils.spec.ts`.

**Interfaces produced:** `hexToLab(hex: string): [number, number, number]` (sRGB → linear via the existing `channelLuminance` curve → XYZ D65 → Lab); `deltaE76(hexA, hexB): number` (Euclidean in Lab); `compositeOver(rgba: string, bgHex: string): string` returning lowercase `#rrggbb` — accepts `rgb(r, g, b)` / `rgba(r, g, b, a)` (same grammar as `cssColorSchema`) and `#rrggbb` (returned as-is, lowercased); rounds channels with `Math.round`; throws on anything else.

- [ ] Red spec cases: `hexToLab("#ffffff")` ≈ `[100, 0, 0]` (±0.1); `#000000` ≈ `[0, 0, 0]`; `#ff0000` ≈ `[53.24, 80.09, 67.20]` (±0.1); `deltaE76` symmetric, 0 for identical; `deltaE76("#e11d48", "#db2777")` ≈ 28.1 (±0.2); `compositeOver("rgba(255, 255, 255, 0.6)", "#fdf0db")` === `#fef9f1`; `compositeOver("rgba(255, 255, 255, 0.1)", "#0b2e1a")` === `#234331`; `compositeOver("#ABCDEF", "#000000")` === `#abcdef`.
- [ ] Implement; green; `npm run check`.
- [ ] Commit: `feat(color-utils): Lab/ΔE76 and rgba compositing for theme palette checks`

### Task 3: Person contrast + distinguishability guard

**Files:** create `client/src/themes/people-contrast.spec.ts`.

Mirror `client/src/themes/contrast.spec.ts` structure (validate `BUILTIN_THEMES`, per-theme `describe`, generated per-check tests, Default floors map with the "never lower one" comment). For each theme and slot 1..8 assert the four rules from Global Constraints using `contrastRatio` and `compositeOver(theme.tokens["--rb-on-tint-chip"], tint)`; assert every person token matches `/^#[0-9a-f]{6}$/`; one test per theme for min pairwise `deltaE76` over the eight `-color` values ≥ 20. `DEFAULT_PERSON_FLOORS` keys like `"2:text/tint"`, values exactly the Global Constraints floors.

- [ ] Write spec; run → green immediately is expected (values pre-verified). To prove it bites, temporarily set Deep Space slot 7 tint to `#c0266d` locally, confirm failure, revert. Report that check in the report.
- [ ] Commit: `test(theme): person palette contrast + distinguishability guard (Default grandfathered)`

### Task 4: `person-colors.ts` helper

**Files:** create `client/src/lib/person-colors.ts`; extend `client/src/lib/person-colors.spec.ts`.

**Interfaces produced:** `personSlot(colorIdx: unknown): number` → 1..8: integer ≥ 0 maps to `(idx % 8) + 1`; anything else (negative, fractional, NaN, non-number) → 1. `personColorVar(colorIdx: unknown, role: PersonRole): string` → `var(--rb-person-N-role, <PERSON_PALETTE fallback hex>)`. `personPaletteVars(colorIdx: unknown): PersonPaletteEntry` → `{ color, tint, text }` of those strings. Imports `PERSON_PALETTE`, `type PersonPaletteEntry` from `@/lib/chores-state` and `personTokenName`, `PERSON_ROLES`, `type PersonRole` from `@shared/theme-manifest`. `chores-state.ts` is **not** modified.

- [ ] Red cases: `personSlot(0)=1`, `(7)=8`, `(8)=1`, `(-1)=1`, `(2.5)=1`, `(NaN)=1`, `("3")=1`; `personColorVar(3,"tint") === "var(--rb-person-4-tint, #e8effd)"`; `personPaletteVars(0)` equals the three purple var strings; every name produced for idx 0..7 × roles is in `THEME_TOKEN_NAMES`.
- [ ] Implement; green; `npm run check`.
- [ ] Commit: `feat(chores): personPaletteVars — theme-token person colors with Default fallbacks`

### Task 5: Chores components read the helper

**Files:** modify `client/src/components/chores/person-column.tsx`, `edit-people.tsx`, `reset-confirm-dialog.tsx`, `chore-card-stack.tsx` (JSDoc only); create `client/src/components/chores/person-palette-usage.spec.ts`.

- [ ] Red: source-guard spec reads the three component files (`fs.readFileSync(path.resolve(import.meta.dirname, "<file>"))`) and asserts none contains `PERSON_PALETTE`, each contains `personPaletteVars`. Run → fail.
- [ ] In each component replace `const pal = PERSON_PALETTE[x.colorIdx % PERSON_PALETTE.length];` with `const pal = personPaletteVars(x.colorIdx);` and fix imports (`PERSON_PALETTE` import removed; `type Person` import kept). In `edit-people.tsx` the swatch loop `PERSON_PALETTE.map((sw, si) => …)` becomes `Array.from({ length: PERSON_SLOT_COUNT }, (_, si) => personPaletteVars(si)).map((sw, si) => …)` with `PERSON_SLOT_COUNT` from `@shared/theme-manifest`; selection logic (`si === p.colorIdx`, `onSetPersonColor(p.id, si)`) unchanged. `chore-card-stack.tsx`: `color` prop JSDoc → "CSS colour value for the check button (usually `var(--rb-person-N-color, …)`)." No other edits.
- [ ] Green; `npm run check`; `npm test` (legacy `chores-state.test.ts` untouched and passing).
- [ ] Commit: `refactor(chores): person colors come from theme tokens (live repaint on theme switch)`

### Task 6: Surface-aware calendar ink

**Files:** modify `client/src/lib/theme-engine.ts` (+ `theme-engine.spec.ts`), `client/src/lib/color-utils.ts` (+ spec); create `client/src/hooks/use-surface-hex.ts`; modify `client/src/components/calendar/event-item.tsx`, `day-view.tsx`, `coming-up.tsx`.

**Interfaces produced:**
- `theme-engine.ts`: `getActiveThemeTokens(): Record<string, string> | null` — module variable set inside `applyTheme` (before `notify()`) to a copy of `manifest.tokens`; initial value lazily from `readThemeCache()?.tokens ?? null` on first call (guarded, never throws).
- `color-utils.ts`: `eventTextColor(hex: string, opts?: { surface?: string; factor?: number })` — **keep the existing positional `factor` parameter working**: new signature `eventTextColor(hex, factorOrOpts = 0.55)`, where a number means today's behaviour. If `opts.surface` is given and `relativeLuminance(opts.surface) < 0.2`, return `rgb(r', g', b')` with `c' = Math.round(c + (255 - c) * DARK_INK_LIGHTEN)`; `DARK_INK_LIGHTEN` exported, chosen as the smallest of 0.5, 0.55, … 0.9 that passes the dark spec below. Otherwise return exactly today's darkened value.
- `use-surface-hex.ts`: `useSurfaceHex(): string | undefined` via `useSyncExternalStore(subscribeTheme, () => getActiveThemeTokens()?.["--rb-surface"])`.
- Calendar components: call `const surface = useSurfaceHex();` once per component and pass `eventTextColor(color, { surface })` at every existing `eventTextColor(...)` call site. No other visual change.

- [ ] Red (color-utils spec): for all 12 `FALLBACK_COLORS` (import from `calendar-meta.ts` if exported; else copy the literal list into the spec with a comment) and the Google palette sample `#7986cb #33b679 #8e24aa #e67c73 #f6bf26 #f4511e #039be5 #616161 #3f51b5 #0b8043 #d50000 #1a73e8`: (a) `eventTextColor(c)` and `eventTextColor(c, { surface: "#ffffff" })` equal `eventTextColor(c, 0.55)` byte-for-byte; (b) with `surface: "#141c2e"`, `contrastRatio(parseRgb(ink), compositeOver(eventTint(c), "#141c2e")) ≥ 4.5`. (Add a tiny local `rgb()`→hex converter in the spec if needed.)
- [ ] Red (engine spec): `getActiveThemeTokens()` returns the applied manifest's `--rb-surface` after `applyTheme`, and a subsequent `applyTheme` of a different manifest updates it.
- [ ] Implement; green; `npm run check`; `npm test`.
- [ ] Commit(s): `feat(theme): active-theme token snapshot for first-party readers`, then `fix(calendar): surface-aware event ink (Deep Space chips were ~1.2–2.0:1)`.

### Task 7: Docs, decision record, contract convention

**Files:** `docs/plans/widget-system/CONTRACT.md`, `docs/plans/theme-system/THEME-ENGINE-SPEC.md`, `docs/plans/theme-system/THEME-SYSTEM-PLAN.md`, `docs/SPEC.md`, create `docs/decisions/0010-person-palettes-are-theme-tokens.md`, `TASKS.md`, this plan's status line.

- CONTRACT.md §4 theme block: after the `subscribe` line, add a paragraph: person colours are theme tokens `--rb-person-{1..8}-{color,tint,text}`; slots are 1-based and stable across themes; a slot is "the theme's Nth identity colour", **not** "Chores person N" — a widget that colours its own people should store a slot index per person, never the colour; adding tokens is additive (no API bump). §8 (authoring guidance): always write a fallback, e.g. `var(--rb-person-3-tint, #ddf2ef)` or `getToken(...) || "#ddf2ef"`, because widgets cannot require a minimum app version.
- THEME-ENGINE-SPEC.md: new section "Person palette tokens" (convention, four contrast rules, ΔE ≥ 20, Default floors, Deep Space rule, slot order = identity); 76 → 100 wherever stated; in Out of scope remove person palettes but keep calendar `FALLBACK_COLORS` with the reason "server hashes calendar ids to the same list"; reword the version rule to "after first release, adding a token bumps `THEME_ENGINE_VERSION`" plus a Phase 2 note: community themes will need a backfill rule (tokens newer than a manifest's `engineVersion` filled from Default), or every token addition breaks every community theme. Add the calendar-ink change to the behaviour description.
- THEME-SYSTEM-PLAN.md status line: slice 2 (person palettes + calendar ink) implemented.
- docs/SPEC.md Themes subsection: 76 → 100 tokens; person-palette bullet; calendar ink bullet.
- 0010 (format per `docs/README.md`): person colours are theme tokens, not a host API (no contract growth, free boot cache/guards/getToken); `PERSON_PALETTE` stays a pinned literal rather than derived (keeps `chores-state.ts` dependency-free for the legacy test; serves as var fallback); Deep Space keeps Default's hue order.
- TASKS.md: extend the open companion-repo sync item text with "and document the `--rb-person-N-*` convention + fallback rule"; add to the open release item "first boot after update shows Default person colours for under a second until the 100-token cache is written (expected)". Do not rewrite other lines.
- This plan: status → "implemented (unreleased)".
- Security grep on staged diff before commit.
- Commit: `docs(theme): person palette tokens — spec, contract convention, decision 0010`
