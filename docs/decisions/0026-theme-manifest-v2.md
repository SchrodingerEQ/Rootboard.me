# 0026 — Theme manifest v2: additive, optional fields filled from Default
Date: 2026-11-24
Status: accepted (built under `docs/briefs/2026-11-23-remote-work/WP-06-theme-imagery.md`;
the launch set itself is founder decision 9 in that folder's README).
Where the background image is drawn, and what sits under the header and
sidebar images, is superseded by decision 0027 (manifest v3, 2026-11-27).

## Decision

The theme manifest grows past colours in two parts, both under
`THEME_ENGINE_VERSION = 2`:

- **Part 1 (fonts and shape):** an optional `font` block (`family`,
  `fallback`, `files`) and an optional `shape` block (`radiusScale`,
  `shadowSoftness`).
- **Part 2 (imagery and confetti shapes):** an optional `images` block
  (`background`, `header`, `sidebar`, `screensaver`, `logo`, each separate)
  and an optional `confettiShapes` list (1–5 SVG path strings on a 24×24
  viewBox), under the same version. Slot table and budget:
  `docs/plans/theme-system/THEME-ASSETS.md`.

Every field added after version 1 is **optional**, and the **backfill
rule** is: an absent field takes Default's value (`resolveThemeStyle` in
`shared/theme-manifest.ts`). For an image slot, Default's value is "no
image": the region keeps its flat colour token. A version 1 manifest
therefore still validates and renders exactly as it did; Deep Space is
left at `engineVersion: 1` on purpose as the proof.

Rules that come with it:

- **Font:** a theme names a family declared by an `@font-face` in
  `client/src/fonts.css` from a bundled woff2 file. Nothing is fetched
  (decision 0016). The family and fallback names are letters, digits,
  spaces and hyphens only, so the CSS value built from them carries a
  name and nothing else. Sizes and weights stay the app's.
- **Shape:** two multipliers on the app's own values, not lengths:
  `radiusScale` (0 to 2) on the corners of cards, cells, panels, dialogs
  and fields, and `shadowSoftness` (0 to 3) on the blur of card and cell
  shadows. Pills and circles stay round. A multiplier cannot change a
  size, a touch target or a layout, and at 1 the computed values are the
  old literals exactly. The shadow colours were already tokens
  (`--rb-shadow-*`), so depth needs no more than the blur scale.
- **Where they live:** the three resulting CSS custom properties
  (`--rb-font-family`, `--rb-radius-scale`, `--rb-shadow-softness`) are
  declared in `client/src/index.css` `:root` with Default's values and
  listed in `THEME_STYLE_PROPERTY_NAMES`, separate from the 100 colour
  tokens, so the colour grammar and the contrast guard are untouched.
- **Boot cache:** the cache gains a `style` object. The inline boot script
  applies each of the three properties only if its value matches that
  property's grammar. A cache without `style` was written before v2: the
  script repaints the colours it has, leaves `:root`'s Default font and
  shape in place, and logs one console line saying so. The first
  successful config load rewrites the cache.
- **Images are references to bundled raster files**, never URLs or SVG:
  a same-origin path with path characters only, or a small base64
  PNG/JPEG/WebP data URI. They render as `<img src>` (the logo) or CSS
  `url()` through `--rb-image-*` properties, the nav rail's rule for
  community icons. Each region layers its image over its existing colour
  token, so an absent or slow image shows today's flat colour. The
  background goes on each view's root next to its canvas fill rather than
  on the shell column: moving the fill exposed a header shadow the views
  had always covered, and keeping it where it was leaves image-free themes
  pixel-identical. Images are not in the boot cache.
- **Confetti shapes are path data, not files.** The plan said "SVGs are
  sanitized"; a grammar of path commands and numbers is simpler and
  stricter: a string with no `<`, quote, parenthesis or letters other than
  path commands cannot carry an element, attribute or URL. It is checked
  at load and again at burst time.
- **Image budget** (enforced from part 2): main background and screensaver
  at most 3 MB each; header and sidebar at most 500 KB each; logo at most
  150 KB; a confetti shape at most 4 KB. Supply sizes are 1× for a
  1920×1080 panel at device pixel ratio 1. The cap bounds the release
  tarball; the supply resolution bounds the decoded memory (about 8 MB
  for a 1920×1080 image, about 18 MB for all five slots).

## Context

Slice 1 shipped 100 required colour tokens at engine version 1. The
engine spec's Phase 2 note warned that the first field addition needs a
backfill rule, or every addition breaks every existing theme. On
2026-11-24 the founder held Winter Holiday because a colour-only theme
reads as a palette change, and set the full launch set (fonts, shape
and depth, imagery, confetti shapes) as required before the theme feature
ships.

## Alternatives considered

- **Make the new fields required.** Rejected: it would invalidate every
  version 1 manifest, and community themes (plan Phases 2–3) would break
  on every future addition.
- **Shape as absolute lengths** (`--rb-radius: 18px`). Rejected: the app
  uses about six radii (14 to 24 px), so one length either drives one of
  them or needs a ratio per call site. A multiplier keeps every
  proportion and is exactly 1 for Default.
- **Shape and font values inside `tokens`.** Rejected: `tokens` is
  colours only, checked by one grammar and the contrast guard; mixing
  units into it would weaken both.
- **Fonts as uploaded files in the manifest.** Out of scope: a new font
  file is a licence and size decision for the founder, so a theme picks
  from what the bundle already declares.
