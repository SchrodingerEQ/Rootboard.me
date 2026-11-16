# 0022 — Two release channels: stable and beta
Date: 2026-11-14
Status: accepted (beta-launch brief 08, decisions locked 2026-11-08)

## Decision

1. A kiosk follows `stable` (default, unchanged: GitHub's
   `releases/latest`) or `beta` (the ten newest releases, drafts
   skipped, highest version wins, prereleases included).
2. The channel is `update.channel` in `data/config/dashboard.json`, set
   in Settings → System → Updates. Lenient like `theme`: a malformed
   value is dropped, never the layout. `UPDATE_CHANNEL` env is the
   fallback (for the provision script); config wins. Resolved on every
   check, so a change applies without a restart.
3. Prereleases are tagged `vX.Y.Z-beta.N` and marked Pre-release on
   GitHub. `shared/version.ts` carries the full string. The compare
   (`shared/release-version.ts`) follows semver's prerelease ordering:
   `1.7.3 < 1.8.0-beta.1 < 1.8.0-beta.2 < 1.8.0`. A leading `v` is
   ignored; a tag that is not a version is never offered.
4. No automatic downgrade: a beta build stays on a kiosk switched to
   stable until stable is newer, and Settings says so.
5. Same HTTPS host, same tarball path, same backup and rollback for both
   channels. Release steps are in `docs/RELEASING.md`.

## Context and alternatives

One channel meant every release reached every kiosk at the next check,
so a fix could not be tried on the reference kiosk before the beta
tester's unit, or the other way round.

- **A separate branch or repo for beta.** Rejected: two places to cut
  releases from, and the tarball path would differ.
- **A semver library.** Rejected: the grammar in use is
  `X.Y.Z[-beta.N]`; thirty lines with tests cover it without a new
  dependency.
- **Newest by publish date on beta.** Rejected: a late hotfix to the old
  line (`1.7.4` after `1.8.0-beta.1`) would pull a beta kiosk backwards.

## Consequences

- Promoting a beta needs a one-line commit that sets `version.ts` to
  `X.Y.Z`; publishing the beta's exact tree as `vX.Y.Z` would leave
  kiosks reporting `X.Y.Z-beta.N` and being offered `X.Y.Z` forever.
  The brief's decision 3 said "the same tree"; the founder accepted the
  one-line bump instead (2026-11-16).
- A beta tag published without the Pre-release tick would come back from
  `releases/latest`; stable refuses any tag with a prerelease part and
  logs it, so the mistake stalls stable updates instead of shipping a
  beta. An optional CI check for the tick is left for later.
- Kiosks from before channels (v1.7.3 and older) read `X.Y.Z-beta.N` as
  a normal newer release, so the first beta waits until every kiosk runs
  a build with channel support, and a beta is never published without
  the Pre-release tick (`docs/RELEASING.md`).
- Founder decisions on the PR (2026-11-16): promotion is the one-line
  `version.ts` PR, then the tag; and the tag must match `version.ts`
  exactly, a manual checklist step for now.
- Rolling back to a build from before channels, then saving any setting
  there, drops the `update` key (older schemas strip keys they don't
  know), so the kiosk returns to the env value or stable. Set the
  channel again after updating forward.
- `data/` is on both updater preserve lists, so the channel survives
  updates and rollbacks.
- The beta check reads only the ten newest releases; more than ten
  releases between two checks of one beta kiosk is not expected.
