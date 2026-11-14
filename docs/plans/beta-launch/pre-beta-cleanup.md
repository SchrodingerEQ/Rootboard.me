# Pre-beta cleanup — dependencies, a real linter, two small bugs

**Status:** In progress (started 2026-11-14): step 1 merged (#27); step 3 (ESLint) merged (#29), taken ahead of step 2 so other briefs got a real lint step sooner; step 2 merged (#30); step 4a merged (#31); step 4b merged (#33); step 6 (CLAUDE.md pointer) taken before step 5, because step 5 is a soft flag that waits for the founder.
**Type:** One session, a short series of small PRs (one thing each, per
`CODING-STANDARDS.md` kernel 3), in the order below. Each is safe zone
unless its review says otherwise; merge each on green before starting
the next.
**Depends on:** nothing. Runs now, in parallel with 05, 08 and 03
session 1. Merge the linter PR (step 3) as early as you can: once it is
on `main`, every other brief's CI lint step is real, and the later
branches fix their own findings when they merge `main` in.
**Unblocks:** 09 (its `npm audit` gate needs step 1 shipped in a release).
**Closes in `TASKS.md`:** the remaining-npm-audit item and the four
per-release audit items (folded into one standing item by step 1), the
unused-packages candidate, "Adopt a real linter", the stale-closure
keyboard bug, the "Syncing calendar..." overlap, and What to Wear in
awesome-rootboard and README.md.

---

## 1. Goal

Clear the small backlog that would otherwise ride along into the beta:
dependency findings that need no breaking upgrade, packages nothing
uses, a placeholder lint step, two visible bugs, and two list entries.
None of it changes what Rootboard does.

## 2. Decisions locked

| # | Decision | Choice |
|---|---|---|
| 1 | Audit fixes | Plain `npm audit fix` only, never `--force`. No major upgrades here: drizzle-orm 0.39→0.45, Vite 5→8 and Tailwind 3→4 stay out of scope (Vite 8 needs Node 20.19+/22.12+, and the Pi builds during auto-update, so it is its own release after the beta). |
| 2 | Lockfile | Written with npm 11 (`npx npm@11 …`), per `CLAUDE.md`'s cross-platform notes. Never regenerate it with npm 10. |
| 3 | Linter | ESLint, flat config (`eslint.config.js`), with `typescript-eslint` and `eslint-plugin-react-hooks`. Why not `tsc --noUnusedLocals`: the code already carries `// eslint-disable-next-line react-hooks/exhaustive-deps` comments, and the hooks rule is what would have caught step 4a's bug; compiler flags cannot. Keep the rule set small: the two hooks rules as errors and typescript-eslint's recommended set, and no style or formatting rules (kernel 12). Record it as `docs/decisions/0024-eslint-with-react-hooks.md`. |
| 4 | Lint findings | Fix each one. Where adding a hook dependency would change behaviour (a refetch loop, a re-subscribe), keep today's behaviour and keep or add a disable comment with a one-line reason (kernel 10). The one exception is the calendar keyboard effect, which step 4a fixes. |
| 5 | Unused packages | Removed only after proving nothing loads them (step 2). They were never imported, so no shipped functionality goes; say so in the PR. If anything does load one, stop and record where instead of removing it. |
| 6 | Releases | None. Cutting a release stays with the founder, following brief 08's `docs/RELEASING.md` once it exists. |

## 3. Work, one PR each, in this order

1. **Audit fixes.** Run `npm audit` and record the counts by severity.
   Run `npx npm@11 audit fix`, then `npm audit` again. In the PR, list
   what was fixed and what is left. `drizzle-kit` went in #24, so
   anything that came only through it should already be gone. Then merge
   `TASKS.md`'s five audit items (the "7 remaining" item and the ones
   recorded at v1.7.0, v1.7.1, v1.7.2 and v1.7.3) into **one standing
   item** that lists what is left and why. Brief 08's release checklist
   updates that one item at every release from then on.
