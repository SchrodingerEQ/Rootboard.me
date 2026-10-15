## See it working

<Screenshot, short recording, before/after, or "open X, click Y, observe Z." This is the first thing the founder reads. For a change with no visible surface, show the command and its output.>

## What changed and why

<Two to four plain-language sentences. What a user or the business gets out of this. No jargon.>

## Tier

**<Safe zone | Safe zone (verified) | Soft flag | Hard stop>** — label `<auto-merge | principle-flag | needs-founder>`

Triggers: <each trigger from PR-POLICY.md that fired, or "none">

- [ ] This PR trips the PR-POLICY privacy policy trigger (network calls, third-party code, permissions, accounts or identifiers, server-checked purchases, privacy text)

<If /crucible-code-standards-review and /pr disagreed, say so here and keep the higher tier.>

## Summary

<One small visual that shows the shape of the change — see §Visuals. Keep words around it brief.>

## Evidence

- **Before:** <failing test / old screenshot / old output>
- **After:** <passing test / new screenshot / new output>
- Tests: <pass count> · Types: <clean> · Lint: <clean>

## Code review

<Paste the Standards, Spec, and Bugs sections from /crucible-code-standards-review, or "no findings" per axis.>

## Verification

<Safe zone (verified) only. Each mandatory verification performed, with its result and numbers — e.g. "Rename `score` → `points`: 14 references found, 14 updated, 0 remaining." Otherwise: "None required.">

## Hard-stop analysis

<Hard stop only. Otherwise: "Not applicable.">

**Blast radius:** <what breaks, who is affected, what data is at risk if this is wrong>
**Rollback:** <exact steps to undo; first line says whether undo is fully possible>
**Removal proposal (principle 4, if functionality is removed):** <what is removed, why, what replaces it>

## Principle note

<Soft flag only. Otherwise: "Not applicable.">

**Principle touched:** <number and name, quoted from HQ CLAUDE.md>
**How:** <two to three sentences — and the honest read: crosses the line / stays inside it / unclear>
**What the user would see differently:** <one or two sentences>
