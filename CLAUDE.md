# CLAUDE.md — Agent guide for Rootboard.me

Guidance for any AI agent (Claude Code, etc.) working in this repository.

## Project at a glance

- A touchscreen **Google Calendar kiosk** ("McMurry Hurricane Calendar"), designed to run 24/7 on a Raspberry Pi in Firefox kiosk mode.
- Stack: Express + React/Vite (TypeScript), `better-sqlite3` for storage (native module — must be `npm install`ed on the target, never copied between architectures).
- Self-hosted default: SQLite (`calendar.db`); Google auth via a **service-account JSON key**. `DATABASE_URL` is only used for hosted (Postgres) deployments.
- Ships an **auto-update** feature (`server/services/updateService.ts`) that downloads the latest GitHub **release source tarball**, applies it, runs `npm install && npm run build`, and restarts under a supervisor (`scripts/start.sh` / systemd).

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
