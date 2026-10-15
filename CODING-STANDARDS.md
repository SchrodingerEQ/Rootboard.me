# Coding Standards — Crucible kernel

Company-wide starter standards for every Crucible product repo. Installed from `Crucible-HQ/claude-config/repo-template/`. The `/crucible-code-standards-review` skill reviews every diff against this file first.

**How to use this file.** The kernel below is short on purpose. It states intent, not procedure; a capable agent fills in the how. Add project-specific rules under "Project additions" at the bottom — never edit the kernel in a product repo; propose kernel changes in Crucible-HQ instead. When the agent repeatedly gets something wrong in this repo, that is the signal to add a rule here, not before.

---

## Kernel

1. **Simple over clever.** Prefer the boring solution a stranger could read in one pass. Cleverness needs a comment explaining why it was necessary.
2. **Names reveal intent.** A function, variable, or type is named for what it does or holds. If no honest name comes, the design is murky — fix the design.
3. **Small, single-purpose changes.** One PR does one thing. If the description needs "and", split it.
4. **Tests prove behavior, not implementation.** Every behavior a user relies on has a test that fails when the behavior breaks. Tests do not assert on internals.
5. **Nothing destructive without an explicit flag.** Any operation that deletes, truncates, overwrites, or rewrites existing data requires a deliberate, named opt-in — never a default path. (See PR-POLICY.md: these are hard stops.)
6. **Errors surface; they are not swallowed.** No empty catch blocks, no `|| true` on a step that matters, no silent fallbacks to a default that hides a failure from the user or the logs.
7. **Dependencies earn their place.** A new dependency needs a one-line reason in the PR. Prefer the standard library and what the repo already uses. Pin versions.
8. **Client-side first, no accounts unless functionally required.** Per HQ product principles 1 and the product-selection bias: if it can run without a server or a login, it does.
9. **No secrets, keys, or personal data in the repo.** Ever. Config comes from the environment. The repo's gitleaks pre-commit hook and the `gitleaks · secret scan` CI job enforce this; the rule exists so they never have to fire.
10. **Comments explain why, code explains what.** Delete a comment that restates the code. Keep a comment that records a constraint, a trade-off, or a surprise.
11. **Shipped functionality is never removed by an agent.** Deprecate, hide behind a flag, or propose removal to the founder (HQ principle 4) — never delete on your own judgment.
12. **Match the surroundings.** Follow the formatting, structure, and idioms already in the file you are editing, even if you would have chosen differently. Consistency beats preference.

---

## Project additions

_Add rules specific to this product below. Each rule: the rule, one line of why, the date._

<!-- example:
- Kiosk UI must remain usable at 800×480 — the Rootboard touchscreen's native resolution. (2026-10-xx)
-->
