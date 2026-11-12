# 0016 — Fonts are bundled woff2 files; the page loads nothing from outside the device
Date: 2026-11-11
Status: accepted (founder-directed 2026-11-11); amended 2026-11-11 — Google Sans dropped, see the update at the end

## Decision

1. The kiosk page loads nothing from outside the device at page load.
   Anything that leaves the device does so because a feature the owner
   chose needs it (calendar sync, weather, zip lookup, update check).
   Guarded by `client/src/lib/no-outside-page-load.spec.ts`.
2. Fonts ship as woff2 files committed under
   `client/src/assets/fonts/<family>/`, declared in
   `client/src/fonts.css`, with each family's `OFL.txt` beside its
   files. Vite copies them into `dist/public/assets`.
3. The `@font-face` blocks keep the exact subsets and unicode-ranges
   Google Fonts served (fetched 2026-11-11), so the browser still
   downloads only the subsets a page's text needs (Latin only, in
   practice).

## Context and alternatives

A privacy check found two outside requests on every page load that no
feature needed: Google Fonts (`client/index.html` linked Google Sans,
`client/src/index.css` `@import`ed Nunito) and a replit.com
development-banner script that the build copied into production. Both
told a third party the kiosk's IP and user agent on every load and made
the look depend on those hosts being reachable. The founder ruled both
out and asked for the two fonts to be bundled on the device.

- **Licences.** Nunito is SIL OFL 1.1. Google Sans was historically
  Google-only, but Google's own repository now publishes it under SIL
  OFL 1.1 (`google/fonts`, `ofl/googlesans`, "Copyright 2025 The Google
  Sans Project Authors"), with no Reserved Font Name. Its
  `TRADEMARKS.md` keeps "Google" and "Google Sans" as trademarks: the
  name may label the font itself, never a Rootboard product, theme or
  feature name. So both may be committed to a public repo.
- **`@fontsource` npm packages** — rejected: two new dependencies for
  static files, and the licence would live in `node_modules` instead
  of next to the files the release ships. Committed files also match
  the theme plan's rule that a theme bundles its own font files.
- **One full variable TTF per family** — rejected: the full Google Sans
  file covers dozens of scripts in one download; the subset files keep
  each load to what the text needs.

## Consequences

- About 1.3 MB of woff2 in the repo and in every release tarball
  (Nunito ~140 KB in 5 files; Google Sans ~1.1 MB in 27 files).
- **Google Sans is declared but no CSS rule uses it** (it was linked
  but unused before this change too). An unused face is never
  downloaded by the browser. It is bundled because the founder asked
  for both fonts; dropping it is a one-line founder call.
- Updating a font means re-fetching the files and the `@font-face`
  blocks by hand; nothing updates them automatically.

## Update 2026-11-11 — Google Sans dropped

The founder ruled: "drop the unused Google Sans font and remove the
database storage path" (founder, 2026-11-11). Google Sans was removed
from `client/src/fonts.css` and `client/src/assets/fonts/`; Nunito is
now the only bundled family (~140 KB). No CSS rule ever used Google
Sans, so nothing renders differently.
