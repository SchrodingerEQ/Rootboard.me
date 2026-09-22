# Theme Engine — Phase 1, Slice 1 (design spec)

**Status:** implemented (unreleased).
**Date:** 2026-09-22
**Parent plan:** [THEME-SYSTEM-PLAN.md](THEME-SYSTEM-PLAN.md) (Phase 1).
**Decision record:** [0009](../../decisions/0009-theme-engine-persistence-and-token-layer.md).

This slice builds the theme *engine* and proves it with one dark theme.
It deliberately excludes fonts, imagery, confetti shapes, person palettes
and the two remaining seasonal themes — those are later slices (see
"Out of scope").

## Goals

1. A validated theme manifest format with every color token required.
2. Switching themes from the settings menu, persisted across browser
   resets and auto-updates, with no page reload.
3. No flash of the light Default at boot when a dark theme is active.
4. A theme that fails validation explains itself in the UI instead of
   silently disappearing.
5. Widgets learn about theme switches through the contract's existing
   `theme.subscribe`.
6. The Default look is visually unchanged (see "Fidelity" for the
   documented sub-perceptual deltas).

## Deliverables

- **Default** theme: the current palette, extracted verbatim.
- **Deep Space** theme: the dark proof theme, colors only.
- Theme picker + error surface in the settings menu.
- Real `theme.subscribe` in the widget host.

## Architecture

### 1. Token layers become one layer

Today two parallel palettes are live: the Rootboard `--rb-*` tokens
(~200 uses in app code) and the shadcn tokens (`--background`,
`--muted-foreground`, … — ~230 uses, almost all inside the
`components/ui` primitives: dialogs, popovers, selects, switches). A theme
that swapped only `--rb-*` would leave every dialog light.

`:root` in `client/src/index.css` is rewritten so every shadcn token is an
alias of a Rootboard token. Tailwind already reads these via `var(--x)`,
so `tailwind.config.ts` needs no change.

| shadcn token | aliases to |
|---|---|
| `--background` | `--rb-canvas` |
| `--foreground`, `--card-foreground`, `--popover-foreground`, `--secondary-foreground`, `--accent-foreground`, `--ring` | `--rb-ink` |
| `--card`, `--popover` | `--rb-surface` |
| `--muted`, `--secondary`, `--accent` | `--rb-chip` |
| `--muted-foreground` | `--rb-ink-tertiary` **(new token)** |
| `--border`, `--input` | `--rb-field-border` |
| `--primary` | `--rb-info` |
| `--primary-foreground`, `--destructive-foreground` | `--rb-on-color-ink` |
| `--destructive` | `--rb-danger` |

`--radius` stays a literal; shape tokens are not themed in this slice.

The `.dark` block in `index.css` is unreachable (`darkMode: ["class"]` is
configured but nothing ever adds the class). It stays as-is with a
comment marking it dead; it must not be relied on.

**New token:** `--rb-ink-tertiary: #787f8c` — the exact current
`--muted-foreground` value. Sits between `--rb-ink-secondary` and
`--rb-muted` on the ink ladder. Minted because aliasing muted text to any
existing token would visibly change 29 text sites and reduce contrast.

### Fidelity

The stylesheet's hex comments next to the shadcn HSL values were
approximate, so the two layers were never byte-identical. After aliasing,
Default is **visually identical, not byte-identical**. Recorded deltas
(computed HSL → alias):

| token | was | becomes | max channel delta |
|---|---|---|---|
| `--background` | `#f7f5f3` | `#f7f6f3` | 1 |
| `--foreground` (+ 5 aliases of ink) | `#2b2f36` | `#2b3038` | 2 |
| `--muted`/`--secondary`/`--accent` | `#efeeeb` | `#f1efea` | 2 |
| `--border`/`--input` | `#e4e2dd` | `#e7e4dd` | 3 |
| `--primary-foreground` | `#fafcff` | `#ffffff` | 5 |
| `--destructive` | `#e21d48` | `#e11d48` | 1 |
| `--primary` | `#2b77f3` | `#2563eb` | 20 |

