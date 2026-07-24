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
