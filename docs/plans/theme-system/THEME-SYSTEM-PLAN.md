# Rootboard Theme System — Plan

**Status:** TODO — not started. Parked for a future work session.
**Decided:** July 18, 2026
**Scope of initial rollout:** Built-in themes only. Community themes are explicitly deferred (see "Deferred" section).

> **Update 2026-08-15:** The founder-ratified community-widget-system
> direction ([decision 0006](../../decisions/0006-community-widget-system.md))
> touches many of the same ~20 files as Phase 0. Plan the widget-contract
> extraction and the Phase 0 color sweep as a **single refactoring phase**
> with one combined plan doc under `docs/plans/` (tracked in `TASKS.md`),
> rather than two passes over the same files.
>
> **Update 2026-08-19:** That combined plan now exists —
> [`docs/plans/widget-system/WIDGET-SYSTEM-PLAN.md`](../widget-system/WIDGET-SYSTEM-PLAN.md)
> (Phase 2 there = Phase 0 here, with an audit-corrected scope: 220 hex
> across 29 files plus in-scope Tailwind palette classes, `setup.tsx`
> exempt). Execute Phase 0 via that plan; this file's Phase 0 section and
> hotspot counts (line "Repo facts") are superseded for scope purposes.

---

## Summary

Add visual themes to Rootboard (e.g., Spooky, Winter Holiday, Deep Space) that reskin as much of the app as possible — colors, fonts, logo, screensaver, and animation visuals — without ever touching layout, touch targets, or functionality. Themes are pure data: a JSON manifest plus an assets folder. No arbitrary CSS, no theme-supplied code.

## Decisions (locked)

1. **Structured tokens only.** Themes swap the values of named CSS variables and supply assets. Themes may NOT include custom CSS or JS. This guarantees a theme can never misalign layout, break touch targets, or cover the on-screen keyboard on an unattended kiosk.
2. **Manual selection only.** No automatic seasonal switching. Theme is picked from the settings menu.
3. **No third-party IP.** No Star Trek or other branded themes. A "Deep Space" original sci-fi theme replaces the Star Trek idea. This policy will also apply to any future community gallery.
4. **Community themes deferred.** Initial rollout ships only built-in, first-party themes. Rationale: a community site requires uploads, hosting, and — critically — human moderation of every submitted theme (inappropriate content, IP violations, malicious SVGs). That review burden exceeds current solo-founder resources. Keeping full control of the theme catalog is fine for launch. Revisit when there's real demand and a moderation answer.
5. **Theme selection persists via `/api/state`** (same hardened `useAppState` path as Chores/Dinner), NOT localStorage — it must survive browser resets on the 24/7 kiosk.

## What a theme can change

- **All app colors** — via the CSS variable system (`--rb-*` palette + shadcn tokens).
- **Person/profile palette** — replacement set allowed, but the app validates that colors are mutually distinguishable and readable against the theme background (person colors are functional, not decorative).
- **Font family** — theme bundles the font file(s) and declares a plain fallback stack. The app keeps control of all font sizes and weights. Fonts must be local files, not remote URLs (kiosk must not depend on Google Fonts reachability).
- **Shape/depth tokens** — corner radius (`--radius`), shadow softness.
- **Assets** — logo, screensaver image, optional per-section background texture. Manifest declares dimensions; app crops/letterboxes. File-size caps (Raspberry Pi performance).
- **Confetti pack** — list of small SVG particle shapes (bats, snowflakes, etc.) + color list. The particle physics in `confetti-burst.tsx` stays unchanged; only visuals swap.
- **Screensaver** — themed image + selection from the app's existing motion presets.

## What a theme can never touch

- Layout: spacing, widths, grid structure, element positions, z-index.
- Touch target minimums (48/56px) and the 28px touch scrollbars — both were hard-won tuning for the 21.5" touchscreen (see the war-story comments in `index.css`).
- Font sizes/weights (beyond app-controlled overflow auto-shrink).
- Any executable content. SVGs are sanitized before render (SVG files can embed scripts).

## Theme format

```
my-theme/
  theme.json        # manifest — Zod-validated
  assets/
    logo.png
    screensaver.png
    fonts/*.woff2
    confetti/*.svg
```

Manifest requirements:
- `engineVersion` field from day one, so future kiosks can gracefully reject themes built for a newer engine.
- Validated on load: Zod schema, file-size caps, contrast checks (extend existing `client/src/lib/color-utils.ts`).

## Phases

### Phase 0 — Color sweep (prerequisite; do first, do alone — see 2026-08-15 update: now part of the combined widget-contract refactor, still with no feature work mixed in)
Replace ~150 hardcoded hex colors across ~20 component files with named CSS variables, extending the `--rb-*` palette with semantic names (e.g., nav active pink → `--rb-nav-active-bg`, badge orange → `--rb-badge`). Move confetti colors and the screensaver gradient into variables too.
**Success test: the app is pixel-identical before and after.** No logic changes. No feature work mixed in.
→ Claude Code kickoff prompt: `phase0-color-sweep-prompt.md`

### Phase 1 — Theme engine + built-in themes (the real build)
- `theme.json` Zod schema in `shared/` (consistent with existing schema patterns).
- ThemeProvider applies variables at startup and on switch.
- Active theme stored via `useAppState` → `/api/state/theme`.
- Built-in themes ship in a repo `/themes` folder.
- Settings menu gets a theme picker with preview swatches.
- Launch set: **Default** (current look, extracted into a manifest), **Spooky**, **Winter Holiday**, **Deep Space**.
- Design workflow: Claude Design produces each theme visually → values extracted into manifests.
→ Claude Design prompt: `claude-design-themes-prompt.md`

### Phase 2 — DEFERRED: local community install
Zip upload via the setup page, or paste-a-GitHub-URL (reuse download/extract pattern from `server/services/updateService.ts`). Server-side validation: schema, size caps, contrast warnings, SVG sanitization.
**Implementation landmine noted for later:** installed themes must live in a directory on the auto-updater's preserve list (`updateService.ts` keeps service-account keys etc. across updates) — otherwise every app update silently deletes installed themes.

### Phase 3 — DEFERRED: community website + in-app gallery
Creator uploads, moderation (no-IP policy enforced), published JSON index; kiosk "browse themes" screen reads the index and installs with a tap. Thin layer on top of Phase 2. **Blocked on having a sustainable moderation answer.**

## Effort read

Phase 0: 1–2 days of mechanical Claude Code work. Phase 1: the substantive build. Phases 2–3: not scheduled.

## Repo facts this plan relies on (verified July 18, 2026)

- CSS variables defined in `client/src/index.css` (`--rb-*` + shadcn tokens); Tailwind maps tokens in `tailwind.config.ts`.
- Hardcoded hex hotspots (counts): dinner voting-strip (17), meal-list-dialog (16), calendar-header (15), day-cell (14), settings-menu (13), meal-picker (9), edit-people (9), chores page (8), on-screen-keyboard (8), plus ~10 more files.
- Confetti: pure particle math + 5 hardcoded colors in `client/src/components/chores/confetti-burst.tsx`.
- Screensaver: rAF bounce loop in `client/src/components/screensaver/screensaver-overlay.tsx`; float keyframes in `index.css`.
- State persistence: `client/src/hooks/use-app-state.ts` → GET/PUT `/api/state/:key` (`server/routes.ts` ~L328).
- GitHub download pattern: `server/services/updateService.ts`.
- Brightness currently uses localStorage — theme should NOT copy that pattern.
