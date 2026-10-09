# 0013 — No browser zoom on the kiosk: `touch-action: pan-x pan-y` plus Firefox prefs
Date: 2026-10-08
Status: accepted (founder-directed 2026-10-08)

## Decision

1. The document root declares `touch-action: pan-x pan-y`
   (`client/index.html`), and no rule below it may re-enable zoom with
   `manipulation`, `pinch-zoom`, or `auto`. `.touch-button` uses the
   same value. Touch scrolling of inner containers (week grid, lists)
   is unaffected. Guarded by `client/src/lib/kiosk-zoom-policy.spec.ts`.
2. The reference kiosk's Firefox profile additionally pins zoom off in
   `user.js` (`apz.allow_zooming`, `apz.allow_double_tap_zooming`,
   `zoom.minPercent`/`zoom.maxPercent` at 100, trackpad pinch commands
   cleared). This is device setup, documented in `INSTALLATION.md`
   step 4, not app code.

## Context and alternatives

A two-finger pinch on the kiosk zoomed the whole page. The layout is
sized to the screen (`h-screen`, `body { overflow: hidden }`), so a
zoomed visual viewport leaves the dashboard panning instead of fitting —
reported as "the view no longer fits without scrolling". Nothing in the
app had been touched: a 1920×1080 viewport at scale 1 renders every
view without document overflow, on the device and locally.

The page already carried two zoom opt-outs that do not work here:

- `<meta name="viewport" ... user-scalable=no>` — Firefox desktop does
  not apply the viewport meta.
- `body { touch-action: manipulation }` — per the spec and MDN this is
  an alias for `pan-x pan-y pinch-zoom`: it removes only double-tap
  zoom and explicitly **keeps** pinch zoom.

Firefox ships `apz.allow_zooming=true` and
`apz.allow_double_tap_zooming=true` unconditionally, so a touchscreen
pinch is a smooth APZ zoom of the visual viewport. APZ honors CSS
`touch-action`; dropping `pinch-zoom` from the allowed set is the
page-side fix that works in Firefox and Chromium alike.

- **`touch-action: none` on the root.** Rejected: it would also stop
  touch scrolling in every inner scroll container.
- **Prefs only.** Rejected as the sole fix: the app ships to other
  kiosks via the updater, and a page-side rule travels with it. Prefs
  stay as a second layer because `touch-action` cannot block
  Ctrl+wheel / keyboard zoom.

## Consequences

- Users cannot zoom the dashboard at all — by design for a wall display;
  the UI is already tuned for the screen size.
- Any future rule that sets `touch-action` must keep pinch-zoom out of
  its value; the spec file fails the build otherwise.
- New kiosk installs apply the Firefox `user.js` prefs during step 4.
