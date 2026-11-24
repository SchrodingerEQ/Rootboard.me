/**
 * Google sign-in routes (beta-launch brief 02, decision 0017).
 *
 * | Route                       | Guard                                        |
 * |-----------------------------|----------------------------------------------|
 * | POST /api/google/start      | kiosk only + JSON body + not cross-site      |
 * | GET  /api/google/callback   | kiosk only (Google's redirect is cross-site) |
 * | POST /api/google/signout    | kiosk only + JSON body + not cross-site      |
 * | GET  /api/google/status     | LAN token (the /api guard), like other reads |
 * | PUT  /api/google/client     | LAN token + JSON body + not cross-site       |
 *
 * Start is kiosk only because a sign-in started from a LAN device would put
 * Google's page on that device, and the loopback redirect would then fail
 * there. The callback is kiosk only because Google sends the kiosk's own
 * browser to 127.0.0.1; it is also bound to the sign-in by `state`.
 *
 * PUT /api/google/client installs the unit's OAuth client JSON (decision
 * 0017: never in the repo). A paired device may call it, so a client can be
 * replaced without a release or SSH; it answers `{configured: true}` and
 * never echoes the secret.
 */

import type { Express, Request, Response } from "express";
import { KIOSK_APP_URL, OAuthClientNotConfiguredError, type CallbackResult, type GoogleOAuthService } from "./services/googleOAuth";
import { MAX_CLIENT_FILE_BYTES } from "./services/googleOAuthClient";
import type { GoogleAuthStatus } from "./services/googleCalendar";
import { isSameOriginJsonRequest } from "./middleware/lanAuth";

export interface GoogleRoutesDeps {
  oauth: Pick<GoogleOAuthService, "startSignIn" | "handleCallback" | "signOut">;
  authStatus: () => GoogleAuthStatus;
  /** Stops a running sync and waits for it, so it can't write after the clear. */
  beginAccountChange: () => Promise<void>;
  /** Empties the synced-event cache, so the views never mix two accounts. */
  clearSyncedEvents: () => Promise<number>;
  isLocalRequest: (req: Request) => boolean;
  /** Validates and saves Google's client JSON (googleOAuthClient.ts); false when invalid. */
  saveClient: (value: unknown) => boolean;
}

export const GOOGLE_ROUTE_PATHS = {
  start: "/api/google/start",
  callback: "/api/google/callback",
  status: "/api/google/status",
  signout: "/api/google/signout",
  client: "/api/google/client",
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
  const { oauth, authStatus, beginAccountChange, clearSyncedEvents, isLocalRequest, saveClient } = deps;

  // The socket peer must be this machine, and the body JSON with no
  // cross-site Sec-Fetch-Site, so a web page open in the kiosk's own browser
  // cannot form-POST a sign-out (isSameOriginJsonRequest, middleware/lanAuth.ts).
  const kioskPost = (req: Request, res: Response): boolean => {
    if (isLocalRequest(req) && isSameOriginJsonRequest(req)) return true;
    res.status(403).json({ message: KIOSK_ONLY_MESSAGE });
    return false;
  };
  const noStore = (res: Response) =>
    res.set({ "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate", Pragma: "no-cache", Expires: "0" });

  app.post(GOOGLE_ROUTE_PATHS.start, (req, res) => {
    if (!kioskPost(req, res)) return;
    noStore(res);
    try {
      res.json({ url: oauth.startSignIn() });
    } catch (error) {
      if (error instanceof OAuthClientNotConfiguredError) {
        return res.status(409).json({ message: error.message, oauthClient: error.clientStatus });
      }
      throw error;
    }
  });

  // The guard in front of /api already admitted only the kiosk or a paired
  // device. JSON only, and not from a cross-site page in the kiosk browser.
  app.put(GOOGLE_ROUTE_PATHS.client, (req, res) => {
    noStore(res);
    if (!isSameOriginJsonRequest(req)) {
      return res.status(403).json({ message: "Send the client JSON as application/json" });
    }
    if (Number(req.get("content-length") ?? 0) > MAX_CLIENT_FILE_BYTES) {
      return res.status(413).json({ message: "That file is too large to be a Google OAuth client" });
    }
    try {
      if (!saveClient(req.body)) {
        return res.status(400).json({
          message:
            'Not a Google "Desktop app" OAuth client: expected the JSON Google Cloud downloads, with installed.client_id ending in .apps.googleusercontent.com and installed.client_secret',
        });
      }
    } catch (error) {
      console.error("[google-oauth] could not save the sign-in client:", (error as Error).message);
      return res.status(500).json({ message: "Couldn't save the client file on the kiosk" });
    }
    res.json({ configured: true });
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
