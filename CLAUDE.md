# CLAUDE.md — Agent guide for Rootboard.me

Guidance for any AI agent (Claude Code, etc.) working in this repository.

> **Full current spec:** read `docs/SPEC.md` — it documents the as-built
> behavior (views, data invariants, OSK/kiosk quirks, update system) in
> detail. Keep it updated when behavior changes.
>
> **Decision records:** `docs/decisions/` holds short "why X over Y" notes.
> When you make a non-obvious design choice (library, architecture,
> protocol, policy), add a note there. See `docs/README.md` for the format.
>
> ⚠️ `docs/` is **tracked and public** (it syncs the project across
> machines via the repo — see `docs/decisions/0001`). Everything written
> there falls under the security review below: no hostnames, IPs, real
> names, or other deployment specifics — use generic placeholders.
>
> ⚠️ **Business information never goes in this repo.** Monetization,
> pricing, margins, revenue strategy, legal/trademark plans, and
> sales/pilot logistics live in Crucible-HQ `departments/pm/rootboard/`
> (private repo — it syncs across machines too, so strategy material
> still travels with the project). This applies to tracked files,
> commit messages, and release notes alike. A decision record that turns
> on business strategy gets a numbering **stub** here pointing to
> "private planning records" (see `docs/decisions/0005`). Technical and
> community-facing direction stays public.

## Project at a glance

- A touchscreen **Google Calendar kiosk** ("Rootboard"), designed to run 24/7 on a Raspberry Pi in Firefox kiosk mode.
- Stack: Express + React/Vite (TypeScript), `better-sqlite3` for storage (native module — must be `npm install`ed on the target, never copied between architectures).
- Self-hosted default: SQLite (`calendar.db`); Google auth via a **service-account JSON key**. `DATABASE_URL` is only used for hosted (Postgres) deployments.
- Ships an **auto-update** feature (`server/services/updateService.ts`) that downloads the latest GitHub **release source tarball**, applies it, runs `npm install && npm run build`, and restarts under a supervisor (`scripts/start.sh` / systemd).
- Has a **community widget system** (contract: `docs/plans/widget-system/CONTRACT.md`; sideloaded folders in `/widgets/`, gitignored + update-preserved). Three companion public repos live under the same GitHub account: `rootboard-widget-template` (starter + tutorial + contribution guide, MIT), `rootboard-widget-grocery-list` (reference widget, MIT), `awesome-rootboard` (community list, CC0). Changes to the contract or host must keep those repos' docs in sync.

## ⚠️ MANDATORY: security review before every push/release

**This is a PUBLIC repository, and the auto-updater pulls the release tarball onto every kiosk. Anything committed is doubly exposed.** Before committing, pushing, or cutting a release, the agent MUST run the following review and explicitly report the result to the user. Do not push if any check fails.

### 1. No secrets or credentials in tracked files
These are gitignored — confirm none are staged or force-added:
- `service-account.json` (Google service-account **private key**)
- `google_credentials.json` (legacy OAuth creds)
- `.env`, `.env.*` (may hold `DATABASE_URL` with passwords)
- Any hardcoded API key, token, password, or `BEGIN ... PRIVATE KEY` block in source.

### 2. No personal data / PII
- `calendar.db`, `*.db`, `*.db-wal`, `*.db-shm` — contain **real family calendar events** (titles, locations, descriptions).
- `attached_assets/*` except the one whitelisted logo — this folder has historically held **personal screenshots, hostnames, and IPs**.
- `*.log` (e.g. `firefox-kiosk.log`) — can contain IPs/hostnames.
- `.local/`, `.agents/`, `.cache/`, `.upm/` — agent/Replit artifacts that may contain personal data.

### 3. No identifying info hardcoded in source, docs, comments, commit messages, or release notes
- Real email addresses (the service-account `client_email`, personal Gmail).
- Internal **IP addresses** (`192.168.x.x` / `10.x.x.x` etc.), the kiosk's **hostname**, the Linux **username** it runs under, and absolute home paths (`/home/<user>/...`). Use generic placeholders in docs, never the real deployment's values.
- Real names beyond the project's public branding.
- Remember: **commit messages and release notes are public too.**

### 4. No business/strategy information
- Monetization, pricing, margins, revenue strategy, trademark/legal
  plans, sales/pilot logistics — none of it in tracked files, commit
  messages, or release notes. It belongs in Crucible-HQ
  `departments/pm/rootboard/` (see the warning block at the top).
  Grep the staged diff for tells like dollar amounts, `pricing`,
  `margin`, `revenue`, `trademark`, `BOM`.

