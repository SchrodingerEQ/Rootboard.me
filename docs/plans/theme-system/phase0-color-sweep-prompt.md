# Claude Code Kickoff Prompt — Phase 0: Color Variable Sweep

Copy everything below the line into a fresh Claude Code session at the Rootboard.me repo root.

---

I'm preparing Rootboard for a theme system. Before any theme work can happen, every hardcoded color in the client must be replaced with a named CSS variable. This is a **pure refactor**: the app must look pixel-identical before and after. No logic changes, no feature work, no cleanup of unrelated code.

## The task

1. **Inventory first.** Scan `client/src` (excluding `client/src/components/ui/` — leave the shadcn library components alone unless one contains a literal hex color, which you should report before touching) for every hardcoded color: hex codes (`#f2655a`), rgb()/rgba() literals, and named colors used for styling. Produce a table: file, line, color value, what it's used for.

2. **Design the variable names before editing.** Extend the existing `--rb-*` palette in `client/src/index.css` with semantic names based on *role*, not appearance. Examples:
   - Nav rail active background `#fdeae8` → `--rb-nav-active-bg`
   - Chore badge orange `#ea8c00` → `--rb-badge`
   - Scrollbar thumb `#d9d5cc` / hover `#c4bfb2` → `--rb-scrollbar-thumb` / `--rb-scrollbar-thumb-hover`
   - Screensaver gradient stops → `--rb-screensaver-bg-1` / `-2` / `-3`
   Deduplicate: if the same hex appears in six files for the same role, it becomes ONE variable. If the same hex is used for two unrelated roles, it becomes TWO variables (themes may want them different).

3. **Special cases:**
   - `CONFETTI_COLORS` in `client/src/components/chores/confetti-burst.tsx`: keep the exported constant (tests/pure functions use it), but derive it from CSS variables read at runtime, or restructure so the color list is injectable with the current five colors as the default. Preserve the existing pure-function testability — `chores-state.test.ts` and friends must still pass.
   - Colors that come from data (Google Calendar event colors, person colors stored in state) are NOT hardcoded styling — leave the data flow alone. Only the fallback/default literals become variables.
   - rgba() shadows like `rgba(0,0,0,.05)`: make these variables too (`--rb-shadow-soft` etc.) — themes will want to soften/darken shadows.

4. **Verify.**
   - `npm run build` passes and all existing tests pass.
   - `git grep -nE '#[0-9a-fA-F]{6}' client/src` returns only: `client/src/components/ui/`, variable *definitions* in `index.css`, and any justified exceptions you list explicitly.
   - Walk me through a summary of every variable added and every file touched.

## Rules

- Work in small commits by area (nav rail, calendar, chores, dinner, keyboard, screensaver) so a visual regression is easy to bisect.
- If you find a color whose role is ambiguous, ask me rather than guessing.
- Do not rename, move, or reformat anything unrelated. Do not touch `server/`.
- The definition of done is: identical rendering, zero hardcoded styling colors outside the allowed list, tests green.
