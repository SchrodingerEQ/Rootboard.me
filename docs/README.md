# docs/ — house documentation

Longer-form project documentation. This folder is **tracked by git and
public**: the repo is the sync mechanism that keeps every machine working
on the project up to date (see
[decision 0001](decisions/0001-docs-travel-with-repo.md)).

> ⚠️ Because the repo is public **and** the auto-updater ships everything
> git tracks onto every kiosk, nothing in this folder may contain
> deployment specifics: no hostnames, internal IPs, real names, home paths,
> or family usage details. Use generic placeholders. Everything here falls
> under the pre-push security review in `CLAUDE.md`.

## Contents

- **[SPEC.md](SPEC.md)** — the as-built specification: views, data
  invariants, OSK/kiosk quirks, and the update system. Keep it updated
  whenever behavior changes; agents are pointed here from `CLAUDE.md`.
- **[decisions/](decisions/)** — short "why X over Y" records, numbered
  `NNNN-slug.md`. Add one whenever a non-obvious design choice is made.
- **[plans/](plans/)** — briefs and execution plans for larger pieces of
  work, one folder per initiative (widget system, theme system, What to
  Wear, [beta launch](plans/beta-launch/README.md), the
  [Node runtime upgrade](plans/node-runtime-upgrade/BRIEF.md)). A brief
  is written so
  a fresh session can execute it without the planning conversation.
- **[briefs/](briefs/)** — dated brief sets for a bounded stretch of
  work, one folder per set (for example
  [2026-11-23-remote-work](briefs/2026-11-23-remote-work/README.md): the
  work that runs with no kiosk at hand). Each set has a README with the
  order, dated decisions and a founder checklist, plus one `WP-NN` file
  per work package, written to be handed to a fresh session as its whole
  prompt. Plans describe an initiative; a brief set schedules the pieces
  of one or more plans for a given week.

## Decision record format

Keep them short — a screenful. Each file has:

```markdown
# NNNN — Title
Date: YYYY-MM-DD (note if reconstructed after the fact)
Status: accepted | superseded by NNNN

## Decision
What was chosen.

## Context and alternatives
What problem forced a choice; what else was considered.

## Consequences
What this commits us to; known tradeoffs.
```
