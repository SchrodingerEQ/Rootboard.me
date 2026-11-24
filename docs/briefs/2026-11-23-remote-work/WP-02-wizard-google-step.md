# WP-02 — The setup wizard's Google step (beta brief 03, session 2)

| | |
|---|---|
| **Repo** | `SchrodingerEQ/Rootboard.me`, one PR |
| **Base** | latest `main`, fresh clone, `npm ci` (npm 11) |
| **Waits on** | nothing (brief 02 flow B merged as #38; brief 03 session 1 as #35). Merge `main` in and re-run checks if WP-01 merged first: both touch `docs/SPEC.md`. |
| **Unblocks** | beta brief 09 (the wizard is what the tester sees); v1.9.0 |
| **Network / secrets** | none new. In dev, Google sign-in needs `data/google-oauth-client.json`, which the founder keeps in the password manager; this brief does **not** need it (see Verification). |
| **Deliverable** | one PR, tier **safe zone expected** (no new network call, no new permission; the panel it embeds already shipped under the brief-02 soft flag); never a lower tier than `/crucible-code-standards-review` reports |
| **Model** | per the README |
| **Unattended run** | 1–2 hours |

## Goal

The wizard's Google step stops being a placeholder. Today
(`client/src/pages/setup-wizard.tsx`, the "Google (session 1
placeholder)" block) it shows "How to connect" and opens the old
`AuthDialog`. After this brief it embeds brief 02's `GoogleConnectPanel`
(`client/src/components/calendar/google-connect-panel.tsx`, already used
by `auth-dialog.tsx` and `google-account-settings.tsx`), so a new owner
connects Google from the wizard with fingers only, then continues. This is
brief 03 decision 7. Every other wizard rule (SPEC §3.11: steps, Skip,
modes, run condition, "changes something only when its own button is
tapped") is unchanged.

## Decisions already made (don't reopen)

| Decision | Answer | Where |
|---|---|---|
| Google step embeds brief 02's connect dialog | yes | brief 03 §2 decision 7 |
| Skip stays on the Google step | yes (every step but Network has Skip) | brief 03 decision 2; SPEC §3.11 |
| Client credentials | on the unit in `data/google-oauth-client.json`, never in the repo | decision 0017 (founder 2026-11-16) |
| Missing client file | the panel already shows what to do (`clientStatus`); the wizard shows the same, with Skip | brief 02 as built (#38) |
| Service-account kiosks | the step reads as connected when `/api/google/status` says `authenticated` in either mode; nothing is removed | principle 4; brief 02 decision 6 |
| Self-hoster path in the wizard | a **Set up manually (self-hosting)** button on the Google step opens a warning dialog (significant manual setup; where the instructions are; leaving the wizard) with Back to setup / Continue with manual setup; Continue leaves the wizard and opens the service-account instructions | founder 2026-11-24 (this brief, step 1) |

## Read first

1. `docs/plans/beta-launch/03-first-run-wizard.md` (decisions 2, 7, 9,
   10; §4 acceptance, the Google line) and
   `docs/plans/beta-launch/02-google-sign-in-oauth.md` §3 (client side).
2. `docs/SPEC.md` §3.11 (wizard), §3.7 (Settings → Google), §2.2 (the
   `/api/google/*` routes).
3. `client/src/pages/setup-wizard.tsx`, `client/src/lib/setup-wizard.ts`,
   `client/src/components/calendar/google-connect-panel.tsx`,
   `google-account-settings.tsx`, `auth-dialog.tsx`,
   `client/src/components/app-shell.tsx` (how the wizard gets
   `googleConnected` / `googleError` today), `server/google-routes.ts`
   (`GET /api/google/status`).
4. The existing wizard spec, `client/src/lib/setup-wizard.spec.ts`
   (pure logic; there are no component tests in this repo).
5. `docs/decisions/0018-on-device-setup-via-networkmanager.md`.

## Steps

1. Replace the placeholder `GoogleStep` with one that renders
   `GoogleConnectPanel` (with `clientStatus` and the `reason` from the
   status query, as `google-account-settings.tsx` does) when not
   connected, and the connected line plus **Continue** when connected.
   Read the shell's existing status query (`app-shell.tsx` already
   passes `authStatus.authenticated` into the wizard; widen that to the
   whole status rather than adding a second query), so the step flips
   to connected when the sign-in completes. Keep the step's **Skip**.
   **The self-hoster path (founder, 2026-11-24):** under the panel, a
   secondary button **Set up manually (self-hosting)**. Tapping it opens
   a confirmation dialog, not the instructions: one plain paragraph
   saying this path needs a significant amount of manual setup on a
   computer (a Google Cloud project, a service-account key file copied
   onto the unit), that the instructions are in the install guide's
   service-account appendix and on the unit at `/setup`, and that
   choosing it leaves the wizard. Two buttons: **Back to setup** (closes
   the dialog, nothing changes) and **Continue with manual setup**
   (closes the wizard without writing `setup.completedAt`, so it returns
   on the next boot, and opens today's `AuthDialog` on its Advanced tab
   with the service-account steps). `GoogleConnectPanel` has no Advanced
   tab of its own; `AuthDialog` is where the steps live, so reuse it.
   Touch targets 48 px or more, theme tokens only, OSK not needed. The
   warning copy is one paragraph in the product's voice; quote it in the
   PR body for the founder's yes. Nothing else in the wizard changes.
2. **The return from Google.** The callback 302s to
   `/?google=connected` (SPEC §2.2), which reloads the page. SPEC §3.11
   and `lib/setup-wizard.ts`: with no `setup.completedAt`, every page
   load is `first-run`, so the wizard restarts at **Welcome** after the
   sign-in ("the wizard starts again in boot mode", SPEC ~line 1177);
   from Settings (`rerun`) the reload lands on the dashboard and the
   owner is out of the wizard. Decide here, not with hardware: when the
   page loads with `?google=connected` and the mode would be
   `first-run`, resume at the Google step with the connected line and
   Continue, so the owner does not redo Wi-Fi and time zone; in `rerun`,
   accept the dashboard landing (Settings → Google already shows the
   result) and say so in SPEC. Put the rule in `lib/setup-wizard.ts` as
   a pure function (query string + mode → starting step) and record it
   in SPEC §3.11. Do not change the callback's localhost-only guard.
   Reproduce on the laptop: reload with `?google=connected` appended.
3. Tests: the repo has no DOM test environment (`vitest.config.ts` is
   `environment: "node"`, no jsdom or testing-library, no `*.spec.tsx`),
   and adding one is a dependency decision outside this brief. So test
   as pure logic in `client/src/lib/setup-wizard.spec.ts` (the existing
   wizard spec): the starting-step rule from step 2 for `?google=
   connected` in `first-run`, `rerun` and the absence of the parameter;
   and a small step-state helper (status → `connected` /
   `needs-client` / `connect`) extracted from the component and tested
   for `oauth` authenticated, `service-account` authenticated,
   `oauthClient: "missing"` and unauthenticated; and the manual-setup
   dialog's outcome rule (Back → wizard unchanged; Continue → wizard
   closed, `setup.completedAt` not written, auth dialog opened). The
   rendered component is checked by eye in the dev server
   (Verification).
4. Docs: `docs/SPEC.md` §3.11 (the Google step, the resume rule, the
   manual-setup dialog and what it writes); brief 03's **Status** line
   ("Session 2 merged <date> as #<n>"); `INSTALLATION.md` "First boot:
   the setup wizard", whose Google sentence describes the placeholder's
   "Advanced: service account" reach, now describes the manual-setup
   button and its warning.
5. Tracker: `TASKS.md` beta sub-item 03 gets "session 2 in PR #<n>
   (WP-02); closes when it merges"; tick it only if this session merges
   the PR under PR-POLICY.
6. `/crucible-code-standards-review` against `main`, then `/pr`. Title:
   "Setup wizard: connect Google from the Google step (brief 03 session
   2)". The security review in `CLAUDE.md` runs before the push (no
   client id, no secret, no token in the diff or tests).

