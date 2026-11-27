# WP-07 — Theme system: one continuous background, and text backing a theme controls

| | |
|---|---|
| **Repo** | `SchrodingerEQ/Rootboard.me`, two PRs in sequence, the second onto the open #55 branch |
| **Base** | latest `main` (with #63, #64, #65), fresh clone, `npm ci` (npm 11) |
| **Waits on** | nothing for PR A; PR B waits for the founder's new full-screen Winter Holiday image |
| **Unblocks** | #55 (Winter Holiday) shipping with imagery; any community theme that uses a background image |
| **Network / secrets** | none. Assets stay local files; nothing is fetched at runtime. |
| **Deliverable** | PR A (engine: shell-level background, header and rail as overlays, text-backing contract, guard compositing) safe zone; PR B (Winter Holiday on the new image, with backing values) **waits for the founder's look in the dev server**; the end-of-run report |
| **Model** | per the README |
| **Done when** | PR A merged with Default and Deep Space pixel-identical to `main`; PR B open on #55 with screenshots, or the branch ready and waiting if the image has not arrived |
| **Unattended run** | PR A 3–5 h; PR B 1–2 h once the image exists |

## Goal

On 2026-11-27 the founder put his three Winter Holiday images into the
three slots #64 built (background, header, sidebar) and looked at the
result in the dev server. Each image was fine alone; the seams between
them were not: three separately cover-cropped pictures meet at hard
edges, so the theme reads as disjointed. His decision: the main
background becomes **one continuous image across the whole viewer**,
rail and header included; the header and sidebar slots stay for theme
authors who want distinct art there, as overlays; and because a
continuous picture runs under the title bar and the nav icons, **the
backing behind that text becomes part of the theme contract** so an
author can choose transparent, semi-transparent, solid or a gradient per
region to keep text readable over their own art.

## Decisions already made (don't reopen)

| Decision | Answer | Where |
|---|---|---|
| Themes are structured tokens and declared assets only; no CSS, no JS, never layout or touch targets | yes | `THEME-SYSTEM-PLAN.md` decisions 1, 3 |
| Manifest v2 is additive and optional; new fields default to Default's values; adding fields is a version bump and a decision record | yes | decision 0026 |
| **The `background` slot paints the whole shell**: one image, cover-fit to the full viewport, under the rail, the header bars and every view | yes | founder 2026-11-27 |
| **`header` and `sidebar` slots are kept** as optional overlays drawn on top of the continuous image inside their regions; a theme may set any subset | yes | founder 2026-11-27 ("keep the header and the rail bars in there for potentially if anyone wants to create a theme to use those separately") |
| **Text backing is a theme feature.** For each region that carries text over the picture (header bar, nav rail, and the chip row of the Dinner vote strip), the theme chooses: none (transparent), a solid colour with alpha (semi-transparent), or a two-stop gradient. Defaults keep today's look | yes | founder 2026-11-27 ("the ability to make the header boxes or background elements of certain text transparent, semi-transparent, or have a colored gradient background ... should be part of creating the theme") |
| Translucent cards and cells remain the theme's choice through `rgba()` tokens; the contrast guard composites a translucent surface over the canvas before measuring, and that guard change lands in PR A so PR B may use it | yes | THEME-ASSETS.md "Surfaces over a background"; WP-06 step 7 |
| Default and Deep Space render pixel-identical to `main` after PR A (they declare no images, so backing defaults must reproduce today's solid surfaces) | yes | WP-06 PR A/B precedent |
| The founder generates the new full-screen Winter Holiday image; the agent does not author imagery | yes | founder 2026-11-24, 2026-11-27 |

## The contract additions (manifest v3)

Add to `shared/theme-manifest.ts`, all optional, under one block:

```ts
backing?: {
  header?: Backing;   // the view header bar (calendar, Chores, Dinner)
  rail?: Backing;     // the nav rail
  voteStrip?: Backing; // Dinner's "vote on upcoming dinners" row of slots
};
type Backing =
  | { kind: "none" }
  | { kind: "solid"; color: CssColor }                       // rgba() gives semi-transparent
  | { kind: "gradient"; from: CssColor; to: CssColor; direction: "down" | "right" };  // a bar fades down, a rail fades right; add more only when a theme needs one
```

- `CssColor` is the existing colour grammar (`#rrggbb`, `#rrggbbaa`,
  `rgb()`, `rgba()`): never `url()`, never `var()`, never a raw CSS string,
  so no theme can inject styling beyond these values.
- Defaults, so nothing shipped changes: when a theme sets **no**
  `background` image, every region's backing is `solid` with that
  region's current token (`--rb-surface` for header and rail). When a
  theme **does** set a background image and leaves `backing` out, header
  and rail default to `solid` at the theme's `--rb-canvas` with 70 % alpha
  and the vote strip to `none`. A theme overrides any of them.
- Engine version goes to **3**; the backfill rule from 0026 applies (a
  v2 manifest validates and gets the defaults). Decision record
  `docs/decisions/0027-theme-manifest-v3-continuous-background.md`.
- Rendering is two CSS custom properties per region: a colour layer
  (`--rb-backing-header-color`, and so on) and an image layer
  (`--rb-backing-header-image`, `none` or a `linear-gradient(...)`),
  built by the engine from validated parts; the manifest never carries a
  CSS string. Each region applies them as **separate longhands**, never
  the `background` shorthand, because the shorthand resets
  `background-image`, and the `header` and `sidebar` slot images share
  that property: the region's `background-image` is the two-layer list
  `var(--rb-image-<slot>), var(--rb-backing-<region>-image)` with the
  slot image on top, the gradient under it, and the colour under both.
  `:root` declares every backing property with the no-image default so a
  theme without images, and the first paint before the engine runs,
  resolve to today's values.
- The 70 % alpha default is the engine converting the theme's `--rb-canvas`
  (hex or rgb) to an `rgba()`; `color-utils.ts` already parses hex.
- The header bars also carry `boxShadow: var(--rb-shadow-soft)` today;
  that stays as it is for every theme, since it is not part of backing.
- Cards, month cells and panels are **not** backing regions in this
  brief: they stay opaque unless a theme sets their tokens to `rgba()`,
  which the guard now composites. A gradient on cards is a later slice if
  ever wanted. The Dinner vote strip is included because its slots are
  transparent already and the 2026-11-27 look showed a label lost over a
  bright patch of art.

## Measured regions (2026-11-24 dev server, 1920×1080, device pixel ratio 1)

| Region | Box | Note for image authors |
|---|---|---|
| whole viewer (the `background` slot after PR A) | 1920 × 1080 | one 16:9 image, cover, centre |
| nav rail | x 0–104, full height | logo at the top (76 × 76 at y 18), three icons below, the Settings gear at the bottom |
| header bar | x 104–1920, y 0–88 (calendar) or 0–92 (Chores, Dinner) | title at the left, buttons at the right |
| content area | x 104–1920, y 88–1080 | cards and grids are opaque unless the theme makes them translucent |

## Read first

1. `docs/plans/theme-system/THEME-ASSETS.md` (whole; its slot table and
   "Surfaces over a background" change in this brief); `STATUS-2026-11.md`;
   `THEME-ENGINE-SPEC.md` §2, §4, §6, §8; decisions 0009, 0026.
2. `shared/theme-manifest.ts` (the v2 `images`, `font`, `shape` blocks and
   the backfill); `client/src/lib/theme-engine.ts` (`applyTheme`, the
   image properties, `activeManifest`); `client/src/index.css` lines
   236–253 (the `rb-image-*` classes) and the `:root` block;
   `client/src/components/app-shell.tsx` (the `h-screen flex bg-background`
   root at line 1209 and the content column); `client/src/components/nav-rail.tsx`;
   the three header bars (`client/src/components/calendar/calendar-header.tsx:108`,
   `client/src/pages/chores.tsx:57`, `client/src/pages/dinner.tsx:82`);
   the view roots carrying `rb-image-background` (`day-view.tsx`,
   `week-view.tsx`, `month-view.tsx`, `chores.tsx:55`, `dinner.tsx:80`,
   and the What to Wear widget root, `client/src/widgets/what-to-wear/WhatToWear.tsx:133`,
   which must lose the class too or it paints a second copy of the image).
3. `client/src/themes/contrast.spec.ts` and `people-contrast.spec.ts`
   (the pairs and floors), `theme-assets.spec.ts`, and
   `client/src/lib/theme-boot-script.spec.ts`.
4. The WP-06 hand-over note and #64's description (its screenshot method
   for the pixel-identical check against `main`).
5. `CLAUDE.md` security review; `CODING-STANDARDS.md`.

## Steps

### PR A — engine (safe zone)

1. **Background moves to the shell.** The `rb-image-background` class
   leaves the view roots and goes on the shell root, with the canvas
   colour under it, so one image covers 1920 × 1080 once. The view roots
   keep their canvas fill only when no background image is set (a
   transparent root otherwise), so a theme without images renders as
   before. The three header bars lose their `bg-rb-surface` class and the
   rail its inline `backgroundColor: var(--rb-surface)` style
   (`nav-rail.tsx` line 93) in favour of `background: var(--rb-backing-*)`,
   whose default with no image is exactly that surface colour.
2. **Header and sidebar slots become overlays.** `rb-image-header` and
   `rb-image-sidebar` stay on their elements and paint above the backing,
   so a theme that sets them gets distinct art there and a theme that
   does not gets the continuous picture showing through.
3. **Backing contract.** Add the `backing` block, the three CSS
   properties, the engine string-builder, the defaults, the v3 bump and
   backfill, and the boot script's handling of the new properties (a v2
   cache applies what it has and logs once, as #63 did for v1).
4. **Contrast guard composites.** Where a theme's `--rb-surface`,
   cell tokens or a `solid` backing carry alpha, the guard composites the
   colour over `--rb-canvas` (and a backing over the canvas) before
   measuring, and adds the pairs `--rb-ink` over each backing region.
   A gradient is measured at both stops. Floors stay as they are.
5. **Dinner vote strip.** Its dashed "Add meal" slots are transparent
   today, so a bright patch of background art made one label hard to
   read on 2026-11-27. The strip takes the `voteStrip` backing (default
   `none`, so Default and Deep Space are unchanged).
6. **Tests.** Manifest: each backing kind validates; a `url(` or `var(`
   in a colour is rejected; defaults with and without a background
   image; v2 backfill. Engine: the built `background` strings. Guard:
   a translucent surface that passes only after compositing, and one
   that fails. Node environment, no jsdom.
7. **Pixel check.** Default and Deep Space at 1920 × 1080 across the five
   views, `main` versus the branch, as #63 and #64 did. Any difference is
   a bug in the defaults.
8. **Docs.** THEME-ASSETS.md: the slot table's `background` row becomes
   "the whole viewer, 1920 × 1080, under everything"; `header` and
   `sidebar` become "optional overlays on their regions"; a new "Text
   backing" section with the three kinds, the defaults and the measured
   regions above; "Making the images" gains the full-screen safe-area
   note (top 92 px band and left 104 px column carry text and icons; keep
   them calm). SPEC §3.9 and "Themes"; `THEME-ENGINE-SPEC.md` status
   line; decision 0027; `TASKS.md` note. Safe zone by the review;
   auto-merge on green.

### PR B — Winter Holiday on the new image (onto #55; waits for the founder)

9. Check out `claude/wp-05-winter-holiday` under a new local branch
   name (another worktree may hold the branch itself), merge `main` in. Replace the three images with the founder's one full-screen image
   as `background.jpg` (cover 1920 × 1080, metadata stripped, under the
   3 MB cap); delete `header.jpg` and `sidebar.jpg` and their manifest
   entries. Declare these three confetti shapes (24 × 24 viewBox; a six-point
   snowflake, a four-point sparkle, a round berry):

   ```text
   M12 2 L15 7.5 L21 7.5 L18 12 L21 16.5 L15 16.5 L12 22 L9 16.5 L3 16.5 L6 12 L3 7.5 L9 7.5 Z
   M12 2 L14 10 L22 12 L14 14 L12 22 L10 14 L2 12 L10 10 Z
   M12 4 A8 8 0 1 1 11.99 4 Z
   ```
10. Set `backing`: header and rail as a gradient from the canvas colour
    at about 80 % alpha down to transparent (so the title sits on a calm
    band that fades into the picture), vote strip `solid` canvas at 60 %.
    The guard must pass after compositing; a failure is a value to
    change, never a floor to lower.
11. Screenshots of Calendar day, week, month, Chores, Dinner and the
    theme picker in the PR body; update #55's description so the merge
    condition reads "the founder's look at the continuous image". Open
    and stop. If the image has not arrived, stop at step 9 with the
    branch merged and say so.

### Tracker

12. `TASKS.md` "Theme system" line: dated note naming PR A and the held
    #55. Do not tick it.

## Verification without hardware

- The three checks green for every PR.
- PR A: `npm run dev` with a throwaway local theme (not committed) that
  sets a background image and each backing kind in turn: none, solid
  with alpha, gradient; the image is continuous under rail, header and
  views; the header overlay slot still works when set; remove the image
  and the app looks exactly like `main`.
- PR B: the screenshot set; the title and the nav icons are readable
  over the art at a glance from arm's length.
- Kiosk (founder checklist): Winter Holiday across the room; one decoded
  image instead of three, so CPU and memory should be lower than the
  2026-11-27 three-image build.

## If blocked

- The shell root cannot carry the image without a layout change (an
  overflow or stacking problem): put a fixed, full-viewport layer behind
  the shell (`position: fixed; inset: 0; z-index: 0`) and raise the shell
  above it; say so in the PR.
- A gradient backing cannot be measured sensibly by the guard: measure
  the opaque stop and the midpoint composited over the canvas, and note
  it in the decision record.
- The founder's image is not 16:9: letterbox is not an option (the
  background must cover); crop to 16:9 from the centre and say what was
  lost.

## Report (end of run)

**Done (PR A merged; PR B open on #55 or waiting for the image) / Not
done and why / Findings worth a task / Founder actions (hand over the
full-screen image; look at #55; kiosk checks after the release).**
