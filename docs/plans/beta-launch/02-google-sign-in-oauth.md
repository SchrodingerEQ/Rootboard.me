# 02 — Google sign-in with OAuth (tokens stay on the unit)

**Status:** Flow B built 2026-11-16 in PR #38 (soft flag, awaiting the founder). The founder chose option B the same day: the client id and secret ship on each unit in `data/google-oauth-client.json`, never in the repo (decision 0017). Flow A (device flow) waits on brief 00 §3.1, as a follow-up session.
**Type:** Server auth refactor + client dialog. One to two sessions.
**Depends on:** 00 §3.0 only: a consent screen in Testing and a Desktop
OAuth client, about 30 minutes of founder work. Flow B is the whole
build. Add the device flow (A) if 00 §3.1 says Calendar is accepted, as a
follow-up session if 00 has not answered by the time B is done.
**Unblocks:** 03 session 2.
**Closes in `TASKS.md`:** the beta sub-item 02, and "Fix duplicate
calendar-color fallback" (folded in 2026-11-14, see §3).

---

## 1. Goal

A new owner connects their own Google account from the touchscreen, the
way they would add an account to a phone. Google issues tokens to the
kiosk; the tokens are stored only on the kiosk; the developer never holds
anything that can read the owner's calendars. The service-account path
stays as the documented advanced option for self-hosters.

## 2. Decisions locked

| # | Decision | Choice |
|---|---|---|
| 1 | Auth model | OAuth 2.0 authorization code with PKCE, Google "Desktop app" client type, loopback redirect to the kiosk's own server (`http://127.0.0.1:5000/api/google/callback`). Device flow added as a second entry point only if brief 00 confirms a Calendar scope is accepted. |
| 2 | Client id in the repo | The OAuth **client id** (and, for the Desktop type, the non-confidential client secret Google issues with it) is committed in `shared/google-oauth-client.ts`. Google's own guidance is that installed-app secrets are not confidential; several open-source Calendar tools ship theirs. Add a `.gitleaks.toml` allowlist for that file **by path** with a comment explaining why, so the hook and CI keep flagging any *other* `GOCSPX-` string. Record this in decision 0017. **Founder 2026-11-16: client credentials ship on the unit in `data/google-oauth-client.json`, never in the repo (decision 0017).** |
| 3 | Scopes | `calendar.events` + `calendar.readonly` (events read/write, calendar list read). Not the full `calendar` scope — the app never creates or deletes calendars. If 00 shows the device flow needs a different scope string, follow 00. |
| 4 | Token storage | `data/google-oauth.json`, file mode 0600, inside the already-gitignored and update-preserved `data/` folder. Never logged. Refresh token + access token + expiry + the signed-in account's email (for display only). |
| 5 | Which calendars show | After sign-in, list the account's calendars and let the owner tick which to display. Calendars already shared *to* the owner by family members appear in that list because Google shows them in the owner's calendar list; no sharing step is needed. |
| 6 | Service account | Unchanged and still the default when `service-account.json` exists and no OAuth token exists. If both exist, OAuth wins and a log line says so. `GET /api/calendar/auth-status` grows a `mode: "oauth" | "service-account" | "none"` field. |
| 7 | Sign out | A Settings action that deletes the token file, revokes the token at Google (best effort), clears the synced events for that account from `calendar.db`, and returns the UI to the connect state. |
| 8 | Loss of token | If Google returns `invalid_grant` (revoked, expired), show the same "Connect Google" state with a one-sentence reason and keep the last synced events visible, marked stale. No silent retry loops. |
| 9 | Request origin | The callback must only be honoured from the kiosk itself; reuse `isLocalRequest` from `server/routes.ts`. The start-sign-in endpoint is also localhost-only: starting a Google sign-in from another device on the LAN would show Google's page on *that* device, which is not the flow we want in v1. |

## 3. Where the code goes

- `server/services/googleCalendar.ts`: today constructs `GoogleAuth` from a
  key file in `initialize()` (lines ~23–50) and reads `client_email` for
  display (~72). Introduce an auth-provider seam: `getAuthClient()` returns
  either the service-account client or an `OAuth2Client` loaded from the
  token file; everything below that seam (sync, create, patch, delete) is
  unchanged.
- New `server/services/googleOAuth.ts`: PKCE verifier/challenge, start URL
  builder, callback handler, token persistence, refresh, revoke, device
  flow polling (if enabled). Use `google-auth-library`'s `OAuth2Client`,
  already a dependency.
