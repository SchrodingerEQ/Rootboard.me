# WP-04 — Small fixes from `TASKS.md`, one PR each

| | |
|---|---|
| **Repo** | `SchrodingerEQ/Rootboard.me` (five PRs), then `SchrodingerEQ/awesome-rootboard` (one PR, if push access) |
| **Base** | latest `main`, fresh clone, `npm ci` (npm 11). Merge `main` in before each PR; (d) touches `INSTALLATION.md`, as WP-03 PR A does. |
| **Waits on** | nothing |
| **Unblocks** | a cleaner v1.9.0; brief 06's provision script ((d) gives it the cache setting to apply) |
| **Network / secrets** | none |
| **Deliverable** | six safe-zone PRs, each auto-merged per `/pr` rule 3 on all-green checks; the end-of-run report |
| **Model** | per the README |
| **Done when** | each lettered fix has its own PR open with auto-merge armed, or a dated TASKS.md note saying why not |
| **Unattended run** | 2–4 hours in all |

## Read first

`CLAUDE.md`, `CODING-STANDARDS.md`, `docs/SPEC.md` §2.2 (endpoint
inventory), §2.7 (pairing and diagnostics), §4.2 (apply flow);
`INSTALLATION.md` steps 4, 11, 12, 14; the files each fix names below.

## Goal

Clear the small open items in `TASKS.md` that need no Pi, each as its
own PR (kernel rule 3), so nothing rides along with a Pi-dependent brief
later. Every item below is quoted from `TASKS.md` on 2026-11-23; the
item's own text is the specification. Do them in this order; (b) first,
because it makes `npm test` green on the laptop for every other brief.

## The fixes

### (b) Windows-safe file-mode tests (`TASKS.md`, added 2026-11-19)

Five tests in `server/google-oauth.spec.ts` assert `0o600` (lines ~198,
~272, ~350 and two more) and fail on Windows (`expected 438 to be 384`).
Make the mode assertion conditional on `process.platform !== "win32"`
through one small helper in the spec, so the assertion still runs in CI
on Linux and the test still checks the file's contents everywhere. Do
not weaken the production code's `0o600`. Tier safe zone.

### (a) Cross-site guard on update and rollback (`TASKS.md`, added 2026-11-14)

`POST /api/update/apply` and `/api/update/rollback` (`server/routes.ts`
~350 and ~365) are localhost-only by socket address, so a page open in
the kiosk's own browser could form-POST them. Give them the guard the
`/api/system/*` mutations got in #35: see `server/system-routes.ts`
~55–60 (JSON body required; `Sec-Fetch-Site` cross-site refused) and its
tests in `server/system-routes.spec.ts`. Extract that check into a shared
helper in `server/middleware/lanAuth.ts` (or beside it) if it is not one
already, use it in both places, and test apply and rollback with a
cross-site request (403) and a same-origin JSON request (passes to the
existing handler). A third copy of the same check sits in
`server/google-routes.ts` ~65–93: switch it to the shared helper too,
with its tests unchanged. `docs/SPEC.md` §2.2 today says update and
rollback "do not have this yet": remove that clause, and add one line to
§4.2 saying the guard applies. Tier safe zone; it narrows nothing a user
does from the touchscreen.

### (c) Disk usage on the Diagnostics screen (`TASKS.md`, added 2026-11-21)

`server/services/diagnosticsService.ts` already reads `disk`
(`freeBytes`, `totalBytes`, ~line 178) and
`client/src/lib/diagnostics-rows.ts` already shows a "Disk free" row
(~line 100). The task asks for used / total with a warning colour above
about 80 %. Change the row to "Disk: <used> of <total> used (<n> %)",
set `warn` when used is above 80 %, and keep the "Unknown" case. Add the
same to the redacted and full bundle views if the row is rendered from
the bundle (check `system-diagnostics.tsx`). The row already warns when
free space is under 1 GB or under 5 %; **keep that and OR the new 80 %
rule onto it** (a 32 GB card at 81 % has 6 GB free, which the old rule
would call fine; a small card at 70 % with 900 MB free is still a
problem). Unit-test the row function at 79 %, 80 % and 81 %, and the
old rule still firing. `docs/SPEC.md` §2.7 lists the row. Tier safe
zone.

