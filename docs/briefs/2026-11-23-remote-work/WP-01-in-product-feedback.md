# WP-01 — In-product feedback (beta brief 04), through `/add-feedback`

| | |
|---|---|
| **Repo** | `SchrodingerEQ/Rootboard.me` (one PR), then `SchrodingerEQ/CrucibleWebsite` (one **draft** PR) |
| **Base** | latest `main`, fresh clone, `npm ci` (npm 11) |
| **Waits on** | nothing. The Crucible feedback service is live (2026-11-23), the shared React client is on crucible-feedback `main` (PR 12), and the `/add-feedback` skill exists in Crucible-HQ (`claude-config/skills/add-feedback/`, PR 62). |
| **Unblocks** | the beta itself (brief 04 §"Unblocks"); v1.9.0 |
| **Network / secrets** | a shallow clone of `github.com/SchrodingerEQ/crucible-feedback`, its `npm install`, and its local Worker (`npm run dev`, wrangler, local D1) for the skill's proof. **No live send** to production from this brief (decision below). Nothing in the client is secret; the repo is public. |
| **Model** | per the README |
| **Deliverable** | one Rootboard PR, tier **`principle-flag`**, never merged by the agent; one CrucibleWebsite draft PR, tier **`needs-founder`**; the end-of-run report |
| **Done when** | the Rootboard PR is open with the Review-step screenshot, the six steps proven against the local Worker, and the CrucibleWebsite draft linked; both wait for the founder |
| **Unattended run** | 2–3 hours |

## Goal

From the Settings popover, in every auth state, the owner taps **Send
feedback**, picks great / broken / idea, types on the on-screen keyboard,
sees exactly what will be sent, taps Send, and gets a ticket code. Nothing
is sent without that tap; a draft survives a reload and is never sent in
the background. This is `docs/plans/beta-launch/04-in-product-feedback.md`
as written on 2026-11-14; its nine locked decisions stand. The
`/add-feedback` skill is the method; this brief adds only what the skill
leaves to the product and what is specific to this week.

## Decisions already made (don't reopen)

| Decision | Answer | Where |
|---|---|---|
| Flow, payload, context, no proxy, no outbox | brief 04 §2, decisions 1–9 | `docs/plans/beta-launch/04-in-product-feedback.md` |
| Entry point | Settings popover, the spot the owner reaches fastest; visible signed out | brief 04 decision 1; HQ feedback contract §2 note (2026-11-23) |
| Context keys | `widgets` (enabled widgets as `name@version` strings) and `theme`; keys never contain `id`, `name`, `user`, `device`, `token` | brief 04 decision 3; `/add-feedback` `PRODUCTS.md` row `rootboard` |
| Contact box | on, optional, never pre-filled | `PRODUCTS.md` row |
| Origin, Turnstile | `http://localhost:5000` allow-listed; no Turnstile | `PRODUCTS.md` row |
| No live send this week | the proof of a real row needs the founder (a test row lands in production); he sends one `TEST`-prefixed item from the kiosk on his first day back | README founder checklist (2026-11-23) |
| Privacy row on cruciblecreations.net | live before v1.9.0; founder approves the wording | README founder checklist; HQ TASKS.md ## ops |

## Read first

1. `docs/plans/beta-launch/04-in-product-feedback.md`, all of it.
2. `Crucible-HQ/claude-config/skills/add-feedback/SKILL.md` and
   `PRODUCTS.md` (the `rootboard` row). Crucible-HQ is the private repo
   `github.com/SchrodingerEQ/Crucible-HQ`; use the local clone the
   machine already has and `git pull` there first. If `/add-feedback` is
   not offered as a skill, read `SKILL.md` and follow it by hand.
3. `Crucible-HQ/departments/pm/feedback-contract.md` §2, §3, §5.3–5.4, §8.
4. In the fresh crucible-feedback clone: `clients/README.md`,
   `clients/core/README.md`, `clients/react/README.md`.
5. Here: `CLAUDE.md`, `CODING-STANDARDS.md`, `docs/SPEC.md` §3.3 (OSK,
   `data-osk-open`), §3.7 (Settings), §3.8 (touch targets),
   `client/src/components/calendar/settings-menu.tsx`,
   `client/src/components/keyboard/on-screen-keyboard.tsx`,
   `shared/version.ts`, `shared/dashboard-config.ts`, the `GET
   /api/widgets` route for manifests and versions.

## Steps

