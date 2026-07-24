# 0004 — AGPL-3.0 license

Date: 2026-07-23 (reconstructed; the LICENSE file predates this note)
Status: accepted

## Decision

The project is licensed under the GNU Affero General Public License v3.0
(`LICENSE` at repo root; stated in README).

## Context and alternatives

The repo is public and the product is self-hosted software a household runs
on its own hardware. Crucible Creations' principles favor transparency and
oppose value extraction by intermediaries.

- **MIT/Apache-2.0** — rejected: would allow a third party to take the
  code, close it, and sell it (including as a hosted service) with nothing
  returned.
- **GPL-3.0** — closes the binary-distribution loophole but not the
  network-service loophole; since a calendar kiosk could plausibly be
  offered as a hosted service, AGPL's network clause is the meaningful
  difference.

## Consequences

- Anyone distributing or hosting a modified Rootboard must publish their
  changes under AGPL-3.0.
- Crucible retains the ability to sell the product itself (one-time
  purchases per company policy) — AGPL restricts closing the source, not
  charging for it. Copyright remains with the founder, so relicensing
  options stay open while no outside contributions are accepted without
  agreement.
- Some businesses avoid AGPL dependencies entirely; irrelevant here since
  this is an end-user application, not a library.
