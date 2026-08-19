# Phase 2 — Color inventory + naming table

**Status: ⛔ AWAITING FOUNDER APPROVAL.** No area sweep (Tasks 7–11) starts
until this table is approved. Task 6 may add the pre-decided tokens
immediately; the rest of the definitions block below is proposed, not final.

Source of rules: [PHASE2-EXECUTION.md](./PHASE2-EXECUTION.md) Task 5 and
[phase0-color-sweep-prompt.md](../theme-system/phase0-color-sweep-prompt.md).

---

## 1. Scope and grep results

Run from repo root (Git Bash). Note the pathspec form — the `--` must come
*before* `client/src`, otherwise git reads it as a revision:

```bash
git grep -nE '#[0-9a-fA-F]{3,8}\b' -- client/src ':!client/src/components/ui' ':!client/src/pages/setup.tsx'
git grep -nE 'rgba?\(' -- client/src ':!client/src/components/ui' ':!client/src/pages/setup.tsx'
git grep -nE '(text|bg|border|ring|divide|fill|stroke|from|via|to)-(white|black|(gray|slate|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose)-[0-9]{2,3})' -- client/src ':!client/src/components/ui' ':!client/src/pages/setup.tsx'
```

| Grep | Matching lines | Occurrences | Files | Audit expectation |
|---|---|---|---|---|
| hex | 155 | **234** | 29 | ~220 / 29 ✅ |
| rgb/rgba | 24 | **24** | 18 | ~21 / 16 ✅ |
| Tailwind palette classes | 116 | **144** | 24 | ~144 / 24 ✅ |

Occurrence counts (multiple literals per line are common) match the prior
audit. Line counts are lower simply because one line often carries three
literals.

**Extra find, missed by all three greps:** `client/src/index.css:169` —
`border: 2px solid white` on the current-time-indicator dot. A CSS *named*
color, so no grep above catches it. It is listed in the table and must be
part of Task 7's gate (the gate grep will not flag it — check it by eye).

---

## 2. Questions for founder (`?` rows)

Every genuinely ambiguous role is here. Each `?` row in the tables below
points back to one of these. Recommendation given for each.

> **Rulings (founder-ratified 2026-08-19):** all recommendations below
> are APPROVED as written — Q1 harmonize (governs every Tailwind
> palette-class row; drift confined to dialog chrome is accepted);
> Q9/Q10/Q13/Q17 micro-collapses accepted; Q2–Q8, Q11, Q14–Q16 as
> recommended; Q12 tracked as its own TASKS.md item, excepted from the
> sweep. Rider: the accepted drift/token approach must be documented in
> `docs/SPEC.md` (Task 12). Area tasks execute this table as-is.

