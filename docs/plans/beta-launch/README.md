# Beta launch — single external tester

**Status:** Planning complete 2026-11-08; briefs ready to execute one per session.
Re-checked 2026-11-14: dependencies loosened so most briefs can run
before brief 00's founder work, backlog items folded into the briefs
that touch the same code, brief 04 aligned with the feedback contract,
and decision numbers reserved (see "Running briefs in parallel").
**Goal:** Put one Rootboard unit in the hands of a first external beta tester
by mid-December 2026, with a pre-flashed card, a finger-only first-run
setup, Google Calendar access that the developer can never see, an
in-product feedback channel, and a setup path that the tester's own AI
agent can follow for anything beyond the wizard.
**Tracked in:** `TASKS.md` (one open item per brief).

> `docs/` is public and ships to every kiosk. These briefs use generic
> placeholders only — no hostnames, IPs, real names, or business details.
> Anything about pricing, logistics or the tester's identity lives in
> private planning records, not here.

---

## Why this plan exists

The 2026-11-07/08 planning sessions reviewed the as-built state against
the question "could someone else set this up and use it without us?" and
found these gaps:

| Area | Finding | Brief |
|---|---|---|
| Google access | The service-account design means the developer's project owns the identity that reads the tester's calendars. Unacceptable for anyone outside the household. Phones solve this with OAuth: tokens live on the device, the developer only registers the app. | 00, 02 |
| First run | No way to join Wi-Fi, pick a time zone, or set a weather location from the touchscreen. Everything is an `.env` edit over SSH. | 01, 03 |
| Feedback | Nothing in the client. The flow is specified in `TASKS.md` and blocked on the Crucible feedback service. | 04 |
| Troubleshooting | Every fix in `INSTALLATION.md` is a terminal command. No on-screen diagnostics, no machine-readable state an agent could read. | 05, 06 |
| Local network exposure | The server listens on every interface and only update/rollback are localhost-only; any device on the tester's Wi-Fi can edit events and config. | 05 |
| Widgets | Contract and tutorial are solid; getting a folder onto the Pi and seeing a widget's errors are not. | 07 |
| Updates | One release channel. A fix cannot be tested on the reference kiosk before it reaches the tester, or the other way round. | 08 |
| Shipping | No checklist for a factory-fresh image; `INSTALLATION.md` step 10 still describes Chromium while the kiosk runs Firefox. | 06, 09 |

## Principles for every brief

1. **Nothing shipped is removed.** The service-account path stays as the
   documented advanced/self-hoster option. Principle 4.
2. **The developer never holds a credential to the tester's data.**
   Tokens, keys and Wi-Fi passwords live only on the unit. Principle 1.
3. **Finger-only happy path.** Everything a new owner must do is possible
   on the touchscreen with the on-screen keyboard. SSH and agents are for
   the long tail, not for day one.
4. **Agent-readable long tail.** Anything beyond the wizard is written as
   idempotent scripts and machine-readable endpoints first, prose second.
5. **Every network call is user-initiated or disclosed.** Feedback,
   diagnostics and sign-in all happen on a tap; privacy text is updated in
   the same PR that adds the call.
6. **One brief, one session, one PR.** Each brief lists its acceptance
   criteria, the kiosk verification, and the docs it must update
   (`docs/SPEC.md`, `INSTALLATION.md`, a decision record). Do not start a
   brief whose dependency is unmerged.

## Execution order and dependencies

Only brief 02 truly waits on brief 00, and only on its first half hour
(§3.0: a consent screen in Testing and a Desktop OAuth client). The
spike and the verification submission decide an extra sign-in path and
how soon the tester stops seeing Google's "unverified app" screen; they
do not decide whether 02 can be built.

```
Runs now, no founder work needed:
  C   Pre-beta cleanup: audit fixes, unused packages, ESLint, two bugs
  05  Diagnostics + LAN pairing + Settings in every auth state
  08  Beta update channel
  03  session 1: wizard shell, Wi-Fi, time zone, weather
After 05:                        06  Agent-facing setup
After 05 and 06:                 07  Widget developer loop
After 00 §3.0 (founder):         02  Google sign-in (flow B; flow A if 00 §3.1 allows)
After 02 and 03 session 1:       03  session 2: the Google step
After 05, the feedback service and its shared React client:      04
After 02, 03, 05, 06, 07, 08 released, 00 §3.2 step 3 (and 04 if live):  09
```

