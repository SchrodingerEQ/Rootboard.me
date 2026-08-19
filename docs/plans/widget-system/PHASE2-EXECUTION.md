# Phase 2 Execution Plan — Combined Refactor (Color Sweep + Decoupling)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace every hardcoded styling color in the kiosk-facing client with named CSS variables and cut the couplings that block the widget-contract migration — with the app pixel-identical before and after.

**Architecture:** Pure refactor of `client/src` only (no `server/` changes, no feature work). Two workstreams executed area-by-area in adjacent commits: (1) color → `--rb-*` CSS variables plus a Tailwind `rb` color map for utility classes; (2) three targeted decouplings (type extraction, dead-code deletion, filter-path unification). A single `npm test` gate is created first.

**Tech Stack:** React 18 + Vite + Tailwind 3, vitest (new, dev-only), existing standalone `tsx` test scripts, `git grep` verification gates.

**Parent plan:** [WIDGET-SYSTEM-PLAN.md](WIDGET-SYSTEM-PLAN.md) Phase 2 · scope decisions in [decision 0007](../../decisions/0007-widget-contract-shape.md)

## Global Constraints

- **Pixel-identical rendering**, with the founder-approved exceptions
  (ratified 2026-08-19 at the Task 5 gate): the all-calendars-off edge
  case in Task 4, the Q1 harmonization drift (Tailwind palette classes
  land on house `rb` tokens — small shifts confined to dialog chrome),
  and the Q9/Q10/Q13/Q17 micro-collapses. Everything else renders
  exactly as before. The approved drift set must be documented in
  `docs/SPEC.md` as part of Task 12 (which colors are acceptable under
  the token approach).
