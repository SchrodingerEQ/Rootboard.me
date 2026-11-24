# WP-03 — Node 24: the decision record, the install docs, CI, the floor, the lock

| | |
|---|---|
| **Repo** | `SchrodingerEQ/Rootboard.me`, two PRs in sequence |
| **Base** | latest `main`, fresh clone, `npm ci` (npm 11); the laptop runs Node 24 |
| **Waits on** | nothing |
| **Unblocks** | the reference kiosk's reinstall and v1.9.0 (founder checklist); later, Vite 8 and ESLint 10 as their own releases |
| **Network / secrets** | npm registry only. No install on the kiosk. |
| **Deliverable** | PR A (decision record + docs + CI + `engines`), tier **`principle-flag`**, founder-ratified 2026-11-23, waits for the label; PR B (lock bump), tier **safe zone**; the end-of-run report |
| **Model** | per the README |
| **Unattended run** | 2–3 hours |

## Goal

Rootboard states and installs Node 24 everywhere, and the `better-sqlite3`
lock moves to a release that ships ready-made Raspberry Pi builds for
Node 24 and Node 26, so the project installs on Node 26 development
machines and the Pi never compiles the module. This runs steps 2 and 5 of
`docs/plans/node-runtime-upgrade/BRIEF.md`; the founder answered its
four decisions on 2026-11-23 (below). Step 3 of that brief (an updater
guard for Node 20 kiosks) is **not built**, by the founder's decision.

## Decisions made 2026-11-23 (founder; don't reopen)

| # | Node brief decision | Answer |
|---|---|---|
| 1 | Which Node new kiosks get | **24** (supported to 2028-04-30; Pi builds in every 12.x release checked; the laptop already runs it) |
| 2 | How kiosks on Node 20 move | **No path.** The reference kiosk is the only Node 20 unit; the founder wipes it and reinstalls from scratch on his first day back, which is also the first clean-install test. No notice, no updater guard, no on-Pi compile. Consequence to record: a kiosk left on Node 20 would fail the install and roll back under today's updater, with no friendlier message. Principle 4 (shipped value never removed) is the founder's to waive; he did, today, because no such kiosk will exist. |
| 3 | Does the beta unit ship on the new Node | **Yes.** Brief 09's image installs Node 24 from the start. |
| 4 | State the real floor | **Yes.** `engines` in `package.json`, "Node 24" in `INSTALLATION.md` and the in-app setup page; "Node.js 18+" goes (the current lock never supported 18). |

## Read first

1. `docs/plans/node-runtime-upgrade/BRIEF.md`, all of it: the facts table
   says where every number came from.
2. `INSTALLATION.md` step 5; `client/src/pages/setup.tsx` lines ~145–155;
   `.github/workflows/ci.yml` (`node-version: 20`, `npm@11.16.0`);
   `package.json`; `server/sqlite-storage.ts` (the five better-sqlite3
   calls); `server/services/updateService.ts` `applyUpdate`;
   `scripts/start.sh`.
3. `docs/decisions/0002-sqlite-service-account.md`, `0003`, `0024`;
   `docs/README.md` (decision record format).
4. `CLAUDE.md` "Cross-platform / deployment notes" (the lockfile is
   written with npm 11; shell scripts stay LF).

## Steps

### PR A — decision record, docs, CI, floor (`principle-flag`)

1. **Decision record** `docs/decisions/0025-node-24-no-node-20-path.md`
   (0025 is the next free number; 0019, 0021 and 0023 are reserved for
   beta briefs 04, 06 and 09). Date 2026-11-23, status accepted. Decision:
   the four answers above. Context: the Node brief §1–2 in two sentences,
   cited not copied. Consequences: the principle-4 waiver and its
   reasoning (one kiosk, wiped by its owner; the wipe doubles as the
   clean-install test), that the updater gains no version check, that
   Vite 8 and ESLint 10 are unblocked once the kiosk runs 24, and that a
   self-hoster on Node 20 reads the floor in `package.json` and the
   guide. Mark the founder's ratification with the date.
2. **`INSTALLATION.md` step 5:** `setup_24.x`, "Node.js 24" as the
   requirement, and a sentence that older Node versions are not
   supported by the database module's ready-made Pi builds. Keep the
   step's structure; the guide is being followed from scratch next week.
   Check the hardware/software requirements list near the top says the
   same.
