# Theme assets: image slots, confetti shapes, budget

Reference for anyone making a theme's images and confetti shapes.
Contract: `shared/theme-manifest.ts` (manifest v2, decision 0026). Written
2026-11-24 with WP-06 PR B; the sizes were measured that day in the dev
server at 1920×1080, device pixel ratio 1.

## The slots

Every slot is separate and optional. A theme may supply any subset; an
absent slot leaves its region on the theme's flat colour token. Default
declares no images, by design. Winter Holiday is the copyable example
once its images land.

| Slot | Region | Shown at (px) | Supply (px) | Fit | Colour underneath |
|---|---|---|---|---|---|
| `background` | each view's own area: the calendar views below their header; Chores, Dinner and What to Wear behind their whole page (their header bar covers the top) | 1816 × 988 (calendar) | 1920 × 1080 | cover, centre | `--rb-canvas` |
| `header` | the view header bar (calendar, Chores, Dinner) | 1816 × 88–92 | 1920 × 128 | cover, centre | `--rb-surface` |
| `sidebar` | the nav rail | 104 × 1080 | 128 × 1080 | cover, centre | `--rb-surface` |
| `screensaver` | the power-saving overlay, full screen | 1920 × 1080 | 1920 × 1080 | cover, centre | `--rb-power-saving-bg` |
| `logo` | the nav-rail logo and the screensaver's logo | 76 × 76 (rail) | 256 × 256 | contain | none (transparent PNG/WebP) |
| `confettiShapes` | the chore check-off burst | 7–13 px particles | 1–5 path strings on a 24 × 24 viewBox | each a single `<path>` | filled with `--rb-confetti-1…5` in rotation |

Content always draws on top at full opacity. Cards, cells and panels keep
their own colours, so a background shows in the margins and gaps around
them (see "Surfaces over a background" below).

Supply sizes are 1×: the kiosk's 21.5-inch 1920 × 1080 panel is expected to
report a device pixel ratio of 1 (a kiosk check confirms it). A 2× image
doubles the decode cost for nothing visible on the kiosk.

## Files and types

- Built-in theme images live in `client/src/themes/<theme-id>/` and are
  named after their slot: `background.jpg`, `header.webp`, `logo.png`, …
  The theme module imports each file (`import bg from "./<id>/background.jpg"`)
  so the manifest holds a bundled path, never a URL.
- Background, header, sidebar and screensaver: JPEG or WebP; PNG only for
  a flat illustration that fits the cap. Logo: PNG or WebP (it needs alpha).
- No SVG images: an image slot is a raster file, shown with `<img src>` or
  CSS `url()` only, never inline SVG or `innerHTML`.
- Strip all metadata before committing (EXIF can carry a location or a
  name). `client/src/themes/theme-assets.spec.ts` rejects JPEG APP1, PNG
  text/EXIF chunks and WebP EXIF/XMP.
- No text, logos, faces or third-party characters in any image.

## Budget

Enforced by `theme-assets.spec.ts` for built-ins and by the manifest
validator for inlined images (1 MB = 1,000,000 bytes):

| Slot | Cap |
|---|---|
| `background`, `screensaver` | 3 MB each |
| `header`, `sidebar` | 500 KB each |
| `logo` | 150 KB |
| one confetti shape | 4 KB of path data |

The cap bounds the release tarball. It does not bound the Pi's memory: a
browser decodes every image to 4 bytes per pixel whatever the file size,
so a 1920 × 1080 image costs about 8 MB decoded and all five slots about
18 MB. That is why the supply resolution, not the byte cap, is the figure
held at 1×.

## Confetti shapes

- 1 to 5 SVG path strings (`d` attribute data only) on a fixed 24 × 24
  viewBox. Path commands, numbers, spaces, commas and signs; must start
  with `M`/`m`. Anything else (an element, an attribute, a URL, a quote)
  is rejected, so nothing but a shape can ride in.
- Keep each shape to one subpath with absolute commands where you can.
  If a design does not fit the grammar, simplify the path; the grammar is
  not loosened.
- Particles keep the same motion as the default squares and circles. A
  shape that fails the check at burst time sends the burst back to
  squares and circles and logs one console warning.

## Making the images (generator parameters)

- **Background and screensaver:** ask for 16:9 landscape at the largest
  size offered; scale to 1920 × 1080.
- **Header:** ask for 3:1 and crop a centre band to 1920 × 128 (15:1).
  Keep the interest in the middle third: the band is cropped further on
  narrower views.
- **Sidebar:** ask for 2:3 portrait and crop a centre strip to
  128 × 1080.
- **Logo:** square, transparent background, 256 × 256.
- **Tone:** match the theme's `--rb-canvas` (backgrounds) or
  `--rb-surface` (header, sidebar) so text tokens stay readable; even
  lighting; edges that fade to the base colour; no text, no logos, no
  faces.

## Surfaces over a background

Month cells, cards and panels are opaque, so the main background shows
only in margins and gaps. A theme may make its own surfaces translucent
by setting `--rb-surface` and the cell tokens (`--rb-cell-weekend-bg`,
`--rb-cell-inactive-bg`) to `rgba()` with about 88 % alpha; the manifest
colour grammar already accepts it. **Before any built-in theme ships
translucent surfaces, the contrast guard (`themes/contrast.spec.ts`) must
composite the surface over the canvas before measuring** (WP-06 step 7);
until then, built-in themes keep opaque surfaces.

## Cost on the Pi

Each region image is drawn once by the browser and left alone: no
animation, no per-frame work. The confetti burst builds its 14 particle
elements once per check-off and only changes their transform and
opacity while they fly. Expected to be fine on a Pi 4 at the budget
above; the kiosk measurement (CPU and memory in Diagnostics before and
after a theme switch) is a founder checklist item.
