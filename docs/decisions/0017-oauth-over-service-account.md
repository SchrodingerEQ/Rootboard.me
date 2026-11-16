# 0017 — Google sign-in on the kiosk (OAuth) over a developer-held service account
Date: 2026-11-16
Status: accepted for flow B (beta-launch brief 02); on main via the brief 02 PR, not yet released. Supersedes the **auth half** of [0002](0002-sqlite-service-account.md) (the SQLite half stands). The spike section below is filled in by brief 00.

## Decision

1. **Flow B: sign in on the kiosk.** OAuth 2.0 authorization code with
   PKCE (S256), Google client type "Desktop app", loopback redirect to
   the kiosk's own server: `http://127.0.0.1:5000/api/google/callback`.
   The device flow (A, "type this code at google.com/device") is not
   built: it waits on the spike below.
2. **The client id and secret are in the repo**, in
   `shared/google-oauth-client.ts`, on purpose. For installed apps Google
   documents the secret as not confidential: the flow is protected by
   PKCE and the loopback redirect, and the two values read no calendar by
   themselves. `.gitleaks.toml` gains a rule for `GOCSPX-` secrets (the
   default ruleset does not match them; checked with 8.30.1) and
   allowlists that one file by path, so a client secret anywhere else is
   still blocked by the hook and the CI scan. Nothing in `client/`
   imports the file, so it is not in the browser bundle (tested).
   **Open (2026-11-16):** GitHub push protection on this repository
   flags both the client id and the secret and refused the push. The
   brief 02 PR therefore carries placeholders in that file; the owner
   decides whether to allow the two values at GitHub (then they go in as
   decided here) or to deliver them another way. Brief 02 does not choose.
3. **Scopes:** `calendar.events` and `calendar.readonly`. Not the full
   `calendar` scope. No `openid`/`email` scope either: the account address
   shown in Settings is the primary calendar's id.
4. **Tokens live only on the unit**, in `data/google-oauth.json`: mode
   0600, written atomically, inside the gitignored, update-preserved
   `data/`. Refresh token, access token, expiry, scope, and the address
   for display. Never logged; the log scrubber also masks `ya29.`/`1//`
   token shapes in case a library error quotes one.
5. **Provider precedence:** a token file wins over `service-account.json`,
   with a boot log line when both exist. The service account is unchanged
   and remains the advanced path for self-hosters. `auth-status` and the
   new `GET /api/google/status` report `mode: oauth | service-account | none`.
6. **Loss of access:** `invalid_grant` (revoked, or Testing's 7-day
   expiry) rewrites the token file to `{email, lost: {at, reason}}` with
   no tokens. The connect screen shows the reason; the last synced events
   stay on screen with the header's sync error. Later syncs fail fast
   without contacting Google. No retry loop.
7. **Kiosk-only routes:** start, callback and sign out answer 403 to any
   other device, even a paired one. Start and sign out also need a JSON
   body and refuse `Sec-Fetch-Site: cross-site`/`same-site`, like the
   Wi-Fi routes. The callback is bound to the started sign-in by a random
   `state` (single use, 15 minutes, newest start wins).
8. **Back to the app on `http://localhost:5000/`, absolute.** The callback
   arrives on 127.0.0.1; a relative redirect would leave the kiosk on that
   origin, splitting localStorage (theme cache, drafts) and sending an
   Origin the Crucible feedback service does not allow.
9. **Calendar choice reuses `hiddenCalendars`.** After sign-in a "Choose
   which calendars to show" dialog writes the calendar widget's existing
   `hiddenCalendars` setting in `dashboard.json`, the same one Settings'
   switches write. No new config key, so the brief's "widget settings or
   a new `calendars` key" choice lands on the former; a v1.7.3 file loads
   unchanged (tested).
10. **The event cache follows the account.** A successful sign-in and a
    sign-out each empty `calendar_events` (it is a copy of Google data;
    the next sync refills it), so two accounts never mix on screen. Sign
    out also revokes at Google (best effort) and deletes the token file.
    Sign out without a Google sign-in is a 409 and touches nothing. Before
    the clear, a running sync is stopped at its next write and awaited, so
    it cannot put the old account's events back.
11. **Signed in, the service-account rows hide:** Remove calendar and Add
    by ID call `calendarList.insert/delete`, which these scopes do not
    allow, and would change the owner's own Google calendar list; the
    server also refuses both with a 409 while signed in. Shared calendars
    appear in the owner's list without a step. A service-account kiosk
    gets a "Sign in with a Google account instead" link in Settings.

## Context and alternatives

Decision 0002 chose a service account because interactive OAuth "expires
and needs re-consent". That was the Testing-status 7-day refresh-token
limit, not OAuth itself (brief 00 §2). The service account had a worse
property for anyone outside the developer's household: the developer's
Google project owns the identity that reads the tester's calendars.

- **Keep the service account as the only path.** Rejected: the developer
  would hold a credential to every tester's calendars (beta principle 2).
- **A hosted redirect or token broker.** Rejected: ongoing infrastructure
  and a server that sees tokens (principles 1 and 5).
- **Phone bounce page (option C).** Out of scope for v1 (brief 02 §7).
- **Device flow (A).** Kept as a possible second entry point; Google
  allows only a short list of scopes for it, and whether Calendar is on it
  is what the spike decides.

## Consequences

- **Testing status limits:** only listed test users can sign in, and a
  sign-in lasts 7 days. Production status (brief 00 §3.2 step 3) must
  come before the tester's unit ships; a fresh client created then
  replaces the two values in `shared/google-oauth-client.ts`.
- Google's pages show in the kiosk browser, where Rootboard's on-screen
  keyboard does not run. A USB keyboard covers typing an address or a
  password; the account picker needs none.
- Firefox keeps Google's session cookie after sign-in. Acceptable on a
  household kiosk; SPEC §3.8.
- Every `/api/google/*` route is in the `lan-auth.spec.ts` inventory.
- The published privacy text that says the kiosk reaches Google Calendar
  "through a Google service account that you create" must say "the Google
  account you sign in with" before the release that ships this.

## Spike results (brief 00 §3.1)

Pending. Brief 00 fills this in: whether the device flow accepts a
Calendar scope, and so whether flow A is added in a follow-up session.
