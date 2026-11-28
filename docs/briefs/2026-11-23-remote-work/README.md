# Rootboard remote work — briefs for the week of 2026-11-23

Written away from the hardware: a laptop, a phone and a tablet, **no
Raspberry Pi and no touchscreen**. These briefs are the Rootboard work
that can run anyway, each as one unattended agent session on the laptop.
Everything that needs the kiosk is collected in the founder checklist at
the end, for the next session at the kiosk.

Each `WP-*.md` file is a **brief**: a self-contained prompt one agent
session executes from a fresh clone with no other context. Hand a brief
to a new session as the whole prompt. Briefs cite the existing plans
(`docs/plans/beta-launch/`, `docs/plans/node-runtime-upgrade/BRIEF.md`,
`docs/plans/theme-system/`) rather than restating them; where this
folder and an older plan disagree, the dated decision here wins and the
brief says so.

> `docs/` is public and ships to every kiosk. Generic placeholders only:
> no hostnames, IPs, real names, home paths, prices, vendors or other
> business details. Business material lives in private planning records.

Written 2026-11-23 with the founder, from a read of `main` at `0640de6`
(PR 45), not from memory.

## Resume point, 2026-11-28

For the next session, read this block, then the brief it names.

**Merged this week, all on `main`:** WP-01 (#54, plus CrucibleWebsite's
draft), WP-02 (#51), WP-03 PR A (#49) and PR B (#60), WP-04 (#48 and
its one-PR-each siblings), WP-05 (#50, #57), WP-06 PR A (#63) and PR B
(#64), WP-07 PR A (#67), Winter Holiday with the founder's imagery and
20 % see-through surfaces (#55), Spooky the same way (#70), and the docs
follow-ups (#65, #66, #68, #69). The `pr-assets/*` screenshot branches
and the session worktrees are deleted.

**Not released.** The kiosk is on v1.8.0. Everything above ships in
v1.9.0, which the founder cuts at the kiosk (decision 1); the kiosk
checks for it are in the founder checklist below.

**Next brief:** [WP-08, the theme authoring guide and community
install](WP-08-theme-authoring-guide-community-install.md), written
2026-11-28. PR A (the guide) runs unattended; PR B (folder-drop install)
waits on four founder answers that PR A's report asks for. Kickoff:

> Execute `docs/briefs/2026-11-23-remote-work/WP-08-theme-authoring-guide-community-install.md` against `main`. Read its README first.

**Open founder items, remote:** the four WP-08 questions (after PR A);
CrucibleWebsite's feedback change-history row; awesome-rootboard's
pending PR; the `bufferutil` removal proposal from WP-04 (e). The two
orphaned `node` dev-server processes on the laptop (ports 5000 and 5001)
are not project state; end them before the next `npm run dev`.

**Current theme state:** `docs/plans/theme-system/STATUS-2026-11.md`,
"Where things stand, 2026-11-28".

Facts verified on 2026-11-23:

| Fact | Value |
|---|---|
| `main` head | `0640de6` (#45). No open PRs. |
| Released and on the kiosk | v1.8.0 (2026-11-21). The kiosk still authenticates with the service account; Google sign-in has never run on hardware. |
| Beta briefs merged | pre-beta cleanup, 01, 02 (flow B), 03 session 1, 05, 08. Not started: 03 session 2, 04, 06, 07, 09. |
| Feedback service | live at `feedback.cruciblecreations.net` (2026-11-23); React client on crucible-feedback `main` (PR 12); `/add-feedback` skill in Crucible-HQ (PR 62); `rootboard` row present in its product table. |
| Node | install guide and CI say Node 20; `better-sqlite3` locked at 12.4.6; no `engines` field; the laptop runs Node 24 with npm 11. |
| Theme engine | v1.6.0: Default and Deep Space, colours only; the confetti burst already reads the theme's tokens at runtime (the spec's "Out of scope" line saying otherwise is stale). |
| Tests | vitest, `environment: "node"`; no DOM test environment, no component tests. Five file-mode tests fail on Windows until WP-04 (b). |
| Companion repos | awesome-rootboard still says there is no theme system and does not list What to Wear. |

## What should be true by the end of the week (founder, 2026-11-23)

1. In-product feedback is in the product (brief 04, now unblocked).
2. The setup wizard's Google step is finished (brief 03 session 2).
3. The beta unit's hardware is ordered (founder; checklist below).

Plus, with the spare unattended capacity: the move to Node 24, the small
fixes queued in `TASKS.md`, and a run at the theme system (audit, Winter
Holiday, confetti colours) so a theme release can be tested on the kiosk
the week after.

## Decisions made 2026-11-23 (founder, in the brief-writing session)

Settled. A brief cites them; an executing agent does not reopen them.

1. **Merge only, no release this week.** Every brief ends at a pull
   request. The release that carries this work (v1.9.0, stable) is cut by
   the founder at home per `docs/RELEASING.md`, so the install is watched
   on the kiosk and the queued kiosk checks run in the same sitting.
2. **Every brief runs to a PR and stops.** Nothing is shown or approved
   mid-run. Safe-zone PRs merge under PR-POLICY as usual: `main` has
   branch protection with the three required checks, so the agent arms
   GitHub auto-merge (`/pr` rule 3) and the PR lands when every check is
   green, unless a brief says the founder looks first; `principle-flag`
   and `needs-founder` PRs wait for the founder's `founder-approved`
   label.
3. **Node 24 for every kiosk, no Node 20 path.** New kiosks install
   Node 24; `package.json` states the real floor (`engines`); the
   reference kiosk, the only Node 20 unit in existence, is wiped and
   reinstalled from scratch by the founder, which doubles as the first
   test of a clean install; the beta unit ships on 24. The Node brief's
   step 3 (an updater guard for Node 20 kiosks) is **not built**: a
   kiosk left on Node 20 would fail the install and roll back under
   today's updater, with no friendlier message, and no such kiosk will
   exist. That is a principle-4 call the founder made today; WP-03
   records it in a decision record.
4. **Theme run this week = audit, then Winter Holiday as a colour-only
   manifest, then the confetti follow-through: the burst already reads
   the theme tokens, so it gains a warning on fallback, a test, and the
   stale docs are corrected.** Fonts, imagery, shape tokens, Spooky, the
   authoring guide and community install stay later slices.
   *(2026-11-24: the colour-only scope and the deferral of fonts, imagery
   and shape tokens are superseded by decision 9. 2026-11-28: Spooky
   shipped to `main` as #70; the authoring guide and community install
   are WP-08.)*
5. **Beta hardware: one unit built like the reference kiosk (Pi 5),
   one microSD.** The reference kiosk is what the install docs were
   written from. Brief 09's two-card rule (one ships, one stays as a
   known-good spare) is relaxed to "rebuildable from the provision
   script" and confirmed when 09 runs. The parts list, vendor and cost
   live in private planning records.
6. **The small fixes all go in**, one PR each (WP-04), including the
   companion-repo list entry that needs push access to awesome-rootboard.
7. **Model: every brief runs on Opus 5.5** (the agent's default, taken
   from the Pitcher Notes set and shown to the founder with the drafts),
   unless the founder says otherwise when he hands a brief out.
8. **The wizard keeps a self-hoster path (2026-11-24).** The Google
   step gets a **Set up manually (self-hosting)** button that opens a
   warning dialog (significant manual setup, where the instructions are,
   leaving the wizard) with Back to setup / Continue with manual setup.
   Continue leaves the wizard and opens the service-account steps.
   WP-02 builds it.
9. **Themes need imagery before they ship (2026-11-24, supersedes the
   "colour-only" part of decision 4).** The founder looked at Winter
   Holiday (#55) in the dev server: it reads as a palette change, not a
   theme. #55 is held until it carries imagery. The theme work this week
   grows to the full launch set from `THEME-SYSTEM-PLAN.md`: image slots
   (main background, header banner, sidebar, screensaver, logo, each a
   separate optional asset), confetti shapes, fonts, and shape tokens.
   The founder generates the Winter Holiday images; the agent builds the
   contract and render paths. WP-06 is that brief.
10. **One continuous background, and text backing in the contract
    (2026-11-27).** With the three WP-06 slots filled, the seams between
    the background, header and sidebar images read as disjointed. The
    `background` slot now paints the whole viewer (rail and header
    included); `header` and `sidebar` stay as optional overlays for
    authors who want distinct art there; and the backing behind text over
    the picture (header bar, nav rail, Dinner's vote strip) becomes a
    theme choice: none, solid with alpha, or a gradient. The founder
    regenerates the Winter Holiday image at full screen. WP-07 is that
    brief; WP-06's PR C is superseded by WP-07's PR B.

## Order

| ID | Brief | Waits on | PR tier | Unattended run |
|---|---|---|---|---|
| **WP-01** | [In-product feedback (brief 04) with `/add-feedback`](WP-01-in-product-feedback.md) | nothing | `principle-flag` (privacy), plus one `needs-founder` draft PR in CrucibleWebsite | 2–3 h |
| **WP-02** | [The wizard's Google step (brief 03 session 2)](WP-02-wizard-google-step.md) | nothing; rebase on WP-01 if it merged first (both touch `docs/SPEC.md`) | safe zone expected | 1–2 h |
| **WP-03** | [Node 24: decision record, docs, CI, floor, lock](WP-03-node-24.md) | nothing | PR A `principle-flag` (principle 4, founder-ratified today); PR B safe zone | 2–3 h |
| **WP-04** | [Small fixes from TASKS.md, one PR each](WP-04-small-fixes.md) | nothing; merge after WP-03 PR A if both touch `INSTALLATION.md` | safe zone, each | 2–4 h |
| **WP-05** | [Theme system: audit, Winter Holiday, confetti colours](WP-05-theme-audit-winter-holiday-confetti.md) | nothing | safe zone; the Winter Holiday PR waits for the founder's look in the dev server | 3–5 h |
| **WP-06** | [Theme system: imagery, confetti shapes, fonts, shape tokens](WP-06-theme-imagery.md) (added 2026-11-24, decision 9) | WP-05 merged (#50, #57); its PR C waits for the founder's image files | safe zone for PR A and PR B; PR C lands on the held #55 and waits for the founder's look | 7–11 h |
| **WP-07** | [Theme system: one continuous background, text backing](WP-07-continuous-background-text-backing.md) (added 2026-11-27, decision 10) | WP-06 PR A and PR B merged (#63, #64); its PR B waits for the founder's full-screen image | safe zone for PR A; PR B lands on the held #55 and waits for the founder's look | 4–7 h |
| **WP-08** | [Theme system: the authoring guide, and community install (plan Phase 2)](WP-08-theme-authoring-guide-community-install.md) (added 2026-11-28) | WP-05 to WP-07 and #55, #70 merged (all are); PR B waits on four founder answers asked in PR A's report | safe zone for PR A (docs); safe zone expected for PR B, the review decides | PR A 2–3 h; PR B 4–6 h |

WP-01 to WP-05 are independent and may run in parallel sessions; WP-06
follows WP-05 (its PRs #50 and #57 are in `main`). Several edit
`docs/SPEC.md` and `TASKS.md`: merge PRs one at a time, and the next
branch merges `main` in (never a rebase of a pushed branch) and re-runs
its checks before review, as `docs/plans/beta-launch/README.md` says.

## Build approvals

None needed. No brief here builds a release, publishes a tag, flashes a
card, sends a live feedback row to production, or spends money. Nothing
calls a paid service.

## How each package relates to the existing plans

| Package | Existing plan | Relationship |
|---|---|---|
| WP-01 | `docs/plans/beta-launch/04-in-product-feedback.md` | Executes brief 04 as written, through the `/add-feedback` skill; its decisions table stands. The two `TASKS.md` lines brief 04 names close when the founder merges its PR. |
| WP-02 | `docs/plans/beta-launch/03-first-run-wizard.md`, `02-google-sign-in-oauth.md` | Executes 03 session 2: decision 7 (embed brief 02's connect panel). Closes beta sub-item 03. |
| WP-03 | `docs/plans/node-runtime-upgrade/BRIEF.md` | Answers its four founder decisions (section 4) and runs steps 2 and 5; step 3 is dropped by decision 3 above; steps 1, 4 and 6 are founder checklist items. |
| WP-04 | `TASKS.md` open items; brief 05 and brief 06 follow-ups | Small items that would otherwise ride along with a Pi-dependent brief. |
| WP-05 | `docs/plans/theme-system/THEME-ENGINE-SPEC.md` ("Out of scope: later slices"), `THEME-SYSTEM-PLAN.md` | Two of the later slices (one more built-in theme; confetti colours), after an audit that records what the engine does today. |
| WP-06, WP-07 | `THEME-ENGINE-SPEC.md` later slices, `THEME-SYSTEM-PLAN.md` launch set | The rest of the launch set (fonts, shape, images, confetti shapes; then the continuous background and text backing), as manifest v2 and v3 (decisions 0026, 0027). |
| WP-08 | `THEME-SYSTEM-PLAN.md` Phase 2 and the 2026-09-22 authoring-guide requirement (TASKS.md) | The last two theme items: the guide, and folder-drop install after the widget precedent (decision 0006). Zip upload and paste-a-URL stay founder questions. |

## Standing rules for every brief here

- **Read before writing:** `CLAUDE.md`, `CODING-STANDARDS.md`,
  `docs/SPEC.md`, the brief's own "Read first" list. The security review
  in `CLAUDE.md` runs before every push and is reported in the PR.
- **Founder decisions, not agent calls:** money, published privacy or
  legal text, removing or degrading shipped behaviour, anything that
  deletes data. A brief that reaches one stops and reports.
- **Governance:** every PR runs `/crucible-code-standards-review`
  against `main`, then `/pr` (`Crucible-HQ/PR-POLICY.md`). Never a lower
  tier than the review reported. Safe-zone PRs: arm GitHub auto-merge
  (`/pr` rule 3; `main` is protected with three required checks) and
  let the checks land it; never merge on "no checks reported".
- **The three checks:** `npm run check`, `npm test`, `npm run lint`, all
  green before a PR opens. On a Windows laptop five tests in
  `server/google-oauth.spec.ts` fail on file mode until WP-04 (b)
  merges; say so in the PR rather than skipping them.
- **Windows laptop notes:** Node 24 and npm 11 are installed, which the
  lockfile needs (`CLAUDE.md`). Working copies are CRLF; shell scripts
  must stay LF (`.gitattributes`). Long bash heredocs fail here: write
  multi-line files with the editor tool. Run anything likely to exceed
  two minutes in the background.
- **No kiosk, so no kiosk check.** Where an older brief's acceptance
  list says "on the kiosk", the brief here says what is checked in
  `npm run dev` instead and adds the kiosk line to the founder checklist
  below, not to the PR as done.
- **A brief that reaches a founder wait ends there.** When a later PR
  in a brief cannot open until the founder labels or looks at an
  earlier one, the session stops at the open PR, says in its report
  which step the rest resumes from, and a fresh session picks the
  same brief up at that step once the founder has acted.
- **Reporting:** every brief ends with *Done (PR numbers) / Not done and
  why / Findings worth a task / Founder actions*, and ticks or adds the
  matching `TASKS.md` lines.

## Founder checklist

Things only the founder does. Nothing here is an agent's.

**Remote, before the kiosk session**

- [ ] Order the beta unit's hardware: one unit built like the reference
  kiosk, one microSD, nothing spare (decision 5). The parts list, vendor,
  cost, receipt and the spend-register row are in private planning
  records, never here.
- [ ] Label `founder-approved` (or not) on WP-01's Rootboard PR and
  WP-03's PR A once their tier checks are otherwise green.
- [ ] Approve the wording of the feedback change-history row in the
  CrucibleWebsite draft PR from WP-01 (published legal text). It must be
  live before v1.9.0 ships.
- [x] Look at Winter Holiday in `npm run dev` on the laptop (Settings →
  Theme) before WP-05's second PR merges; say yes, or what to change.
  (2026-11-24: looked; held until it carries imagery, decision 9.)
- [x] Generate the Winter Holiday images with an image generator using
  the slot table in WP-06 (main background, header banner, sidebar,
  screensaver, logo) and hand them to the WP-06 session for PR C.
  (2026-11-27: three made and tried; the seams between them led to
  decision 10.)
- [x] Generate **one** full-screen Winter Holiday image (16:9, shown at
  1920 × 1080, calm top band and left column for the title and nav
  icons) per WP-07, plus the screensaver and logo, and hand them to the
  WP-07 session for its PR B. (2026-11-27: done; on #55.)
- [x] Pick opaque or translucent surfaces from WP-06's two screenshot
  sets, then look at #55 again with the imagery in `npm run dev`.
  (2026-11-27: 20 % see-through, after live renders at 10, 15, 20 and
  30 %; #55 merged that day. 2026-11-28: Spooky built the same way from
  three new images and merged as #70.)
- [ ] Answer WP-08's four questions (install path, where the guide
  lives, a `rootboard-theme-template` repo, the dropped-folder format)
  once its PR A report asks them.
- [ ] Read WP-04 (e)'s `bufferutil` removal PR, the proposal the TASKS.md
  line asked for, and merge it or decline.

**Next session at the kiosk (in this order)**

- [ ] Read the kiosk's Node version from Settings → System →
  Diagnostics and write it into `docs/plans/node-runtime-upgrade/BRIEF.md`
  section 2 (step 1 of that brief), for the record, before wiping.
- [ ] Switch the kiosk to Google sign-in and run the #38 checks
  (`TASKS.md`, "Before any beta unit is handed out"). Do this **before**
  the wipe if you want the service-account kiosk's behaviour on record,
  otherwise it is covered by the fresh install below.
- [ ] Wipe the reference kiosk and reinstall from scratch following
  `INSTALLATION.md` as WP-03 rewrote it (Node 24). This is the first
  clean-install test; every step the guide gets wrong is a task. Chores,
  dinner and settings start empty by design (decision 3); the calendar
  re-syncs from Google.
- [ ] Cut **v1.9.0** per `docs/RELEASING.md` (stable; the kiosk is on
  v1.8.0): version bump PR, `npm audit` into the standing item, pre-push
  review, privacy gate (the feedback row must be live), tag, publish.
  Watch the kiosk install it.
- [ ] Run the kiosk checks queued in `TASKS.md`: #32 (pairing,
  diagnostics, self-heal count, supervisor), #28 and the beta-channel
  prerelease steps in `docs/RELEASING.md`, #35 (wizard, Wi-Fi, time zone,
  router-off boot), #38 (sign-in, restart, refresh, revoke), brief 01's
  weather location, and now WP-01 (send one `TEST`-prefixed feedback
  item from the kiosk and confirm the ticket code), WP-02 (the wizard's
  Google step on hardware), WP-04 (c) (the disk row), WP-05 to WP-07 and #70
  (Winter Holiday and Spooky with imagery on the 21.5-inch screen, the
  faded header and rail and the 20 % see-through cards readable from
  across the room; each theme's screensaver under the power-saving dim;
  shaped confetti in the theme's colours stays smooth; CPU and memory in
  Diagnostics before and after a theme switch; `window.devicePixelRatio` in the
  kiosk Firefox is 1, which WP-06's image supply sizes assume).
- [ ] Brief 00 §3.1 device-flow test (optional, 15 minutes) and the §3.2
  verification recording, which needs the sign-in on screen.

**Still needs a Pi, not this week**

- Beta briefs 06 (agent-facing setup, provision script), 07 (widget
  developer loop) and 09 (golden image, card, rehearsal), in that order.
- The Wi-Fi password-file test for the wizard (`TASKS.md`, "Before brief
  09 builds the tester's card").
- Refreshing `networkService.fixtures.ts` from the real kiosk's `nmcli`
  output.
- Node brief step 6's follow-ups (Vite 8, ESLint 10) as their own
  releases after v1.9.0 is on the kiosk.
- The Firefox cache cap applied on the kiosk (WP-04 (d) writes the
  docs; the kiosk gets it at the reinstall).

## Kickoff prompts

Each prompt is the whole first message of a fresh session, run from a
fresh clone of `main`.

- **WP-01:** "Execute `docs/briefs/2026-11-23-remote-work/WP-01-in-product-feedback.md` against `main`. Read its README first."
- **WP-02:** "Execute `docs/briefs/2026-11-23-remote-work/WP-02-wizard-google-step.md` against `main`. Read its README first."
- **WP-03:** "Execute `docs/briefs/2026-11-23-remote-work/WP-03-node-24.md` against `main`. Read its README first."
- **WP-04:** "Execute `docs/briefs/2026-11-23-remote-work/WP-04-small-fixes.md` against `main`. Read its README first."
- **WP-05:** "Execute `docs/briefs/2026-11-23-remote-work/WP-05-theme-audit-winter-holiday-confetti.md` against `main`. Read its README first."
- **WP-06:** "Execute `docs/briefs/2026-11-23-remote-work/WP-06-theme-imagery.md` against `main`. Read its README first."
- **WP-07:** "Execute `docs/briefs/2026-11-23-remote-work/WP-07-continuous-background-text-backing.md` against `main`. Read its README first."
