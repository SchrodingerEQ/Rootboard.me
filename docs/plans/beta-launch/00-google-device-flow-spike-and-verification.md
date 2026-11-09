# 00 — Google device-flow spike and OAuth verification submission

**Status:** Not started.
**Type:** Spike + founder actions outside the repo. Produces a decision, not shipped code.
**Depends on:** nothing. Start on day one — verification waits on Google.
**Unblocks:** 02 (which sign-in flow to build first), 09 (what the tester will see).

---

## 1. Goal

Answer two questions so brief 02 can be built without guessing:

1. **Does Google's limited-input device flow accept a Calendar scope?**
   Google's "OAuth 2.0 for TV and Limited-Input Device Applications" flow
   (the "go to google.com/device and type this code" experience) only
   permits an allow-listed set of scopes. Our recollection is that the
   list is OpenID/profile, two Drive scopes and two YouTube scopes, with
   **no Calendar scope**; one third-party CLI claims Calendar works. This
   must be tested, not assumed.
2. **How long does Google take to verify an app for the Calendar scope?**
   Submit the consent screen for verification now so the answer arrives
   while 01–03 are being built.

## 2. Background the implementer needs

- Google classes every Calendar scope as **sensitive** (not restricted).
  Sensitive scopes need brand verification and a scope justification; they
  do **not** need the annual CASA security assessment that Gmail/Drive
  restricted scopes need.
- An app whose consent screen is in **Testing** status issues refresh
  tokens that **expire after 7 days**. This is the most likely reason
  decision 0002 recorded OAuth as "tokens expire and need re-consent":
  the project was never moved to production. In **production** status
  the refresh token persists until revoked or unused for six months.
  After switching, obtain a fresh token (ideally with a freshly created
  client) — forum reports say tokens minted under Testing keep the 7-day
  behaviour.
- An **unverified** app in production still works but shows a "Google
  hasn't verified this app" interstitial and is capped at 100 users for
  the project's lifetime. Acceptable for a one-tester beta; not for a
  product.
- Verification needs: a public homepage on the project's domain, a
  privacy policy page linked from it, the app's logo, and a short screen
  recording of the consent flow. The privacy policy must state what the
  app does with calendar data (reads and writes events on the kiosk;
  nothing leaves the device except to Google's own API).

## 3. Work

### 3.1 Device-flow scope test (≈30 minutes)

1. In the Google Cloud project that will own Rootboard's OAuth client,
   create an OAuth client of type **TVs and Limited Input devices**.
2. From any machine, POST to Google's device-code endpoint with that
   client id and `scope=https://www.googleapis.com/auth/calendar.events`
   (and separately `.../auth/calendar`, `.../auth/calendar.readonly`).
3. Record the exact response for each. A rejection looks like
   `invalid_scope` with a message naming the scope. An acceptance returns
   a `device_code`, `user_code` and `verification_url`.
4. If any Calendar scope is accepted: complete the flow once on a phone,
   exchange for tokens, and make one Calendar API call to prove the token
   actually carries the scope.
5. Write the results into §5 of this brief and into a new decision record
   (see §4).

Do **not** commit the client id or any token to the repo during the
spike. Use a scratch directory.

### 3.2 Consent screen and verification submission (founder)

1. Set the consent screen to **External**, fill in app name "Rootboard",
   support email, logo, homepage, privacy policy and terms links.
2. Add the scope(s) brief 02 will use. Prefer `calendar.events` plus
   `calendar.readonly` for the calendar list over the full `calendar`
   scope, unless the spike shows a reason not to; the app creates and
   edits events but never creates or deletes calendars.
3. Publish to **In production**.
4. Submit for verification with the screen recording and scope
   justification. Keep the submission text in private planning records.
5. Record the submission date in this brief's Status line.

### 3.3 Decide the primary sign-in surface

Fill in the table in §5 and pick one of:

- **A. Device flow** if a Calendar scope is accepted — best experience,
  the user never types a password on the kiosk.
- **B. Sign in on the kiosk** otherwise — Google's sign-in page opens in
  the kiosk's own Firefox using a *Desktop app* client with a loopback
  redirect; the user types on the on-screen keyboard and approves 2-step
  verification on their phone. Works today with no infrastructure.
- **C. Phone completes sign-in, kiosk receives the code** via a static
  bounce page on the project's domain — recorded as a later improvement,
  not for the beta.

Brief 02 is written to build **B** and add **A** on top if available.

## 4. Deliverables

- `docs/decisions/0015-oauth-over-service-account.md` — supersedes the
  auth half of 0002 (leave the SQLite half untouched; note it in the
  record). Must include the spike's scope results and the Testing-vs-
  production token finding, since that is the "why now" of the reversal.
- §5 below filled in.
- `TASKS.md` item updated with the verification submission date.

## 5. Results (fill in)

| Scope tested | Device-flow response | Token worked against Calendar API? |
|---|---|---|
| `calendar.events` | | |
| `calendar.readonly` | | |
| `calendar` | | |

Verification submitted: ____ · Outcome: ____ · Days elapsed: ____

## 6. Out of scope

Any client code. Any change to the service-account path.
