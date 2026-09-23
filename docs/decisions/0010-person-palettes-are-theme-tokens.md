# 0010 — Person palettes are theme tokens, not a host API
Date: 2026-09-23
Status: accepted

Design spec: `docs/plans/theme-system/THEME-ENGINE-SPEC.md` §10.
Plan: `docs/plans/theme-system/THEME-PEOPLE-PLAN.md`.

## Decision

Person identity colours ship as 24 more required theme tokens,
`--rb-person-{1..8}-{color,tint,text}` (100 tokens total), not as a new
`WidgetHost` service. Slots are 1-based and identity-ordered, stable
across every theme. Chores maps a person's `colorIdx` to a slot
(`client/src/lib/person-colors.ts`) and reads the colour through
`var(--rb-person-N-role, <Default hex>)`, so a theme switch repaints
person columns live with no widget-contract change — adding tokens is
additive, not an `apiVersion` bump.

`PERSON_PALETTE` in `client/src/lib/chores-state.ts` stays a pinned
literal rather than being derived from the active theme manifest.

## Context and alternatives

The obvious alternative was a `host.people` (or similar) service:
`getPersonColor(slot)`, a subscribe callback, maybe a dedicated
contrast contract. Rejected — it would grow `WidgetHost` for something
that already fits the existing `theme` surface: person colours are
just more CSS custom properties, and `theme.getToken` /
`theme.subscribe` already cover reading and reacting to them. No new
API surface means no `WIDGET_API_VERSION` bump and no new contract to
document, version, or keep the companion repos in sync with.

`PERSON_PALETTE` could instead have been derived from the Default
theme's person tokens at import time, removing the duplication between
the two. Rejected: `chores-state.ts` is deliberately dependency-free
(a legacy test imports it standalone, with no theme-engine wiring), and
the literal doubles as the `var()` fallback in `person-colors.ts` — a
value that must survive even if the theme engine fails to apply.

## Consequences

- No widget-contract growth for this slice; community widgets that want
  themed person colours read the same tokens first-party code does,
  with the fallback-var convention documented in
  `docs/plans/widget-system/CONTRACT.md` §4/§8.
- Two copies of the Default person palette exist (the literal in
  `chores-state.ts` and the tokens in `client/src/themes/default.ts`);
  a spec (`person-colors.spec.ts` per the people plan) asserts they
  agree, the same fidelity-guard pattern used for the rest of Default's
  tokens.
- Because slots are identity, not "Chores person N", any future
  first-party or community feature that wants per-person colour reads
  the same eight slots — there is one palette, not one per feature.