| Brief | Before brief 00? | Waits on | Needs hardware or the founder |
|---|---|---|---|
| C (cleanup) | yes; merge its linter PR early | nothing | push access to awesome-rootboard for one list entry |
| 00 | — | nothing | founder, in Google Cloud and Search Console |
| 01 | done | — | kiosk check after the next release |
| 02 | no: needs 00 §3.0 (≈30 min) | 00 §3.0 | kiosk check after merge |
| 03 | session 1 yes, session 2 no | s1: nothing; s2: 02 | a Pi with NetworkManager for the system steps |
| 04 | no: blocked outside this repo | the feedback service and its React client; 05 | kiosk check |
| 05 | yes | nothing | a laptop on the kiosk's network for the pairing check |
| 06 | yes, after 05 | 05 | a spare Pi or card; the reference kiosk's launch files |
| 07 | yes, after 05 and 06 | 05, 06 | a USB stick; push access to the three companion repos |
| 08 | yes | nothing | the founder publishes one test prerelease |
| 09 | no | 02, 03, 05, 06, 07, 08 released; 00 §3.2 step 3; 04 if live | two cards, a second network |

00 and 04's external dependency should still be started on day one,
because they wait on other parties.

### Founder inputs, in the order they unblock work

1. Brief 00 §3.0: consent screen in Testing and a Desktop OAuth client.
   Unblocks 02.
2. Brief 00 §3.1–3.3: the device-flow test and the verification
   submission. The recording needs brief 02's sign-in on screen, so
   only the branding and Search Console domain checks can start before
   02; §3.2 step 3 (In production) must be done before 09.
3. The feedback service going live (private planning records). Unblocks 04.
4. For 06: a spare Pi or SD card, and copies of the reference kiosk's
   launch script and labwc autostart file with the username and hostname
   removed.
5. For 08: publishing one test prerelease on GitHub.
6. Before 09: the three "none yet" entries in `CLAUDE.md` → "Pull
   requests and merging" (what done means, project hard stops, mandatory
   verifications). They start to matter when the first unit leaves the
   house.

### Running briefs in parallel

Several briefs edit the same files (`settings-menu.tsx`, `docs/SPEC.md`
§2.2, `INSTALLATION.md`, `TASKS.md`). Parallel sessions are fine, but
merge their PRs one at a time: the next branch merges `main` in (never a
rebase of a pushed branch) and re-runs its checks before review. Where
two briefs each add a piece to the same script, whichever merges second
wires its piece in, and each brief says so: the polkit rule (03) and
`--channel` (08) both go into 06's `scripts/provision.sh`.

**Decision numbers are reserved** so parallel briefs never collide:
0017 (00 and 02), 0018 (03), 0019 (04), 0020 (05), 0021 (06), 0022
(08), 0023 (09). 0015 and 0016 went to the weather location and the
bundled fonts on 2026-11-11; any other work takes 0024 onward.

## How to run a brief

Open a fresh session, point it at the brief, and ask it to execute the
brief against `main`. Each brief is written so that the implementing
agent needs nothing from the planning conversation. The agent must:

- read `CLAUDE.md`, `CODING-STANDARDS.md`, `docs/SPEC.md` and the brief
  before touching code;
- keep to the brief's scope; anything that conflicts with a locked
  decision is raised, not resolved unilaterally;
- run the pre-push security review in `CLAUDE.md` and report it;
- update the brief's **Status** line, and check off in `TASKS.md` the
  beta sub-item plus every item the brief's **Closes** line names.

## Briefs

- [Pre-beta cleanup — dependencies, a real linter, two small bugs](pre-beta-cleanup.md) (added 2026-11-14; not numbered because it is not a beta feature)
- [00 — Google device-flow spike and OAuth verification](00-google-device-flow-spike-and-verification.md)
- [01 — Weather location as a config setting](01-weather-location-setting.md)
- [02 — Google sign-in with OAuth](02-google-sign-in-oauth.md)
- [03 — First-run setup wizard](03-first-run-wizard.md)
- [04 — In-product feedback](04-in-product-feedback.md)
- [05 — Diagnostics and local-network API pairing](05-diagnostics-and-local-api-pairing.md)
- [06 — Agent-facing setup](06-agent-facing-setup.md)
- [07 — Widget developer loop](07-widget-developer-loop.md)
- [08 — Beta update channel](08-beta-update-channel.md)
- [09 — Golden image and ship checklist](09-golden-image-and-ship-checklist.md)
