# 0017 — Google sign-in on the kiosk (OAuth) over a developer-held service account
Date: 2026-11-16
Status: accepted for flow B (beta-launch brief 02); on main via the brief 02 PR, not yet released. Supersedes the **auth half** of [0002](0002-sqlite-service-account.md) (the SQLite half stands). The spike section below is filled in by brief 00.

## Decision

1. **Flow B: sign in on the kiosk.** OAuth 2.0 authorization code with
   PKCE (S256), Google client type "Desktop app", loopback redirect to
   the kiosk's own server: `http://127.0.0.1:5000/api/google/callback`.
   The device flow (A, "type this code at google.com/device") is not
   built: it waits on the spike below.
2. **The client id and secret are never in the repo.** Each unit reads
   them from `data/google-oauth-client.json`. See "Client credentials"
   below (founder decision, 2026-11-16), which replaced the brief's
   original choice to commit them.
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
   new `GET /api/google/status` report `mode: oauth | service-account | none`
   and `oauthClient: missing | configured | invalid`.
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
  come before the tester's unit ships. A fresh client created then goes
  onto each unit as a new `data/google-oauth-client.json` (scp or
  `PUT /api/google/client`); no release is needed.
- Google's pages show in the kiosk browser, where Rootboard's on-screen
  keyboard does not run. A USB keyboard covers typing an address or a
  password; the account picker needs none.
- Firefox keeps Google's session cookie after sign-in. Acceptable on a
  household kiosk; SPEC §3.8.
- Every `/api/google/*` route is in the `lan-auth.spec.ts` inventory.
- The published privacy text that says the kiosk reaches Google Calendar
  "through a Google service account that you create" must say "the Google
  account you sign in with" before the release that ships this.

## Client credentials

Date: 2026-11-16. Founder decision (relayed by the coordinating session:
"go ahead with B then. I'm aligned with it.").

**Decision.** The Desktop client's id and secret are delivered **on the
unit**, in `data/google-oauth-client.json`, and are **never committed**:
not in source, docs, tests, fixtures, commit messages or release notes.

- The file is the JSON Google Cloud's console downloads, as-is:
  `{"installed": {"client_id", "client_secret", …}}`. It is read on
  demand, so a file that appears works without a restart.
- It lives in `data/`, which is gitignored, in `PRESERVE_PATHS`
  (`updateService.ts`) and in the `start.sh` rollback case. When the app
  writes it, the write is atomic and mode 0600.
- `PUT /api/google/client` (the kiosk or a paired device; JSON only; not
  cross-site; 8 KB max) validates and replaces it without a release. It
  answers `{configured: true}` and never echoes the secret.
- Nothing logs, returns or puts the secret in the diagnostics bundle.
  The only part ever shown is the client id's project number:
  "configured: yes, project NNN".
- With no file (or an invalid one), the Connect Google tab says so and
  points to the setup guide and the service-account tab. The status
  endpoints report `oauthClient`, and the service-account path is
  unchanged.
- `shared/google-oauth-client.ts` holds only the scopes. The
  `rootboard-google-oauth-client-secret` gitleaks rule (`GOCSPX-…`) has
  **no allowlist**; it now guards the whole repo, and
  `server/secret-scan-rules.spec.ts` pins the rule and scans every
  tracked file.

**Why.**
- Google's OAuth policy says not to commit client credentials to public
  repositories.
- GitHub push protection blocks them (it refused this PR's first push,
  flagging both the id and the secret).
- GitHub reports Google client secrets found in public repos to Google,
  which may revoke them. That would break every unit at once.
- Units the project ships get the file when their card is built
  (brief 09). Self-hosters create their own Desktop client, the norm for
  open-source Google integrations.

**Alternatives rejected.**
- *Commit the values* (the brief's original decision 2): the policy and
  the revocation risk above.
- *A small project server that hands the values out:* an open address is
  the same as publishing them. A locked-down one needs a per-unit key on
  the card anyway, plus a server to run, and it would break the privacy
  page's "no server" promise.

## Spike results (brief 00 §3.1)

Pending. Brief 00 fills this in: whether the device flow accepts a
Calendar scope, and so whether flow A is added in a follow-up session.
