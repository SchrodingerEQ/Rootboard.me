# 0003 — Auto-update via GitHub release tarball with supervisor rollback

Date: 2026-07-23 (reconstructed as-built rationale)
Status: accepted

## Decision

The kiosk self-updates by downloading the latest GitHub **release source
tarball** over HTTPS (`server/services/updateService.ts`), preserving the
paths in `PRESERVE_PATHS` (env, service-account key, database, backups),
running `npm install && npm run build`, and restarting under a supervisor
(`scripts/start.sh` / systemd) that health-checks the new version and
auto-rolls back to the pre-update backup on failure.

## Context and alternatives

The kiosk runs 24/7 on a Pi that nobody wants to SSH into. Updates must be
one-tap from the touchscreen, and a bad update must not brick the family
calendar.

- **`git pull` on the device** — rejected: requires git state to stay clean
  on the kiosk, conflicts brick the update path, and releases (tagged,
  deliberate) are a better unit of shipping than whatever is on main.
- **Prebuilt binaries/packages (deb, Docker)** — rejected: `better-sqlite3`
  is a native module, so artifacts are per-architecture; building on-device
  from source sidesteps cross-compilation entirely at the cost of a slower
  update (`npm install` + build on a Pi).
- **No auto-update** — rejected: defeats the product goal of a maintenance-
  free household appliance.

## Consequences

- **Supply-chain exposure:** the updater downloads and *executes* code
  (npm lifecycle scripts + build). The GitHub account is the root of trust —
  2FA required, ship only from a trusted machine, URLs must stay HTTPS.
- Update/rollback endpoints are **localhost-only** guarded in
  `server/routes.ts`; re-verify if a reverse proxy is ever introduced.
- `PRESERVE_PATHS` (updateService.ts) and the rollback list in `start.sh`
  are parallel lists that **must be kept in sync by hand**.
- Everything git tracks ships to every kiosk — the driver behind the
  security review in CLAUDE.md and decision 0001.
