# WP-05 — Theme system: audit, Winter Holiday, confetti colours

| | |
|---|---|
| **Repo** | `SchrodingerEQ/Rootboard.me`, three PRs in sequence |
| **Base** | latest `main`, fresh clone, `npm ci` (npm 11) |
| **Waits on** | nothing |
| **Unblocks** | a theme release the founder tests on the kiosk the week after; the next theme slices |
| **Network / secrets** | none. No fonts or images are downloaded: this slice is colours only. |
| **Deliverable** | PR 1 (audit, docs only) safe zone; PR 2 (Winter Holiday) safe zone **but waits for the founder's look in the dev server before it merges**; PR 3 (confetti: warning, test, stale docs) safe zone; the end-of-run report |
| **Model** | per the README |
| **Done when** | PR 1 merged, PR 2 open with screenshots and waiting for the founder, PR 3 open (it does not depend on PR 2 merging; if it collides, it rebases later) |
| **Unattended run** | 3–5 hours |

## Goal

Know exactly where the theme engine stands, then add the first seasonal
theme and close the one place the shipped engine still ignores the theme.
Founder 2026-11-23: "a run-through of the theme system, see where we're
at, then Winter Holiday and the confetti fix", for a release patch to test
on the kiosk when he is back. Fonts, logo and screensaver imagery, shape
tokens, Spooky, the authoring guide and community install are **not** in
this brief (README decision 4).

## Decisions already made (don't reopen)

| Decision | Answer | Where |
|---|---|---|
| Themes are structured tokens only; no CSS, no JS, never layout or touch targets | yes | `THEME-SYSTEM-PLAN.md` decisions 1, 3; `THEME-ENGINE-SPEC.md` |
| Built-in themes are bundled TypeScript modules validated by `shared/theme-manifest.ts`; every token required | yes | decision 0009; SPEC §3.9 and "Themes (engine slice 1)" |
| Person palettes are theme tokens with a contrast guard | yes | decision 0010; `THEME-PEOPLE-PLAN.md` |
| Manual selection only; no automatic seasonal switching | yes | `THEME-SYSTEM-PLAN.md` decision 2 |
| No third-party IP in any theme | yes | `THEME-SYSTEM-PLAN.md` decision 3 |
| Winter Holiday is colours only this week; the founder judges it on the laptop before merge, on the kiosk before release | yes | founder 2026-11-23 |

## Read first

1. `docs/plans/theme-system/THEME-ENGINE-SPEC.md` (whole), especially
   "Out of scope (later slices)" and "Files touched";
   `THEME-PEOPLE-PLAN.md`; `THEME-SYSTEM-PLAN.md` (the locked decisions
   and the Phase 1 launch set); `claude-design-themes-prompt.md` (the
   brief for what a theme is meant to convey).
2. `docs/decisions/0009`, `0010`; `docs/SPEC.md` §3.9 and "Themes
   (engine slice 1)".
3. `shared/theme-manifest.ts`; `client/src/themes/` (`default.ts` is the
   authoring reference, `deep-space.ts` the second theme, `index.ts` the
   registry, the three `*.spec.ts`); `client/src/lib/theme-engine.ts`;
   `client/src/index.css` `:root`; `client/index.html` (boot flash
   script); `client/src/components/chores/confetti-burst.tsx`
   (`CONFETTI_COLORS`, line 17); `client/src/lib/color-utils.ts`.
4. `TASKS.md` lines on the theme system and the authoring guide (read,
   not done here).

## Steps

### PR 1 — the audit (docs only)

1. Compare the spec with the code, section by section: tokens declared
   versus tokens in `THEME_TOKEN_NAMES` versus tokens used in the
   components (grep `--rb-` and `rb-` Tailwind classes); literal colours
   still in components, CSS or TSX outside `index.css` `:root` (CLAUDE.md
   says never add one; list any that exist, with file and line); the
   contrast guard's rules versus what the two themes pass; the boot
   cache; the widget contract's `theme.subscribe`; what the Settings
   picker shows. Run the existing theme specs and note what they cover.
2. Write `docs/plans/theme-system/STATUS-2026-11.md`: a one-screen table
   "spec says / code does / gap", then the later slices in the spec's
   order with a one-line size read each (S/M/L and whether a Pi is
   needed), then the items this brief's PRs 2 and 3 take. Facts with
   file and line; no proposals beyond the size read. Update the
   **Status** lines of `THEME-SYSTEM-PLAN.md` and `THEME-ENGINE-SPEC.md`
   to point at it. Safe zone (docs). Auto-merge per `/pr` rule 3 on green.

### PR 2 — Winter Holiday, colours only (waits for the founder)