`--primary` is the one visible shift. It is used only inside shadcn
primitives (zero uses in app code) and the change unifies the app on a
single blue. Accepted.

### 2. Manifest schema (`shared/theme-manifest.ts`)

Mirrors `shared/widget-manifest.ts`.

```ts
export const THEME_ENGINE_VERSION = 1;
export const THEME_TOKEN_NAMES = [ "--rb-canvas", /* … */ "--rb-ink-tertiary" ] as const; // 76 names
export const themeIdSchema = /* same rule as widgetIdSchema */;
export const themeManifestSchema = z.object({
  engineVersion: z.number().int().positive(),
  id: themeIdSchema,
  name: z.string().min(1).max(40),
  tokens: z.object(Object.fromEntries(THEME_TOKEN_NAMES.map(n => [n, cssColorSchema]))).strict(),
});
```

- **Every token is required.** A missing key fails validation. `.strict()`
  also rejects unknown keys so a typo surfaces instead of silently doing
  nothing.
- `cssColorSchema` accepts `#rrggbb`, `#rrggbbaa`, and `rgb()/rgba()`
  with numeric components. Nothing else (no `var()`, no `url()`, no
  named colors) — a manifest is data, never CSS.
- `engineVersion > THEME_ENGINE_VERSION` → rejected with the message
  "built for a newer Rootboard" (same policy as widgets).
- Adding a token later bumps `THEME_ENGINE_VERSION`.

### 3. Built-in themes (`client/src/themes/`)

Typed modules, bundled — no runtime fetch, no discovery endpoint.

```
client/src/themes/
  index.ts        // BUILTIN_THEMES: readonly unknown[] (raw, unvalidated on purpose)
  default.ts      // the current palette, every var() reference resolved to its concrete color
  deep-space.ts   // dark proof theme
```

`index.ts` exports the raw list; validation happens in the engine so an
invalid module is *reported*, not thrown at import time.

**Default is the authoring reference.** Because every token is required,
a theme author must be able to start from a complete, correct palette
and change only what they want. So `default.ts` is written to be copied:
tokens grouped and commented by role (the same grouping as `:root` —
canvas/ink, status colors, keyboard panel, screensaver, …), no clever
helpers, plain literals only. The future theme user guide (plan Phase 2)
must reproduce Default's complete token map — and, once later slices add
them, its assets (fonts, logo, screensaver image, confetti shapes) — as
copyable starting material, so an author can port any Default element
into their own theme verbatim. Deep Space follows the same file shape so
the two diff cleanly.

**Deep Space authoring constraints** (values are written during
implementation, not in this spec): dark navy / near-black canvas, slightly
lighter surface, cyan accent, amber badge/warn, cool muted inks. Original
design only — no franchise design language. Every pair in the contrast
list (§8) must pass WCAG AA 4.5:1; the test enforces it.

### 4. Engine (`client/src/lib/theme-engine.ts`)

Pure module, no React.

- `loadBuiltinThemes(raw) → { ok: ThemeManifest[]; failed: { id: string; message: string }[] }`
  — `safeParse` each entry; never throws. `id` for a failed entry is
  best-effort (`String(raw.id)` or `"<unknown>"`).
- `resolveTheme(id: string | undefined, ok) → ThemeManifest | null` — the
  manifest with that id, else the one with id `"default"`. If even Default
  failed validation (a build bug the tests catch), returns `null` and the
  engine applies nothing, leaving the raw stylesheet in charge.
- `applyTheme(manifest, root = document.documentElement)` — `setProperty`
  for every token, then notifies subscribers, then writes the cache.
  Default is applied through this same path (no special-casing), so the
  path is exercised on every boot.
- `subscribeTheme(cb) → unsubscribe` — plain listener set.
- `readThemeCache() / writeThemeCache(manifest)` — see §6.

