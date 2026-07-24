# 0001 — Documentation travels with the repo

Date: 2026-07-23
Status: accepted

## Decision

All project documentation — `docs/SPEC.md`, `docs/decisions/`, and this
folder generally — is tracked by git and published with the repo. The
previous policy (a gitignored, local-only `docs/` folder) is reversed.

## Context and alternatives

The repo is the sync mechanism that keeps every machine working on the
project consistent. The earlier local-only policy proved that point by
failing: the original `SPEC.md` did not survive to a fresh checkout and had
to be regenerated from the code (2026-07-23).

The local-only policy existed for a real reason: this is a **public** repo,
and the auto-updater ships everything git tracks onto every kiosk, so docs
were kept out of the tree to avoid leaking deployment details. Alternatives
to full publication that were considered:

- **Keep docs local-only, back them up out-of-band** — rejected: an extra
  manual sync channel exists solely to work around git, and it already
  failed once.
- **Publish decisions/, keep SPEC local** — rejected: SPEC.md is the
  document that most needs to be on every machine.
- **A private second repo for docs** — rejected: more overhead, splits the
  project's history in two.

Instead, the risk is handled at the *content* level rather than the
*channel* level.

## Consequences

- Docs are always current on every clone; no out-of-band backup needed.
- **Content discipline is now mandatory:** nothing under `docs/` may
  contain hostnames, internal IPs, real names, home paths, or family usage
  details — generic placeholders only. `docs/` falls under the pre-push
  security review in `CLAUDE.md`, and gitleaks/agent review run on pushes.
- Docs ship inside release tarballs to every kiosk (a few extra KB —
  harmless).
- Forkers benefit from the spec and decision records.