- **No `server/` changes. No feature work. No unrelated renames/reformatting.**
- Scope: hex/rgb(a) literals AND Tailwind palette classes (`text-gray-500` etc.) in kiosk-facing files. **`client/src/pages/setup.tsx` is fully exempt** (both kinds), as is `client/src/components/ui/**`.
- **Allowed literal exceptions** (the final grep gate's allowlist — each is data, not styling, or a pinned testable default):
  - `client/src/index.css` — variable *definitions*
  - `client/src/components/ui/**` (5 hex) and `client/src/pages/setup.tsx`
  - `client/src/lib/chores-state.ts` `PERSON_PALETTE` — functional person colors, pinned by tests; theme Phase 1 swaps them via its validated replacement-set mechanism, not CSS vars
  - `client/src/lib/calendar-meta.ts` `FALLBACK_COLORS` — hash-assigned calendar colors that must match server logic
  - `client/src/lib/color-utils.ts` `hexToRgb` fallback `{r:37,g:99,b:235}` — data-path fallback inside a pure node-tested function
  - `client/src/components/chores/confetti-burst.tsx` `CONFETTI_COLORS` — kept as the testable default; runtime callers inject values read from CSS variables (Task 7)
  - `*.test.ts` / `*.spec.ts` files asserting color values
- Commit convention: small commits per area, message prefix `refactor:`; every commit passes `npm test` and `npm run build`.
- This is a **public repo**: run the CLAUDE.md security review before any push; commit messages are public.
- Shell scripts LF-only (enforced by `.gitattributes`); no `.claude`/local paths in tracked files.

---

### Task 1: Single test gate — `npm test`

**Files:**
- Modify: `package.json` (scripts + devDependency)
- Create: `vitest.config.ts` (repo root)

**Interfaces:**
- Produces: `npm test` = the pass/fail gate every later task runs. New tests in this phase are written as `client/src/**/*.spec.ts` (vitest); the four legacy standalone scripts (`date-range.test.ts`, `chores-state.test.ts`, `dinner-state.test.ts`, `osk.test.ts`) stay untouched and run via `tsx`.

Rationale: the legacy scripts interleave top-level state mutation with immediate `check()` calls — converting them to deferred vitest `test()` callbacks would change execution order and is pure risk. They stay as scripts; vitest (with a `.spec.ts` include so it never collects the legacy files) hosts new tests from this phase onward.

- [x] **Step 1: Install vitest**

```bash
npm install -D vitest
```

- [x] **Step 2: Add scripts to `package.json`**

```json
"test": "npm run test:legacy && vitest run --passWithNoTests",
"test:legacy": "tsx client/src/lib/date-range.test.ts && tsx client/src/lib/chores-state.test.ts && tsx client/src/lib/dinner-state.test.ts && tsx client/src/lib/osk.test.ts"
```

- [x] **Step 3: Create `vitest.config.ts`**

```ts
import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
  test: {
    include: ["client/src/**/*.spec.ts"],
    environment: "node",
  },
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "client", "src"),
      "@shared": path.resolve(import.meta.dirname, "shared"),
    },
  },
});
```

- [x] **Step 4: Run the gate**

Run: `npm test`
Expected: all four legacy scripts print their `ok - …` lines and exit 0; vitest reports "no test files found" and passes.

- [x] **Step 5: Verify build still clean:** `npm run build` → exits 0.

- [x] **Step 6: Commit**

```bash
git add package.json package-lock.json vitest.config.ts
git commit -m "refactor: add npm test gate (vitest + legacy tsx scripts)"
```

---

### Task 2: Decoupling — move `Section`/`CalendarView` types out of page/component files

**Files:**
- Create: `client/src/lib/app-types.ts`
- Modify: `client/src/components/nav-rail.tsx:4`, `client/src/pages/calendar.tsx` (type declaration + imports), `client/src/components/calendar/calendar-header.tsx:7`, plus every hit of the greps below.

**Interfaces:**
- Produces: `export type Section = "calendar" | "chores" | "dinner"` and `export type CalendarView = "day" | "week" | "month"` from `@/lib/app-types` — the module Phase 3's host/registry will import. No component may import types from `@/pages/*` afterward.

- [x] **Step 1: Create `client/src/lib/app-types.ts`**

```ts
// Shared view/section identifiers. Lives in lib/ so components never
// import types from page modules (pages will split in the widget-host
// refactor; see docs/plans/widget-system/WIDGET-SYSTEM-PLAN.md).
export type Section = "calendar" | "chores" | "dinner";
export type CalendarView = "day" | "week" | "month";
```

- [x] **Step 2: Find every importer**

Run: `git grep -n 'from "@/pages/calendar"' client/src` and `git grep -n 'type Section' client/src`
Expected: `calendar-header.tsx` (CalendarView), `nav-rail.tsx` (Section declaration), `calendar.tsx` (both). If more files appear, update them the same way.

- [x] **Step 3: Point everything at `@/lib/app-types`** — delete the `Section` declaration in `nav-rail.tsx:4` and the `CalendarView` declaration in `calendar.tsx`, add `import type { Section } from "@/lib/app-types"` / `import type { CalendarView, Section } from "@/lib/app-types"` respectively, and change `calendar-header.tsx:7` to `import type { CalendarView } from "@/lib/app-types";`. Keep `export type { Section }` in `nav-rail.tsx` and `export type { CalendarView }` in `calendar.tsx` ONLY if the grep in Step 2 showed other importers you are not updating — otherwise remove the re-exports.

- [x] **Step 4: Verify:** `npm run check` exits 0; `git grep -n 'from "@/pages/calendar"' client/src/components` → no output.

- [x] **Step 5: Commit** — `refactor: move Section/CalendarView types to lib/app-types`

---

### Task 3: Decoupling — delete the dead `RB` constant

**Files:**
- Modify: `client/src/lib/color-utils.ts:26-40`

- [x] **Step 1: Confirm it is dead:** `git grep -nE '\bRB\b' client/src` → only the definition in `color-utils.ts` (audit 2026-08-19 found no other references; re-verify).
- [x] **Step 2: Delete lines 26–40** (the `// Shared Rootboard UI tokens…` comment + `export const RB = {…} as const;`). The three functions above it stay.
- [x] **Step 3: Verify:** `npm run check` and `npm test` pass.
- [x] **Step 4: Commit** — `refactor: remove unused RB color constant (duplicated --rb-* palette)`

---

### Task 4: Decoupling — one filtering path for all three calendar views

**Files:**
- Modify: `client/src/pages/calendar.tsx:380-416`, `client/src/components/calendar/month-view.tsx`, `client/src/components/calendar/week-view.tsx`, `client/src/components/calendar/day-view.tsx`
- Update: `docs/SPEC.md` §3.2 (the "inconsistency to know about" note)

**⚠️ Documented behavior change (the one allowed):** today, with **every** calendar toggled off, Week/Day show no events (`calendar.tsx:164-169` returns `[]`) but MonthView shows **all** events (its internal filter is bypassed when the set is empty, `month-view.tsx:50`). After this task all three views show none — matching SPEC §3.2's stated behavior ("Empty `enabledCalendars` = no events shown"). Report this explicitly when the task completes.

- [x] **Step 1: Pass the filtered list to MonthView** — in `calendar.tsx:382-388`, change `events={events}` to `events={filteredEvents}` and delete the `enabledCalendars={enabledCalendars}` prop.
- [x] **Step 2: Strip MonthView's internal filter** — in `month-view.tsx`: remove `enabledCalendars?: Set<string>;` from the props interface (line 12) and the destructure (line 19); delete `const usingFilter = …` (line 50) and the `if (usingFilter && …) continue;` line (line 53); remove `enabledCalendars` from the `eventsByDate` dependency array (line 77).
- [x] **Step 3: Remove the now-dead prop from Week/Day** — grep inside `week-view.tsx` and `day-view.tsx` for `enabledCalendars`; if (as expected) it is only received and never used, delete it from their prop interfaces and from the call sites at `calendar.tsx:398` and `:411`. If either view *does* use it, leave that view untouched and note it in the completion report.
- [x] **Step 4: Verify:** `npm run check`, `npm test`, `npm run build` pass. Manual check in the dev app: month/week/day render identically with a normal calendar selection; toggling all calendars off now empties all three views.
- [x] **Step 5: Update `docs/SPEC.md`** — rewrite the §3.2 note ("Inconsistency to know about: …") to say all views receive pre-filtered events, and note the empty-set unification.
- [x] **Step 6: Commit** — `refactor: single pre-filtered events path for all calendar views`

---

### Task 5: Color inventory + naming table ⛔ FOUNDER GATE

**Files:**
- Create: `docs/plans/widget-system/phase2-color-inventory.md`

**Interfaces:**
- Produces: the approved literal→variable naming table every area task (7–11) applies. **No area task starts until the founder approves this table.**

- [x] **Step 1: Run the three inventory greps** (repo root):

```bash
git grep -nE '#[0-9a-fA-F]{3,8}\b' -- client/src ':!client/src/components/ui' ':!client/src/pages/setup.tsx'
```
```bash
git grep -nE 'rgba?\(' -- client/src ':!client/src/components/ui' ':!client/src/pages/setup.tsx'
```
```bash
git grep -nE '(text|bg|border|ring|divide|fill|stroke|from|via|to)-(white|black|(gray|slate|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose)-[0-9]{2,3})' -- client/src ':!client/src/components/ui' ':!client/src/pages/setup.tsx'
```

Expected magnitudes (audit 2026-08-19): ~220 hex / 29 files, ~21 rgb(a) / 16 files, ~144 palette classes / 24 files.

- [x] **Step 2: Build the table** in `phase2-color-inventory.md`: columns `file · line · literal · role · variable (new or existing)`. Naming rules (from [phase0-color-sweep-prompt.md](../theme-system/phase0-color-sweep-prompt.md)):
  - Name by **role**, not appearance (`--rb-nav-active-bg`, never `--rb-light-pink`).
  - Same value + same role in N files → ONE variable. Same value, different role → separate variables.
  - Literals already matching an existing `--rb-*`/`--p-*` value adopt the existing variable (e.g. the `#ea8c00` badge = `--p-orange`'s value but a different role → new `--rb-badge`).
  - Every `rgba()` shadow becomes a variable too (`--rb-shadow-soft` etc.).
  - Pre-decided rows (already ratified): `#fdeae8`→`--rb-nav-active-bg`, `#5b626d`→`--rb-nav-inactive-ink`, `#ea8c00` (badge)→`--rb-badge`, white badge text→`--rb-badge-ink`, `rgba(0,0,0,.05)`→`--rb-shadow-soft`, `#d9d5cc`/`#c4bfb2`→`--rb-scrollbar-thumb`/`--rb-scrollbar-thumb-hover`, `#0f0f0f`/`#1a1a1a` gradient→`--rb-screensaver-bg-1`/`-2`, confetti five→`--rb-confetti-1…5`, scattered `"#2563eb"` event fallbacks→consolidated `EVENT_FALLBACK_COLOR` in `lib/calendar-meta.ts` (single definition site).
  - Tailwind palette classes map to `rb` utilities from Task 6 (e.g. `text-gray-500`→`text-rb-muted`, `bg-white`→`bg-rb-surface`, `border-gray-100`→`border-rb-grid-line`) — where no existing token fits the role, propose a new variable in the table.
  - A color whose role is ambiguous gets a `?` row — ask, don't guess.
- [x] **Step 3: Commit the table** (`refactor: phase 2 color inventory + naming table`) and **STOP — present the table (especially new variable names and all `?` rows) for founder approval before Task 7.** Tasks 1–4 and 6 may proceed meanwhile.

---

### Task 6: Token foundation — variables + Tailwind `rb` map

**Files:**
- Modify: `client/src/index.css:28-48`, `tailwind.config.ts:17-68`

Adding definitions only — zero rendering change.

- [x] **Step 1: Extend the `--rb-*` block in `index.css`** with every *approved* new variable from Task 5. The pre-decided set (final values confirmed against the inventory):

```css
  /* Phase 2 additions — roles extracted from hardcoded literals */
  --rb-nav-active-bg: #fdeae8;
  --rb-nav-inactive-ink: #5b626d;
  --rb-badge: #ea8c00;
  --rb-badge-ink: #ffffff;
  --rb-shadow-soft: rgba(0, 0, 0, 0.05);
  --rb-scrollbar-thumb: #d9d5cc;
  --rb-scrollbar-thumb-hover: #c4bfb2;
  --rb-screensaver-bg-1: #0f0f0f;
  --rb-screensaver-bg-2: #1a1a1a;
  --rb-confetti-1: #f2655a;
  --rb-confetti-2: #f5a623;
  --rb-confetti-3: #16a34a;
  --rb-confetti-4: #2563eb;
  --rb-confetti-5: #9333ea;
```

- [x] **Step 2: Add the `rb` color map to `tailwind.config.ts`** inside `theme.extend.colors` (enables `bg-rb-surface`, `text-rb-muted`, … for the palette-class sweep):

```ts
        rb: {
          canvas: "var(--rb-canvas)",
          surface: "var(--rb-surface)",
          ink: "var(--rb-ink)",
          muted: "var(--rb-muted)",
          faint: "var(--rb-faint)",
          chip: "var(--rb-chip)",
          "chip-hover": "var(--rb-chip-hover)",
          accent: "var(--rb-accent)",
          "accent-hover": "var(--rb-accent-hover)",
          "today-wash": "var(--rb-today-wash)",
          "grid-line": "var(--rb-grid-line)",
          "nav-active-bg": "var(--rb-nav-active-bg)",
          "nav-inactive-ink": "var(--rb-nav-inactive-ink)",
          badge: "var(--rb-badge)",
          "badge-ink": "var(--rb-badge-ink)",
          // + any further approved Task 5 variables used via utilities
        },
```

- [x] **Step 3: Verify:** `npm run build` passes; app renders identically (no consumer changed yet).
- [x] **Step 4: Commit** — `refactor: add phase-2 --rb-* tokens and Tailwind rb color map`

---

### Task 7: Area sweep — nav rail + global CSS

**Files:**
- Modify: `client/src/components/nav-rail.tsx`, `client/src/index.css` (consumer sites: `.calendar-cell:101`, `.screensaver-overlay:110`, scrollbar blocks `:188`, `:202`, `:209`)

- [x] **Step 1: `nav-rail.tsx` replacements** (exact edits):
  - line 26: `boxShadow: "1px 0 0 rgba(0,0,0,.05)"` → `boxShadow: "1px 0 0 var(--rb-shadow-soft)"`
  - line 50: `background: isActive ? "#fdeae8" : "transparent"` → `background: isActive ? "var(--rb-nav-active-bg)" : "transparent"`
  - line 51: `color: isActive ? "var(--rb-accent)" : "#5b626d"` → `color: isActive ? "var(--rb-accent)" : "var(--rb-nav-inactive-ink)"`
  - line 63: badge `className="… text-white"` → drop `text-white`, add `color: "var(--rb-badge-ink)"` to the badge `style`
  - line 70: `background: "#ea8c00"` → `background: "var(--rb-badge)"`
- [x] **Step 2: `index.css` consumer sites:** `.calendar-cell` shadow → `box-shadow: 0 1px 2px var(--rb-shadow-soft);`; `.screensaver-overlay` gradient → `linear-gradient(135deg, var(--rb-screensaver-bg-1) 0%, var(--rb-screensaver-bg-2) 50%, var(--rb-screensaver-bg-1) 100%)`; `scrollbar-color: var(--rb-scrollbar-thumb) transparent;`; both `::-webkit-scrollbar-thumb` backgrounds → `var(--rb-scrollbar-thumb)` / `var(--rb-scrollbar-thumb-hover)`. Do NOT restructure the `@supports` guard (see the war-story comment — it is load-bearing).
- [x] **Step 3: Gate:** `git grep -nE '#[0-9a-fA-F]{3,8}\b|rgba?\(' client/src/components/nav-rail.tsx` → no output. `npm run build && npm test` pass. Visual check: rail, badge, scrollbars, screensaver dim identical.
- [x] **Step 4: Commit** — `refactor: color variables for nav rail and global css`

---

### Task 8: Area sweep — calendar

**Files:**
- Modify: `components/calendar/calendar-header.tsx` (15 hex + 9 palette classes), `settings-menu.tsx` (13 hex + 42 classes), `week-view.tsx` (4 hex incl. module-level `GRID_LINE = '#ededed'` at line 26 → delete the constant, use `var(--rb-grid-line)` at its use sites), `day-view.tsx` (7 hex + 5 classes), `month-view.tsx` (6 hex), `update-notification.tsx` (20 classes), `auth-dialog.tsx` (14 classes), `event-details-dialog.tsx` (10 classes), `event-form-dialog.tsx`, `day-events-dialog.tsx`, `calendar-filters.tsx`, `mini-month.tsx`, `coming-up.tsx`, `event-item.tsx`, `loading-indicator.tsx`, `pages/calendar.tsx` (e.g. `border-gray-100` at `:369`), `lib/calendar-meta.ts` (styling literals only — `FALLBACK_COLORS` stays; add the consolidated `EVENT_FALLBACK_COLOR` export and point the `event.color || "#2563eb"` sites at it)

- [x] **Step 1:** Apply the approved Task 5 table to every file above: inline `style` literals → `var(--rb-…)`; Tailwind palette classes → `rb` utilities (`text-gray-500` → `text-rb-muted`, `bg-white` → `bg-rb-surface`, etc. per table). Work dialog-chrome files (`settings-menu`, `update-notification`, `auth-dialog`) as their own commit if the diff gets large.
- [x] **Step 2: Gate:** the Task 5 hex/rgb/palette greps restricted to `client/src/components/calendar client/src/pages/calendar.tsx` return only allowlisted lines (`calendar-meta.ts` `FALLBACK_COLORS` + `EVENT_FALLBACK_COLOR` definition). `npm run build && npm test` pass. Visual check all three views + settings popover + each dialog.
- [x] **Step 3: Commit(s)** — `refactor: color variables for calendar views/header`, `refactor: color variables for settings and dialogs`

---

### Task 9: Area sweep — chores + injectable confetti colors

**Files:**
- Modify: `pages/chores.tsx` (8 hex), `components/chores/person-column.tsx`, `edit-people.tsx` (9 hex), `reset-confirm-dialog.tsx` (8 hex), `chore-card-stack.tsx`, `confetti-burst.tsx`
- Create: `client/src/components/chores/confetti-colors.spec.ts`
- **Leave alone:** `lib/chores-state.ts` `PERSON_PALETTE` (exception list)

The confetti change is the one code-shape change in this task — TDD it:

- [x] **Step 1: Write the failing spec** (`confetti-colors.spec.ts`):

```ts
import { describe, expect, test } from "vitest";
import {
  CONFETTI_COLORS,
  generateConfettiParticles,
} from "./confetti-burst";

describe("generateConfettiParticles color injection", () => {
  test("defaults to CONFETTI_COLORS", () => {
    const particles = generateConfettiParticles();
    for (const p of particles) expect(CONFETTI_COLORS).toContain(p.color);
  });

  test("uses injected colors, cycling in order", () => {
    const custom = ["#111111", "#222222", "#333333"];
    const particles = generateConfettiParticles(custom);
    particles.forEach((p, i) => expect(p.color).toBe(custom[i % custom.length]));
  });

  test("default constant is unchanged (pinned for themes/tests)", () => {
    expect(CONFETTI_COLORS).toEqual(["#f2655a", "#f5a623", "#16a34a", "#2563eb", "#9333ea"]);
  });
});
```

- [x] **Step 2: Run it — must fail:** `npx vitest run client/src/components/chores/confetti-colors.spec.ts` → FAIL ("Expected 0 arguments, but got 1" / injection test fails).
- [x] **Step 3: Make `generateConfettiParticles` injectable** (`confetti-burst.tsx:23`, one-line signature change; body's line 32 uses the param):

```ts
export function generateConfettiParticles(
  colors: readonly string[] = CONFETTI_COLORS
): ConfettiParticle[] {
```

…and inside the loop: `color: colors[i % colors.length],`

- [x] **Step 4: Resolve runtime colors in the caller** — in `chore-card-stack.tsx`, add and use:

```ts
/** Confetti colors come from the theme via CSS variables, falling back to
 *  the pinned defaults if any variable is missing (an undefined CSS var
 *  once made the OSK transparent — never trust vars blindly on the kiosk). */
function runtimeConfettiColors(): readonly string[] {
  const style = getComputedStyle(document.documentElement);
  const colors = [1, 2, 3, 4, 5].map((i) =>
    style.getPropertyValue(`--rb-confetti-${i}`).trim()
  );
  return colors.every(Boolean) ? colors : CONFETTI_COLORS;
}
```

…and at line 53: `particles: generateConfettiParticles(runtimeConfettiColors())`.

- [x] **Step 5: Run tests:** `npm test` → legacy chores/dinner scripts still pass (pure functions untouched), new spec passes.
- [x] **Step 6:** Apply the Task 5 table to the remaining chores files (straight literal→`var()`/`rb`-utility swaps).
- [x] **Step 7: Gate:** area greps return only `PERSON_PALETTE` + `CONFETTI_COLORS` lines; build + tests pass; visual check incl. a confetti burst and the FLIP reorder.
- [x] **Step 8: Commit** — `refactor: color variables for chores; theme-injectable confetti colors`

---

### Task 10: Area sweep — dinner

**Files:**
- Modify: `pages/dinner.tsx`, `components/dinner/voting-strip.tsx` (17 hex — densest file), `meal-list-dialog.tsx` (16), `day-cell.tsx` (14), `meal-picker-dialog.tsx` (9), `planner-grid.tsx`, `reset-votes-dialog.tsx`

- [x] **Step 1:** Apply the approved table (straight swaps; `lib/dinner-state.ts` has no styling colors — verify with the grep, and leave its logic untouched).
- [x] **Step 2: Gate:** area greps clean; `npm run build && npm test` pass (dinner legacy script pins the pure logic). Visual check: voting strip, planner grid, both dialogs.
- [x] **Step 3: Commit** — `refactor: color variables for dinner`

---

### Task 11: Area sweep — keyboard, screensaver, remainder

**Files:**
- Modify: `components/keyboard/on-screen-keyboard.tsx` (8 hex — **do not touch the kiosk defenses**: non-passive touchstart, pointer-events overrides, solid panel background stays a *defined* variable), `components/screensaver/power-saving-overlay.tsx`, every remaining file the Task 5 inventory lists (~10 files, 1–7 literals each), and `components/screensaver/screensaver-overlay.tsx` **only if** the open TASKS.md dead-code question has been resolved to keep it — otherwise skip it and say so.

- [x] **Step 1:** Apply the table to each remaining inventory row.
- [x] **Step 2: Gate:** full-repo greps (Task 5 commands) return ONLY allowlisted lines. `npm test` (OSK legacy script pins the keyboard core) and `npm run build` pass. Visual check: open the OSK on a touch field — solid background, dialogs lift, emoji layer renders.
- [x] **Step 3: Commit** — `refactor: color variables for keyboard, screensaver, and remaining files`

---

### Task 12: Final verification + docs

- [x] **Step 1: Full gates:**

```bash
git grep -nE '#[0-9a-fA-F]{3,8}\b' -- client/src ':!client/src/components/ui' ':!client/src/pages/setup.tsx'
```
Expected: only `index.css` definitions, `chores-state.ts` PERSON_PALETTE, `calendar-meta.ts` FALLBACK_COLORS + `EVENT_FALLBACK_COLOR`, `confetti-burst.tsx` CONFETTI_COLORS, and `.test/.spec` assertions. Same for the rgb(a) and palette-class greps.

Plus a standing opacity-modifier gate (the `rb` map's colors are plain `var(...)` strings, so Tailwind's `/alpha` and `text-opacity-*`/`bg-opacity-*` modifiers silently produce no CSS against them):
```bash
git grep -nE 'rb-[a-z-]+/[0-9]|text-opacity-|bg-opacity-' -- client/src ':!client/src/components/screensaver/screensaver-overlay.tsx'
```
Expected: no output.

- [x] **Step 2:** `npm run check && npm test && npm run build` — all green (3 pre-existing server/ errors tracked separately).
- [x] **Step 3: Side-by-side visual pass** on the dev machine at kiosk resolution: month/week/day, chores (badge, confetti, resets), dinner (voting, planner, dialogs), settings popover, update dialog, OSK, screensaver dim, scrollbars. **The definition of done is identical rendering.**
- [x] **Step 4: Docs:** update `WIDGET-SYSTEM-PLAN.md` status line (Phase 2 ✅); update `docs/SPEC.md` where behavior notes changed (Task 4's filter note; the variable-ization is invisible so §3 otherwise stands) **and add a short SPEC section documenting the color-token approach: styling colors come from the `--rb-*` variables / Tailwind `rb` map, plus the approved-drift record (Q1 harmonization + Q9/Q10/Q13/Q17 collapses, per the founder rulings in `phase2-color-inventory.md`)**; add the final exception list to `phase2-color-inventory.md`.
- [ ] **Step 5: Security review** per CLAUDE.md (public repo), then commit docs — `docs: phase 2 complete; update SPEC filter note` — and push the phase's commits.

---

## Self-review notes

- **Spec coverage:** parent-plan Phase 2 bullets → Task 1 (harness), Tasks 2–4 (all three named decouplings; "thin prop-drilling" is deliberately deferred to Phase 3's shell split, where those props move wholesale — thinning them twice would be rework), Tasks 5–11 (sweep incl. Tailwind classes, confetti special case, `setup.tsx` exemption), Task 12 (pixel-identical gate).
- **Known unknown:** exact variable names beyond the pre-decided set depend on the Task 5 table — that gate exists precisely so naming gets founder eyes before 29 files change.
- **Type consistency:** `Section`/`CalendarView` names match current declarations; `generateConfettiParticles(colors?)` signature is used consistently in Task 9's spec, implementation, and caller.
