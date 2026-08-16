# 0006 — Community-buildable widget system

Date: 2026-08-15
Status: accepted (founder-ratified)

## Decision

Extend the theme system's pure-data philosophy (JSON manifests,
Zod-validated) from appearance to **function**: a widget is a folder with
a manifest.

- **Contract:** manifest (name, version, `"apiVersion": 1` from day one,
  size constraints, config schema) + lifecycle (mount/unmount/refresh) +
  a small set of host services (storage, settings, theme CSS variables,
  fetch). Widgets touch ONLY this public contract.
- **Dogfooding:** all first-party built-in widgets are rebuilt on the
  same public API — no privileged internal widgets.
- **Loading model:** drop a folder into `/widgets/`, Zod validation on
  load, widget appears in the layout picker. Sideload via SD card or SSH.
  **No marketplace, registry, one-click install, or auto-update in v1.**
- **Config-as-text:** full dashboard state (layout, widget placement,
  widget settings, active theme) lives in human-readable JSON files; the
  touchscreen UI is an *editor over those files*, not the source of
  truth. Shareable configs are a free community feature.

## Context and alternatives

Community extensibility is load-bearing for the product's positioning
([0005](0005-sell-hardware-open-source-software.md), held privately):
open, extensible software is what differentiates Rootboard from
subscription incumbents.

- **Marketplace/registry at launch** — deferred: hosting plus
  human moderation of submissions exceeds solo-founder resources (same
  rationale as the community-themes deferral in the theme plan).
- **Security sandbox / permission system** — explicitly a v1 non-goal.
  Local kiosk trust model: widgets run with full access; install ones you
  trust. This must be stated plainly in the docs, not hidden.
- **Broad API surface** — rejected: expose only what first-party widgets
  actually need, discovered by auditing them first.

## Consequences

- The contract extraction touches many of the same ~20 files as the theme
  plan's Phase 0 color sweep — the two are planned as a **single
  refactoring phase**, not two passes (theme plan updated; combined plan
  doc to be written under `docs/plans/`).
- `apiVersion` lets future kiosks gracefully reject widgets built for a
  newer engine (mirrors the theme manifest's `engineVersion`).
- Launch requires a proof-of-openness package even with zero community
  members: a `rootboard-widget-template` repo with a working hello-world
  widget, a "build your first widget in 30 minutes" tutorial, a
  contribution guide (including the trust-model note), an
  `awesome-rootboard` list seeded with first-party entries, and one
  reference community widget built purely on the public API in a separate
  repo (candidate: stock ticker or grocery list).