2. **Unused packages.** For `express-session`, `memorystore`, `passport`,
   `passport-local`, `ws` and their `@types/*` packages:
   - Grep for imports and requires in `server/`, `client/`, `shared/`,
     `scripts/` and every config file.
   - Check `npm ls ws`, because `ws` may also arrive under another
     package. Only the top-level entry goes.
   - Run `npm run build` and `npm test`, start the production build
     (`npm start`) and request `/api/version`.

   If all is clean, remove them from `package.json` and update the
   lockfile with npm 11.
3. **Linter.** Add ESLint per decisions 3 and 4, point `npm run lint`
   at it (CI's lint step already calls that script), and give each new
   dev dependency a one-line reason in the PR (kernel 7), with versions
   pinned. Add `npm run lint` to `CLAUDE.md` wherever it lists the
   checks a change must pass.
4. **Two bugs, one PR each.**
   - **a. Arrow keys page from a stale date.** In
     `client/src/widgets/calendar/index.tsx`, the keyboard effect
     (around line 283) lists `[currentView, isVisible]`, but its
     handler calls `navigateCalendar`, which reads `currentDate`.
     Repeated ArrowLeft or ArrowRight presses therefore all step from
     the date the effect captured. Fix it (a functional state update is
     the simplest route) and add a test: three ArrowRight presses in Day
     view move three days.
   - **b. "Syncing calendar..." covers What to Wear's weather summary.**
     `client/src/components/calendar/loading-indicator.tsx` is fixed at
     the top right. The calendar widget stays mounted behind other
     sections and portals that indicator to `document.body` (around line
     424 of the same widget file), so it shows over whichever section is
     on screen. Show it only while the calendar section is visible (the
     widget already has `isVisible`), or move it to a spot nothing uses.
     Pick one and say why in the PR. Check at 1920×1080 with What to Wear
     on screen during a sync.
5. **What to Wear in the lists.** It shipped in v1.7.0. Add it to
   `README.md`'s Features list (the README's Widgets section is about
   community widgets), and to awesome-rootboard's first-party list. That
   second one is a separate repo and its own small PR there, which needs
   push access to it.
6. **Point `CLAUDE.md` at the coding standards.** Under "Pull requests
   and merging", add the line the company repo template uses: "Code in
   this repo follows `CODING-STANDARDS.md`: the Crucible kernel, the
   same in every repo, plus this project's additions. Read it before
   writing code. `/crucible-code-standards-review` reviews every diff
   against it." Cloud sessions do not load the founder's global memory,
   so this line is their only pointer to the standards.

## 4. Acceptance

- Every PR: `npm run check` and `npm test` green. From step 3 on,
  `npm run lint` is green too.
- Step 1: the before and after audit counts are in the PR, and
  `TASKS.md` holds one audit item.
- Step 2: `npm ls` shows none of the removed packages at top level, and
  `npm run build`, `npm start` and `/api/version` all work.
- Step 3: `npm run lint` fails on a deliberately broken hook dependency
  (show it in the PR, then revert), and CI's lint step runs ESLint.
- Steps 4a and 4b: the test or the screenshot described above.
- No kiosk change until the next release. When that release goes out,
  the founder checks that the kiosk's update and `npm install` succeed
  (steps 1 and 2 change what it installs).

## 5. Docs

- `docs/decisions/0024-eslint-with-react-hooks.md` (step 3).
- `docs/SPEC.md` only if a step changes documented behaviour (4b may
  change where the sync indicator appears).
- `CLAUDE.md` (steps 3 and 6). `TASKS.md` per the **Closes** line.

## 6. PR tier

Safe zone for steps 1–4 and 6: dependency bumps with no majors, dev
tooling, bug fixes, docs. Step 5 changes README copy that describes what
the product does, which may trip the clear-purpose flag (principle 3):
let the review decide, and if unsure, mark it a soft flag.

## 7. Out of scope

The major upgrades in decision 1; the theme authoring guide; DDC/CI
dimming; the CLAUDE.md "none yet" entries (the founder's); cutting a
release.
