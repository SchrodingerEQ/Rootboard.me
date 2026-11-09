# 07 — Widget developer loop: install paths and visible errors

**Status:** Not started.
**Type:** Server + client + companion-repo docs. One session.
**Depends on:** 05 (paired API for the upload path), 06 (`AGENTS.md`).
**Unblocks:** a tester who wants to write widgets.

---

## 1. Goal

A widget author in another house, with or without an AI agent, can get a
widget folder onto the unit, see it appear in Settings → Community
Widgets, and **see why it failed** when it does, without SSH. The
contract (`docs/plans/widget-system/CONTRACT.md`), template, tutorial and
reference widget already exist and are good; this brief fixes the two
things around them that assume the author is sitting at the kiosk's
terminal.

## 2. Decisions locked

| # | Decision | Choice |
|---|---|---|
| 1 | Install path A — USB | Settings → Community Widgets → **Install from USB**: the server lists mounted removable volumes (Raspberry Pi OS auto-mounts under `/media/<user>/`), finds folders containing a `widget.json`, validates each with the existing Zod schema and containment rules (`server/services/widgetDiscovery.ts`), shows name/version/description, and copies the chosen folder into `/widgets/<id>/`. Finger-only. Overwrite only on an explicit second tap when the id already exists. |
| 2 | Install path B — paired upload | `POST /api/widgets/install` (paired callers only) accepting a zip of the folder; same validation; same copy. This is what an agent or `npm run deploy` in the template repo uses. `DELETE /api/widgets/:id` for uninstall, with the same guard. |
| 3 | Validation before copy | A folder is rejected, with the Zod message shown, if the manifest fails, the entry path escapes the folder, or the id does not equal the folder name. Symlinks inside the folder are refused (mirrors the discovery service's three containment checks). |
| 4 | Visible errors | The widget host error boundary (`client/src/components/widget-host-error-boundary.tsx`) and the mount/import catch paths in `app-shell.tsx` surface the error **text and stack head** in the widget's own fallback panel behind a "Show details" toggle, and in the diagnostics bundle (brief 05) under `widgets[].lastError`. Import failures (bad ESM, 404 on `entry`) are reported the same way instead of only on the server console. |
| 5 | Reload without reboot | A "Reload widgets" action in Settings re-runs discovery and re-imports changed manifests, so an author iterates without toggling. Keep the existing `id+version` module-cache rule from SPEC §3.1: bumping `version` is what invalidates the cache, and the UI says so when it detects an unchanged version after reload. |
| 6 | Companion repos | The template's `TUTORIAL.md` gains a "Put it on your Rootboard" section with the USB path, the paired-upload path (`npm run deploy -- --host rootboard.local --token …`), and how to read the error panel. `CONTRIBUTING.md` and `awesome-rootboard` are checked for anything that still says "copy over SSH" as the only way. |

## 3. Where the code goes

- `server/services/widgetInstall.ts`: list volumes, inspect candidates,
  validate, copy (temp dir then rename, so a half-copy never appears as a
  widget), remove.
- Routes: `GET /api/widgets/removable`, `POST /api/widgets/install`
  (multipart or `{ source: "removable", path }`), `DELETE /api/widgets/:id`,
  `POST /api/widgets/reload`. Mutations are paired-or-loopback.
- Client: Community Widgets section in `settings-menu.tsx`; error details
  in the host fallback; a `lastError` map in the widget host state.
- Template repo: a tiny `scripts/deploy.mjs` that zips and POSTs.

## 4. Acceptance

- Template widget on a USB stick → Settings → Install from USB → appears
  in the layout picker → enable → renders. Pull the stick first: list is
  empty with a one-line hint.
- Break `index.js` (syntax error) → Reload widgets → the fallback shows the
  SyntaxError message; fix and bump version → Reload → renders.
- Manifest with `"entry": "../x.js"` → rejected with the containment
  message; nothing written under `/widgets/`.
- From a laptop: `npm run deploy` in the template repo with a paired token
  installs and the kiosk picks it up on Reload.
- Discovery service tests extended for the new candidate-inspection path.

## 5. Docs

- `docs/SPEC.md` §3.1 (community widgets), §2.2 endpoints.
- `docs/plans/widget-system/CONTRACT.md`: no contract change; add a
  "Installing" pointer. Keep the three companion repos in sync (CLAUDE.md
  requirement).
- `README.md` Widgets section: replace "drop a folder" with the two paths.

## 6. PR tier

**Safe zone (verified)**. Trust model unchanged (CONTRACT §7: no sandbox,
install what you trust) and now stated again on the install screen.

## 7. Out of scope

A registry, one-click install from the internet, widget auto-updates
(all recorded as deferred in `TASKS.md`).
