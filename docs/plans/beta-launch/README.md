# Beta launch — single external tester

**Status:** Planning complete 2026-11-08; briefs ready to execute one per session.
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
| Shipping | No checklist for a factory-fresh image; `INSTALLATION.md` step 10 still describes Chromium while the kiosk runs Firefox. | 09 |

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

```
00 Google device-flow spike + verification submission   (founder actions, no code)
 │
01 Weather location becomes a config setting            (small; unblocks 03)
 │
02 Google sign-in with OAuth (tokens on the unit)       (depends on 00's answer)
 │
03 First-run wizard: Wi-Fi, time zone, Google, weather  (depends on 01, 02)
 │
04 In-product feedback client                           (blocked on the feedback service being live)
 │
05 Diagnostics + local-network API pairing              (feeds 04's attachment and 06's agent surface)
 │
06 Agent-facing setup: AGENTS.md, provision script, discovery
 │
07 Widget developer loop: install paths and visible errors
 │
08 Beta update channel
 │
09 Golden image, recipient card, install-guide fixes, dress rehearsal
```

00 and 04's external dependency should be started on day one because
they wait on other parties. 01 → 03 is the critical code path; 05–08 can
interleave with it.

## How to run a brief

Open a fresh session, point it at the brief, and ask it to execute the
brief against `main`. Each brief is written so that the implementing
agent needs nothing from the planning conversation. The agent must:

- read `CLAUDE.md`, `docs/SPEC.md` and the brief before touching code;
- keep to the brief's scope; anything that conflicts with a locked
  decision is raised, not resolved unilaterally;
- run the pre-push security review in `CLAUDE.md` and report it;
- update the brief's **Status** line and the matching `TASKS.md` item.

## Briefs

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
