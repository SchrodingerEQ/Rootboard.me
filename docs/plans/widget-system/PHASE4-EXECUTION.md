# Phase 4 Execution Plan — Folder-Drop Widget Loading

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task.

**Status:** implemented 2026-08-20, branch `feat/phase4-folder-drop`.

**Ratified during execution:** two decisions surfaced mid-phase and were
founder-ratified rather than left to implementer judgment — (A)
discovered widgets are imported **only** when enabled in
`data/config/dashboard.json`; a disabled widget's entry module is never
fetched or executed. (B) the layout picker reorders built-in and
community widgets as **separate pools** over the one `config.widgets`
array, rather than one combined displayed order — a not-yet-installed
community id has no position to reorder among. See CONTRACT.md §6 and
`docs/SPEC.md` §3.1 for the resulting behavior.

**Goal:** A widget folder dropped into `/widgets/` (SD card or SSH) appears in the layout picker, mounts through the same contract as built-ins, survives auto-updates, and fails safe — invalid manifests surface as picker errors, newer-apiVersion widgets are listed but not loadable.

**Architecture:** Server: a discovery service scanning `widgets/*/widget.json` through the shared Zod schema + `express.static("widgets")` mounted inside `registerRoutes` (so it precedes both the prod SPA catch-all and the dev Vite middleware); `GET /api/widgets` returns `{widgets, invalid}` per CONTRACT §6. Client: the shell merges discovered community widgets into the renderable set, loading entries via dynamic `import(/* @vite-ignore */ "/widgets/<id>/<entry>")`; hosts are created identically to built-ins (`widget:<id>` storage keys). Manifest `settings` descriptors get the host-rendered editor CONTRACT §2 already promises. The updater preserve lists gain `widgets` in a dedicated commit.

**Parent plan:** [WIDGET-SYSTEM-PLAN.md](WIDGET-SYSTEM-PLAN.md) Phase 4 · contract: [CONTRACT.md](CONTRACT.md) §6 · ratified in [0006](../../decisions/0006-community-widget-system.md)/[0007](../../decisions/0007-widget-contract-shape.md)

## Global Constraints

- **Fail-safe discovery:** a broken/malicious folder must never crash the server or blank the kiosk — invalid manifests are skipped + reported, never fatal. The read path mirrors configService's degrade posture.
- **apiVersion gate exactly as CONTRACT §6:** `apiVersion > WIDGET_API_VERSION` ⇒ listed, not loadable, "built for a newer Rootboard" in the picker.
- **Icon safety:** manifest icons render via `<img src>` ONLY (SVG in an `<img>` executes no scripts and loads no external resources) — never inline/innerHTML SVG. This is how CONTRACT §2's "sanitized before render" is satisfied in v1; document it there.
- **Preserve-list parity:** `widgets` lands in `PRESERVE_PATHS` (`server/services/updateService.ts`) AND the `case` list in `scripts/start.sh` in one dedicated commit; `start.sh` stays LF (`.gitattributes` enforces; verify the diff anyway).
- **Trust model unchanged (no sandbox):** a loaded entry runs with full page access — CONTRACT §7 stands; the picker shows community widgets without scare-copy but the docs stay plain about trust.
- Built-in behavior must be byte-identical; community loading is additive.
- Every commit passes `npm test` + `npm run build`; `npm run check` no new errors vs baseline. Public repo: security review before push; `widgets/` gitignored (user content, never tracked, never in the release tarball).

## Tasks

### Task 1 — Phase-4-prep hardenings (the TASKS.md item; check-off proposed at phase end)
Move `validateBuiltinManifest` out of `registry.ts` into `client/src/widgets/validate-manifest.ts` (breaks the registry↔widget import cycle; update importers). Guard `LEGACY_KEY_ALIASES` lookup with `Object.hasOwn` (prototype-chain ids like `"constructor"` must fall through to `widget:<id>`; add spec cases). CONTRACT wording: `theme.subscribe` "(hosts without a theme engine may never fire it)"; §3 visibility callbacks "may repeat the current value; implement handlers idempotently". Commit: `refactor: phase-4 prep — break registry cycle, harden alias lookup, contract wording`.

### Task 2 — Server discovery + static serving
`server/services/widgetDiscovery.ts`: scan `widgets/*/widget.json` (folder name must equal manifest id — mismatch ⇒ invalid entry); validate via `widgetManifestSchema`; return `{ widgets: manifests[], invalid: [{folder, errors: string[]}] }`; missing `widgets/` dir ⇒ empty result, never throw. Routes: `GET /api/widgets` (re-scans per call — sideload then refresh, no restart); `express.static(path.resolve("widgets"), { index: false })` mounted at `/widgets` inside `registerRoutes`. `.gitignore` gains `/widgets/`. Curl verification incl. a hand-made valid + invalid + id-mismatch folder trio. Commit: `feat: widget discovery endpoint + /widgets static serving`.

