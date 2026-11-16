/**
 * Google sign-in scopes (beta-launch brief 02 decision 3, decision 0017).
 *
 * Events read/write plus the calendar list, read-only. Not the full
 * `calendar` scope: the app never creates or deletes calendars.
 *
 * The OAuth client itself (id and secret) is never in this repository: it
 * lives on each unit in data/google-oauth-client.json (decision 0017,
 * "Client credentials"; server/services/googleOAuthClient.ts).
 */
export const GOOGLE_OAUTH_SCOPES = [
  "https://www.googleapis.com/auth/calendar.events",
  "https://www.googleapis.com/auth/calendar.readonly",
] as const;