3. **`client/src/pages/setup.tsx`:** the same command and version
   (lines ~145–155). It mirrors the guide (brief 09 decision 4).
4. **`.github/workflows/ci.yml`:** `node-version: 24`. Keep the
   `npm@11.16.0` install step (Node 24 bundles npm 11, so it becomes a
   pin rather than a fix) and rewrite the comment above it, which still
   explains npm 10 on Node 20/22.
5. **`package.json`:** `"engines": { "node": ">=24" }`. Do **not** add
   `engine-strict` to `.npmrc`; the updater's `npm install` on a wrong
   Node should still fail on the module, not on npm's own check, until
   the founder wants otherwise. Say in the PR body why.
6. **`TASKS.md`:** the "Node runtime upgrade" item gets a dated note:
   decisions made 2026-11-23 (0025), steps 2 and 5 in PRs A and B, step
   3 dropped, steps 1, 4 and 6 on the founder's first-day-back list.
   Update the Node brief's **Status** line the same way; fill decision
   answers into its section 4 table (a "Decided 2026-11-23" column), and
   strike step 3 with a pointer to 0025. Do not remove the brief's facts.
7. **Crucible-HQ `setup/machine-setup.md` step 8** tells development
   machines to stay on Node 24 because of this lock. That is the HQ
   repo; do not edit it here. Name it under Founder actions in the report
   (one line: the Node row can say "24 or newer" once PR B merges).
8. `/crucible-code-standards-review` against `main`, then `/pr`. Tier
   **`principle-flag`**, principle 4 (a Node 20 kiosk could no longer
   update; founder-ratified 2026-11-23, record 0025). If the review
   reports **`needs-founder`** instead (HQ lists feature removal as a
   hard stop by rule), apply that tier; the outcome is the same, the
   founder's label, and the ratification is already recorded. The agent
   does not merge it.

### PR B — the lock (safe zone), after PR A merges

9. `npm view better-sqlite3 versions` and the module's GitHub release
   assets: pick the **newest 12.x** that ships `linux-arm64` prebuilds
   for Node 24 **and** Node 26 (12.11.1 did on 2026-11-19; check for
   newer). Not 13.x (Node brief §7).
10. `npm install better-sqlite3@<version>` with npm 11. Check the diff of
    `package-lock.json` is that module and its prebuild chain only; if
    npm 11 rewrites unrelated entries, say so in the PR.
11. `npm run check`, `npm test`, `npm run lint`. The storage tests cover
    the five calls in `server/sqlite-storage.ts`; if none exercises
    `pragma`, add one.
12. **`npm ci` on Node 26** is the point of the step. If the laptop has a
    Node version manager, run `npm ci` under 26 in a scratch clone and
    record the result; if not, record that the check is owed and how to
    run it (Node brief §6).
13. `TASKS.md`: the standing npm-audit item records whether the finding
    count moved; the Node item gets "step 5 in PR #<n>". Tier **safe
    zone** with a one-line reason for the dependency change (kernel
    rule 7). Auto-merge per `/pr` rule 3 (main has branch protection).

## Verification without hardware

- Both PRs: the three checks green on the laptop (Node 24) and in CI
  (now Node 24). State the five known Windows file-mode failures if
  WP-04 (b) has not merged.
- PR B: `npm run build` then `npm start` on the laptop with a scratch
  `calendar.db`; `GET /api/version` answers and the startup log shows
  the SQLite storage opened (the module loaded under the new prebuild
  and the schema ran). The storage specs already exercise `new
  Database` and `pragma`. Creating an event needs a Google connection,
  so it is not part of this proof.
- What only the kiosk can show (founder checklist): a fresh install from
  the rewritten step 5 ends with Node 24 and a running kiosk; the
  one-tap update to v1.9.0 and the rollback path still work.

## If blocked

- No 12.x release ships Pi prebuilds for both 24 and 26: pick the newest
  that ships 24 and say in the PR that Node 26 installs still compile;
  add a `TASKS.md` line.
- The lock bump drags in a `node-gyp` or `prebuild-install` change that
  breaks `npm install` on Windows: stop PR B, report the error text, keep
  PR A.

## Report (end of run)

**Done (PR A number, waiting for the label; PR B number, merged or
waiting) / Not done and why / Findings worth a task / Founder actions
(label PR A; the kiosk wipe and reinstall from the rewritten step 5;
record the kiosk's old Node version in the Node brief first; the HQ
machine-setup Node row).**
