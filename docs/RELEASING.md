# Releasing Rootboard

The one place the per-release steps live. Kiosks update from GitHub
releases (decision 0003), so **publishing a release ships code to every
kiosk on that channel**. Only the founder publishes releases, and only
from a trusted machine with 2FA on the GitHub account.

## Channels

Each kiosk follows one channel (decision 0022), set in Settings → System →
Updates (`data/config/dashboard.json` → `update.channel`; the
`UPDATE_CHANNEL` env var applies when the file has none; default `stable`).

| Channel | Gets | How the updater finds it |
|---|---|---|
| `stable` | normal releases only | `GET /repos/<owner>/<repo>/releases/latest` (newest non-prerelease, non-draft) |
| `beta` | normal releases **and** prereleases | `GET /repos/<owner>/<repo>/releases?per_page=10`, drafts skipped, highest version wins |

Version order: `1.7.3 < 1.8.0-beta.1 < 1.8.0-beta.2 < 1.8.0`. A kiosk
switched from beta back to stable keeps its beta build until a stable
release is newer; there is no automatic downgrade (Roll Back is the
manual path).

## Version strings and tags

- `shared/version.ts` `APP_VERSION` is the full version, without `v`:
  `1.8.0-beta.1` for a prerelease, `1.8.0` for a release.
- The tag is the same string with a leading `v`: `v1.8.0-beta.1`,
  `v1.8.0`. Old tags are mixed (`v1.7.1`, `1.7.2`, `v1.7.3`); the updater
  reads both, but **every new tag starts with `v`**.
- The tag and `APP_VERSION` must match exactly. A kiosk that installs a
  release whose `APP_VERSION` is lower than its tag is offered the same
  release again at every check.
- Prereleases count up from `beta.1` for each version: `-beta.1`,
  `-beta.2`, … (numbers compare numerically, so `beta.10` > `beta.9`).

## Release notes

The update dialog on the kiosk shows the release body, so it is written
for the **owner**, not for developers:

- The first paragraph is headed **What changed for you** and says, in
  plain language, what the owner will notice.
- A prerelease body starts with: "This is a beta. It reaches kiosks on
  the beta channel first and may have rough edges."
- Release notes are public: no hostnames, IPs, names, home paths, or
  business details (`CLAUDE.md` security review, check 3 and 4).

## Checklist for every release (beta or stable)

1. **Bump the version.** A PR to `main` that sets `shared/version.ts` to
   the new version (see above), merged with green checks.
2. **npm audit.** Run `npm audit` on the merged `main`. Record the result
   by updating the **one standing npm-audit item** in `TASKS.md`: the
   finding count, what changed since the last release, and whether
   anything is on the kiosk's request path. Do not add a new item per
   release. High or critical findings on the request path block the
   release. Never run `npm audit fix --force` blindly.
3. **Pre-push security review.** Run the mandatory review in `CLAUDE.md`
   over what the tag ships (everything git tracks) and over the release
   notes.
4. **Privacy gate.** If the release changes what leaves the kiosk (a new
   host, new data sent to an existing host), it waits until the Crucible
   privacy policy says so. Brief 01's weather lookup was the first case.
5. **Tag and publish** (below).
6. **Kiosk check.** Update the reference kiosk and check the change on
   it, plus every merged item in `TASKS.md` still marked as waiting on a
   kiosk verification. Tick those items once seen.

## Publishing a beta (prerelease)

1. Steps 1–4 of the checklist, with `APP_VERSION` = `X.Y.Z-beta.N`.
2. GitHub → Releases → **Draft a new release**.
3. **Choose a tag** → type `vX.Y.Z-beta.N` → **Create new tag on
   publish**, target `main` (the commit with the version bump).
4. Title: `vX.Y.Z-beta.N`. Body: the beta sentence, then "What changed
   for you".
5. Tick **Set as a pre-release**. Leave "Set as the latest release"
   unticked.
6. **Publish release**.
7. Check: on a kiosk set to Beta, Settings → System → **Check for
   Updates** offers `X.Y.Z-beta.N`; a stable kiosk does not.

A tag `vX.Y.Z-beta.N` published **without** the pre-release tick becomes
GitHub's "latest release". Stable kiosks refuse a beta tag and log it,
so they get **no** update at all until it is fixed: edit the release and
tick **Set as a pre-release** straight away.

## Promoting a beta to stable

When the beta has run on the beta kiosk without problems:

1. A PR to `main` that changes only `shared/version.ts` from
   `X.Y.Z-beta.N` to `X.Y.Z`. No other changes, so stable gets exactly
   what beta tested.
2. Checklist steps 2–4.
3. Draft a new release with tag `vX.Y.Z` on that commit, title `vX.Y.Z`,
   the owner-facing notes (no beta sentence), **Set as the latest
   release** ticked and **pre-release unticked**. Publish.
4. Check: the beta kiosk is offered `X.Y.Z` over `X.Y.Z-beta.N`; a stable
   kiosk is offered `X.Y.Z`.

A fix found during the beta goes out as `X.Y.Z-beta.N+1` first.

## Publishing a stable release directly

For a release that skips beta, use the checklist with `APP_VERSION` =
`X.Y.Z` and publish `vX.Y.Z` as in "Promoting", step 3. Both channels
receive it.
