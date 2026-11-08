# 08 — Beta update channel

**Status:** Not started.
**Type:** Update service + Settings toggle + release process. One session.
**Depends on:** nothing. Ship before the tester's unit leaves, so it can be flipped later.
**Unblocks:** 09 (which channel the shipped unit is on).

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
| 1 | Channels | `stable` (default; unchanged behaviour: `releases/latest`) and `beta` (newest release **including prereleases**, from `/releases?per_page=10`, skipping drafts, picking the highest version by the existing numeric comparison). |
| 2 | Where it is set | `data/config/dashboard.json` → `update: { channel }`, lenient schema like `theme`. Settings → System → Updates shows the channel with a toggle and one sentence: "Beta gets fixes a few days earlier and may have rough edges." Also settable by env `UPDATE_CHANNEL` for the provision script; config wins over env. |
| 3 | Release process | Prereleases are tagged `vX.Y.Z-beta.N` and marked **Pre-release** on GitHub. Promoting = publishing `vX.Y.Z` as a normal release with the same tree. `shared/version.ts` carries the full string including `-beta.N`; the version comparison must treat `1.8.0-beta.2 < 1.8.0` and `1.8.0-beta.1 < 1.8.0-beta.2`. Document the exact steps in `docs/RELEASING.md` (new, short). |
| 4 | Downgrade | A unit on `beta` switched to `stable` keeps its beta build until stable catches up; the UI says so. No automatic downgrade (rollback remains the manual path it is today). |
| 5 | Release notes | The update dialog already shows the release body. `RELEASING.md` states that notes are written for the owner, in plain language, with a "What changed for you" first paragraph; the prerelease body says it is a beta. |
| 6 | Safety | HTTPS only, same tarball path, same backup/rollback. Prereleases go through the same CI and the same pre-push security review; the only difference is who receives them first. |

## 3. Where the code goes

- `updateService.ts`: `fetchLatestRelease(channel)`; semver-with-prerelease
  compare (write it, with tests; no new dependency needed for this
  little grammar); include `channel` in `/api/update/check` and `/status`.
- `shared/dashboard-config.ts`: `update` key.
- `settings-menu.tsx`: toggle + copy.
- `scripts/provision.sh` (brief 06): `--channel beta|stable`.
- `.github/workflows/`: nothing required; optional later job that fails if
  a tag `vX.Y.Z-beta.N` is published without the Pre-release flag.

## 4. Acceptance

- Reference kiosk on `beta`, a `v1.8.0-beta.1` prerelease published: next
  check offers it; stable unit does not see it.
- Publish `v1.8.0` normal release: both see it; beta unit shows it as an
  update over `1.8.0-beta.1`.
- Compare tests: the ordering cases in decision 3 plus `1.7.3 < 1.8.0-beta.1`.
- Toggle survives an update (`data/` is preserved).

## 5. Docs

- `docs/SPEC.md` §4.1 cadence and §3.7.
- `docs/RELEASING.md` (new).
- `INSTALLATION.md` §13 "Updating the app".
- `docs/decisions/0020-two-release-channels.md`.

## 6. PR tier

Safe zone. No new destination; same GitHub API host, one extra endpoint.
