# WP-08 — Theme system: the authoring guide, and community install (plan Phase 2)

| | |
|---|---|
| **Repo** | `SchrodingerEQ/Rootboard.me`, two PRs in sequence; a third, optional, in a companion repo |
| **Base** | latest `main` (with #55, #67, #70), fresh clone, `npm ci` (npm 11) |
| **Waits on** | nothing for PR A; PR B waits on the founder's answers to the questions in "Founder decisions this brief needs" |
| **Unblocks** | anyone outside the company making a theme; the theme section of `awesome-rootboard`; plan Phase 3 later |
| **Network / secrets** | none. Themes are local files; nothing is fetched at runtime. PR B must not add a download path (see the questions) |
| **Deliverable** | PR A (the authoring guide) safe zone, docs only; PR B (folder-drop install) safe zone expected, with the preserve-list check reported; the end-of-run report |
| **Model** | per the README |
| **Done when** | PR A merged; PR B merged or open and waiting on a founder answer, with the step it resumes from named in the report |
| **Unattended run** | PR A 2–3 h; PR B 4–6 h |

## Goal

The theme engine is complete for built-in themes: manifest v3, four
built-ins, two of them (Winter Holiday #55, Spooky #70) with the
founder's imagery, shaped confetti and text backing. What is missing is
everything a person *outside the repo* needs: a guide that tells them
how to write a theme, and a way to put one on their kiosk without
rebuilding the app. The 2026-09-22 founder requirement for the guide
stands: Default's complete token map and, now that they exist, the
asset slots as copyable starting material, so an author can port any
Default element verbatim.

## Read first

- `CLAUDE.md`, `CODING-STANDARDS.md`, `docs/SPEC.md` (the Themes entry
  under 3.9 and the `/widgets/*` rows), this folder's `README.md`
  (standing rules, decisions 9 and 10).
- `docs/plans/theme-system/STATUS-2026-11.md`, "Where things stand,
  2026-11-28": what is built, what is open.
- `docs/plans/theme-system/THEME-ENGINE-SPEC.md` (the contract),
  `THEME-ASSETS.md` (slots, budget, backing, surfaces over a background),
  decisions 0009, 0026, 0027.
- `shared/theme-manifest.ts`: the schema, `THEME_ENGINE_VERSION`,
  the backfill rule, `THEME_IMAGE_BUDGET_BYTES`, the confetti path
  grammar, the "newer engine" rejection.
- `client/src/themes/default.ts` (the token reference),
  `winter-holiday.ts` and `spooky.ts` (the image-carrying examples),
  `client/src/lib/theme-engine.ts` (`loadBuiltinThemes`, `resolveTheme`,
  `applyTheme`, the boot cache), `client/src/hooks/use-theme.ts`.
- The widget folder-drop precedent, which PR B copies: `server/routes.ts`
  (`/api/widgets` re-scan and the three-way containment guard on
  `/widgets`), `server/services/updateService.ts` `PRESERVE_PATHS`,
  `scripts/start.sh` (the rollback case mirrors that list), `.gitignore`
  (`/widgets/`), `docs/plans/widget-system/CONTRACT.md`, decision 0006.
- `docs/plans/theme-system/THEME-SYSTEM-PLAN.md` Phase 2 and the
  "Deferred" section: the no-third-party-IP rule applies to anything the
  guide shows or links.

## Decisions already made (don't reopen)

| Decision | Answer | Where |
|---|---|---|
| Themes are structured tokens and declared assets only; no CSS, no JS, never layout or touch targets | yes | `THEME-SYSTEM-PLAN.md` decisions 1, 3 |
| Every built-in theme in the launch set carries imagery, confetti shapes and text backing | yes | README decision 9 |
| The `background` slot is one continuous picture under the whole shell; `header` and `sidebar` are optional overlays; text backing is a theme field | yes | README decision 10, decision 0027 |
| Fields newer than v1 are optional and backfill from Default; a manifest newer than the app is rejected with a message, never partially applied | yes | decision 0026, `shared/theme-manifest.ts` |
| Image budget: background and screensaver 3 MB each, header and sidebar 500 KB, logo 150 KB; confetti shapes ≤ 4 KB of path data, at most five | yes | `THEME-ASSETS.md`, WP-06 (raised 2026-11-24 after the Pi gut-check) |
| The guide includes Default's complete token map and the asset slots as copyable material | yes | founder 2026-09-22 (TASKS.md) |
| Community themes stay a *local* install; no website, no gallery, no uploads to us (Phase 3 is blocked on moderation) | yes | `THEME-SYSTEM-PLAN.md` decision 4, Phase 3 |
| No third-party IP in anything shipped or shown as an example | yes | `THEME-SYSTEM-PLAN.md` decision 3 |
| Installed user content lives on the updater's preserve list, or the next update deletes it | yes | plan Phase 2 landmine; the widgets precedent |

## Founder decisions this brief needs

Ask these in the end-of-run report of PR A if they are still open; PR B
does not start until they are answered. Do not decide them.

1. **Install path for PR B.** The plan's Phase 2 names three: folder-drop
   (copy a theme folder onto the kiosk by SD card or SSH, exactly as
   widgets work today), zip upload from the setup page, and
   paste-a-GitHub-URL. The brief's proposal: **folder-drop only** in
   PR B, because it adds no upload surface and no download path, matches
   the widget system, and the other two can be added later as their own
   briefs. Paste-a-URL would download and unpack third-party content
   onto the kiosk and is a privacy-policy and supply-chain question for
   the founder (README standing rules; `CLAUDE.md` "Update supply chain").
2. **Where the guide lives.** Proposal: `docs/THEMES.md` at the repo root
   of `docs/`, linked from `README.md` and `docs/README.md`, so it ships
   in the tarball and is findable from the repo page. The plan documents
   under `docs/plans/theme-system/` stay as the engine's record.
3. **A `rootboard-theme-template` companion repo**, mirroring
   `rootboard-widget-template` (starter folder, tutorial, contribution
   guide, MIT). Proposal: yes, as an optional PR C, created from the
   guide's starter folder once PR B defines what a dropped folder
   contains. Needs the founder to create the repo under the same
   GitHub account; the agent cannot.
4. **Theme file format for a dropped folder.** Built-ins are TypeScript
   modules; a dropped theme cannot be. Proposal: `theme.json` (the same
   manifest, as JSON, validated by the same schema) plus the image files
   beside it under their slot names, exactly as `THEME-ASSETS.md` lays
   out `client/src/themes/<id>/`. Confirm, or name a different shape.

## PR A: the theme authoring guide (docs only, safe zone)

Write the guide a theme author reads top to bottom. Plain language, in
the product's own words; every claim backed by the code or a plan
document, with the path. Sections, in this order:

1. **What a theme can change, and what it never can.** Colours (the
   100 tokens), font, shape (radius scale, shadow softness), images
   (the five slots), confetti shapes, text backing. Never layout, touch
   targets, sizes, pills or circles (`client/src/lib/theme-shape.ts`
   header comment; decision 0009).
2. **Start from Default.** The complete token map: every `--rb-*` token,
   grouped as `default.ts` groups them, with Default's value and one
   line on where it shows (the audit in `STATUS-2026-11.md` and
   `THEME-ENGINE-SPEC.md` §2 and §10 have the where). This is the
   founder's 2026-09-22 requirement; it is the long part of the guide
   and is generated from `default.ts`, not retyped. Add a small script
   or a spec that fails when the guide's table and `default.ts` drift
   apart, so the table cannot go stale silently.
3. **Dark themes.** The one-text-colour rule (both canvas and cards
   dark, or both light), the contrast floors the guard enforces (the 20
   pairs, the people rules, the backing rule) and what they mean for an
   author; the status-colour caveat from the audit. Point at
   `contrast.spec.ts` and `people-contrast.spec.ts` as the judge.
4. **Images.** Reuse `THEME-ASSETS.md`: the slot table, supply sizes,
   budget, the "calm top band and left column" composition advice, the
   generator parameters, the metadata rule. Say which built-in to copy:
   Winter Holiday and Spooky (`background`, `screensaver`, `logo`, a
   `backing` block, 0.8-alpha surfaces and tints).
5. **Confetti shapes.** The 24 × 24 viewBox, the path grammar (commands
   and numbers only, starts with `M`, ≤ 4 KB, up to five), how colours
   are applied in rotation, and the three built-in sets as examples.
6. **Text backing and see-through cards.** The `backing` block with its
   three kinds, Winter Holiday's values as the worked example, and how
   `rgba()` surface tokens let the picture through (the founder's 20 %
   choice and why the guard composites).
7. **Fonts and shape.** The `font` and `shape` fields from manifest v2
   (decision 0026), with Default's values.
8. **Testing a theme.** `npm run dev`, Settings → Display → Theme, the
   "Theme Errors" list, the three checks, and the kiosk points from the
   founder checklist (21.5-inch panel, screensaver dim, CPU and memory
   before and after a switch).
9. **Installing a theme on a kiosk.** One paragraph that says "built-in
   only today; see PR B" until PR B merges, then the folder-drop steps.
10. **Rules.** No third-party IP, no brand characters, no text in images,
    the privacy line (a theme never fetches anything), and the licence
    the author grants if they later contribute it (mirror what the
    widget template says).

Acceptance: `npm run check`, `npm test`, `npm run lint` green; the drift
check from section 2 runs in `npm test`; `README.md` and `docs/README.md`
link the guide; `docs/SPEC.md` Themes entry names it; TASKS.md's
2026-09-22 line is updated (ticked only if the founder agrees the guide
meets the requirement; otherwise annotated).

## PR B: folder-drop community install (safe zone expected)

Build the smallest thing that lets a person copy a theme folder onto a
kiosk and pick it in Settings. Copy the widget system's shape; do not
invent a second one.

1. **Folder.** `themes/<id>/` at the app root: `theme.json` plus image
   files named after their slots (`background.jpg`, `logo.png`, …).
   Gitignored (`/themes/`), added to `PRESERVE_PATHS` in
   `updateService.ts` **and** to the rollback list in `scripts/start.sh`
   (the two must stay in sync, `CLAUDE.md`). Report the preserve-list
   check in the PR body: run the updater's backup/restore path in a
   test or a dry run and show the folder survives.
2. **Server.** `GET /api/themes`: re-scan `themes/` on every call (as
   `/api/widgets` does), validate each `theme.json` with
   `validateThemeManifest` plus the asset checks from
   `theme-assets.spec.ts` lifted into a shared module (names, types,
   budget, metadata), rewrite each image slot to the served URL, and
   return `{ ok: [...], failed: [{ id, message }] }`. Serve the files at
   `/themes/<id>/<file>` behind the same three-way realpath containment
   guard the widget route uses (symlink escape, `..`, dotfiles). A broken
   theme never breaks the response; it lands in `failed`.
3. **Client.** `use-theme.ts` merges installed themes after the built-ins
   (built-ins win on a duplicate id, and the duplicate is reported in
   "Theme Errors"). The picker shows them in the same list; "Theme
   Errors" shows `failed` from the server next to the built-in failures.
   An installed theme that disappears from disk while selected falls
   back to Default on the next load, as a missing built-in would. The
   boot cache keeps working: it stores computed tokens, not a theme id,
   so no change is expected; prove it with the existing
   `theme-boot-script.spec.ts`.
4. **Contract for authors.** A short `THEMES-INSTALL.md` section inside
   the guide from PR A (section 9) with the folder layout, the exact
   `theme.json` shape (the manifest as JSON, `engineVersion` included),
   and the error messages they will see.
5. **Decision record** `docs/decisions/0028-community-theme-folder-drop.md`:
   folder-drop first, why not upload or URL yet, the preserve-list rule,
   the duplicate-id rule.
6. **Docs.** `docs/SPEC.md` (new routes in the table, the Themes entry,
   the files-on-disk list that names `widgets/`), `CLAUDE.md` (the
   theme paragraph's "bundled modules" sentence and the `PRESERVE_PATHS`
   note), `THEME-SYSTEM-PLAN.md` Phase 2 (struck, dated),
   `STATUS-2026-11.md`, `TASKS.md`.

Acceptance: a theme folder copied from `client/src/themes/spooky/` with a
hand-written `theme.json` (the Spooky manifest as JSON, a different id
and name) shows in the picker in `npm run dev`, applies, and survives a
simulated update (the updater's backup and restore functions, in a
test); a folder with a bad image, a bad path string and a newer
`engineVersion` each land in "Theme Errors" with a named reason and
never throw; the three checks green; the containment guard gets a spec
with the three escape cases the widget route's comment names (symlink
out of the folder, `..`, dotfiles): the widget route has no such spec
today, so write it for both routes or note the gap as a task.

Tier: safe zone is the expectation. The review decides; if it reads the
preserve-list or updater change as "production deployment
configuration", it performs that row's rollback verification and the
PR reports it. Nothing here touches a principle: no network, no account,
no data about the user, nothing removed.

## PR C (optional, companion repo): `rootboard-theme-template`

Only if the founder answered question 3 yes and created the repo. Mirror
`rootboard-widget-template`: a starter folder that is PR B's layout with
Default's values, the guide linked rather than copied, a contribution
guide with the no-IP rule, MIT. Then a theme section in
`awesome-rootboard` (CC0) listing the four built-ins and the template.

## Founder checklist additions

- Answer the four questions above (after PR A's report).
- Create `rootboard-theme-template` under the same GitHub account if the
  answer to question 3 is yes.
- At the kiosk, after v1.9.0 is on it and PR B has shipped in a later
  release: copy one theme folder over by SSH, pick it, update the kiosk
  to the next release, confirm the theme is still there.

## Report

End with *Done (PR numbers) / Not done and why / Findings worth a task /
Founder actions*, and tick or annotate the matching `TASKS.md` lines
(the theme line and the 2026-09-22 authoring-guide line).