### Task 3 — Preserve-list commit (dedicated, reviewed on its own)
`widgets` added to `PRESERVE_PATHS` (updateService.ts) and `start.sh`'s rollback `case` list, with the keep-in-sync comments updated on both sides. Verify: grep both files; confirm LF endings on start.sh; simulate the updater's stale-file deletion filter against a fixture list to prove `widgets/` survives (pure-function test if extractable, else a documented trace). Commit: `feat: preserve /widgets/ across auto-updates (updateService + start.sh)`.

### Task 4 — Client loading + picker integration
Shell: query `/api/widgets`; for each discovered manifest with `apiVersion <= WIDGET_API_VERSION`, dynamically `import()` the entry (once, cached; failures surface like invalid manifests), wrap as a registry-shaped entry (`navIcon` absent — icon `<img>` from `/widgets/<id>/<icon>`, fallback glyph otherwise), and include it in the SAME renderable/host/entries pipeline as built-ins (hosts via `createWidgetHost` — `widget:<id>` keys come free). Picker: community widgets listed with name/description/icon; newer-apiVersion entries shown disabled with "built for a newer Rootboard"; invalid folders shown with their first validation error. Config entries for never-seen ids appear when enabled via picker (append to config.widgets). Nav renders enabled+loaded community widgets in config order. Commit: `feat: load community widgets from /widgets/ through the contract`.

### Task 5 — Manifest settings editor (closes the CONTRACT §2 promise)
Picker rows for widgets whose manifest declares `settings` descriptors get an expandable form: string/number/boolean/select fields (48px touch targets, OSK-compatible inputs), values initialized from config settings ?? descriptor defaults, writes via the existing `updateWidgetSettings` builder pipeline. Unknown/extra keys in config are preserved (never stripped by the editor). Commit: `feat: manifest-declared settings editor in the layout picker`.

### Task 6 — End-to-end proof (hello-world)
Build a throwaway hello-world widget (scratchpad-built ESM bundle — becomes the Phase 5 template's seed; NOT committed to this repo): manifest + entry rendering a greeting + a counter persisted via `host.storage` + one declared setting. Drop into `widgets/`: appears in picker → enable → mounts in nav → counter survives reload (curl `/api/state/widget:hello-world`) → setting edits via Task 5 editor → apiVersion-2 variant listed-not-loadable → mangled-manifest variant surfaces error. Update-survival: covered by Task 3's deletion-filter proof (full Pi update cycle deferred to the next real release; note in report). Document the E2E transcript in the plan folder as `phase4-e2e-notes.md` (public-safe).

### Task 7 — Docs + ship
SPEC: §2.2 add `GET /api/widgets` + `/widgets/*` static rows; §3.1 loading model (discovery, dynamic import, apiVersion gate, icon-via-img note); §5 invariants (widgets/ preserved, gitignored); §6 quirks if any found. CONTRACT status → "apiVersion 1 fully implemented incl. folder-drop"; §2 icon line documents the img-only render rule. WIDGET-SYSTEM-PLAN Phase 4 ✅. Then controller ship sequence (final gates, whole-branch review, security review, merge decision, TASKS.md check-off proposals: folder-drop item + hardenings item).

## Landmines

- Dev-mode route ordering: `/widgets` static MUST be inside `registerRoutes` or Vite's catch-all swallows it (server/index.ts registers routes before vite middleware).
- `import()` of a URL: use `/* @vite-ignore */` so Vite doesn't try to resolve it at build time.
- The updater's stale-deletion pass deletes unlisted top-level dirs — Task 3 is the guard; Task 2 must not ship without Task 3 in the same push.
- Manifest `entry`/`icon` path traversal is already schema-blocked (`..` segments); the static mount must still never serve outside `widgets/` (express.static resolves within root by default — verify with a `..` curl).
- Community entry modules share the page (trust model) but NOT the app's module graph — a hello-world importing React must bundle it (document in the E2E notes for Phase 5's template).

## Repo facts (verified through Phase 3 work, 2026-08-19)

- `registerRoutes` runs before dev Vite middleware and prod static+catch-all (`server/index.ts`).
- `PRESERVE_PATHS` at `server/services/updateService.ts:~40-56`; hand-synced `case` list in `scripts/start.sh:~50`; repo-metadata exclusion does not cover new top-level dirs (deletion pass would remove `widgets/` today).
- Shell pipeline: config query → `renderableEntries` (enabled ∩ installed) → navItems/WidgetHostMount entries; hosts in `hostsRef`, created per enabled id, disposed on leaving the set; `createWidgetHost` derives storage keys (`Object.hasOwn` guard arrives in Task 1).
- `widgetManifestSchema` + `WIDGET_API_VERSION` in `shared/widget-manifest.ts` (server-usable).
- vitest: `client/src/**/*.spec.ts`; server has no test harness (curl verification pattern established in Phases 2-3).