### (d) Firefox disk-cache cap, as docs (`TASKS.md`, added 2026-11-21)

On the reference kiosk the Firefox profile's cache and the OS caches had
filled the card to 77 %. Add to `INSTALLATION.md` step 4's "Turn off
browser zoom (Firefox)" section, or a sibling section "Cap the browser
cache", the `user.js` lines that cap `browser.cache.disk.capacity` (state
the value in KB and what it means in MB) and, if you confirm the
preference exists in current Firefox, the one that disables
remote-settings attachment downloads; plus `sudo apt-get clean` as a
housekeeping line in step 11 ("Make the app survive crashes and
updates"), under a short "Disk housekeeping" heading; step 12 is Wi-Fi
and does not fit. Say what each line does in one sentence. Cite Firefox's own documentation for
each preference name in the PR body, not in the guide. Then add one line
to `docs/plans/beta-launch/06-agent-facing-setup.md` §2 decision 2 so
the provision script applies the same settings. Nothing in this PR runs
on a Pi; the founder applies it at the reinstall (README checklist).
Tier safe zone (docs).

### (e) `bufferutil` check (`TASKS.md`, "Candidate for removal", added 2026-11-14)

The task says: check that nothing loads it, then **propose** removal.
Run the check (`npm ls bufferutil`, `grep -rn bufferutil` outside
`node_modules`, and whether `ws` is still a dependency at all after #30).
Write the finding into the `TASKS.md` line with the date. Removal itself
is a dependency change the task asks to be proposed, so: if nothing loads
it, open the PR that removes it from `package.json` and the lock, tier
safe zone with the one-line reason (kernel rule 7), and say in the body
that it is the proposal the task asked for. **Do not arm auto-merge on
this one**: the founder reads the proposal and merges it himself (one
more item on the README checklist, reported at the end). If something
does load it, the `TASKS.md` note is the whole PR.

### (f) awesome-rootboard: What to Wear and the theme section (`TASKS.md`, added 2026-10-04 and 2026-09-22)

In a fresh clone of `SchrodingerEQ/awesome-rootboard` (or the local
clone beside this repo, after `git pull`): add What to Wear to the first-party
widget list (shipped v1.7.0; one line in the style of the others), and
rewrite the Themes section, which still says "Rootboard doesn't have a
theme system yet": the engine shipped in v1.6.0 with Default and Deep
Space, built in and switchable from Settings; community themes remain
deferred (link the plan). Keep CC0. This repo has no PR-POLICY template;
open a normal PR and merge it if you have push access. The
`theme.subscribe` wording for the two widget repos stays with beta brief
07 (it edits those repos anyway); do not start it here.

## Tracker lines

Each PR ticks or annotates its own `TASKS.md` line with the PR number.
(f) ticks the awesome-rootboard half of the "After What to Wear ships"
item and notes the theme wording.

## Verification without hardware

- Every Rootboard PR: `npm run check`, `npm test`, `npm run lint` green
  (after (b), fully green on Windows too).
- (a): the new tests, plus a manual `curl` against `npm run dev` with
  `Sec-Fetch-Site: cross-site` → 403, and a same-origin JSON POST reaches
  the handler (it will refuse to apply without an update available; that
  is fine, the point is the guard).
- (c): the row tests; the Diagnostics screen in `npm run dev` shows the
  laptop's own disk.
- (d): read the finished section as the person who will follow it next
  week; every command is one a person can paste.

## If blocked

- (a): the `/api/system/*` check cannot be reused without touching the
  pairing guard's behaviour: write the smallest copy beside the update
  routes with a comment pointing at the original, and add a `TASKS.md`
  line to unify them.
- (f): no push access to awesome-rootboard: stop that part, report it,
  leave the `TASKS.md` note as it was with today's date added.

## Report (end of run)

**Done (PR numbers per letter) / Not done and why / Findings worth a task
/ Founder actions (apply (d) on the kiosk at the reinstall; see the disk
row on the kiosk).**
