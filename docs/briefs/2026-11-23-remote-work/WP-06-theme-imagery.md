# WP-06 — Theme system: imagery, confetti shapes, fonts and shape tokens (the launch set)

| | |
|---|---|
| **Repo** | `SchrodingerEQ/Rootboard.me`, three PRs in sequence, plus the Winter Holiday assets onto the open #55 branch |
| **Base** | latest `main` (with #57 merged), fresh clone, `npm ci` (npm 11) |
| **Waits on** | WP-05's #50 and #57, already in `main`; PR C also waits for the founder's image files |
| **Unblocks** | #55 (Winter Holiday, held 2026-11-24 until it carries imagery); the theme feature counting as launchable |
| **Network / secrets** | none. Every asset is a local file in the repo; no font or image is fetched at runtime (decision 0016 and the plan's local-fonts rule). |
| **Deliverable** | PR A (fonts and shape tokens: manifest v2 part 1) safe zone; PR B (image slots and confetti shapes: manifest v2 part 2) safe zone; PR C (Winter Holiday assets on the #55 branch) **waits for the founder's look in the dev server before it merges**; the end-of-run report |
| **Model** | per the README |
| **Done when** | PR A and PR B merged with Default and Deep Space valid under manifest v2; PR C open on the #55 branch with screenshots, or, if the founder's images have not arrived, the branch ready to take them with a placeholder set that is clearly not for release |
| **Unattended run** | PR A 2–3 h; PR B 4–6 h; PR C 1–2 h once the images exist |

## Goal

Make a theme feel like a theme. On 2026-11-24 the founder looked at
Winter Holiday (#55) in the dev server and said it reads as a colour
palette change, not a winter theme. That is exactly what the shipped
engine can do: slice 1 is 100 colour tokens, and every other element of
`THEME-SYSTEM-PLAN.md` "What a theme can change" (fonts, logo, screensaver
image, background imagery, confetti shapes, shape and depth tokens) is
still a later slice. This brief builds those slices, so the theme feature
is complete enough to launch and Winter Holiday can ship with imagery.

## Decisions already made (don't reopen)

| Decision | Answer | Where |
|---|---|---|
| Themes are structured tokens and declared assets only; no CSS, no JS, never layout or touch targets | yes | `THEME-SYSTEM-PLAN.md` decisions 1, 3; `THEME-ENGINE-SPEC.md` |
| Built-in themes are bundled TypeScript modules validated by `shared/theme-manifest.ts` | yes | decision 0009; SPEC §3.9 |
| Manual selection only; no third-party IP in any theme | yes | plan decisions 2, 3 |
| **#55 does not merge until Winter Holiday carries imagery** | yes | founder 2026-11-24 |
| **Image slots are separate and each optional:** main background (behind the content area of every view), header banner, sidebar, screensaver image, logo. A theme may supply any subset; an absent slot falls back to today's flat colour tokens | yes | founder 2026-11-24 ("make it so they are separate images if people want to load background images onto those as part of the contract") |
| **Every planned theme element is required for the theme feature to launch:** image slots, confetti shapes, fonts, shape and depth tokens. "Required" means the contract supports them and at least one built-in theme uses each; Default keeps its current look and declares no images | yes | founder 2026-11-24 ("all of the elements that are planned really need to be in place in order for us to ship the theme feature") |
| The founder generates the Winter Holiday images with an image generator from the slot table below; the agent does not author imagery | yes | founder 2026-11-24 |
| Image budget is enforced by the contract, sized for the Pi: main background and screensaver at most 1.5 MB each; header and sidebar at most 300 KB each; logo at most 100 KB; confetti shape at most 4 KB | proposed | this brief; the founder ratifies the numbers by merging it, and may change them in PR B's review |
| Confetti shapes are inline SVG path data validated by a strict grammar, not SVG files run through a sanitiser (the plan's "SVGs are sanitized" line); a path string cannot carry an element, attribute or URL | yes | this brief, for the same reason as the nav rail's `<img src>`-only rule |
| Adding manifest fields bumps `THEME_ENGINE_VERSION` to 2 and gets a decision record | yes | `THEME-ENGINE-SPEC.md` §2 |

## The image slots (measured 2026-11-24 in the dev server at 1920×1080, device pixel ratio 1)

| Slot | Region | Shown at (px) | Supply (px, device pixel ratio 1) | Fit rule |
|---|---|---|---|---|
| `background` | the content column of every view, below the header (`client/src/components/app-shell.tsx`: the `flex-1 flex flex-col overflow-hidden min-w-0` column minus the header) | 1816 × 988 | 1920 × 1080 (16:9; the app crops) | cover, centre anchor; views keep drawing on top |
| `header` | the view header bar (`<header>` in `calendar-header.tsx` and `day-view.tsx`, 88 px; in `pages/chores.tsx` and `pages/dinner.tsx`, 92 px) | 1816 × 88–92 | 1920 × 128 band | cover, centre anchor |
| `sidebar` | the nav rail (`client/src/components/nav-rail.tsx`, the `flex flex-col items-center flex-shrink-0` column) | 104 × 1080 | 128 × 1080 strip | cover, centre anchor |
| `screensaver` | the live overlay `client/src/components/screensaver/power-saving-overlay.tsx` (not `screensaver-overlay.tsx`, which is dead code; SPEC 3.6) | 1920 × 1080 | 1920 × 1080 | cover; replaces the two-colour gradient when present; the logo glow token still applies. The plan's "selection from the app's existing motion presets" is moot: the live overlay has one motion (the floating logo), so no preset field is added |
| `logo` | the nav-rail logo (76 × 76 on screen) and the screensaver's floating logo, both the whitelisted `attached_assets/image_1753142842256.png` today (imported as `@assets/…`) | 76 × 76 | 256 × 256 PNG with alpha | contain |
| `confettiShapes` | the burst in `client/src/components/chores/confetti-burst.tsx` | 8–16 px particles | 3–5 path strings on a 24 × 24 viewBox | each a single `<path>`, filled with the theme's `--rb-confetti-1…5` in rotation; the particle physics does not change |

Supply sizes are 1× because the Pi renders at device pixel ratio 1; a
2× asset doubles decode cost for no visible gain on the kiosk.

The generator parameters the founder uses to produce these (aspect to
ask for, what is cropped, the tone rule) are reproduced in the theme
authoring notes PR B writes (step 11), so a future theme author has them.

## Read first

1. `docs/plans/theme-system/STATUS-2026-11.md` (what the engine does
   today, and the "Later slices" table this brief executes);
   `THEME-ENGINE-SPEC.md` §2 (manifest), §3 (built-ins), §4 (engine), §6
   (boot cache), §8 (contrast guard), "Out of scope (later slices)";
   `THEME-SYSTEM-PLAN.md` "What a theme can change", "What a theme can
   never touch", "Theme format".
2. `docs/decisions/0009`, `0010`, `0016` (fonts are bundled woff2 in
   `client/src/assets/fonts/`, declared in `client/src/fonts.css`).
3. `shared/theme-manifest.ts`; `client/src/themes/*` (Default is the
   authoring reference); `client/src/lib/theme-engine.ts`; the inline
   boot script in `client/index.html` (`#rb-theme-boot`) and its test
   `client/src/lib/theme-boot-script.spec.ts`;
   `client/src/components/nav-rail.tsx` (note its
   `<img src>`-only rule for community icons: the same rule applies to
   every theme image); `client/src/components/chores/confetti-burst.tsx`
   (`runtimeConfettiColors`, the particle loop); `power-saving-overlay.tsx`.
4. `docs/plans/widget-system/CONTRACT.md` theme section (widgets read
   tokens; nothing here may change what a widget sees except new tokens
   they may ignore).
5. `CLAUDE.md` security review (images and fonts are tracked files that
   ship in the public tarball: no EXIF with a location or a real name,
   no embedded text, no third-party IP) and `CODING-STANDARDS.md`.

## Steps

### PR A — fonts and shape tokens (manifest v2, part 1)

1. **Manifest.** Add to `shared/theme-manifest.ts`: an optional `font`
   block (`family`, `fallback` stack as a plain string list, and the
   bundled file names it needs; the app keeps every size and weight), and
   the shape and depth tokens the plan names (`--rb-radius` for the
   corner scale and a shadow-softness value; pick the smallest set that
   lets a theme go from today's rounded look to a squarer or softer one
   without touching layout). Bump `THEME_ENGINE_VERSION` to 2. A v1
   manifest (no `font`, no new tokens) must still validate: new fields
   are optional and default to Default's values, so Deep Space keeps
   working untouched. Write the backfill rule the spec's Phase 2 note asks
   for now, since this is the first field addition.
2. **Engine and boot.** `applyTheme` sets the new tokens and the font
   family on `:root`; the inline boot script in `client/index.html`
   (`#rb-theme-boot`) carries the new fields and, on a v1 cache shape,
   applies the 100 colour tokens it has and logs one console line saying
   the cache predates manifest v2 (kernel rule 6: no silent fallback); no
   light flash, no crash on the first boot after update. Fonts: the
   theme names a family already declared by a bundled
   `@font-face`; PR A ships the mechanism and lets Winter Holiday use a
   bundled family other than Nunito only if one is already in
   `client/src/assets/fonts/` (a new font file is a licence and size
   decision for the founder, named in the report).
3. **Radius.** Replace the hard-coded radii that should follow the theme
   (`--radius: 0.9rem` in `client/src/index.css`, and the `rounded-[18px]`
   literals in the calendar, chores and dinner components) with the token.
   Touch target sizes and the 28 px scrollbars do not move.
4. **Tests and docs.** Manifest validation for the new fields (present,
   absent, wrong type); backfill from Default; boot cache round-trip with
   a v1 cache. Decision record `docs/decisions/0026-theme-manifest-v2.md`
   (why v2 is additive and optional, the backfill rule, the image budget
   from this brief). SPEC §3.9 and "Themes"; `THEME-ENGINE-SPEC.md`
   "Out of scope" lines struck with dated notes. Safe zone by the review;
   auto-merge per `/pr` rule 3 on green.

### PR B — image slots and confetti shapes (manifest v2, part 2)

5. **Manifest.** An optional `images` block with the five slots above,
   each a reference to a bundled asset (built-ins import the file through
   Vite so the URL is a hashed bundle path; nothing is fetched from
   outside the bundle), and an optional `confettiShapes` list of inline
   SVG path strings (not files: a path `d` attribute and a `viewBox`,
   validated against a strict grammar of path commands and numbers, so no
   element, attribute or URL can ride in). Size caps per the decisions
   table, enforced by a test over the built-in assets and by the
   validator for anything loaded later.
6. **Render paths.** Each slot renders as a positioned `<img>` or a
   `background-image` on its region with the fit rule in the table and
   the region's existing colour token underneath, so a missing or
   slow-to-decode image shows today's flat colour and never a gap. Images
   are `<img src>` or CSS `url()` of a bundle path only, never inline
   SVG or `innerHTML` (the nav-rail rule). Content stays on top at full
   opacity; nothing here changes a touch target or the on-screen keyboard
   lift. The screensaver image replaces the gradient; the floating logo
   uses the theme's logo when present.
7. **Surfaces over a background.** Today the month grid's cells and every
   card are opaque, so a main background shows only in margins and gaps.
   Do **not** change `--rb-surface` for the shipped themes. Instead,
   produce for the founder two screenshot sets of Winter Holiday with a
   stand-in background: one with opaque surfaces as today, one where the
   Winter Holiday manifest alone sets `--rb-surface` and the cell tokens
   to an `rgba()` with about 88 % alpha (the manifest colour schema
   already accepts `rgba()`). If the founder picks translucency, the
   contrast guard must composite the surface over the canvas before
   measuring; that is its own small PR between PR B and PR C (one PR,
   one thing), so the guard stays honest before any translucent theme
   lands. The founder picks one in PR C; both must pass the guard.
8. **Confetti shapes.** Particles render the theme's shapes (one `<svg>`
   per particle with the shape's path, `fill` from the confetti colour
   tokens in rotation) when the theme declares them; Default and Deep
   Space keep the current squares and circles. The physics in
   `confetti-burst.tsx` is untouched. The once-only fallback warning from
   #57 extends to a malformed shape.
9. **Pi cost.** Decode cost is the risk: one 1816×988 image and one
   screensaver image at the budget above, drawn once and left alone, are
   expected to be fine on a Pi 4; the burst must not re-create SVG
   elements per frame. Note the expected cost in the PR; the kiosk
   measurement is a founder checklist item.
10. **Tests.** Manifest validation of each slot and of the shape grammar
    (good path, path with an element, path with a URL, oversize file);
    the fallback when a slot is absent; the confetti particle list for a
    theme with shapes and one without. Node environment, no jsdom (adding
    a DOM test environment is a dependency decision outside this brief).
11. **Docs.** SPEC §3.9 and "Themes"; `THEME-ENGINE-SPEC.md` "Out of scope"
    lines struck; `STATUS-2026-11.md` rows closed; a new
    `docs/plans/theme-system/THEME-ASSETS.md`: the slot table above with
    the measured sizes, the fit rules, the budget, and the generator
    parameters (ask for 16:9 landscape at the largest size for the
    background and screensaver, 3:1 for the header and crop a centre
    band, 2:3 portrait for the sidebar and crop a centre strip; tone must
    match the theme's canvas colour; no text, no logos, no faces; even
    lighting; edges that fade to the base colour). `TASKS.md` authoring
    guide line gains a note that Default's asset set is now "none" by
    design and Winter Holiday's is the copyable example. Safe zone by the
    review; auto-merge on green.

### PR C — Winter Holiday assets (onto the #55 branch; waits for the founder)

12. Check out `claude/wp-05-winter-holiday` (PR #55), merge `main` in
    (never a rebase of a pushed branch). Add the founder's image files
    under `client/src/themes/winter-holiday/` with the names the manifest
    expects, run them through the budget test, strip metadata, and
    declare them in `winter-holiday.ts` together with 3–5 confetti shapes
    (snowflake, star, holly leaf, or what the founder sends) and the
    radius value. If the founder has not delivered images by the time PR
    B merges, stop here and say so: do not ship generated stand-ins.
13. Screenshots of Calendar month, Chores, Dinner, the screensaver and
    the burst in the PR body, both surface variants from step 7, and the
    #55 body updated to say the merge condition is now "the founder's
    look at the imagery". Open and stop; the founder decides. Changes go
    on the same branch.

### Tracker

14. `TASKS.md`: the "Theme system" line gets a dated note naming PR A, PR
    B and the held #55; the authoring-guide line the note from step 11.
    Do not tick either: the authoring guide and community install remain.

## Verification without hardware

- The three checks green for every PR.
- PR A: `npm run dev`, switch themes; radius follows the theme; Default
  and Deep Space look pixel-identical before and after the radius
  replacement (screenshot both at 1920×1080 on `main` and on the branch
  and compare); no light flash on reload with a cache written by v1
  (clear `localStorage` to simulate the first boot after update, then
  reload twice).
- PR B: with a fixture image set on a throwaway local theme (not
  committed), walk Calendar day/week/month, Chores, Dinner, What to Wear,
  Settings, the on-screen keyboard and the screensaver; remove one slot
  at a time and confirm the flat colour returns; check off a chore and
  see shaped particles in theme colours.
- PR C: the two screenshot sets; the Settings picker still shows five
  swatches for Winter Holiday.
- On the kiosk (founder checklist): Winter Holiday with imagery on the
  21.5-inch panel across the room; the burst stays smooth; memory and CPU
  in Diagnostics before and after a theme switch.

## If blocked

- A slot needs a region that has no single element to attach to (the
  header is per view): render it from the shell as a layer under the
  column rather than editing every view header; say so in the PR.
- The shape grammar rejects a shape the founder wants: simplify the path
  (one subpath, absolute commands) rather than loosen the grammar.
- An image under the budget still stalls the Pi: that is a kiosk finding
  for the founder checklist, not a reason to raise the budget here.
- Fonts: if no second bundled family exists, PR A ships the mechanism
  with Default and Deep Space declaring Nunito and the report names the
  font choice for Winter Holiday as a founder decision (licence and
  file size).

## Report (end of run)

**Done (PR A, PR B merged; PR C open on #55 or waiting for images) / Not
done and why / Findings worth a task (Pi cost, any token the guard cannot
cover, the font decision) / Founder actions (generate and hand over the
Winter Holiday images; pick opaque or translucent surfaces; look at #55
again; kiosk checks after the release that carries it).**