1. **Run `/add-feedback` for `rootboard`.** Follow the skill as written:
   identify the product against the live registry in the clone, copy
   `feedback-client.js`, `feedback-dialog.js` and the optional CSS from
   the fresh clone (record the SHA), wire the Settings entry, build the
   client once with product `rootboard`, version from `shared/version.ts`,
   platform `kiosk`, os, locale, and a `context()` per brief 04
   decision 3. Where the skill and brief 04 disagree, the HQ contract
   wins, then the skill, then brief 04; note each difference in the PR.
   One known clash, settled here: brief 04 decision 3 hardcodes `os:
   "Raspberry Pi OS"`, the skill takes `os` from the runtime. **Follow
   the skill** (the dev server runs on a laptop; a hardcoded value would
   lie there). **The skill's local-Worker walk (its step 9.2) is
   required**, not optional: `npm install` and `npm run dev` in the
   crucible-feedback clone, the six steps proven against the local
   Worker, no row to production. The dev server here listens on port
   5000, which is exactly the production-allow-listed origin, so **never
   tap Send while the laptop is online and the client points at
   production**; point it at the local Worker for the walk.
2. **Rootboard specifics.** The dialog uses Rootboard's touch keyboard:
   OSK-lifted through `data-osk-open` (SPEC §3.3), theme tokens only,
   touch targets of 48 px or more. `client/src/lib/feedback-context.ts`
   builds `context` from the dashboard config, widget manifests and the
   active theme, unit-tested against the identifier-key rule and the
   2 KB cap (brief 04 §4: a widget named `user-notes` still passes,
   because names are values). The service base URL in one constant,
   `shared/feedback-endpoint.ts`. A small marker in Settings when a draft
   is waiting. The row is reachable signed out of Google.
3. **Tests (brief 04 §4):** the Review step lists every field on the wire
   (a test diffs the built body against the rendered list; `ticket` is
   the only field filled after the tap); the draft survives a reload with
   the connection off; nothing is sent until Send is tapped again.
4. **Docs:** `docs/SPEC.md` §3.7 and a new §3.12 "Feedback"; the privacy
   sentence in the app and `README.md` ("Feedback you choose to send goes
   to the Crucible feedback service. It contains what the review screen
   shows and nothing else."); `docs/decisions/0019-in-product-feedback.md`
   (number reserved for brief 04): why the shared client rather than a
   server proxy, the 2026-11-14 alignment, and today's no-live-send
   rule. Update brief 04's **Status** line.
5. **Tracker lines:** `TASKS.md` beta sub-item 04 and "Add in-product
   feedback": append "PR #<n> (WP-01), waits on the founder's label";
   do not tick them. The beta sub-item closes when the founder merges.
6. **The Rootboard PR.** `/crucible-code-standards-review` against
   `main`, then `/pr`. Tier **`principle-flag`**: principle 1 (a new
   user-initiated network destination, disclosed in the app and the
   README) and principle 6 (no prompts, no nags). **The agent never
   merges it.** The body says what the founder checks: the Review step
   shows every field; the Settings copy; the context keys.
7. **The CrucibleWebsite draft PR.** In a fresh clone of
   `SchrodingerEQ/CrucibleWebsite`, `public/privacy.html` has a change
   history. Add one row in substance: "<date>: Added in-product feedback
   to Rootboard. What's sent is shown before sending; the message and
   the optional contact you type are the only personal data; raw
   feedback is deleted after six months" (the six months is the HQ
   feedback contract §8; cite it in the PR body). If Pitcher Notes' row from its
   WP-17 is already there, match its wording and add Rootboard to it or
   beside it, whichever the file's format suggests. Leave the date as a
   placeholder for the founder. Tier **`needs-founder`**. Don't merge.
   Link it from the Rootboard PR body.

## Verification without hardware

- `npm run check`, `npm test`, `npm run lint` green (the five known
  Windows file-mode failures in `server/google-oauth.spec.ts` are stated
  in the PR if WP-04 (b) has not merged).
- `npm run dev` on the laptop: Settings → Send feedback through kind →
  message → review; screenshot the Review step for the PR (that is what
  the founder approves). With the network off (DevTools offline), Send
  shows the needs-a-connection message and the draft survives a reload.
  A real send from the dev server is **not** attempted: production rows
  are the founder's.
- Signed out of Google in dev (no `service-account.json`, no token file):
  the row is still reachable.

## If blocked

- The `rootboard` row differs between `PRODUCTS.md` and the clone's
  `worker/products.ts`: the clone wins; note it under Findings.
- The copied client's copy or behaviour is wrong for a kiosk: the change
  goes to crucible-feedback first (skill rule); report it, don't edit the
  copied file.
- The skill stops on an open gate for Rootboard: there is none on
  record; if it finds one, stop and report.

## Report (end of run)

**Done (Rootboard PR number, CrucibleWebsite draft number) / Not done and
why / What the founder checks before merging / What the kiosk must prove
on the first day back (the live TEST send, the ticket code, the OSK flow
on the touchscreen) / Anything the shared client needs changed in
crucible-feedback.**
