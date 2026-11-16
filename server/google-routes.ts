/**
 * Google sign-in routes (beta-launch brief 02, decision 0017).
 *
 * | Route                       | Guard                                        |
 * |-----------------------------|----------------------------------------------|
 * | POST /api/google/start      | kiosk only + JSON body + not cross-site      |
 * | GET  /api/google/callback   | kiosk only (Google's redirect is cross-site) |
 * | POST /api/google/signout    | kiosk only + JSON body + not cross-site      |
 * | GET  /api/google/status     | LAN token (the /api guard), like other reads |
 *
 * Start is kiosk only because a sign-in started from a LAN device would put
 * Google's page on that device, and the loopback redirect would then fail
 * there. The callback is kiosk only because Google sends the kiosk's own
 * browser to 127.0.0.1; it is also bound to the sign-in by `state`.
 */

import type { Express, Request, Response } from "express";
import { KIOSK_APP_URL, type CallbackResult, type GoogleOAuthService } from "./services/googleOAuth";
import type { GoogleAuthStatus } from "./services/googleCalendar";

export interface GoogleRoutesDeps {
  oauth: Pick<GoogleOAuthService, "startSignIn" | "handleCallback" | "signOut">;
  authStatus: () => GoogleAuthStatus;
  /** Stops a running sync and waits for it, so it can't write after the clear. */
  beginAccountChange: () => Promise<void>;
  /** Empties the synced-event cache, so the views never mix two accounts. */
  clearSyncedEvents: () => Promise<number>;
  isLocalRequest: (req: Request) => boolean;
}

export const GOOGLE_ROUTE_PATHS = {
  start: "/api/google/start",
  callback: "/api/google/callback",
  status: "/api/google/status",
  signout: "/api/google/signout",
} as const;

const KIOSK_ONLY_MESSAGE = "Google sign-in can only be changed on the kiosk's own screen";

/** Where the app lands after Google sends the browser back. */
export function callbackRedirectUrl(result: CallbackResult): string {
  const url = new URL(KIOSK_APP_URL);
  if (result.ok) url.searchParams.set("google", "connected");
  else {
    url.searchParams.set("google", "failed");
    url.searchParams.set("reason", result.reason);
  }
  return url.toString();
}

export function registerGoogleRoutes(app: Express, deps: GoogleRoutesDeps): void {
  const { oauth, authStatus, beginAccountChange, clearSyncedEvents, isLocalRequest } = deps;

  // The socket peer must be this machine, and the body JSON with no
  // cross-site Sec-Fetch-Site, so a web page open in the kiosk's own browser
  // cannot form-POST a sign-out (same checks as system-routes.ts).
  const kioskPost = (req: Request, res: Response): boolean => {
    const site = req.get("Sec-Fetch-Site");
    if (isLocalRequest(req) && req.is("application/json") && (!site || site === "same-origin" || site === "none")) return true;
    res.status(403).json({ message: KIOSK_ONLY_MESSAGE });
    return false;
  };
  const noStore = (res: Response) =>
    res.set({ "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate", Pragma: "no-cache", Expires: "0" });

  app.post(GOOGLE_ROUTE_PATHS.start, (req, res) => {
    if (!kioskPost(req, res)) return;
    noStore(res);
    res.json({ url: oauth.startSignIn() });
  });

  app.get(GOOGLE_ROUTE_PATHS.callback, async (req, res) => {
    // Only from the kiosk itself: no JSON or Sec-Fetch-Site check here,
    // because this request IS the cross-site redirect from Google.
    if (!isLocalRequest(req)) {
      return res.status(403).json({ message: KIOSK_ONLY_MESSAGE });
    }
    noStore(res);
    let result: CallbackResult;
    try {
      result = await oauth.handleCallback({ code: req.query.code, state: req.query.state, error: req.query.error });
    } catch (error) {
      // e.g. the token file can't be written (disk full): say so, don't crash.
      console.error("[google-oauth] sign-in could not be saved:", (error as Error).message);
      result = { ok: false, reason: "exchange-failed" };
    }
    if (result.ok) {
      try {
        await beginAccountChange();
        await clearSyncedEvents();
      } catch (error) {
        console.error("[google-oauth] could not clear the event cache after sign-in:", (error as Error).message);
      }
    }
    res.redirect(302, callbackRedirectUrl(result));
  });

  app.get(GOOGLE_ROUTE_PATHS.status, (req, res) => {
    noStore(res);
    res.json(authStatus());
  });

  app.post(GOOGLE_ROUTE_PATHS.signout, async (req, res) => {
    if (!kioskPost(req, res)) return;
    noStore(res);
    // Without a Google sign-in there is nothing to sign out of, and the
    // event cache belongs to the service account: leave it.
    if (authStatus().mode !== "oauth") {
      return res.status(409).json({ message: "This kiosk is not signed in to Google" });
    }
    let revoked: boolean;
    try {
      await beginAccountChange();
      ({ revoked } = await oauth.signOut());
    } catch (error) {
      console.error("[google-oauth] sign out failed:", (error as Error).message);
      return res.status(500).json({ message: "Couldn't sign out: the kiosk could not delete its saved sign-in" });
    }
    let cleared = true;
    try {
      await clearSyncedEvents();
    } catch (error) {
      cleared = false;
      console.error("[google-oauth] could not clear the event cache after sign-out:", (error as Error).message);
    }
    res.json({ signedOut: true, revoked, cleared });
  });
}
