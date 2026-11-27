# Theme assets: image slots, confetti shapes, budget

Reference for anyone making a theme's images and confetti shapes.
Contract: `shared/theme-manifest.ts` (manifest v2, decision 0026; v3,
decision 0027). Written 2026-11-24 with WP-06 PR B; the sizes were
measured that day in the dev server at 1920×1080, device pixel ratio 1.
Updated 2026-11-27 with WP-07 PR A: the `background` slot paints the whole
viewer, the `header` and `sidebar` slots are overlays, and the backing
behind text over the picture is a theme choice (see "Text backing").

## The slots

Every slot is separate and optional. A theme may supply any subset; an
absent slot leaves its region on the theme's flat colour token. Default
declares no images, by design. Winter Holiday is the copyable example
once its images land.

| Slot | Region | Shown at (px) | Supply (px) | Fit | Colour underneath |
|---|---|---|---|---|---|
| `background` | the whole viewer, under everything: one image under the nav rail, the header bars and every view | 1920 × 1080 | 1920 × 1080 | cover, centre | `--rb-canvas` |
| `header` | optional overlay on the view header bar (calendar, Chores, Dinner), drawn above the header's text backing | 1816 × 88–92 | 1920 × 128 | cover, centre | the header's backing, then the background image |
| `sidebar` | optional overlay on the nav rail, drawn above the rail's text backing | 104 × 1080 | 128 × 1080 | cover, centre | the rail's backing, then the background image |
| `screensaver` | the power-saving overlay, full screen | 1920 × 1080 | 1920 × 1080 | cover, centre | `--rb-power-saving-bg` |
| `logo` | the nav-rail logo and the screensaver's logo | 76 × 76 (rail) | 256 × 256 | contain | none (transparent PNG/WebP) |
| `confettiShapes` | the chore check-off burst | 7–13 px particles | 1–5 path strings on a 24 × 24 viewBox | each a single `<path>` | filled with `--rb-confetti-1…5` in rotation |

Images are not in the boot cache. After a restart the theme's colours
show at once and its images, the logo included, appear when the theme
loads a moment later (the app's own logo shows until then).

Content always draws on top at full opacity. Cards, cells and panels keep
their own colours, so a background shows in the margins and gaps around
them (see "Surfaces over a background" below). A theme that wants one
continuous picture sets `background` only; `header` and `sidebar` are for
an author who wants distinct art in those regions, and a theme may set
any subset.

## Text backing

Three regions carry text over the picture: the view header bar (calendar,
Chores, Dinner), the nav rail, and the chip row of Dinner's "Vote on
upcoming dinners" strip. For each, the manifest's optional `backing`
block (manifest v3) chooses what sits behind the text:

| Kind | Manifest | Renders |
|---|---|---|
| none | `{ kind: "none" }` | transparent: the picture shows through |
| solid | `{ kind: "solid", color }` | one colour; `rgba()` or `#rrggbbaa` makes it semi-transparent |
| gradient | `{ kind: "gradient", from, to, direction }` | two stops; `direction` is `down` (a bar) or `right` (the rail) |

```ts
backing: {
  header: { kind: "gradient", from: "rgba(247, 246, 243, 0.8)", to: "rgba(247, 246, 243, 0)", direction: "down" },
  rail: { kind: "solid", color: "rgba(247, 246, 243, 0.7)" },
  voteStrip: { kind: "solid", color: "rgba(247, 246, 243, 0.6)" },
},
```

Colours use the manifest colour grammar only (`#rrggbb`, `#rrggbbaa`,
`rgb()`, `rgba()`); never `url()`, `var()` or a CSS string. The engine
builds the CSS.

Defaults, when a region is left out:

| Theme | header, rail | voteStrip |
|---|---|---|
| no `background` image | `solid` at `--rb-surface` (today's look) | `none` |
| a `background` image | `solid` at `--rb-canvas`, 70 % alpha | `none` |

The header bars keep their soft shadow whatever the backing. The contrast
guard measures `--rb-ink` over each region's backing composited over
`--rb-canvas`, at both stops of a gradient.

Measured regions (2026-11-24 dev server, 1920 × 1080, device pixel ratio 1):

| Region | Box | Note for image authors |
|---|---|---|
| whole viewer (the `background` slot) | 1920 × 1080 | one 16:9 image, cover, centre |
| nav rail | x 0–104, full height | logo at the top (76 × 76 at y 18), three icons below, the Settings gear at the bottom |
| header bar | x 104–1920, y 0–88 (calendar) or 0–92 (Chores, Dinner) | title at the left, buttons at the right |
| content area | x 104–1920, y 88–1080 | cards and grids are opaque unless the theme makes them translucent |

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
- **Full-screen safe area (background):** the top 92 px band and the left
  104 px column carry the title, buttons and nav icons. Keep them calm
  (low detail, even tone) so the text backing can stay light; put the
  interest in the content area.
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
colour grammar already accepts it. The contrast guard
(`themes/contrast.spec.ts`, `people-contrast.spec.ts`) composites a
translucent surface or cell token over `--rb-canvas` before measuring
(WP-07 PR A), so a built-in theme may ship translucent surfaces as long
as the composited result passes the same floors.

## Cost on the Pi

A theme that sets `background` only decodes one full-screen image (about
8 MB) for the whole viewer. Each region image is drawn once by the browser and left alone: no
animation, no per-frame work. The confetti burst builds its 14 particle
elements once per check-off and only changes their transform and
opacity while they fly. Expected to be fine on a Pi 4 at the budget
above; the kiosk measurement (CPU and memory in Diagnostics before and
after a theme switch) is a founder checklist item.
