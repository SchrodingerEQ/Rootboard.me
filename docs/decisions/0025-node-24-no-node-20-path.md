# 0025 — Node 24 on every kiosk, no path for Node 20 kiosks
Date: 2026-11-23
Status: accepted (founder-ratified 2026-11-23, in the brief-writing
session for `docs/briefs/2026-11-23-remote-work/`)

## Decision

The four founder decisions in
[the Node runtime upgrade brief](../plans/node-runtime-upgrade/BRIEF.md)
§4, answered:

1. **New kiosks install Node 24** (supported to 2028-04-30; every
   `better-sqlite3` 12.x release checked ships ready-made Raspberry Pi
   builds for it).
2. **Kiosks on Node 20 get no migration path.** No install-guide step,
   no on-kiosk notice, no updater version check, no on-Pi compile. The
   brief's step 3 (an updater guard for Node 20 kiosks) is not built.
3. **The first beta unit ships on Node 24.** Brief 09's image installs it
   from the start.
4. **The real floor is stated:** `"engines": { "node": ">=24" }` in
   `package.json`, and Node 24 in `INSTALLATION.md` step 5 and the in-app
   setup page. "Node.js 18+" goes; the current lock never supported 18.

CI runs on Node 24 to match.

## Context

Node 20 reached end of life on 2026-04-30, and no `better-sqlite3`
release ships Pi builds for both Node 20 and Node 26, so the lock cannot
move forward while kiosks stay on 20 (brief §1, with the sources for
every number in §2).

## Consequences

- **Principle 4 waiver.** A kiosk left on Node 20 could no longer take
  updates once the lock moves: the updater's `npm install` would fail on
  the module and the kiosk would roll back to its current version, with
  no friendlier message. That removes shipped value, so it is the
  founder's call; he made it because no such kiosk will exist. The
  reference kiosk is the only Node 20 unit, and its owner wipes and
  reinstalls it from the rewritten guide, which doubles as the first
  clean-install test.
- The updater gains no Node version check. `engine-strict` is not set,
  so a wrong Node fails on the module, not on npm's own check.
- A self-hoster on Node 20 learns the floor from `package.json` and the
  install guide.
- Once the reference kiosk runs Node 24, the upgrades held back on the
  Pi's Node version (Vite 8, ESLint 10 — decision 0024) are unblocked,
  each as its own release.