## Verification without hardware

- The three checks green (state the known Windows file-mode failures if
  WP-04 (b) has not merged).
- `npm run dev` without `data/google-oauth-client.json`: Settings →
  System → Run setup again → the Google step shows the panel's
  missing-client message, Skip and the manual-setup button; tap it, see
  the warning, Back returns to the step unchanged, Continue closes the
  wizard and opens the service-account steps; screenshots for the PR.
- `npm run dev` with a `service-account.json` present and working, if
  the laptop has one; otherwise fake `/api/google/status` in the tests
  only. The step shows connected and Continue.
- The real sign-in on the kiosk, including the return from Google's page
  into the wizard, is a founder checklist item (README), not a PR claim.

## If blocked

- The panel needs props the wizard cannot supply without a larger
  refactor of `app-shell.tsx`: do the smallest lift that keeps the
  panel's one source of truth (the status query), and say so in the PR.
- Resuming at the Google step (step 2) turns out to need state the
  wizard does not keep across a reload: fall back to restarting at
  Welcome with every earlier step pre-passed from current values (Wi-Fi
  connected, time zone set), document that in SPEC, and name the kiosk
  check in the report.

## Report (end of run)

**Done (PR number, merged or waiting) / Not done and why / Findings
worth a task / Founder actions (the kiosk check of the Google step and
the return from Google's page).**
