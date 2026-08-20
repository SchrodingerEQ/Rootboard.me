# Phase 4 Task 6 — End-to-end folder-drop proof (hello-world)

**Parent plan:** [PHASE4-EXECUTION.md](PHASE4-EXECUTION.md) Task 6 · contract:
[CONTRACT.md](CONTRACT.md)

**Status:** proven on branch `feat/phase4-folder-drop`, dev server
(`NODE_ENV=development npx tsx server/index.ts`), 2026-08-20. No app-code
changes — this task exercises Tasks 1-5's existing implementation.

## What was proven

A clean `hello-world` widget (framework-free ESM, no build step) was
dropped into `widgets/` and taken through the full folder-drop lifecycle
described in CONTRACT §6, end to end:

1. **Discovery** — `GET /api/widgets` listed `hello-world` (manifest,
   description, settings) alongside the pre-existing `test-valid` fixture,
   with `mismatch`/`test-invalid` still reported under `invalid[]`.
2. **Static serving** — `widget.json`, `index.js`, `icon.svg` all served
   under `/widgets/hello-world/*`.
3. **Picker (not yet enabled)** — the layout picker's "Community Widgets"
   section showed the manifest's name/description/icon with status
   "not loaded — enable to load"; no module fetch occurred before enabling.
4. **Enable via the picker's own toggle** — wrote
   `{id:"hello-world", enabled:true, settings:{}}` into
   `data/config/dashboard.json`; the module was dynamically imported,
   a nav-rail item appeared (icon rendered via `<img src="/widgets/hello-world/icon.svg">`,
   per CONTRACT §2's img-only render rule), and `mount()` ran.
5. **Mount + greeting** — the widget rendered `"Hello, Rootboard!"` from
   its declared `greeting` setting's default.
6. **Counter via `host.storage`** — three clicks on Increment produced
   `Count: 3`; confirmed server-side via
   `GET /api/state/widget:hello-world` → `{"value":3}`.
7. **Live settings edit** — editing the `greeting` field through the
   Task 5 settings-editor expander wrote `settings.greeting` into the
   config file, and the mounted widget updated its heading immediately
   (no reload) via `host.settings.subscribe()`.
8. **Reload survival** — a hard page reload kept: the active section
   (`localStorage['rootboard-section']`), the edited greeting, and the
   counter value — all in a single check.
9. **`onVisibilityChange`** — switching to another nav section, then
   back, flipped the widget's own "visible"/"hidden" indicator text
   correctly; the same handler fired `false`/`true` across a manual
   `host.ui.sleep()` → wake cycle, confirming CONTRACT §3's callback
   guarantee holds for community-loaded widgets, not just built-ins.
10. **`host.ui.sleep()`** — clicking the widget's Sleep button raised the
    shell's power-saving overlay (`[data-testid="power-saving-overlay"]`),
    exactly as the built-in widgets' own Sleep buttons do.
11. **apiVersion gate** — a second folder (`hello-world-v2`, apiVersion 2,
    otherwise identical code) was listed by `GET /api/widgets` and shown
    in the picker as `"built for a newer Rootboard"`, **even while marked
    enabled** in config: zero `hello-world-v2` module fetches appeared in
    `performance.getEntriesByType('resource')` after a reload, and no nav
    item was rendered. Removed after verification — not a fixture kept
    for reuse.
12. **Invalid fixtures unaffected** — `test-invalid` (schema failure) and
    `mismatch` (folder/id mismatch) continued to surface their original
    errors in `GET /api/widgets` and the picker's "Widget Folder Errors"
    section throughout.
13. **Disable → re-enable** — disabling `hello-world` from the picker
    dropped its nav item; a subsequent reload showed zero module fetches
    for it (confirmed via cleared+re-checked `performance` resource
    timings). Re-enabling via the picker toggle brought the nav item and
    prior state (greeting, counter) back without a reload.

No behavior diverged from CONTRACT/SPEC — no findings from this pass.

## Update-survival status

Full auto-update cycle on real hardware was **not** re-run for this task;
Task 3 already proved the mechanism this task's fixtures would exercise.
Summary of that trace (see `.superpowers/sdd/task-3-report.md` for the
full derivation): the updater's stale-file deletion pass
(`applyFiles` in `server/services/updateService.ts`) filters top-level
`APP_ROOT` entries against `PRESERVE_PATHS` before deleting anything;
`widgets` was added to that list (and to the mirrored `case` list in
`scripts/start.sh`'s rollback path) in a dedicated commit, and the
membership trace shows the predicate short-circuits to `false` for
`f === 'widgets'` in both `applyFiles` and the `createBackup`/`rollback`
filters that share the same array — so `widgets/` is never deleted
during an update, a backup, or a rollback. That's a **code-path proof**,
not a live-hardware run. A full update cycle against a running Pi kiosk
(download → apply → restart → verify `widgets/` and its enabled state
survived) is deferred to the next real release cycle, where it will be
exercised as a matter of course rather than as a synthetic test.

## Widget-authoring note: no import map, bundle your own framework

Per CONTRACT §3, the host exposes **no shared runtime and no import map**
besides the DOM and the `WidgetHost` object. `hello-world` was written in
plain framework-free ESM specifically so this note could be demonstrated
directly: nothing beyond `document`/`window` and its own `export default`
is available to it. A widget that wants React, Preact, or any other
framework must bundle that framework completely into its own `index.js`
at build time — there is no `import "react"` resolution path, and no
version of any framework is shared from the host page. See CONTRACT.md §3
for the authoritative statement.

## Fixtures

`widgets/hello-world/` (gitignored, not part of this commit) is the
canonical clean example — kept in place for reuse by later tasks, same
convention as `widgets/test-valid/` since Task 2. Its source is preserved
outside the repo as the seed for Phase 5's widget-template repo.
`widgets/hello-world-v2/` (the apiVersion-gate fixture) was deleted after
verification; it was not meant to be a lasting fixture.
