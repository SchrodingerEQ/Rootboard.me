# 0027 — Theme manifest v3: one continuous background, and text backing a theme controls
Date: 2026-11-27
Status: accepted (founder decision 10 in `docs/briefs/2026-11-23-remote-work/README.md`;
built under that folder's `WP-07-continuous-background-text-backing.md`, PR A)

## Context

Manifest v2 (decision 0026) gave the background, header and sidebar
separate image slots, each cover-cropped to its own region. Filled with
real art on 2026-11-27, the three pictures met at hard edges and the
theme read as disjointed. A single picture across the whole screen fixes
that, but then the title bar, the nav icons and Dinner's vote strip sit
over the picture, and each theme needs its own answer to keeping that
text readable.

## Decision

- **The `background` slot paints the whole shell.** `rb-image-background`
  moved from the view roots to the app shell's root, over the canvas
  colour, so one image covers the viewer once, rail and header bars
  included. Each view root fills with `--rb-view-fill`: the canvas colour
  when the theme sets no background image (so the paint order, and every
  pixel, stays as it was, including the header shadow 0026 kept covered),
  `transparent` when it does.
- **`header` and `sidebar` stay**, as optional overlays drawn above their
  region's backing. A theme may set any subset of the slots.
- **Text backing is part of the manifest.** An optional `backing` block
  with `header`, `rail` and `voteStrip`, each `none`, `solid` (one colour,
  alpha allowed) or `gradient` (two stops, `down` or `right`). Colours use
  the existing manifest grammar, so no `url()`, `var()` or CSS string can
  ride in; the engine builds the CSS. Two more directions or more stops
  are added only when a theme needs one.
- **Defaults keep shipped themes identical.** No background image: header
  and rail `solid` at `--rb-surface`, vote strip `none`, exactly today's
  surfaces. A background image and no `backing`: header and rail `solid`
  at the theme's canvas colour with 70 % alpha, vote strip `none`.
- **Rendering:** per region a colour property and an image property
  (`none` or a `linear-gradient`), applied as longhands, never the
  `background` shorthand, because the shorthand would reset the slot
  overlay's `background-image`. Where the overlay shares the element the
  layer order is slot image, gradient, colour. `:root` declares every
  property with the no-image default, so the first paint before the
  engine runs, and any theme without images, resolve to today's values.
- **Version 3, same backfill rule as 0026.** A v1 or v2 manifest validates
  and takes the defaults. The boot cache gains a `layers` object; a cache
  without it predates v3, keeps `:root`'s defaults and logs one line.
- **The contrast guard composites.** A background token with alpha is
  composited over `--rb-canvas` before it is measured, and `--rb-ink` is
  measured over each backing region as resolved, composited over the
  canvas. A gradient is measured at both stops: the run lies between
  them, so the worse stop bounds it. The real picture under a backing is
  not known to the guard; the canvas colour is the stand-in, which is why
  the image guidance asks for a calm top band and left column.

## Alternatives considered

- **Keep three images and blend their edges.** Rejected: every theme
  author would have to paint matching seams by hand, and the founder's
  art showed it fails in practice.
- **A fixed full-viewport layer behind the shell** (`position: fixed`).
  Not needed: the shell root carries the image without a layout or
  stacking change, so the brief's fallback stayed unused.
- **A free CSS `background` string per region.** Rejected: themes are
  structured tokens and declared assets only (`THEME-SYSTEM-PLAN.md`
  decisions 1 and 3); a string would let a theme inject any styling.
- **Backing for cards and month cells too.** Deferred: they stay opaque
  unless a theme sets their tokens to `rgba()`, which the guard now
  composites.
