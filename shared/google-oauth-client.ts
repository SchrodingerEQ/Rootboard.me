/**
 * Rootboard's Google OAuth client (beta-launch brief 02, decision 0017).
 *
 * Committed on purpose. This is a "Desktop app" client: Google issues its
 * secret to installed apps that cannot keep one, documents it as not
 * confidential, and protects the flow with PKCE and a loopback redirect
 * instead. Holding these two values lets nobody read a calendar; only the
 * tokens Google issues to a kiosk do, and those stay in that kiosk's
 * data/google-oauth.json. `.gitleaks.toml` allowlists this file by path
 * only, so a client secret anywhere else is still caught.
 *
 * Server-side only: nothing in client/ imports this file, so it is not in
 * the browser bundle.
 *
 * PENDING: GitHub push protection blocked the real values (it flags both
 * the client id and the secret). The repository owner decides whether to
 * allow them; until then these placeholders make Google refuse the sign-in
 * (invalid_client). See the brief 02 PR.
 */
export const GOOGLE_OAUTH_CLIENT_ID =
  "PENDING-FOUNDER-DECISION.apps.googleusercontent.com";
export const GOOGLE_OAUTH_CLIENT_SECRET = "PENDING-FOUNDER-DECISION";

/**
 * Events read/write plus the calendar list, read-only (brief 02 decision 3).
 * Not the full `calendar` scope: the app never creates or deletes calendars.
 */
export const GOOGLE_OAUTH_SCOPES = [
  "https://www.googleapis.com/auth/calendar.events",
  "https://www.googleapis.com/auth/calendar.readonly",
] as const;