3. Author `client/src/themes/winter-holiday.ts` with the complete token
   map, in `default.ts`'s grouped, commented, plain-literal style. Design
   intent, from `claude-design-themes-prompt.md`: a 21.5-inch kitchen
   screen read from across the room, so a deep evergreen or midnight-blue
   canvas with warm surfaces, a red or gold accent, **eight** person
   colours (`--rb-person-1` to `--rb-person-8` in the manifest)
   distinguishable from each other and readable on the surface, five
   confetti colours in the palette, soft snow-white ink on dark areas.
   **No** holiday-specific trademarked motifs or brand colours (decision
   3). If the audit shows an existing design spec for Winter Holiday in
   the plan folder or `docs/`, use its values; otherwise author them and
   say so.
4. Register it in `client/src/themes/index.ts`. The contrast specs
   (`contrast.spec.ts`, `people-contrast.spec.ts`) must pass for it; a
   failure is a colour to change, never a guard to loosen. Add it to
   `default.spec.ts`'s completeness check if that test enumerates themes.
5. Docs: SPEC "Themes" list; `README.md` Features ("Built-in Default,
   Deep Space and Winter Holiday looks"); `THEME-SYSTEM-PLAN.md`'s launch
   set note. No decision record: it is a third instance of an existing
   mechanism.
6. **Open the PR and stop.** Put screenshots of Calendar month, Chores
   and Dinner from `npm run dev` in the PR body: the founder looks at the
   theme in his own dev server (Settings → Theme) and says yes or what to
   change; the PR body names that as the merge condition. Tier safe zone
   by the review; the wait is the founder's wish, not a policy tier. If
   he asks for changes, they go on the same branch.

### PR 3 — confetti colours: the docs are stale, the fallback is silent

7. **Read the code first.** `THEME-ENGINE-SPEC.md` "Out of scope" says
   `CONFETTI_COLORS` "still shadows the `--rb-confetti-*` tokens". That
   is stale: `client/src/components/chores/chore-card-stack.tsx` lines
   6–15 (`runtimeConfettiColors`) already read the five tokens from the
   document's computed style at burst time and fall back to
   `CONFETTI_COLORS` (`confetti-burst.tsx` line 17) when any is empty.
   Do **not** rewrite that; the particle maths stays untouched. What is
   missing: the fallback is silent (kernel rule 6), nothing tests the
   token path, and three documents say the wrong thing.
8. Make `runtimeConfettiColors` take its lookup as a parameter
   (`(name: string) => string`, defaulting to the computed-style read)
   so it is a pure function to test; warn once on the console, naming
   the first missing token, when it falls back. Tests, in the existing
   node environment (no jsdom; `vitest.config.ts` is `environment:
   "node"` and adding one is a dependency decision outside this brief):
   a lookup that returns Deep Space's five values yields exactly those;
   a lookup that returns an empty string for one token yields the
   fallback and warns once.
9. Docs: SPEC §3.5 (Chores) or "Themes", wherever confetti is described,
   says the burst takes the theme's confetti tokens; strike the stale
   line in `THEME-ENGINE-SPEC.md` "Out of scope" with a dated note;
   `STATUS-2026-11.md` gap row closed. Tier safe zone. Auto-merge per
   `/pr` rule 3 on green.

### Tracker

10. `TASKS.md` "Theme system" line: a dated note naming the status doc
    and the three PRs. Do not tick it: later slices remain.

## Verification without hardware

- The three checks green for every PR (state the Windows file-mode
  failures if WP-04 (b) has not merged).
- PR 2: `npm run dev`, switch to Winter Holiday, walk Calendar (day,
  week, month), Chores, Dinner, What to Wear, Settings; check the OSK and
  the update dialog take the theme (the dialog needs the laptop online
  for its GitHub release check); reload and confirm no light flash (the
  boot cache). Screenshots in the PR.
- PR 3: with Deep Space, check off a chore in `npm run dev`; the burst is
  in Deep Space's confetti colours.
- On the kiosk (founder checklist): Winter Holiday on the 21.5-inch
  panel across a room; confetti in theme colours.

## If blocked

- A token the audit finds missing from `THEME_TOKEN_NAMES` is needed by
  Winter Holiday: adding one bumps `THEME_ENGINE_VERSION` (spec §2) and
  is its own change with a decision record; do not do it in PR 2. Author
  within the existing tokens and list the gap in the status doc.
- The contrast guard rejects every readable red/green pairing for the
  person palette: keep the guard, pick a palette that passes, and note in
  the PR that the "holiday red and green" idea was traded for
  readability.

## Report (end of run)

**Done (PR 1 merged; PR 2 open, waits for the founder's look; PR 3 merged
or waiting) / Not done and why / Findings worth a task (the gap table's
open rows) / Founder actions (look at Winter Holiday in the dev server;
kiosk check after v1.9.0).**
