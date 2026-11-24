# Node runtime upgrade — move kiosks off Node 20

**Status:** Draft 2026-11-19. Decided 2026-11-23 (founder): Node 24
everywhere, no Node 20 path — see
[decision 0025](../../decisions/0025-node-24-no-node-20-path.md) and the
"Decided 2026-11-23" column in section 4. Steps 2 and 5 run as WP-03
(`docs/briefs/2026-11-23-remote-work/WP-03-node-24.md`), PRs A and B;
step 3 is dropped; steps 1, 4 and 6 are the founder's, on the
first-day-back list in that folder's README.
2026-11-24: step 2 merged (#49); step 5 moved the lock to 12.11.1 in
WP-03 PR B.
**Type:** Maintenance. No new feature; the goal is that kiosks keep
updating and that the dependency upgrades waiting on the Pi's Node
version can go ahead.
**Related:** [decision 0002](../../decisions/0002-sqlite-service-account.md)
(better-sqlite3), [decision 0003](../../decisions/0003-release-tarball-updater.md)
(the kiosk builds every update itself), [decision 0024](../../decisions/0024-eslint-with-react-hooks.md)
(ESLint 10 held back), `TASKS.md` standing npm audit item (Vite 8 held back).
**Tracked in:** `TASKS.md`, "Node runtime upgrade".

---

## 1. The problem, in one paragraph

The install guide puts **Node 20** on the kiosk, and Node 20 reached end
of life on 2026-04-30. The kiosk's database module, `better-sqlite3`, is
locked at 12.4.6. Releases up to 12.9.0 still ship a ready-made build
for Node 20 on the Pi, but none of them supports Node 26; every release
from 12.10.0 on supports Node 26 and has dropped the Node 20 build. So
the lock cannot move past 12.9.0 without either raising the kiosk's Node
version or making the kiosk compile the module during an update. Until that is settled, Rootboard
does not install on Node 26 without a compiler (seen on Windows), and
the upgrades already waiting on the Pi's Node version stay where they
are.

## 2. Facts, and how each was checked (2026-11-19)

| Fact | How it was checked |
|---|---|
| The kiosk install guide installs Node 20 and says "Node.js 18+". The in-app setup page shows the same Node 20 command. | `INSTALLATION.md` step 5; `client/src/pages/setup.tsx` lines 145–155 |
| CI runs Node 20. | `.github/workflows/ci.yml` |
| `package.json` declares no `engines` field. | `package.json` |
| `better-sqlite3` is locked at 12.4.6 (range `^12.4.6`). It is used in one file, through `new Database`, `pragma`, `exec`, `prepare` and `close` only. | `package-lock.json`; `server/sqlite-storage.ts` |
| Node support dates: 20 ended 2026-04-30; 22 ends 2027-04-30; 24 ends 2028-04-30; 26 ends 2029-04-30. | Node.js Release working group `schedule.json` |
| 12.4.6, 12.8.0 and 12.9.0 ship Pi (linux-arm64) builds for Node 20, 22, 23, 24 and 25. The releases between them were not checked. | Release assets on the module's GitHub releases |
| 12.10.0, 12.10.1 and 12.11.1 ship Pi builds for Node 22, 24, 25 and 26, and **none for Node 20**. No release ships both Node 20 and Node 26. | Same |
| 13.x declares `node >=22`. | `npm view better-sqlite3 engines` |
| On Windows with Node 26, `npm ci` with the current lock fails: no ready-made build, and no compiler present. | Run on a development PC |
| 12.11.1 installs and runs a query on Windows with Node 26 with no compiler. | Scratch folder outside the repo; Rootboard's own tests were **not** run against it |
| On Windows with Node 24.22.3 the current lock installs; lint and typecheck pass; of 979 tests, 973 pass, 5 fail and 1 is skipped. | Run on a development PC. The 5 failures are the file-mode assertions in `server/google-oauth.spec.ts`, which Windows cannot satisfy (see `TASKS.md`) |
| The updater runs `npm install --include=dev` and `npm run build` on the kiosk, rolls back if either fails, and never checks or changes the Node version. | `server/services/updateService.ts` `applyUpdate`; `scripts/start.sh` |
| The diagnostics screen shows the kiosk's Node version. | `server/services/diagnosticsService.ts`; `client/src/lib/diagnostics-rows.ts` |
| Vite 8 (needs Node 20.19+ or 22.12+) and ESLint 10 (needs Node 20.19+ or 22.13+) are held back until the Pi's Node version is checked. A kiosk on Node 20.19 or later already meets both. | `TASKS.md` standing npm audit item; decision 0024 |

**Not checked:**

- Which Node version the reference kiosk actually runs. Read it from the
  diagnostics screen.
- Whether a Node 20 kiosk can compile `better-sqlite3` during an update.
  When no ready-made build exists the module's install script falls back
  to compiling, which needs a C++ compiler, `make` and Python on the Pi.
  The install guide does not install them; the Pi OS image may already
  have them. If the compile fails, the updater rolls back and the kiosk
  stays on its old version.
- Whether [brief 09](../beta-launch/09-golden-image-and-ship-checklist.md)'s
  golden image should carry a newer Node. That brief names no Node
  version.

## 3. What this does not need

- No change to how Rootboard stores data. The SQLite file format does
  not depend on the Node version.
- No move to Node's built-in `node:sqlite`. It does not exist on Node 20
  and would be a rewrite of `server/sqlite-storage.ts`.
- No change for developers today: Rootboard installs and runs on Node 24
  with the current lock.

## 4. Decisions for the founder

| # | Decision | Options | Notes | Decided 2026-11-23 |
|---|---|---|---|---|
| 1 | Which Node version new kiosks get | **22** or **24** | 24 is supported a year longer (to 2028-04-30). Both have ready-made Pi builds in every 12.x release checked above. | **24.** |
| 2 | How kiosks already running Node 20 move | (a) A written manual step in the install guide. (b) A notice on the kiosk when its Node version is out of date, with the steps. (c) Nothing: they stay on Node 20 and on releases that still support it. (d) They stay on Node 20 and compile the module during the update. | The one-tap updater cannot change Node. Decision 0003's goal is that nobody has to open a terminal on the Pi. Option (c) means a later release must refuse to install on Node 20 instead of failing halfway (see step 3 below), and it ends updates for those kiosks. Option (d) is unverified (section 2, "Not checked") and keeps kiosks on an unsupported Node. | **No path, and no guard.** The reference kiosk, the only Node 20 unit, is wiped and reinstalled on Node 24 by its owner. A kiosk left on Node 20 would fail the install and roll back. Principle-4 waiver recorded in decision 0025. |
| 3 | Whether the first external beta unit ships on the new Node | Yes, change the image before it is cut; or no, ship on Node 20 and upgrade later | Cheapest before the first unit leaves; afterwards it becomes decision 2 for someone else's kiosk. | **Yes**, Node 24 from the start. |
| 4 | Whether to raise the stated minimum | Keep "Node.js 18+" or state the real floor | The current lock's module supports Node 20 and later, not 18. The install guide and the in-app setup page both state the number. | **State the real floor:** `engines` `>=24`, and Node 24 in the guide and the setup page. |

Decision 2 option (c) and decision 4 can leave a kiosk that works today
unable to take later releases. Under the product principle that shipped
value is never removed, that is the founder's call to ratify, not an
implementation detail.

## 5. Work, in order

Each step is its own PR. Steps 2 onward wait on section 4. Steps 1 and 4
need the physical kiosk, so they are the founder's to do.

1. **Find out what the reference kiosk runs (founder).** Read the Node
   version from its diagnostics screen and record it here.
2. **Change what new installs get.** Update `INSTALLATION.md` step 5 and
   the command shown in `client/src/pages/setup.tsx` to the chosen
   version (decisions 1 and 4). Move CI to the same version. Add an
   `engines` field to `package.json` if decision 4 says to state the
   floor, or if step 3 goes ahead: the updater needs the floor written
   somewhere it can read.
3. ~~**Protect kiosks still on Node 20.** Before any release whose
   dependencies no longer support Node 20, make the updater compare the
   kiosk's Node version with the release's stated floor and decline with
   a plain message, instead of starting an install that will roll back.
   The shape depends on decision 2. The check runs in the updater the
   kiosk already has, so it must ship at least one release before the
   release it guards against; a kiosk that skipped that release gets no
   check and relies on the existing rollback.~~ **Dropped 2026-11-23**
   ([decision 0025](../../decisions/0025-node-24-no-node-20-path.md)):
   no Node 20 kiosk will exist, so no guard is built.
4. **Upgrade the reference kiosk by hand (founder).** In a terminal on
   the kiosk: run the Node install commands from `INSTALLATION.md`
   step 5 as rewritten in step 2, then in the app folder run
   `npm install --include=dev` and `npm run build`, and restart the
   `touchscreen-scheduler` service. The reinstall is required:
   `better-sqlite3` is built for one Node version, and the app will not
   start on a new Node major until it is installed again. Then run a
   normal one-tap update and confirm the calendar, the update screen
   and the rollback path still work.
5. **Move the lock forward.** `npm install better-sqlite3@<version>`
   with npm 11 (see `CLAUDE.md` on the lockfile), then `npm run check`,
   `npm test` and `npm run lint`. The version is the implementer's
   choice: the newest 12.x that ships Pi builds for the chosen Node and
   for Node 26 (12.11.1 did on 2026-11-19). This is the step that makes
   Rootboard install on Node 26.
6. **Ship it as its own small release** per `docs/RELEASING.md`, on the
   beta channel first, and verify on the kiosk before promoting. Then
   update the Node row in Crucible-HQ's `setup/machine-setup.md`
   step 8, which tells development machines to stay on Node 24 because
   of this lock.
7. **Then, separately:** the upgrades that were waiting — Vite 8 and
   ESLint 10 — each as its own release, as their existing notes say. If
   step 1 shows the kiosk is already on Node 20.19 or later, they do not
   have to wait for steps 2–6.

## 6. How to tell it worked

- A fresh install following `INSTALLATION.md` ends with the chosen Node
  version and a running kiosk.
- The reference kiosk updates through the touchscreen to the release
  from step 6 with no terminal.
- ~~A kiosk left on Node 20 is told why it cannot take that release, and
  keeps running its current version.~~ Dropped with step 3 (decision
  0025): such a kiosk rolls back with no message, and none will exist.
- `npm ci` succeeds on Node 22, 24 and 26 on a development machine.

## 7. Not proposed here

These are left out of this brief's work, not ruled out; the founder can
add any of them.

- `better-sqlite3` 13.x. It needs Node 22 or later everywhere first;
  revisit after step 6.
- Any change to the update mechanism beyond the version check in step 3.
- Installing or upgrading Node from inside the app.