- Routes: `POST /api/google/start` (localhost-only) → `{ url }` for flow B
  or `{ userCode, verificationUrl, expiresIn }` for flow A;
  `GET /api/google/callback` (localhost-only); `GET /api/google/status`;
  `POST /api/google/signout` (localhost-only); `GET /api/calendar/calendars`
  gains `selected` handling (persist the tick list in `dashboard.json`
  under the calendar widget's settings or a new `calendars` key — pick one
  and record it).
- Client: `client/src/components/calendar/auth-dialog.tsx` currently
  explains the service-account steps. It becomes a two-tab dialog:
  **Connect Google** (big button → opens the Google page in the kiosk
  browser; or shows the device code) and **Advanced: service account**
  (today's text). `settings-menu.tsx` shows the signed-in email and the
  Sign out action instead of (or beside) the service-account email row.
- Kiosk browser: Firefox kiosk mode follows the redirect to Google and
  back without leaving kiosk. Verify the back-navigation path: after
  `/api/google/callback` the server must redirect to the absolute
  `http://localhost:5000/` (not a relative `/`) so the app reloads with
  the new auth status. The callback arrives on `127.0.0.1`, and a
  relative redirect would leave the kiosk on that origin: the theme
  cache and any saved feedback draft would split by origin, and feedback
  requests would carry an Origin the feedback service does not allow. The Google session cookie left in
  Firefox is acceptable; note it in SPEC §3.8.

**Folded in from the backlog (2026-11-14):**

- **Calendar colours from one place.** `settings-menu.tsx` keeps its own
  copy of `getCalendarColor` (around lines 421–437) with a different
  palette from `client/src/lib/calendar-meta.ts`, so a calendar with no
  colour of its own shows one colour in Settings and another in the
  views. This brief rebuilds that list for the pick-your-calendars step,
  so delete the local copy and draw every calendar colour with
  `getCalendarColor()` from `lib/calendar-meta.ts`.
- **No passport or express-session.** `passport`, `passport-local`,
  `express-session` and `memorystore` are in `package.json` but imported
  nowhere; `TASKS.md` lists them as a removal candidate. Build on
  `google-auth-library` as decision 1 says and leave them unwired.
- **Settings before sign-in.** Today the Settings popover renders only
  when signed in. Brief 05 changes that; if 05 has merged, the signed-in
  email and Sign out sit with the rest of Settings, and if not, nothing
  here depends on it, because the connect flow lives in the auth dialog.

## 4. Acceptance

- Fresh unit, no key file: Connect Google → Google page → account picker
  → consent → back on the dashboard with the calendar list dialog open →
  tick two calendars → events appear within one sync.
- Kill the server, restart it: still signed in, no re-consent.
- Advance the clock past access-token expiry: refresh happens silently.
- Revoke access from the Google account's security page: within one sync
  the UI shows the connect state with a reason; last events still visible.
- Existing kiosk with `service-account.json`: untouched behaviour, status
  reports `mode: "service-account"`.
- A calendar with no colour of its own shows the same colour in Settings
  and in Month view.
- `npm test` covers: PKCE pair generation, token file round-trip with mode
  0600, provider precedence, `invalid_grant` mapping, localhost guards.

## 5. Docs

- `docs/decisions/0017-oauth-over-service-account.md` (whichever of 00 and
  02 lands first creates it, leaving the other's section to fill; this
  brief fills the implementation consequences).
- `docs/SPEC.md` §2.2 endpoint table, §2.3 Google service, §2.6 env, §3.7
  settings, §3.8 kiosk quirk about the Google cookie.
- `INSTALLATION.md` step 7 becomes "Connect your Google account (on the
  kiosk)" with the service-account steps moved to an "Advanced" appendix.
  `client/src/pages/setup.tsx` mirrors it.
- `README.md` Auth line and Features list.
- Privacy text wherever the app describes what it does with Google data.
- The Rootboard section of the Crucible privacy policy is the source of
  truth: check it still holds once the owner's own tokens live on the
  unit. If it needs a change, that is a CrucibleWebsite PR (a hard stop:
  published legal text) that must be live before the release, as with
  brief 01.

## 6. PR tier

**Soft flag** — new account connection and a change to the privacy text
(PR-POLICY privacy trigger). Principle touched: 1 (privacy). Honest read:
this *improves* the privacy posture (removes a developer-held credential),
but it is still a new sign-in surface and must be disclosed as such.

## 7. Out of scope

Multiple Google accounts on one kiosk; option C (phone bounce page);
Gmail or any non-Calendar scope; removing the service-account path.
