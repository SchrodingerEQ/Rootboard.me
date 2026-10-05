# 0012 — What to Wear: widget-side forecast with host fallback, zippopotam lookup, fixed bands
Date: 2026-10-04
Status: accepted (brief founder-approved 2026-10-04)

## Decision

1. The What to Wear widget fetches Open-Meteo hourly data **itself** via
   `host.fetch` when a zip code is set, and falls back to the host's
   `/api/weather` (extended additively with `hourly` + `units`) when the
   zip is blank.
2. Zip → coordinates uses `api.zippopotam.us` (HTTPS, keyless), cached
   in `host.storage` (current zip only), looked up once per zip.
3. Temperature cutoffs and clothing rules are hard-coded in v1
   (`advice.ts` / `phrases.ts`), not user-tunable.
4. A built-in widget absent from an existing `dashboard.json` is listed
   in the layout picker as disabled and appended on enable; the default
   config includes `what-to-wear` disabled.

## Context and alternatives

- **Server-side only (extend `/api/weather` for everything).** Rejected:
  the kiosk's own location lives in `.env` and the widget needs a
  *different* location per zip. Routing zips through the server would
  add an endpoint and put a per-kid zip on the server path for no gain;
  the contract's v1 trust model already allows widget-side fetches.
- **Widget-side only (no host fallback).** Rejected: a kiosk with
  weather already configured should work on day one with no setup.
- **Open-Meteo's geocoder for zips.** Viable alternative, documented in
  the brief; zippopotam was chosen because it is purpose-built for
  postal codes and returns a clean place/state label. Swap only if it
  proves unreliable, and never call both.
- **User-tunable cutoffs.** Deferred: the brief locks sensible defaults;
  tuning would add settings UI with no on-screen keyboard benefit for a
  display-only widget.
- **Enable the widget by default.** Rejected: without a zip or host
  weather it only shows a setup message; opt-in keeps existing kiosks
  unchanged (value only accrues).

## Consequences

- Two outside hosts total for this widget (`api.open-meteo.com`,
  `api.zippopotam.us`), both documented in SPEC §3.10.
- `/api/weather` gains `hourly` and `units`; existing consumers ignore
  them. Payload grows by ≤ 48 entries.
- Zip is personal data: never logged, never in error text, no default.
- Changing a cutoff is a code change in `advice.ts` with a test update.
- Rule 6.2 was extended during review to carry Cold/Freezing-morning accessories into a warmer afternoon's outfit; the founder should confirm or revert.
