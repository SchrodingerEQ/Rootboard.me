# Phase 5 Execution Plan — Proof-of-Openness Package

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task.

**Status:** implemented 2026-08-20; Tasks 1-5 shipped to the ecosystem
repos with per-task reviews + fix loops (tutorial verbatim-follow gate
PASSED); Task 6 tie-in merged after final review; TASKS.md check-offs
pending founder confirmation. Ran under a founder-ratified autonomy
charter (pushes to the three ecosystem repos pre-authorized with
security review per push; main-repo merge auto on green final review;
surprises are parked in TASKS.md, never block; only
destructive/irreversible situations interrupt).

**Goal:** Ship the package that proves Rootboard's widget system is
genuinely open even with zero community members yet: a template repo
with a working hello-world, a 30-minute tutorial, a contribution guide
that states the trust model plainly, a seeded awesome-list, and one
real reference widget built purely on the public contract in its own
repo.

**Repos (founder-created, empty; licensing per
[decision 0008](../../decisions/0008-community-repo-licensing.md)):**
`SchrodingerEQ/rootboard-widget-template` (MIT),
`SchrodingerEQ/awesome-rootboard` (CC0),
`SchrodingerEQ/rootboard-widget-grocery-list` (MIT).

**Parent plan:** [WIDGET-SYSTEM-PLAN.md](WIDGET-SYSTEM-PLAN.md) Phase 5
· contract: [CONTRACT.md](CONTRACT.md) · candidates ratified in
[0006](../../decisions/0006-community-widget-system.md).

## Global Constraints

- **Everything published is public and community-facing:** no business/
  monetization/strategy content, no PII, no deployment specifics —
  the CLAUDE.md security review runs before every push to every repo
  (the new repos have no gitleaks hook; the review is manual grep +
  diff read).
- **Copy follows the product principles:** clear purpose, no
  overpromising, and the trust model stated plainly (CONTRACT §7
  verbatim or stronger — "no sandbox; widgets run with full access;
  install ones you trust").
- **The reference widget uses ONLY the public contract** — folder +
  `widget.json` + self-contained ESM + `WidgetHost`. If it needs
  anything the contract lacks, that is a FINDING to park, not a reason
  to reach into internals.
- Plain-ESM, no-build-step widgets (the kiosk truth: dropped folders
  are not compiled). Tutorial and template must not require Node
  tooling beyond a text editor.
- Main-repo changes are docs-only (links, plan bookkeeping, TASKS).

## Tasks

### Task 1 — Template repo (`rootboard-widget-template`)
Content: the hello-world widget (seed source in the session scratchpad
`hello-world-widget/`, already review-verified as an exemplary
CONTRACT example) as the repo's working example; `README.md`
(what this is, quickstart: copy folder → edit id/name → drop into
`widgets/` → enable in Settings); `LICENSE` (MIT, SchrodingerEQ);
`.gitignore` (minimal); `widget.json` field reference table (from
CONTRACT §2, linked back to the Rootboard repo's CONTRACT.md as the
authority). Push = repo's initial commit(s). Verify: fresh
`git clone` → copy into the dev kiosk's `widgets/` → appears/mounts.

### Task 2 — Tutorial ("Build your first widget in 30 minutes")
`TUTORIAL.md` in the template repo: from empty folder to a working
widget (a "quote of the day" variant built by editing hello-world),
covering manifest, mount/unmount, storage, one setting, sideloading
via SSH/SD, and the picker. Reviewer gate: a FRESH subagent follows
the tutorial verbatim on the dev kiosk and must succeed without
outside knowledge — tutorial bugs are findings.

### Task 3 — Contribution guide + trust model
`CONTRIBUTING.md` in the template repo (+ a short cross-link section
in the main repo docs): how to build/share a widget today (host it
yourself, submit to awesome-rootboard), the no-third-party-IP policy
(mirrors the theme plan's), and the CONTRACT §7 trust statement
verbatim. No promises about registries/auto-updates (explicitly listed
as not-yet/maybe-never, per 0006's deferral).

### Task 4 — Reference widget (`rootboard-widget-grocery-list`)
A real, family-useful grocery list: add/check-off/clear items,
`host.storage` persistence (≤64k guard: cap list length generously),
manifest settings (e.g. sort mode: manual/alphabetical/checked-last),
`host.ui.sleep()` optional, OSK-eligible inputs, 48px touch targets,
`--rb-*` theme tokens, idempotent visibility handling. Plain ESM, no
deps, no build. Own repo: README (screenshot optional — only if
capturable without personal data), MIT LICENSE, install instructions.
Gate: full folder-drop E2E on the dev kiosk (drop → enable → use →
reload persistence → settings edit → disable), plus a contract-purity
review (zero non-contract touchpoints).

### Task 5 — `awesome-rootboard`
`README.md` list, CC0: sections for built-in widgets (calendar,
chores, dinner — shipped with Rootboard), official resources (main
repo, CONTRACT, template, tutorial), community widgets (seeded with
grocery-list; a "submit a PR" line), themes (placeholder pointing at
the theme plan's future). Honest copy: this list is young; that is
the point of proof-of-openness.

### Task 6 — Main repo tie-in + ship
Docs: README gains a short "Widgets" section linking template/
tutorial/awesome list; WIDGET-SYSTEM-PLAN Phase 5 ✅ + status line;
SPEC untouched unless a finding demands it. Final whole-branch review
(main repo diff only; the ecosystem repos get their per-task reviews),
security review, merge to main per the charter, push. Then propose
TASKS.md check-offs for the five Phase-5 items (founder confirmation
required — the one planned end-of-run interaction).

## Landmines

- The ecosystem repos have no CI, no hooks: the security review and
  the per-task reviewer are the only gates — do not skip them because
  "it's just docs".
- Tutorial drift: CONTRACT.md is the single source of truth; the
  template's field reference must LINK, not fork, normative rules.
- The grocery list must not exceed the 64,000-char storage cap with
  realistic use — cap items (e.g. 200) and say so in its README.
- Nothing in any repo may imply a widget marketplace/registry exists.
