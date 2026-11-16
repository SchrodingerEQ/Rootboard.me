/**
 * Client side of Google sign-in (beta-launch brief 02, docs/SPEC.md §3.7).
 * Pure helpers, so the connect dialog, Settings and the shell share one
 * reading of the auth status and of the callback's return to the app.
 */

/** `GET /api/calendar/auth-status` (and `GET /api/google/status`'s fields). */
export interface GoogleAuthStatus {
  authenticated: boolean;
  needsAuth?: boolean;
  error?: string | null;
  /** Absent from a server older than brief 02: read it as the service account. */
  mode?: "oauth" | "service-account" | "none";
  email?: string | null;
}

/** Signed in with Google, or was until Google refused the sign-in. */
export function isOAuthMode(status: GoogleAuthStatus | undefined): boolean {
  return status?.mode === "oauth";
}

/**
 * The last synced events stay on screen after Google refuses the sign-in
 * (brief 02 decision 8), so the events query runs in that state too.
 */
export function shouldShowSyncedEvents(status: GoogleAuthStatus | undefined): boolean {
  return status?.authenticated === true || isOAuthMode(status);
}

/** One sentence per `reason` the callback can send back (server/services/googleOAuth.ts). */
export const CALLBACK_FAILURE_COPY: Record<string, string> = {
  denied: "Google sign-in was cancelled, so nothing was connected.",
  expired: "That sign-in took too long. Tap Connect Google to start again.",
  "bad-request": "That sign-in didn't match the one this kiosk started. Tap Connect Google to try again.",
  "no-refresh-token": "Google didn't give this kiosk lasting access. Tap Connect Google and allow access again.",
  "exchange-failed": "Rootboard couldn't finish signing in with Google. Check the internet connection and try again.",
};

const GENERIC_FAILURE = "Google sign-in didn't finish. Tap Connect Google to try again.";

export type CallbackOutcome = { kind: "connected" } | { kind: "failed"; sentence: string };

/** What `?google=…` on the app URL says, if anything. */
export function readCallbackOutcome(search: string): CallbackOutcome | null {
  const params = new URLSearchParams(search);
  const google = params.get("google");
  if (google === "connected") return { kind: "connected" };
  if (google === "failed") {
    const reason = params.get("reason") ?? "";
    return { kind: "failed", sentence: CALLBACK_FAILURE_COPY[reason] ?? GENERIC_FAILURE };
  }
  return null;
}

/** The same URL without the callback's parameters, for history.replaceState. */
export function withoutCallbackParams(href: string): string {
  const url = new URL(href);
  url.searchParams.delete("google");
  url.searchParams.delete("reason");
  return url.pathname + (url.search === "?" ? "" : url.search) + url.hash;
}

/** Why `POST /api/google/start` failed, in words for the connect button. */
export function startFailureSentence(status: number): string {
  if (status === 403) return "Google sign-in can only be started on the kiosk's own screen.";
  return "Couldn't start Google sign-in. Check the internet connection and try again.";
}
