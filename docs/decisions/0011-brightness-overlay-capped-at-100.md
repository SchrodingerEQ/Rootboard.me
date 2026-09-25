# 0011 — Brightness is a dim overlay, capped at 100 %; kiosk uses native touch
Date: 2026-09-25
Status: accepted (founder-ratified 2026-09-25 — removes the 100–150 % range)

## Decision

1. Brightness is painted only as a fixed, click-through black overlay
   whose opacity is `1 − brightness` (`client/src/lib/brightness-layers.ts`).
   The page-wide `filter: brightness()` on `<html>` is gone.
2. The brightness slider range is **30–100 %** (was 30–150 %). A value
   saved above 100 % by an older build is clamped to 100 % on load.
3. The kiosk's labwc compositor is configured with
   `mouseEmulation="no"` for the touch device, so the browser receives
   real touch events. This is device setup, documented in
   `INSTALLATION.md` step 4, not app code.

## Context

The brightness slider lagged badly under touch on the reference kiosk
(Raspberry Pi 5, labwc, Firefox 151, 1080p60 HDMI panel with an ILITEK
USB touch digitizer). Removing React re-render churn did not fix it.
An on-device A/B measurement (alternate drags applied / skipped the
filter write) showed the cause:

| drags | page filter | frame time | pointer moves reaching the page |
|---|---|---|---|
| filter applied | yes | ~115 ms (<9 fps) | 9–11 / s |
| filter skipped | no | 17 ms (60 fps) | 43–45 / s |

The same held for emulated-mouse and native-touch input; the digitizer
itself reports ~130 events/s. A filter on the root element makes every
frame a full-page filtered repaint on the Pi — and because the
brightness setting left `brightness(N%)` on the page permanently, every
repaint in the app paid that cost, not just slider drags.

A black overlay's opacity is blended by the compositor as one quad, so
dimming is free. Brightening above 100 % has no equivalent cheap path —
it needs the filter — so the founder chose to remove that range rather
than keep a setting that slows the whole kiosk.

## Alternatives considered

- **Keep >100 % via the filter, applied only on release.** Rejected: the
  filter still sits on the page afterwards and slows every repaint.
- **Hardware dimming over DDC/CI** (the Pi 5 exposes the HDMI I²C buses).
  Deferred: monitor support is untested (`ddcutil` not installed); it
  would add a server endpoint and per-monitor variance. Still an option
  for real backlight control later.
- **Force GPU compositing in Firefox.** Deferred: the overlay removes the
  need; revisit only if other full-screen effects are ever wanted.

## Consequences

- Users set the monitor's own hardware brightness to the daytime maximum
  during setup; the app only dims below it (documented in
  `INSTALLATION.md`).
- The idle power-saving dim is now instant (the 0.5 s filter transition
  went with the filter).
- Rule for future work: no page-wide CSS `filter` / `backdrop-filter`
  effects on the kiosk.
