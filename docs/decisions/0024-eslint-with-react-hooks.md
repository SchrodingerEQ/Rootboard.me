# 0024 — ESLint with typescript-eslint and the two React hooks rules
Date: 2026-11-14
Status: accepted

## Decision

`npm run lint` runs ESLint 9 with a flat config (`eslint.config.js`):

- `@eslint/js` recommended and `typescript-eslint` recommended;
- `react-hooks/rules-of-hooks` and `react-hooks/exhaustive-deps`, both
  errors;
- `no-unused-vars` ignores names that start with `_` (an Express error
  handler's `_next`, a field dropped by destructuring);
- no style or formatting rules (`CODING-STANDARDS.md` kernel 12).

CI's existing lint step calls the script, so it now fails the PR on a
finding. A disable comment is allowed only for a hooks dependency whose
"fix" would change behaviour (a refetch loop, a re-subscribe), and it
carries a one-line reason (kernel 10).

## Context and alternatives

`npm run lint` was a placeholder from the PR-governance template.

- **`tsc --noUnusedLocals --noUnusedParameters`.** Rejected. It adds no
  dependency, but it only finds unused names. The code already carried
  `eslint-disable … react-hooks/exhaustive-deps` comments, and the
  stale-date arrow-key bug in the calendar is exactly what the
  exhaustive-deps rule catches. No compiler flag can.
- **ESLint 10.** Rejected for now. It needs Node 20.19+/22.13+. The Pi
  installs dev dependencies during auto-update (it builds on the
  device), so the same Node-version check as the Vite 8 upgrade
  applies. ESLint 9 runs on Node 18.18+.
- **`eslint-plugin-react-hooks` 7.** Rejected. Its recommended set adds
  the React Compiler rules (far beyond "the two hooks rules"). It also
  pulls in Babel, and it fails to load next to this repo's
  `zod-validation-error` 3.5 (it imports a `/v4` subpath that 3.5 does
  not export). Version 5.2 ships just the two rules.

## Consequences

- Five dev dependencies, pinned exactly: `eslint`, `@eslint/js`,
  `typescript-eslint`, `eslint-plugin-react-hooks`, `globals`. They
  install on the Pi with the rest of the dev tooling.
- `typescript-eslint` brings one moderate `npm audit` advisory
  (minimatch, which runs inside the linter only); it is listed in the
  standing audit item in `TASKS.md`.
- Every branch that merges `main` after this fixes its own findings.