### 5. Persistence (`data/config/dashboard.json`)

Supersedes plan decision 5 (`/api/state`); rationale in decision 0009.

`shared/dashboard-config.ts` gains:

```ts
theme: themeIdSchema.optional().catch(undefined),
```

`.catch(undefined)` makes the field **lenient**: a malformed value
becomes `undefined` (→ Default) instead of invalidating the whole file
and resetting the widget layout. An *unknown but well-formed* id also
resolves to Default (§4). `defaultDashboardConfig()` omits the field.

Writes go through the existing optimistic `writeDashboardConfig` helper
in `app-shell.tsx` (`c => ({ ...c, theme: id })`), inheriting its
rollback-and-toast on failure. SSH hand-edits are picked up by the
existing 60 s config poll.

### 6. Boot flash cache

Problem: the config arrives over HTTP after JS loads, so a dark theme
would flash light Default for a moment on every boot and every
post-update restart.

- On every successful `applyTheme`, the resolved manifest is mirrored to
  `localStorage["rootboard.theme-cache"]` as
  `{ engineVersion, id, tokens }`.
- `client/index.html` gets a small inline `<script>` in `<head>`, before
  the module script: read the cache (try/catch, ignore anything
  malformed), and for each key matching `/^--rb-[a-z0-9-]+$/` whose value
  matches the color grammar, `setProperty` it on `<html>`. It never
  touches non-`--rb-` properties.
- The config file remains the only source of truth. When it resolves,
  `applyTheme` runs and overwrites both the DOM and the cache. A stale
  cache is corrected within one boot; a cleared cache means one flash,
  then it is rebuilt.
- This is a **cache, not a store** — the plan's warning against
  localStorage persistence (brightness) is about source of truth and
  still holds.

### 7. UI (`settings-menu.tsx`)

**"Theme" section**, placed with the other appearance controls
(brightness). One row per validated theme: name, five swatches
(`canvas`, `surface`, `ink`, `accent`, `badge`), selected indicator.
Tapping a row calls `setTheme(id)`; the switch is immediate (optimistic
config write → effect → `applyTheme`). Rows honour the kiosk touch
minimums (48 / 56 px).

**"Theme Errors" section**, shown only when `failed` is non-empty.
Mirrors the existing "Widget Folder Errors" section: id + the validation
message, no controls. This is the error box requested in the design
session — a theme that can't load says why.

Wiring: a `useTheme(config)` hook in `client/src/hooks/use-theme.ts`
(load once, resolve on `config.theme` change, `applyTheme` in an effect)
returns `{ themes, failed, activeId, setTheme }`; `app-shell.tsx` passes
these down as props, the same way brightness and update controls reach
the menu today.

### 8. Contrast guard

`client/src/lib/color-utils.ts` gains `contrastRatio(hexA, hexB)` (WCAG
relative luminance). A test asserts a floor for every theme on the pairs below. **New themes: ≥ 4.5 (WCAG AA).** **Default is grandfathered** — it is shipped and must not change, and it measures below 4.5 on eight pairs (white on coral 3.1, white on amber 2.5, ink-tertiary on canvas 3.7, …), so it is pinned at its measured ratios in `client/src/themes/contrast.spec.ts` with a no-regression rule.

| ink | on |
|---|---|
| `--rb-ink`, `--rb-ink-secondary`, `--rb-ink-tertiary`, `--rb-ink-soft` | `--rb-canvas`, `--rb-surface` |
| `--rb-nav-inactive-ink` | `--rb-canvas` |
| `--rb-on-color-ink` | `--rb-accent`, `--rb-badge`, `--rb-danger`, `--rb-success`, `--rb-info`, `--rb-btn-dark-bg` |
| `--rb-badge-ink` | `--rb-badge` |
| `--rb-danger-ink` / `--rb-success-ink` / `--rb-info-ink` / `--rb-warn-ink` | their `-wash` |

