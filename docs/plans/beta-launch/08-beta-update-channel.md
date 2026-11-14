# 08 — Beta update channel

**Status:** Not started.
**Type:** Update service + Settings toggle + release process. One session.
**Depends on:** nothing, so it can run now, before brief 00. Ship before the tester's unit leaves, so it can be flipped later.
**Unblocks:** 09 (which channel the shipped unit is on).
**Closes in `TASKS.md`:** the beta sub-item 08.

---

## 1. Goal

Two units can run two different builds on purpose. Today the updater
(`server/services/updateService.ts`, ~line 150) reads
`/repos/<owner>/<repo>/releases/latest`, which GitHub defines as the
newest **non-prerelease, non-draft** release. So every release reaches
every kiosk at the next 8 AM check, and there is no way to try a fix on
one unit first.

## 2. Decisions locked

| # | Decision | Choice |
|---|---|---|
| 1 | Channels | `stable` (default; unchanged behaviour: `releases/latest`) and `beta` (newest release **including prereleases**, from `/releases?per_page=10`, skipping drafts, picking the highest version by decision 3's prerelease-aware comparison (today's `compareVersions` splits on `.` and cannot read `-beta.N`)). |
| 2 | Where it is set | `data/config/dashboard.json` → `update: { channel }`, lenient schema like `theme`. Settings → System → Updates shows the channel with a toggle and one sentence: "Beta gets fixes a few days earlier and may have rough edges." Also settable by env `UPDATE_CHANNEL` for the provision script; config wins over env. |
| 3 | Release process | Prereleases are tagged `vX.Y.Z-beta.N` and marked **Pre-release** on GitHub. Promoting = publishing `vX.Y.Z` as a normal release with the same tree. `shared/version.ts` carries the full string including `-beta.N`; the version comparison must treat `1.8.0-beta.2 < 1.8.0` and `1.8.0-beta.1 < 1.8.0-beta.2`. Tags so far are mixed (`v1.7.1`, `1.7.2`, `v1.7.3`); the compare already strips a leading `v`, keep that, and new tags always start with `v`. Document the exact steps in `docs/RELEASING.md` (new, short). |
| 4 | Downgrade | A unit on `beta` switched to `stable` keeps its beta build until stable catches up; the UI says so. No automatic downgrade (rollback remains the manual path it is today). |
| 5 | Release notes | The update dialog already shows the release body. `RELEASING.md` states that notes are written for the owner, in plain language, with a "What changed for you" first paragraph; the prerelease body says it is a beta. |
| 6 | Safety | HTTPS only, same tarball path, same backup/rollback. Prereleases go through the same CI and the same pre-push security review; the only difference is who receives them first. |
| 7 | Release checklist | `RELEASING.md` is also the one place the per-release checks live, collected from `CLAUDE.md`: bump `shared/version.ts`; run `npm audit` and record the change since last time by updating one standing audit item in `TASKS.md`, not by adding a new item per release (the first release under this checklist merges today's per-release audit items into that one); the pre-push security review; the privacy gate (a release that changes what leaves the unit waits until the privacy policy page says so, as brief 01's did); tag; then the kiosk check, including any merged brief still waiting on a kiosk verification. |

## 3. Where the code goes

- `updateService.ts`: `fetchLatestRelease(channel)`; semver-with-prerelease
  compare (write it, with tests; no new dependency needed for this
  little grammar); include `channel` in `/api/update/check` and `/status`.
- `shared/dashboard-config.ts`: `update` key.
- `settings-menu.tsx`: toggle + copy.
- `scripts/provision.sh` (brief 06): `--channel beta|stable`. Whichever of
  06 and 08 merges second adds the flag.
- `.github/workflows/`: nothing required; optional later job that fails if
  a tag `vX.Y.Z-beta.N` is published without the Pre-release flag.

## 4. Acceptance

- Reference kiosk on `beta`, a `vX.Y.0-beta.1` prerelease published for the
  next minor version (the founder publishes it; use whatever number is
  next when this runs): next check offers it; stable unit does not see it.
- Publish `vX.Y.0` as a normal release: both see it; beta unit shows it as
  an update over `X.Y.0-beta.1`.
- Compare tests: the ordering cases in decision 3 plus `1.7.3 < 1.8.0-beta.1`.
- Toggle survives an update (`data/` is preserved).

## 5. Docs

- `docs/SPEC.md` §4.1 cadence and §3.7.
- `docs/RELEASING.md` (new).
- `INSTALLATION.md` §13 "Updating the app".
- `docs/decisions/0022-two-release-channels.md`.

## 6. PR tier

Safe zone. No new destination; same GitHub API host, one extra endpoint.
