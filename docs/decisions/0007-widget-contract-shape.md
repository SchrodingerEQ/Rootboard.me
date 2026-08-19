# 0007 — Widget contract shape: sections, self-contained ESM, sweep scope

Date: 2026-08-19
Status: accepted (founder-ratified)

Refines [0006](0006-community-widget-system.md) with the three design
choices that shape the v1 contract (spec:
`docs/plans/widget-system/CONTRACT.md`).

## Decisions

1. **A v1 widget is a full-screen section**, selected from the nav
   rail; the "layout picker" is a config-driven list of installed
   widgets (enable/disable + order). Manifests declare a `slots` array
   so tile-style widgets can be added later without breaking apiVersion 1.
2. **Community widgets ship as one self-contained ESM bundle**
   default-exporting `mount(container, host)`. Widgets bundle their own
   dependencies; the host exposes no framework.
3. **The pre-widget color sweep covers hex/rgba literals *and*
   hardcoded Tailwind palette classes** in kiosk-facing surfaces, with
   `setup.tsx` exempted for now.

## Alternatives considered

- **Tile-grid dashboard (v1)** — rejected: the app has no layout engine
  or persisted layout state at all today; a grid demands new touch
  drag/resize UX and redesigning all three sections to render at
  partial sizes. Sections match the app's actual shape, making
  first-party migration a refactor instead of a redesign.
- **Hybrid "sections + shared tile strip"** — rejected for v1: adds a
  second slot type to the day-one contract for a strip nothing needs
  yet. The `slots` field keeps the door open.
- **Shared React via import map** — rejected: locks every community
  widget to the host's React version, turning host upgrades into
  ecosystem breaking changes; fragile on a kiosk that must keep working
  unattended. Bundle-size cost of self-contained widgets is acceptable
  on a local appliance.
- **Hex-only sweep (original Phase 0 scope)** — rejected: an audit
  (2026-08-19) found 346 hardcoded Tailwind palette-class usages the
  theme plan hadn't counted; leaving them means themes can't touch the
  settings menu or update/auth dialogs. `setup.tsx` (202 of them) is an
  install-time page and can be themed later.

## Consequences

- The nav rail becomes generated from `data/config/dashboard.json`
  instead of a hardcoded array.
- First-party widgets keep using the app's bundled React internally but
  are reached through the same `mount(container, host)` contract —
  loading mechanism differs (static vs dynamic import), the API surface
  does not.
- The widget template repo (0006's proof-of-openness package) documents
  a bundler setup that produces one ESM file.
- Phase 2 of `docs/plans/widget-system/WIDGET-SYSTEM-PLAN.md` is larger
  than the theme plan's Phase 0 estimate (~2.5× the color sites), and
  supersedes that estimate.