Exempt: `--rb-muted`, `--rb-faint`, `--rb-ink-disabled` (decorative /
disabled by design), and every `rgba()` token.

### 9. Widget contract

`client/src/lib/widget-host-services.ts` `theme.subscribe` stops being a
stub and delegates to `subscribeTheme`. `getToken` is unchanged
(computed style already reflects `setProperty`).

`docs/plans/widget-system/CONTRACT.md` line "hosts without a theme
engine may never fire it" is reworded: it fires on every theme switch;
callbacks must still be idempotent. The three companion repos
(`rootboard-widget-template`, `rootboard-widget-grocery-list`,
`awesome-rootboard`) carry the same sentence and need the same edit —
tracked as a separate task, not part of this repo's change.

## Testing (vitest)

- Schema: rejects a manifest missing any one token; rejects an unknown
  token key; rejects `var(...)` / named colors; rejects
  `engineVersion > THEME_ENGINE_VERSION` with the "newer Rootboard"
  message.
- Built-ins: every module in `BUILTIN_THEMES` validates; ids are unique;
  one is `"default"`.
- Stylesheet guard: parse `:root` in `index.css`; the set of `--rb-*`
  names declared there **equals** `THEME_TOKEN_NAMES` (both directions),
  and every shadcn token is a `var(--rb-…)` alias.
- Default fidelity: `default.ts` tokens equal the concrete values in
  `:root` (with `var()` references resolved).
- Resolver: unknown id → default; `undefined` → default; known id → it.
- Cache: write → read round-trips; malformed JSON reads as `null`.
- Config schema: `theme: 123` and `theme: "../x"` parse to `undefined`
  without failing the document; a valid id survives.
- Contrast: §8 matrix for every built-in theme.
- `applyTheme` notifies subscribers exactly once per call and
  `unsubscribe` stops delivery.

No React renderer in the test setup (see `use-widget-state.spec.ts`), so
hook/UI wiring is verified on the dev server and on the kiosk.

## Rollout

One small release, per the project's release workflow:

1. Desktop: switch to Deep Space; open a dialog, a popover, the settings
   menu and the on-screen keyboard; confirm all dark. Switch back.
2. Kiosk: update, reboot (Firefox kiosk won't load new code without it),
   set Deep Space, reboot again — confirm **no light flash** at boot.
3. Hand-edit `data/config/dashboard.json` to `"theme": "nope"` — confirm
   Default within a minute and the widget layout untouched.

## Out of scope (later slices)

- Fonts (and fixing the existing remote Google Fonts loads in
  `client/index.html` and `index.css`, which contradict the plan's
  local-fonts rule — tracked in TASKS.md).
- Logo, screensaver and background imagery; confetti shapes.
- Confetti colors (`CONFETTI_COLORS` const still shadows the
  `--rb-confetti-*` tokens) and person palettes (hex in
  `calendar-meta.ts` / `chores-state.ts`).
- Spooky and Winter Holiday.
- Shape/depth tokens (`--radius`, shadow softness).
- Community / folder-drop themes (plan Phases 2–3).

## Files touched

```
shared/theme-manifest.ts                  (new)
shared/dashboard-config.ts                (theme field)
client/src/themes/{index,default,deep-space}.ts   (new)
client/src/lib/theme-engine.ts            (new)
client/src/lib/color-utils.ts             (contrastRatio)
client/src/hooks/use-theme.ts             (new)
client/src/index.css                      (:root aliases, --rb-ink-tertiary, .dark comment)
client/index.html                         (inline cache script)
client/src/components/app-shell.tsx       (useTheme wiring, props)
client/src/components/calendar/settings-menu.tsx  (Theme + Theme Errors sections)
client/src/lib/widget-host-services.ts    (real subscribe)
docs/plans/widget-system/CONTRACT.md      (subscribe wording)
docs/SPEC.md                              (new "Themes" section)
+ specs under client/src/**/*.spec.ts
```