| # | Question | Recommendation |
|---|---|---|
| **Q1** | **Value drift on Tailwind palette classes.** Mapping `text-gray-500` (#6b7280) → `text-rb-muted` (#9aa0aa) is *not* pixel-identical, and the same is true for every red/blue/green/amber class. Phase 0 called the sweep a "pure refactor, pixel-identical"; the Task 5 brief explicitly prescribes these mappings. Which wins? | **Harmonize** (accept the small shifts). The drift is confined to secondary dialog chrome — settings popover, update notification, auth dialog, event-details dialog, 404 page — none of which is in the primary kiosk view. Preserving Tailwind's exact grays would bake 9 arbitrary greys into the theme system and defeat the point. **Scope: this question applies to EVERY Tailwind palette-class → rb-variable mapping in this document (all ~144 class occurrences across Areas B–H), not only rows previously marked — approve Q1 once and it governs them all.** |
| **Q2** | **`#5b626d` — one token or two?** Pre-decided as `--rb-nav-inactive-ink`, but the same value is the standard control/label ink in ~20 non-nav sites (header buttons, dialog descriptions, mini-month arrows, chores/dinner header buttons). | Two names, one value: `--rb-ink-secondary: #5b626d` and `--rb-nav-inactive-ink: var(--rb-ink-secondary)`. Honors the pre-decision and lets a theme move the nav independently. |
| **Q3** | **`#fdeae8` — nav active bg (pre-decided) vs. the Dinner "TODAY" pill** (`day-cell.tsx:53`). | Same pattern: `--rb-accent-wash: #fdeae8`, `--rb-nav-active-bg: var(--rb-accent-wash)`. (Note `--rb-today-wash` is a *different* value, #fff1ea — do not merge.) |
| **Q4** | **`#2b3038` as a dark button/keyboard-key background** (7 sites) vs. as body ink (`--rb-ink`, 20+ sites). | Separate token `--rb-btn-dark-bg: #2b3038`. A dark theme will invert ink but must keep a dark-on-light button; collapsing them makes that impossible. |
| **Q5** | **White text/icons on colored fills** (avatar initials, chore check, today numeral, dark-button labels — 18 sites) vs. the pre-decided `--rb-badge-ink`. | `--rb-on-color-ink: #ffffff`, with `--rb-badge-ink: var(--rb-on-color-ink)`. |
| **Q6** | **`#f0eee9`** is the out-of-month month-view cell *and* the past-day Dinner cell. Same role ("de-emphasized day cell") or two? | One token: `--rb-cell-inactive-bg`. |
| **Q7** | **`#fbfaf7`** serves three roles: weekend month-view cell, text-input background (3 dialogs), meal-list row wash. | Two tokens: `--rb-cell-weekend-bg` (calendar grid) and `--rb-surface-sunken` (inputs + list rows). A theme will want the weekend tint to track the grid, not the form controls. |
| **Q8** | **`#d9d5cc`** is the pre-decided `--rb-scrollbar-thumb`, *and* the Dinner day-cell hover border, *and* the empty vote-slot dashed border, *and* the keyboard ctrl-key fill. | Three tokens sharing the value: `--rb-scrollbar-thumb`, `--rb-border-strong`, `--rb-key-ctrl-bg`. |
| **Q9** | **Three near-identical disabled greys**: `#b8bcc4` (month-view + day-cell + disabled vote button), `#cfd2d8` (mini-month out-of-month numeral), and the existing `--rb-faint` `#b0b5be`. | Collapse `#cfd2d8` into `--rb-ink-disabled` (#b8bcc4) — a 2-step shift on a numeral nobody reads; it removes a token and fixes an existing inconsistency. If you want strict pixel-identity, keep `--rb-ink-faintest: #cfd2d8` instead (listed as optional in the definitions block). |
| **Q10** | **`#8b919b`** (sync-status text, `calendar-header.tsx:178`) — matches the shadcn `--muted-foreground`, but not `--rb-muted` (#9aa0aa). | Collapse to `--rb-muted`. One less token; the delta is imperceptible on 12px meta text. Alternative: `--rb-ink-meta: #8b919b`. |
| **Q11** | **`event-details-dialog.tsx:91`** uses `calendarColor \|\| '#4285f4'` (Google blue) — a *different* fallback from the four `'#2563eb'` sites the brief consolidates into `EVENT_FALLBACK_COLOR`. | Fold it into `EVENT_FALLBACK_COLOR` too. Two fallbacks for "we have no color" is an accident, not a design. |
| **Q12** | **`settings-menu.tsx:186-188` holds a second, divergent calendar-color fallback list** (Google palette: `#1a73e8`, `#34a853`, …) with a copy-pasted hash function, duplicating `FALLBACK_COLORS` in `lib/calendar-meta.ts`. The same calendar therefore gets one color in Settings and a different one everywhere else. | **Out of scope for the color sweep** (it's a behavior fix, not a token swap). Recommend replacing the local list + hash with `getCalendarColor()` from `lib/calendar-meta.ts` as its own task; add to TASKS.md. Until then it stays in the exceptions list. |
| **Q13** | **`emerald-500/600`** (sync-ok dot, subscribe button) vs. **`green-600/700`** (update notification) — two success greens in the same app. | Unify both onto `--rb-success` / `--rb-success-hover`. |
| **Q14** | **Tint borders have no house equivalent.** `border-red-200`, `border-blue-200`, `border-amber-200` (dialog chrome) — the Rootboard palette has washes but no border step. | Add `--rb-danger-border` (= `--rb-danger-wash-hover`, #f9d2dd, already in-house), plus two **new invented values**: `--rb-info-border: #cbdcff`, `--rb-warn-border: #f4dcae`. These two are the only values in this document not already present in the codebase — please eyeball them. |
| **Q15** | **`bg-black`** on the power-saving overlay — own token or reuse `--rb-screensaver-bg-1` (#0f0f0f)? | Own token `--rb-power-saving-bg: #000000`. Power-saving is the true blackout state (max panel savings); the screensaver is a dimmed gradient. Different intent. |
| **Q16** | **`#b45309`** (vote-cooldown text, `voting-strip.tsx:29`) is byte-identical to the PERSON_PALETTE orange `text` value — but here its role is "warning ink", not "person". | `--rb-warn-ink: #b45309`, kept fully separate from PERSON_PALETTE (which stays a data exception). |
| **Q17** | **`hover:text-amber-900`** (`settings-menu.tsx:328`) is a step darker than `text-amber-800` on the same block; the house warn ramp has no such step. | Map both to `--rb-warn-ink` (loses a barely-visible hover darkening on one link). |

---

## 3. Naming rules applied

- Named by **role**, never appearance.
- Same value + same role across N files → **one** variable.
- Same value + different role → **separate** variables (aliased to each other
  in the definitions block, so today's rendering is byte-identical and a theme
  can still split them later).
- Every `rgba()` shadow becomes a variable.
- A literal matching an existing `--rb-*`/`--p-*` **value and role** adopts the
  existing variable. Matching value but a different role → new variable.
- Tailwind palette classes → `rb` utilities from Task 6
  (`text-gray-500` → `text-rb-muted`, `bg-white` → `bg-rb-surface`,
  `border-gray-100` → `border-rb-grid-line`).

Note: All Tailwind palette-class rows are governed by founder question **Q1** (value drift vs. exact-value aliases).

Legend: **(E)** = existing variable reused · **(P)** = new, pre-decided/ratified ·
**(N)** = new, proposed · **?** = see the question in column 4.

---

## 4. Area A — Nav rail + global CSS *(Task 7)*

| File | Line | Literal | Role | Variable |
|---|---|---|---|---|
| `components/nav-rail.tsx` | 25 | `rgba(0,0,0,.05)` | rail right-edge hairline | `--rb-shadow-soft` (P) |
| `components/nav-rail.tsx` | 49 | `#fdeae8` | nav item active background | `--rb-nav-active-bg` (P) **?Q3** |
| `components/nav-rail.tsx` | 50 | `#5b626d` | nav item inactive icon+label ink | `--rb-nav-inactive-ink` (P) **?Q2** |
| `components/nav-rail.tsx` | 62 | `text-white` | chore badge numeral | `text-rb-badge-ink` (P) **?Q5** |
| `components/nav-rail.tsx` | 70 | `#ea8c00` | chore badge fill | `--rb-badge` (P) |
| `index.css` | 101 | `rgba(0,0,0,0.05)` | `.calendar-cell` drop shadow | `--rb-shadow-soft` (P) |
| `index.css` | 110 | `#0f0f0f` ×2 | screensaver gradient stops 1 & 3 | `--rb-screensaver-bg-1` (P) |
| `index.css` | 110 | `#1a1a1a` | screensaver gradient midpoint | `--rb-screensaver-bg-2` (P) |
| `index.css` | 116 | `rgba(70,130,180,0.3)` | screensaver logo glow | `--rb-screensaver-logo-glow` (N) |
| `index.css` | 169 | `white` *(named — no grep hit)* | current-time dot ring | `--rb-surface` (E) |
| `index.css` | 188 | `#d9d5cc` | Firefox scrollbar thumb | `--rb-scrollbar-thumb` (P) **?Q8** |
| `index.css` | 202 | `#d9d5cc` | webkit scrollbar thumb | `--rb-scrollbar-thumb` (P) **?Q8** |
| `index.css` | 209 | `#c4bfb2` | webkit scrollbar thumb hover | `--rb-scrollbar-thumb-hover` (P) |
| `index.css` | 7, 8, 10 | `#f7f6f3`, `#2b3038`, `#8b919b` | hex inside comments only | no change |
| `index.css` | 29–47 | `--rb-*`, `--p-*` | variable **definitions** | n/a (allowed) |

---

## 5. Area B — Calendar *(Task 8)*

### calendar-filters.tsx

| File | Line | Literal | Role | Variable |
|---|---|---|---|---|
| `calendar-filters.tsx` | 57 | `text-white` | avatar initials on calendar color | `text-rb-on-color-ink` (N) **?Q5** |
| `calendar-filters.tsx` | 62 | `#3a4049` | calendar name ink | `--rb-ink-soft` (N) |
| `calendar-filters.tsx` | 64 | `#b0b5be` | "(hidden)" faint ink | `--rb-faint` (E) |

### calendar-header.tsx

| File | Line | Literal | Role | Variable |
|---|---|---|---|---|
| `calendar-header.tsx` | 46 | `#5b626d` | nav-arrow icon ink | `--rb-ink-secondary` (N) **?Q2** |
| `calendar-header.tsx` | 98 | `bg-[#2b3038]`, `hover:bg-[#2b3038]` | view-toggle selected fill | `--rb-btn-dark-bg` (N) **?Q4** |
| `calendar-header.tsx` | 98 | `text-white`, `hover:text-white` | view-toggle selected label | `text-rb-on-color-ink` (N) **?Q5** |
| `calendar-header.tsx` | 99 | `text-[#5b626d]` ×2 | view-toggle unselected label | `text-rb-ink-secondary` (N) |
| `calendar-header.tsx` | 99 | `hover:bg-white` | view-toggle hover fill | `hover:bg-rb-surface` (E) |
| `calendar-header.tsx` | 108 | `bg-white` | header bar surface | `bg-rb-surface` (E) |
| `calendar-header.tsx` | 116 | `#2b3038` | page title ink | `--rb-ink` (E) |
| `calendar-header.tsx` | 122 | `bg-[#eef4ff]` | "Today" button fill | `--rb-info-wash` (N) |
| `calendar-header.tsx` | 122 | `text-[#2563eb]` | "Today" button ink | `--rb-info` (N) |
| `calendar-header.tsx` | 122 | `hover:bg-[#e1ebff]` | "Today" button hover fill | `--rb-info-wash-hover` (N) |
| `calendar-header.tsx` | 133 | `#5b626d` | weather icon ink | `--rb-ink-secondary` (N) |
| `calendar-header.tsx` | 134 | `#2b3038` | temperature ink | `--rb-ink` (E) |
| `calendar-header.tsx` | 154 | `rgba(242,101,90,.35)` | accent button drop shadow | `--rb-shadow-accent` (N) |
| `calendar-header.tsx` | 154 | `text-white` | accent button label | `text-rb-on-color-ink` (N) |
| `calendar-header.tsx` | 166 | `bg-[#16a34a]` | sync button fill | `--rb-success` (N) |
| `calendar-header.tsx` | 166 | `hover:bg-[#15803d]` | sync button hover fill | `--rb-success-hover` (N) |
| `calendar-header.tsx` | 166 | `text-white` | sync button label | `text-rb-on-color-ink` (N) |
| `calendar-header.tsx` | 178 | `#8b919b` | sync-status meta ink | `--rb-muted` (E) **?Q10** |
| `calendar-header.tsx` | 180 | `text-red-600` | sync-error icon | `text-rb-danger` (N) |
| `calendar-header.tsx` | 182 | `bg-emerald-500` | sync-ok dot | `bg-rb-success` (N) **?Q13** |
| `calendar-header.tsx` | 190 | `text-red-600` | "Last sync failed" ink | `text-rb-danger` (N) |
| `calendar-header.tsx` | 207 | `#5b626d` | settings/secondary button ink | `--rb-ink-secondary` (N) |

### coming-up.tsx / mini-month.tsx / day-view.tsx

| File | Line | Literal | Role | Variable |
|---|---|---|---|---|
| `coming-up.tsx` | 15 | `rgba(0,0,0,.06)` | card drop shadow | `--rb-shadow-card` (N) |
| `coming-up.tsx` | 32 | `#2b3038` | item title ink | `--rb-ink` (E) |
| `mini-month.tsx` | 20 | `rgba(0,0,0,.06)` | card drop shadow | `--rb-shadow-card` (N) |
| `mini-month.tsx` | 22 | `#2b3038` | month label ink | `--rb-ink` (E) |
| `mini-month.tsx` | 29, 37 | `#5b626d` ×2 | prev/next arrow ink | `--rb-ink-secondary` (N) |
| `mini-month.tsx` | 63 | `#fff` | today numeral on accent fill | `--rb-on-color-ink` (N) **?Q5** |
| `mini-month.tsx` | 63 | `#2b3038` | in-month day numeral | `--rb-ink` (E) |
| `mini-month.tsx` | 63 | `#cfd2d8` | out-of-month day numeral | `--rb-ink-disabled` (N) **?Q9** |
| `day-view.tsx` | 84, 111, 179, 209 | `'#2563eb'` ×4 | event color fallback | `EVENT_FALLBACK_COLOR` (TS const, `lib/calendar-meta.ts`) (P) |
| `day-view.tsx` | 140 ×2, 141, 148 | `bg-white` ×4 | panel surfaces / skeleton cards | `bg-rb-surface` (E) |
| `day-view.tsx` | 167 | `rgba(0,0,0,.06)` | agenda card shadow | `--rb-shadow-card` (N) |
| `day-view.tsx` | 170, 225, 240 | `#2b3038` ×3 | heading / time / event title ink | `--rb-ink` (E) |
| `day-view.tsx` | 242, 257 | `text-white` ×2 | "now" pill + avatar initials | `text-rb-on-color-ink` (N) |

### month-view.tsx / week-view.tsx

| File | Line | Literal | Role | Variable |
|---|---|---|---|---|
| `month-view.tsx` | 127 | `'#f0eee9'` | out-of-month cell fill | `--rb-cell-inactive-bg` (N) **?Q6** |
| `month-view.tsx` | 127 | `'#fbfaf7'` | weekend cell fill | `--rb-cell-weekend-bg` (N) **?Q7** |
| `month-view.tsx` | 127 | `'#ffffff'` | weekday cell fill | `--rb-surface` (E) |
| `month-view.tsx` | 128 | `'#2b3038'` | in-month day numeral | `--rb-ink` (E) |
| `month-view.tsx` | 128 | `'#b8bcc4'` | out-of-month day numeral | `--rb-ink-disabled` (N) **?Q9** |
| `month-view.tsx` | 137 | `rgba(0,0,0,.05)` | cell drop shadow | `--rb-shadow-soft` (P) |
| `month-view.tsx` | 162 | `hover:text-[#5b626d]` | "+N more" hover ink | `hover:text-rb-ink-secondary` (N) |
| `week-view.tsx` | 25 | `'#ededed'` (`GRID_LINE` const) | time-grid rule | `--rb-grid-line` (E) — delete the const |
| `week-view.tsx` | 94 | `'#fff'` | today numeral on accent fill | `--rb-on-color-ink` (N) |
| `week-view.tsx` | 94 | `'#2b3038'` | day numeral ink | `--rb-ink` (E) |
| `week-view.tsx` | 111, 125, 142, 149 | `bg-white` ×4 | header/column surfaces | `bg-rb-surface` (E) |
| `week-view.tsx` | 181 | `'#ffffff'` | non-today column fill | `--rb-surface` (E) |

### Dialog chrome — event-details, event-form, auth, update-notification

| File | Line | Literal | Role | Variable |
|---|---|---|---|---|
| `event-details-dialog.tsx` | 35, 45, 66 | `text-gray-900` ×3 | dialog title / primary ink | `text-rb-ink` (E) |
| `event-details-dialog.tsx` | 43, 64, 85 | `text-gray-500` ×3 | metadata icon ink | `text-rb-muted` (E) |
| `event-details-dialog.tsx` | 49, 54, 76 | `text-gray-600` ×3 | secondary body ink | `text-rb-ink-secondary` (N) |
| `event-details-dialog.tsx` | 89 | `text-white` | calendar chip label | `text-rb-on-color-ink` (N) |
| `event-details-dialog.tsx` | 91 | `'#4285f4'` | calendar color fallback | `EVENT_FALLBACK_COLOR` **?Q11** |
| `event-form-dialog.tsx` | 431 | `rgba(242,101,90,.35)` | save button shadow | `--rb-shadow-accent` (N) |
| `event-form-dialog.tsx` | 431 | `text-white` | save button label | `text-rb-on-color-ink` (N) |
| `event-item.tsx` | 35 | `"#2563eb"` | event color fallback | `EVENT_FALLBACK_COLOR` (P) |
| `loading-indicator.tsx` | 11 | `bg-white` | toast surface | `bg-rb-surface` (E) |
| `loading-indicator.tsx` | 14 | `#5b626d` | toast label ink | `--rb-ink-secondary` (N) |
| `auth-dialog.tsx` | 32 | `text-red-500` | error icon | `text-rb-danger` (N) |
| `auth-dialog.tsx` | 42 | `bg-red-50` / `border-red-200` | error detail panel | `bg-rb-danger-wash` / `border-rb-danger-border` (N) **?Q14** |
| `auth-dialog.tsx` | 43 | `text-red-700` | error detail text | `text-rb-danger-ink` (N) |
| `auth-dialog.tsx` | 47 | `bg-blue-50` / `border-blue-200` / `text-blue-700` | setup-help panel | `bg-rb-info-wash` / `border-rb-info-border` / `text-rb-info-ink` (N) **?Q14** |
| `auth-dialog.tsx` | 50, 54 ×2, 55 | `bg-blue-100` ×4 | inline `<code>` chip fill | `bg-rb-info-wash-hover` (N) |
| `auth-dialog.tsx` | 76 | `border-gray-100` | footer divider | `border-rb-grid-line` (E) |
| `auth-dialog.tsx` | 78 | `text-blue-600` / `hover:text-blue-800` | setup-guide link | `text-rb-info` / `hover:text-rb-info-hover` (N) |
| `update-notification.tsx` | 58, 73 | `text-blue-600` ×2 | downloading / available icon | `text-rb-info` (N) |
| `update-notification.tsx` | 63, 115 | `text-green-600` ×2 | success icon / latest version | `text-rb-success` (N) **?Q13** |
| `update-notification.tsx` | 68 | `text-red-600` | error icon | `text-rb-danger` (N) |
| `update-notification.tsx` | 84, 89, 126 | `text-gray-500` ×3 | progress / hint / section label | `text-rb-muted` (E) |
| `update-notification.tsx` | 88 | `text-green-700` | success message | `text-rb-success-ink` (N) |
| `update-notification.tsx` | 93 | `text-red-700` | error message | `text-rb-danger-ink` (N) |
| `update-notification.tsx` | 95 | `bg-red-50` / `text-red-600` | error detail block | `bg-rb-danger-wash` / `text-rb-danger` (N) |
| `update-notification.tsx` | 108 | `bg-gray-50` | version panel fill | `bg-rb-canvas` (E) |
| `update-notification.tsx` | 110, 114, 119, 127 | `text-gray-600` ×3, `text-gray-700` | version labels / release notes | `text-rb-ink-secondary` (N) |
| `update-notification.tsx` | 127 | `bg-blue-50` | release-notes panel | `bg-rb-info-wash` (N) |
| `update-notification.tsx` | 167 | `bg-blue-600` / `hover:bg-blue-700` | update button | `bg-rb-info` / `hover:bg-rb-info-hover` (N) |

### settings-menu.tsx

| File | Line | Literal | Role | Variable |
|---|---|---|---|---|
| `settings-menu.tsx` | 186–188 | 12 hex | calendar color fallback list | **EXCEPTION** — see §13 and **?Q12** |
| `settings-menu.tsx` | 217 | `bg-red-600` / `hover:bg-red-700` / `text-white` | destructive confirm button | `bg-rb-danger` / `hover:bg-rb-danger-hover` / `text-rb-on-color-ink` (N) |
| `settings-menu.tsx` | 231 | `#5b626d` | close/arrow ink | `--rb-ink-secondary` (N) |
| `settings-menu.tsx` | 242 | `text-gray-600` / `hover:text-gray-800` / `hover:bg-gray-100` | settings trigger button | `text-rb-ink-secondary` / `hover:text-rb-ink-soft` / `hover:bg-rb-chip` (N/E) |
| `settings-menu.tsx` | 271, 310, 341, 419 | `text-gray-400` ×4 | dim icons / helper text | `text-rb-faint` (E) |
| `settings-menu.tsx` | 280 | `text-gray-600` | brightness sun icon | `text-rb-ink-secondary` (N) |
| `settings-menu.tsx` | 282, 335, 352, 388, 457 | `text-gray-500` ×5 | secondary labels | `text-rb-muted` (E) |
| `settings-menu.tsx` | 324 | `bg-amber-50` / `border-amber-200` | setup-warning panel | `bg-rb-warn-wash` / `border-rb-warn-border` (N) **?Q14** |
| `settings-menu.tsx` | 325 | `text-amber-500` | warning icon | `text-rb-warn` (N) |
| `settings-menu.tsx` | 326, 328 | `text-amber-800`, `hover:text-amber-900` | warning text + link hover | `text-rb-warn-ink` (N) **?Q17** |
| `settings-menu.tsx` | 334 | `bg-gray-50` / `border-gray-200` | service-account panel | `bg-rb-canvas` / `border-rb-chip-hover` (E) |
| `settings-menu.tsx` | 337 | `text-gray-700` | service-account email | `text-rb-ink-secondary` (N) |
| `settings-menu.tsx` | 341 | `hover:text-gray-700` | copy button hover | `hover:text-rb-ink-secondary` (N) |
| `settings-menu.tsx` | 345 | `text-emerald-500` | copied checkmark | `text-rb-success` (N) **?Q13** |
| `settings-menu.tsx` | 350 | `bg-gray-100` (track), `bg-gray-400` (thumb), `border-gray-100` (thumb border) | list scrollbar | `bg-rb-chip` / `bg-rb-scrollbar-thumb` / `border-rb-chip` (P/E) |
| `settings-menu.tsx` | 377 | `text-gray-400` / `hover:text-red-500` / `hover:bg-red-50` | remove-calendar button | `text-rb-faint` / `hover:text-rb-danger` / `hover:bg-rb-danger-wash` (N/E) |
| `settings-menu.tsx` | 408 | `bg-emerald-500` / `hover:bg-emerald-600` / `text-white` | subscribe button | `bg-rb-success` / `hover:bg-rb-success-hover` / `text-rb-on-color-ink` (N) **?Q13** |
| `settings-menu.tsx` | 417 | `text-red-600` | subscribe error | `text-rb-danger` (N) |
| `settings-menu.tsx` | 433 | `text-blue-600` / `hover:text-blue-700` / `hover:bg-blue-50` | check-for-updates button | `text-rb-info` / `hover:text-rb-info-hover` / `hover:bg-rb-info-wash` (N) |
| `settings-menu.tsx` | 444 | `text-amber-600` / `hover:text-amber-700` / `hover:bg-amber-50` | restart/rollback button | `text-rb-warn` / `hover:text-rb-warn-ink` / `hover:bg-rb-warn-wash` (N) |

### pages/calendar.tsx

| File | Line | Literal | Role | Variable |
|---|---|---|---|---|
| `pages/calendar.tsx` | 348 | `bg-white` | toolbar surface | `bg-rb-surface` (E) |
| `pages/calendar.tsx` | 368 | `border-gray-100` | filter-strip divider | `border-rb-grid-line` (E) |

---

## 6. Area C — Chores *(Task 9)*

| File | Line | Literal | Role | Variable |
|---|---|---|---|---|
| `chore-card-stack.tsx` | 76 | `bg-white` | chore card surface | `bg-rb-surface` (E) |
| `chore-card-stack.tsx` | 96 | `"#ffffff"` | toggle fill when not done | `--rb-surface` (E) |
| `chore-card-stack.tsx` | 104 | `"#ffffff"` | check glyph on person color | `--rb-on-color-ink` (N) **?Q5** |
| `chore-card-stack.tsx` | 116 | `"#9aa0aa"` | completed chore title | `--rb-muted` (E) |
| `chore-card-stack.tsx` | 116 | `"#2b3038"` | active chore title | `--rb-ink` (E) |
| `confetti-burst.tsx` | 17 | `CONFETTI_COLORS` ×5 | confetti particles | **EXCEPTION** (§13) — runtime read of `--rb-confetti-1…5` (P) |
| `edit-people.tsx` | 47 | `bg-white` | card surface | `bg-rb-surface` (E) |
| `edit-people.tsx` | 47 | `rgba(0,0,0,.06)` | card shadow | `--rb-shadow-card` (N) |
| `edit-people.tsx` | 48 | `"#2b3038"` | dialog title ink | `--rb-ink` (E) |
| `edit-people.tsx` | 51 | `"#9aa0aa"` | subtitle ink | `--rb-muted` (E) |
| `edit-people.tsx` | 64, 89, 172, 186 | `text-white` ×4 | labels on person color / dark buttons | `text-rb-on-color-ink` (N) |
| `edit-people.tsx` | 81 | `bg-white` | inline rename input | `bg-rb-surface` (E) |
| `edit-people.tsx` | 82 | `"#2b3038"` | rename input ink | `--rb-ink` (E) |
| `edit-people.tsx` | 101 | `hover:bg-white/55` | person row hover | `hover:bg-rb-surface/55` (E) |
| `edit-people.tsx` | 114 | `hover:bg-white` | icon button hover | `hover:bg-rb-surface` (E) |
| `edit-people.tsx` | 115 | `rgba(255,255,255,.65)` | icon button fill on person tint | `--rb-on-tint-fill` (N) |
| `edit-people.tsx` | 144 | `rgba(255,255,255,.7)` | swatch selection ring | `--rb-on-tint-ring` (N) |
| `edit-people.tsx` | 166 | `"#e7e4dd"` | text-input border | `--rb-field-border` (N) |
| `edit-people.tsx` | 166 | `"#2b3038"` | text-input ink | `--rb-ink` (E) |
| `edit-people.tsx` | 166 | `"#fbfaf7"` | text-input fill | `--rb-surface-sunken` (N) **?Q7** |
| `edit-people.tsx` | 173, 175 | `"#2b3038"` ×2 | dark "Add" button fill | `--rb-btn-dark-bg` (N) **?Q4** |
| `edit-people.tsx` | 174 | `"#3a4049"` | dark button hover fill | `--rb-btn-dark-hover-bg` (N) |
| `edit-people.tsx` | 187 | `rgba(242,101,90,.35)` | accent Done button shadow | `--rb-shadow-accent` (N) |
| `person-column.tsx` | 38, 58, 101 | `text-white` ×3 | avatar / count chip / icon button | `text-rb-on-color-ink` (N) |
| `person-column.tsx` | 52 | `rgba(255,255,255,.6)` | count chip fill on person tint | `--rb-on-tint-chip` (N) |
| `person-column.tsx` | 94 | `bg-white` | inline input | `bg-rb-surface` (E) |
| `person-column.tsx` | 95 | `rgba(255,255,255,.9)` | inline input border on tint | `--rb-on-tint-border` (N) |
| `person-column.tsx` | 95 | `"#2b3038"` | inline input ink | `--rb-ink` (E) |
| `person-column.tsx` | 112 | `hover:bg-white/50` | add-chore button hover | `hover:bg-rb-surface/50` (E) |
| `reset-confirm-dialog.tsx` | 42 | `"#2b3038"` | dialog title ink | `--rb-ink` (E) |
| `reset-confirm-dialog.tsx` | 45, 102 | `"#5b626d"` ×2 | description / Cancel ink | `--rb-ink-secondary` (N) |
| `reset-confirm-dialog.tsx` | 77 | `text-white` | person avatar initials | `text-rb-on-color-ink` (N) |
| `reset-confirm-dialog.tsx` | 117, 125 | `"#e11d48"` ×2 | selected destructive fill | `--rb-danger` (N) |
| `reset-confirm-dialog.tsx` | 118 | `"#fff"` | selected label ink | `--rb-on-color-ink` (N) |
| `reset-confirm-dialog.tsx` | 118 | `"#b8bcc4"` | unselected label ink | `--rb-ink-disabled` (N) |
| `reset-confirm-dialog.tsx` | 124 | `"#c9163d"` | destructive hover fill | `--rb-danger-hover` (N) |
| `pages/chores.tsx` | 57 | `bg-white` | header bar surface | `bg-rb-surface` (E) |
| `pages/chores.tsx` | 58 | `rgba(0,0,0,.05)` | header bottom hairline | `--rb-shadow-soft` (P) |
| `pages/chores.tsx` | 61 | `#2b3038` | page title ink | `--rb-ink` (E) |
| `pages/chores.tsx` | 71 | `"#16a34a"` | live/online status dot | `--rb-success` (N) |
| `pages/chores.tsx` | 72 | `"#3a4049"` | status label ink | `--rb-ink-soft` (N) |
| `pages/chores.tsx` | 80, 103 | `text-[#5b626d]` ×2 | secondary buttons | `text-rb-ink-secondary` (N) |
| `pages/chores.tsx` | 91 | `bg-white` | reset button surface | `bg-rb-surface` (E) |
| `pages/chores.tsx` | 91 | `hover:bg-[#fce4ea]` | reset button hover fill | `hover:bg-rb-danger-wash` (N) |
| `pages/chores.tsx` | 92 | `"#fce4ea"` | reset button inset ring | `--rb-danger-wash` (N) |
| `pages/chores.tsx` | 92 | `"#e11d48"` | reset button ink | `--rb-danger` (N) |
| `lib/chores-state.ts` | 46–53 | 24 hex | `PERSON_PALETTE` data | **EXCEPTION** (§13) |
| `lib/chores-state.test.ts` | 47 | 3 hex | test assertion | **EXCEPTION** (§13) |

---

## 7. Area D — Dinner *(Task 10)*

| File | Line | Literal | Role | Variable |
|---|---|---|---|---|
| `day-cell.tsx` | 18 | `"#f0eee9"` | past-day cell fill | `--rb-cell-inactive-bg` (N) **?Q6** |
| `day-cell.tsx` | 18 | `"#ffffff"` | normal cell fill | `--rb-surface` (E) |
| `day-cell.tsx` | 19 | `"#d9d5cc"` | cell hover border | `--rb-border-strong` (N) **?Q8** |
| `day-cell.tsx` | 19, 21, 52 | `"#f2655a"` ×3 | today border / numeral / pill ink | `--rb-accent` (E) |
| `day-cell.tsx` | 20, 21, 71 | `"#b8bcc4"` ×3 | past weekday / past numeral / ghost "Add" | `--rb-ink-disabled` (N) **?Q9** |
| `day-cell.tsx` | 21 | `"#2b3038"` | normal day numeral | `--rb-ink` (E) |
| `day-cell.tsx` | 34 | `rgba(0,0,0,.05)` | cell drop shadow | `--rb-shadow-soft` (P) |
| `day-cell.tsx` | 53 | `"#fdeae8"` | "TODAY" pill fill | `--rb-accent-wash` (N) **?Q3** |
| `day-cell.tsx` | 64 | `"#e3f5ea"` | dinner-set row fill | `--rb-success-wash` (N) |
| `day-cell.tsx` | 65 | `"#16a34a"` | utensils icon | `--rb-success` (N) |
| `day-cell.tsx` | 66 | `"#15803d"` | dinner name ink | `--rb-success-ink` (N) |
| `meal-list-dialog.tsx` | 41, 74, 109 | `"#2b3038"` ×3 | title / row title / input ink | `--rb-ink` (E) |
| `meal-list-dialog.tsx` | 48, 85 | `"#e11d48"` ×2 | full-count / delete-hover ink | `--rb-danger` (N) |
| `meal-list-dialog.tsx` | 48, 82, 89 | `"#5b626d"` ×3 | count chip / delete button ink | `--rb-ink-secondary` (N) |
| `meal-list-dialog.tsx` | 49, 84 | `"#fce4ea"` ×2 | full-count chip / delete-hover fill | `--rb-danger-wash` (N) |
| `meal-list-dialog.tsx` | 71, 109 | `"#fbfaf7"` ×2 | meal row wash / input fill | `--rb-surface-sunken` (N) **?Q7** |
| `meal-list-dialog.tsx` | 109 | `"#e7e4dd"` | input border | `--rb-field-border` (N) |
| `meal-list-dialog.tsx` | 115, 128 | `text-white` ×2 | dark + accent button labels | `text-rb-on-color-ink` (N) |
| `meal-list-dialog.tsx` | 116, 118 | `"#2b3038"` ×2 | dark "Add" button fill | `--rb-btn-dark-bg` (N) **?Q4** |
| `meal-list-dialog.tsx` | 117 | `"#3a4049"` | dark button hover fill | `--rb-btn-dark-hover-bg` (N) |
| `meal-list-dialog.tsx` | 129 | `rgba(242,101,90,.35)` | accent Done button shadow | `--rb-shadow-accent` (N) |
| `meal-picker-dialog.tsx` | 56, 93 | `"#2b3038"` ×2 | title / input ink | `--rb-ink` (E) |
| `meal-picker-dialog.tsx` | 71 | `"#3a4049"` | suggestion chip ink | `--rb-ink-soft` (N) |
| `meal-picker-dialog.tsx` | 93 | `"#e7e4dd"` | input border | `--rb-field-border` (N) |
| `meal-picker-dialog.tsx` | 93 | `"#fbfaf7"` | input fill | `--rb-surface-sunken` (N) |
| `meal-picker-dialog.tsx` | 99 | `text-white` | accent button label | `text-rb-on-color-ink` (N) |
| `meal-picker-dialog.tsx` | 100 | `rgba(242,101,90,.35)` | accent button shadow | `--rb-shadow-accent` (N) |
| `meal-picker-dialog.tsx` | 117, 119 | `"#fce4ea"` ×2 | clear-dinner button fill | `--rb-danger-wash` (N) |
| `meal-picker-dialog.tsx` | 117 | `"#e11d48"` | clear-dinner button ink | `--rb-danger` (N) |
| `meal-picker-dialog.tsx` | 118 | `"#f9d2dd"` | clear-dinner hover fill | `--rb-danger-wash-hover` (N) |
| `reset-votes-dialog.tsx` | 27 | `"#2b3038"` | dialog title ink | `--rb-ink` (E) |
| `reset-votes-dialog.tsx` | 30, 39 | `"#5b626d"` ×2 | description / Cancel ink | `--rb-ink-secondary` (N) |
| `reset-votes-dialog.tsx` | 50, 52 | `"#e11d48"` ×2 | destructive button fill | `--rb-danger` (N) |
| `reset-votes-dialog.tsx` | 50 | `"#fff"` | destructive button label | `--rb-on-color-ink` (N) |
| `reset-votes-dialog.tsx` | 51 | `"#c9163d"` | destructive hover fill | `--rb-danger-hover` (N) |
| `voting-strip.tsx` | 29 | `"#b45309"` | vote-cooldown warning ink | `--rb-warn-ink` (N) **?Q16** |
| `voting-strip.tsx` | 43, 126, 128 | `"#ffffff"` ×3 | vote card / reset button surface | `--rb-surface` (E) |
| `voting-strip.tsx` | 45, 59 ×2 | `"#f2655a"` ×3 | leading border + crown | `--rb-accent` (E) |
| `voting-strip.tsx` | 46 | `rgba(0,0,0,.05)` | vote card shadow | `--rb-shadow-soft` (P) |
| `voting-strip.tsx` | 55 | `"#2b3038"` | candidate title ink | `--rb-ink` (E) |
| `voting-strip.tsx` | 73 | `"#f1efea"` | vote button fill while cooling down | `--rb-chip` (E) |
| `voting-strip.tsx` | 73 | `"#2b3038"` | vote button fill (enabled) | `--rb-btn-dark-bg` (N) **?Q4** |
| `voting-strip.tsx` | 74 | `"#b8bcc4"` | vote button ink (disabled) | `--rb-ink-disabled` (N) |
| `voting-strip.tsx` | 74 | `"#ffffff"` | vote button ink (enabled) | `--rb-on-color-ink` (N) |
| `voting-strip.tsx` | 98 | `"#d9d5cc"` | empty-slot dashed border | `--rb-border-strong` (N) **?Q8** |
| `voting-strip.tsx` | 106 | `"#5b626d"` | empty-slot hover ink | `--rb-ink-secondary` (N) |
| `voting-strip.tsx` | 126, 127 | `"#fce4ea"` ×2 | reset button border / hover fill | `--rb-danger-wash` (N) |
| `voting-strip.tsx` | 126 | `"#e11d48"` | reset button ink | `--rb-danger` (N) |
| `pages/dinner.tsx` | 82 | `bg-white` | header bar surface | `bg-rb-surface` (E) |
| `pages/dinner.tsx` | 83 | `rgba(0,0,0,.05)` | header bottom hairline | `--rb-shadow-soft` (P) |
| `pages/dinner.tsx` | 86 | `#2b3038` | page title ink | `--rb-ink` (E) |
| `pages/dinner.tsx` | 94, 105 | `text-[#5b626d]` ×2 | secondary buttons | `text-rb-ink-secondary` (N) |

---

## 8. Area E — Keyboard *(Task 11)*

| File | Line | Literal | Role | Variable |
|---|---|---|---|---|
| `on-screen-keyboard.tsx` | 210 | `border-[#c9c4b8]` | keyboard panel border | `--rb-key-panel-border` (N) |
| `on-screen-keyboard.tsx` | 210 | `bg-[#e8e6e1]` | keyboard panel fill | `--rb-key-panel-bg` (N) |
| `on-screen-keyboard.tsx` | 210 | `rgba(0,0,0,0.28)` | keyboard panel drop shadow | `--rb-shadow-panel` (N) |
| `on-screen-keyboard.tsx` | 243 | `border-[#2b3038]`, `bg-[#2b3038]` | active (shift) key | `--rb-key-active-bg` (N) **?Q4** |
| `on-screen-keyboard.tsx` | 243 | `text-white` | active key label | `text-rb-on-color-ink` (N) |
| `on-screen-keyboard.tsx` | 245, 246 | `border-[#d5d0c6]` ×2 | key border | `--rb-key-border` (N) |
| `on-screen-keyboard.tsx` | 245 | `bg-[#d9d5cc]` | ctrl key fill | `--rb-key-ctrl-bg` (N) **?Q8** |
| `on-screen-keyboard.tsx` | 245 | `text-gray-800` | ctrl key label | `text-rb-ink-soft` (N) |
| `on-screen-keyboard.tsx` | 245 | `group-active:bg-[#cbc6bb]` | ctrl key press fill | `--rb-key-ctrl-active-bg` (N) |
| `on-screen-keyboard.tsx` | 246 | `bg-white` | char key fill | `bg-rb-surface` (E) |
| `on-screen-keyboard.tsx` | 246 | `text-gray-900` | char key label | `text-rb-ink` (E) |
| `on-screen-keyboard.tsx` | 246 | `group-active:bg-gray-100` | char key press fill | `bg-rb-chip` (E) |

---

## 9. Area F — Screensaver *(Task 11)*

| File | Line | Literal | Role | Variable |
|---|---|---|---|---|
| `power-saving-overlay.tsx` | 33 | `bg-black` | power-saving blackout fill | `bg-rb-power-saving-bg` (N) **?Q15** |
| `power-saving-overlay.tsx` | 43 | `text-white` (+`text-opacity-30`) | wake hint ink | `text-rb-on-color-ink` (N) — keep the opacity utility |
| `screensaver-overlay.tsx` | 98 | `text-white` (+`text-opacity-40`) | wake hint ink | `text-rb-on-color-ink` (N) |
| `screensaver-overlay.tsx` | 105 | `text-white` (+`text-opacity-60`) | clock/date ink | `text-rb-on-color-ink` (N) |

*(The screensaver gradient itself lives in `index.css:110` — Area A.)*

---

## 10. Area G — Libs *(consumed by Tasks 8, 9, 11)*

| File | Line | Literal | Role | Variable |
|---|---|---|---|---|
| `lib/calendar-meta.ts` | 19–20 | 12 hex (`FALLBACK_COLORS`) | per-calendar identity data | **EXCEPTION** (§13) |
| `lib/calendar-meta.ts` | — | *(new)* `'#2563eb'` | single event-color fallback | **`EVENT_FALLBACK_COLOR`** — new exported const, the one definition site for the 4 `day-view.tsx` + 1 `event-item.tsx` (+ **?Q11** `event-details-dialog.tsx`) literals (P) |
| `lib/color-utils.ts` | 9 | `{ r: 37, g: 99, b: 235 }` | `hexToRgb` parse fallback | **EXCEPTION** (§13) |
| `lib/color-utils.ts` | 17, 23 | `rgba(...)`/`rgb(...)` templates | string builders, not literals | **EXCEPTION** (§13) |
| `lib/chores-state.ts` | 46–53 | 24 hex (`PERSON_PALETTE`) | person identity data | **EXCEPTION** (§13) |

---

## 11. Area H — Misc / remainder *(Task 11)*

| File | Line | Literal | Role | Variable |
|---|---|---|---|---|
| `pages/not-found.tsx` | 6 | `bg-gray-50` | 404 page canvas | `bg-rb-canvas` (E) |
| `pages/not-found.tsx` | 10 | `text-red-500` | 404 alert icon | `text-rb-danger` (N) |
| `pages/not-found.tsx` | 11 | `text-gray-900` | 404 heading | `text-rb-ink` (E) |
| `pages/not-found.tsx` | 14 | `text-gray-600` | 404 body | `text-rb-ink-secondary` (N) |

---

## 12. Proposed NEW variable definitions

Paste into the `:root` block of `client/src/index.css` after the existing
`--rb-*` palette (Task 6). Aliases (`var(...)`) keep rendering byte-identical
today while letting a theme split the roles later.

```css
  /* ===== Phase 2 — pre-decided (ratified) ===== */
  --rb-nav-active-bg: var(--rb-accent-wash);      /* #fdeae8 */
  --rb-nav-inactive-ink: var(--rb-ink-secondary); /* #5b626d */
  --rb-badge: #ea8c00;
  --rb-badge-ink: var(--rb-on-color-ink);         /* #ffffff */
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

  /* ===== Ink ===== */
  --rb-ink-secondary: #5b626d;   /* control + label ink (Q2) */
  --rb-ink-soft: #3a4049;        /* softer than --rb-ink: names, chips, status */
  --rb-ink-disabled: #b8bcc4;    /* past / out-of-month / disabled (Q9) */
  --rb-on-color-ink: #ffffff;    /* text + icons on any colored fill (Q5) */
  /* --rb-ink-faintest: #cfd2d8;    ONLY if Q9 is answered "keep both" */
  /* --rb-ink-meta: #8b919b;        ONLY if Q10 is answered "keep separate" */

  /* ===== Surfaces + borders ===== */
  --rb-surface-sunken: #fbfaf7;  /* text inputs, list-row wash (Q7) */
  --rb-cell-weekend-bg: #fbfaf7; /* month-view weekend cell (Q7) */
  --rb-cell-inactive-bg: #f0eee9;/* out-of-month + past day cells (Q6) */
  --rb-field-border: #e7e4dd;    /* = --rb-chip-hover value, input-border role */
  --rb-border-strong: #d9d5cc;   /* = scrollbar-thumb value, border role (Q8) */
  --rb-accent-wash: #fdeae8;     /* accent tint fill (Q3) */

  /* ===== Buttons ===== */
  --rb-btn-dark-bg: #2b3038;       /* = --rb-ink value, surface role (Q4) */
  --rb-btn-dark-hover-bg: #3a4049; /* = --rb-ink-soft value, surface role */

  /* ===== Status: danger ===== */
  --rb-danger: #e11d48;
  --rb-danger-hover: #c9163d;
  --rb-danger-ink: #be123c;
  --rb-danger-wash: #fce4ea;
  --rb-danger-wash-hover: #f9d2dd;
  --rb-danger-border: var(--rb-danger-wash-hover);

  /* ===== Status: success ===== */
  --rb-success: #16a34a;
  --rb-success-hover: #15803d;
  --rb-success-ink: var(--rb-success-hover);
  --rb-success-wash: #e3f5ea;

  /* ===== Status: info ===== */
  --rb-info: #2563eb;
  --rb-info-hover: #1e40af;
  --rb-info-ink: var(--rb-info-hover);
  --rb-info-wash: #eef4ff;
  --rb-info-wash-hover: #e1ebff;
  --rb-info-border: #cbdcff;     /* NEW VALUE — see Q14 */

  /* ===== Status: warning ===== */
  --rb-warn: #ea8c00;            /* = --rb-badge value, status role (Q16) */
  --rb-warn-ink: #b45309;
  --rb-warn-wash: #fdf0db;
  --rb-warn-border: #f4dcae;     /* NEW VALUE — see Q14 */

  /* ===== Shadows + on-tint overlays ===== */
  --rb-shadow-card: rgba(0, 0, 0, 0.06);
  --rb-shadow-accent: rgba(242, 101, 90, 0.35);
  --rb-shadow-panel: rgba(0, 0, 0, 0.28);
  --rb-on-tint-border: rgba(255, 255, 255, 0.9);
  --rb-on-tint-ring: rgba(255, 255, 255, 0.7);
  --rb-on-tint-fill: rgba(255, 255, 255, 0.65);
  --rb-on-tint-chip: rgba(255, 255, 255, 0.6);

  /* ===== On-screen keyboard ===== */
  --rb-key-panel-bg: #e8e6e1;
  --rb-key-panel-border: #c9c4b8;
  --rb-key-border: #d5d0c6;
  --rb-key-ctrl-bg: #d9d5cc;       /* = scrollbar-thumb value (Q8) */
  --rb-key-ctrl-active-bg: #cbc6bb;
  --rb-key-active-bg: var(--rb-btn-dark-bg);

  /* ===== Screensaver ===== */
  --rb-screensaver-logo-glow: rgba(70, 130, 180, 0.3);
  --rb-power-saving-bg: #000000;   /* (Q15) */
```

**Totals:** 14 pre-decided + **47 newly proposed** variables (49 if Q9 and Q10
are both answered "keep both"). **9 existing** `--rb-*` variables absorb
literals in this sweep: `canvas`, `surface`, `ink`, `muted`, `faint`, `chip`,
`chip-hover`, `accent`, `grid-line`. `--rb-accent-hover`, `--rb-today-wash`,
`--rb-today-col-wash` and the `--p-*` set are already referenced as variables
at their use sites and are untouched.

### Tailwind `rb` map additions needed (Task 6)

Beyond the entries already listed in Task 6, these tokens are consumed via
utility classes and must appear in `theme.extend.colors.rb`:

`ink-secondary`, `ink-soft`, `faint`, `on-color-ink`, `canvas`,
`scrollbar-thumb`, `danger`, `danger-hover`, `danger-ink`, `danger-wash`,
`danger-border`, `success`, `success-hover`, `success-ink`, `info`,
`info-hover`, `info-ink`, `info-wash`, `info-wash-hover`, `info-border`,
`warn`, `warn-ink`, `warn-wash`, `warn-border`, `power-saving-bg`.

---

## 13. Exceptions — literals that stay as literals

These are **not** assigned variables. The area gates must allowlist them.

| Site | Why it is exempt |
|---|---|
| `lib/chores-state.ts:46-53` — `PERSON_PALETTE` | Identity **data**, not styling. Person colors are chosen/stored by users; a theme must not repaint someone's color. `chores-state.test.ts:47` asserts on these values. |
| `lib/calendar-meta.ts:19-20` — `FALLBACK_COLORS` | Identity data: a deterministic per-calendar hue derived from the calendar id, and it must match the backend's list. Only the *event* fallback is consolidated (`EVENT_FALLBACK_COLOR`). |
| `lib/color-utils.ts:9` — `hexToRgb` fallback `{r:37,g:99,b:235}` | Parse-failure guard inside a pure function with no DOM/CSS access. `:17`/`:23` are `rgb()`/`rgba()` **string builders**, not color literals. |
| `components/chores/confetti-burst.tsx:17` — `CONFETTI_COLORS` | Exported constant consumed by pure functions and tests. Per Phase 0 it becomes *injectable* with the current five as default; `--rb-confetti-1…5` supply the runtime values. The literal array stays as the fallback default. |
| `components/calendar/settings-menu.tsx:186-188` | Duplicate calendar-color fallback list. Exempt from the color sweep; flagged for its own fix — see **Q12**. |
| `pages/setup.tsx` | Fully exempt (excluded from all three greps by the brief). |
| `components/ui/**` | shadcn library components — excluded by the brief. Report, don't touch. |
| `*.test.ts` / `*.test.tsx` | Tests assert on literal values by design. |

---

## 14. Notes for the area tasks

1. **The gate greps will not catch `index.css:169` (`solid white`)** — verify
   that one by eye during Task 7.
2. **`week-view.tsx:25`** — the module-level `GRID_LINE` const is deleted, not
   re-pointed; use `var(--rb-grid-line)` at each use site (per Task 8).
3. **Tailwind opacity utilities are preserved**: `hover:bg-white/55`,
   `hover:bg-white/50`, `text-opacity-30/40/60` become
   `hover:bg-rb-surface/55` etc. — the alpha step is unchanged.
4. **`EVENT_FALLBACK_COLOR` is a TypeScript const, not a CSS variable.** It
   flows into inline `style` as a data value alongside real Google event
   colors, so it cannot be a `var()`.
5. Every alias in §12 (`var(--rb-…)` on the right-hand side) means today's
   pixels are unchanged; splitting an alias into a distinct value is a
   *theme* decision, not a sweep decision.