### How to actually run the check
1. `git status` — verify no untracked secret/data file is about to be added. **Avoid blind `git add -A`/`git add .`**; stage files deliberately.
2. `git diff --cached` — read the staged diff in full before committing.
3. Grep the staged diff for tell-tale patterns, e.g.:
   `private_key`, `BEGIN PRIVATE KEY`, `client_email`, `192.168.`, `10.0.`, `/home/`, `@gmail.com`, known hostnames/usernames.
4. Confirm `.gitignore` still covers every sensitive path above.
5. Treat "what ships" as **everything tracked by git** (that's what lands in the public release tarball).
6. A **gitleaks** pre-commit hook (config: `.gitleaks.toml`, hook: `.githooks/`) automates steps 1–2 against staged content and blocks the commit on a hit. It is a safety net, **not** a replacement for this review: it does not scan commit messages, release notes, or existing history, and it can be bypassed with `--no-verify`. New clones must enable it once with `git config core.hooksPath .githooks`.

### If a secret was ever committed
Git history retains it even after deletion, and this repo is public — so **treat any previously committed secret as compromised**: rotate it immediately (regenerate the Google service-account key, etc.) and consider rewriting history.

## Broader security checks before a release

- **Dependencies:** run `npm audit`; review high/critical findings (especially anything reachable from the request path). Do **not** run `npm audit fix --force` blindly — it can introduce breaking changes.
- **Update supply chain:** the updater downloads and *executes* code (npm lifecycle scripts + a fresh build). Keep the GitHub account protected (2FA), only ship from a trusted machine, and ensure download URLs stay **HTTPS** (`server/services/updateService.ts`). A compromised release auto-deploys to every kiosk.
- **No secrets in client bundle:** the service account is server-side only. Never expose secrets to the Vite client (no `VITE_`-prefixed secrets; they get inlined into public JS).
- **Update/rollback endpoints are localhost-only** (`server/routes.ts`). If a reverse proxy is ever added, set Express `trust proxy` correctly and re-verify the guard can't be bypassed via `X-Forwarded-For`.

## Cross-platform / deployment notes

- **Shell scripts must be LF** (enforced by `.gitattributes`). CRLF breaks `start.sh` on the Pi and in the auto-update flow.
- `reusePort` is enabled on non-Windows only (`server/index.ts`) — it throws `ENOTSUP` on Windows.
- After changing `server/**`, rebuild (`npm run build`) — the server is bundled into `dist/index.js`.
- On the Pi the app runs as the `touchscreen-scheduler` systemd service → `scripts/start.sh` (health-check + auto-rollback supervisor). Files preserved across updates are listed in `PRESERVE_PATHS` (`updateService.ts`) and the `start.sh` rollback case — keep those two in sync.

<!-- Crucible Creations — company principles digest.
     Source of truth: SchrodingerEQ/Crucible-HQ/CLAUDE.md
     Maintained by agent-ops. Do not edit here; propose changes in HQ. -->

## Crucible Creations principles (digest)

This product is built by Crucible Creations. All work in this repo
follows these non-negotiable rules:

1. **Privacy**: Never add analytics, tracking, telemetry, or
   third-party data collection. No user accounts unless functionally
   required.
2. **Transparent pricing**: Any pricing/paywall surface must disclose
   exactly what's included. Never gate previously free functionality
   or a user's existing work/data behind a charge.
3. **Clear purpose**: UI copy and store text state plainly what the
   product does and doesn't do. No overpromising.
4. **Value only accrues**: Never remove or degrade shipped
   functionality. Feature removal requires founder ratification in HQ
   — flag it, don't do it.
5. **Low overhead**: Prefer client-side/serverless approaches; treat
   any new ongoing infrastructure cost as a decision to flag, not a
   default.
6. **No dark patterns**: No manipulative flows anywhere — cancellation,
   upsells, notifications, engagement mechanics. We compete against
   companies that do this.
7. **Escalate, don't decide**: Monetization, pricing, legal, and
   feature-removal questions are decided in Crucible-HQ, not in this
   repo.

<!-- end digest -->

## Task tracking
Open work for this project is tracked in TASKS.md at repo root.
Check it when asked what's next or what's outstanding; when you
complete work that matches an open item, propose checking it off
(confirm with me first). Add new discovered work there, not in
ad-hoc notes.
