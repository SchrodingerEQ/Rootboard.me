# 0008 — Licensing for the community widget ecosystem repos

Date: 2026-08-20
Status: accepted (founder-ratified)

## Decision

The community-facing repos that seed the widget ecosystem are licensed
permissively, distinct from Rootboard core's AGPL ([0004](0004-agpl-license.md)):

- `rootboard-widget-template` — **MIT**
- `rootboard-widget-grocery-list` (reference widget) — **MIT**
- `awesome-rootboard` (link list) — **CC0**

Rootboard itself stays AGPL; nothing changes for the core.

## Context and alternatives

The template exists to be copied: a community author starts from its
code and builds their own widget. Under AGPL, every widget derived from
the template would itself be AGPL — a real adoption chill for the
ecosystem these repos exist to create, and a licensing question every
first-time author would have to answer before writing a line. MIT makes
the copy-and-go path unencumbered; widgets talk to Rootboard only
through the public contract (a folder + JSON + ESM module), so widget
authors' license choices never entangle the core.

- **AGPL everywhere** — rejected for the reason above.
- **CC0/public domain for the code repos too** — considered; MIT keeps
  attribution and a warranty disclaimer, which the reference widget
  (real code people will run on family kiosks) should carry.

The reference widget is the **grocery list** (over the stock-ticker
candidate from [0006](0006-community-widget-system.md)): fully local,
no third-party API, works offline like the kiosk itself, and exercises
the contract surfaces (storage, settings, sleep) a typical family
widget needs.
