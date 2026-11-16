/**
 * Google sign-in on the kiosk (beta-launch brief 02, decision 0017).
 *
 * OAuth 2.0 authorization code + PKCE with Google's "Desktop app" client and
 * a loopback redirect to this server. The kiosk's own browser goes to
 * Google, the owner signs in and consents, and Google sends the browser back
 * to `http://127.0.0.1:5000/api/google/callback`. The tokens Google issues
 * are written only to data/google-oauth.json (mode 0600, gitignored, kept
 * across updates); the developer never holds anything that reads a calendar.
 *
 * Token file states:
 * - absent: not signed in (the service account, if any, is used instead);
 * - `refreshToken` present: signed in;
 * - `lost` present, no tokens: Google refused the refresh token
 *   (`invalid_grant`: revoked, or a Testing-status 7-day expiry). The UI
 *   shows the connect state with `lost.reason`; nothing retries on its own.
 *
 * Nothing here logs a token, a code, the PKCE verifier or the email.
 */

import crypto from "crypto";
import fs from "fs";
import path from "path";
import { OAuth2Client, type Credentials } from "google-auth-library";
import { google } from "googleapis";
import {
  GOOGLE_OAUTH_CLIENT_ID,
  GOOGLE_OAUTH_CLIENT_SECRET,
  GOOGLE_OAUTH_SCOPES,
} from "@shared/google-oauth-client";

/** The kiosk server always listens on 5000 (server/index.ts). */
export const KIOSK_PORT = 5000;
/** Google sends the browser here. 127.0.0.1, as Google recommends for loopback. */
export const OAUTH_REDIRECT_URI = `http://127.0.0.1:${KIOSK_PORT}/api/google/callback`;
/**
 * Where the callback sends the browser afterwards. Absolute and on
 * `localhost`, never a relative `/`: the callback arrives on 127.0.0.1, and
 * staying there would split localStorage (theme cache, drafts) by origin and
 * send an Origin the Crucible feedback service does not allow.
 */
export const KIOSK_APP_URL = `http://localhost:${KIOSK_PORT}/`;

/** How long a started sign-in waits for Google to send the browser back. */
export const SIGN_IN_TTL_MS = 15 * 60 * 1000;

export const DEFAULT_TOKEN_FILE = path.resolve("data", "google-oauth.json");

/** One sentence for the connect screen when Google refuses the saved sign-in. */
export const LOST_ACCESS_REASON =
  "Google stopped accepting this kiosk's sign-in (access was removed or has expired). Connect Google again to keep the calendar up to date.";

/** Why a callback did not sign in. Sent to the app as `?google=failed&reason=`. */
export type CallbackFailure = "denied" | "expired" | "bad-request" | "no-refresh-token" | "exchange-failed";

export type CallbackResult = { ok: true } | { ok: false; reason: CallbackFailure };

interface StoredToken {
  version: 1;
  email: string | null;
  refreshToken?: string;
  accessToken?: string | null;
  expiryDate?: number | null;
  scope?: string | null;
  signedInAt?: string;
  lost?: { at: string; reason: string };
}

export interface OAuthStatus {
  /** A token file exists (signed in, or signed in before and lost). */
  present: boolean;
  /** Signed in with a usable refresh token. */
  connected: boolean;
  email: string | null;
  /** Set when Google refused the saved sign-in. */
  lostReason: string | null;
}

interface PendingSignIn {
  state: string;
  codeVerifier: string;
  expiresAt: number;
}

export interface GoogleOAuthDeps {
  tokenFile?: string;
  now?: () => number;
  /** Tests point the client at a mock token server. */
  makeClient?: () => OAuth2Client;
  /** The signed-in account's address, for display only. */
  lookupEmail?: (client: OAuth2Client) => Promise<string | null>;
}

function base64url(buf: Buffer): string {
  return buf.toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

/** RFC 7636: a 43-character verifier and its S256 challenge. */
export function createPkcePair(): { codeVerifier: string; codeChallenge: string } {
  const codeVerifier = base64url(crypto.randomBytes(32));
  const codeChallenge = base64url(crypto.createHash("sha256").update(codeVerifier).digest());
  return { codeVerifier, codeChallenge };
}

function defaultClient(): OAuth2Client {
  return new OAuth2Client({
    clientId: GOOGLE_OAUTH_CLIENT_ID,
    clientSecret: GOOGLE_OAUTH_CLIENT_SECRET,
    redirectUri: OAUTH_REDIRECT_URI,
  });
}

/** The primary calendar's id is the account's address; no extra scope needed. */
async function defaultLookupEmail(client: OAuth2Client): Promise<string | null> {
  const res = await google.calendar({ version: "v3", auth: client }).calendars.get({ calendarId: "primary" });
  return res.data.id ?? null;
}

/** True when Google refused the refresh token itself (revoked or expired). */
export function isInvalidGrant(error: unknown): boolean {
  const e = error as { response?: { data?: { error?: unknown } }; message?: unknown } | null;
  if (e?.response?.data?.error === "invalid_grant") return true;
  return typeof e?.message === "string" && /\binvalid_grant\b/.test(e.message);
}

export class GoogleOAuthService {
  private readonly tokenFile: string;
  private readonly now: () => number;
  private readonly makeClient: () => OAuth2Client;
  private readonly lookupEmail: (client: OAuth2Client) => Promise<string | null>;
  private pending: PendingSignIn | null = null;
  private client: OAuth2Client | null = null;

  constructor(deps: GoogleOAuthDeps = {}) {
    this.tokenFile = deps.tokenFile ?? DEFAULT_TOKEN_FILE;
    this.now = deps.now ?? Date.now;
    this.makeClient = deps.makeClient ?? defaultClient;
    this.lookupEmail = deps.lookupEmail ?? defaultLookupEmail;
  }

  // --- Sign-in ------------------------------------------------------------

  /**
   * The Google page to send the kiosk browser to. Only the newest sign-in is
   * honoured: starting again replaces an earlier one that never came back.
   */
  startSignIn(): string {
    const { codeVerifier, codeChallenge } = createPkcePair();
    const state = base64url(crypto.randomBytes(24));
    this.pending = { state, codeVerifier, expiresAt: this.now() + SIGN_IN_TTL_MS };
    return this.makeClient().generateAuthUrl({
      access_type: "offline",
      // Always show consent, so Google always returns a refresh token —
      // also when this account signed in to this kiosk before.
      prompt: "consent",
      scope: [...GOOGLE_OAUTH_SCOPES],
      state,
      code_challenge: codeChallenge,
      // The enum lives on the library's CodeChallengeMethod; the string is the same.
      code_challenge_method: "S256" as never,
      redirect_uri: OAUTH_REDIRECT_URI,
    });
  }

  /** Google's redirect back: `?code&state`, or `?error&state` on cancel. */
  async handleCallback(query: { code?: unknown; state?: unknown; error?: unknown }): Promise<CallbackResult> {
    const pending = this.pending;
    const state = typeof query.state === "string" ? query.state : "";
    if (!pending || !state || !safeEqual(state, pending.state)) {
      return { ok: false, reason: "bad-request" };
    }
    // One use per started sign-in, whatever happens next.
    this.pending = null;
    if (this.now() > pending.expiresAt) return { ok: false, reason: "expired" };
    if (typeof query.error === "string") return { ok: false, reason: "denied" };
    if (typeof query.code !== "string" || !query.code) return { ok: false, reason: "bad-request" };

    const client = this.makeClient();
    let tokens: Credentials;
    try {
      ({ tokens } = await client.getToken({
        code: query.code,
        codeVerifier: pending.codeVerifier,
        redirect_uri: OAUTH_REDIRECT_URI,
      }));
    } catch (error) {
      console.error("[google-oauth] code exchange failed:", describeError(error));
      return { ok: false, reason: "exchange-failed" };
    }
    if (!tokens.refresh_token) return { ok: false, reason: "no-refresh-token" };

    client.setCredentials(tokens);
    let email: string | null = null;
    try {
      email = await this.lookupEmail(client);
    } catch (error) {
      // Display only: signing in still works without it.
      console.warn("[google-oauth] could not read the account address:", describeError(error));
    }
    this.writeToken({
      version: 1,
      email,
      refreshToken: tokens.refresh_token,
      accessToken: tokens.access_token ?? null,
      expiryDate: tokens.expiry_date ?? null,
      scope: tokens.scope ?? null,
      signedInAt: new Date(this.now()).toISOString(),
    });
    this.client = null;
    console.log("[google-oauth] signed in; tokens saved to data/google-oauth.json");
    return { ok: true };
  }

  // --- Use ----------------------------------------------------------------

  status(): OAuthStatus {
    const stored = this.readToken();
    return {
      present: stored !== null,
      connected: !!stored?.refreshToken,
      email: stored?.email ?? null,
      lostReason: stored?.lost?.reason ?? null,
    };
  }

  /**
   * An OAuth2Client carrying the saved tokens, or null when not signed in.
   * The library refreshes the access token on its own; each refresh is
   * written back so a restart does not need one.
   */
  getAuthClient(): OAuth2Client | null {
    if (this.client) return this.client;
    const stored = this.readToken();
    if (!stored?.refreshToken) return null;
    const client = this.makeClient();
    client.setCredentials({
      refresh_token: stored.refreshToken,
      access_token: stored.accessToken ?? undefined,
      expiry_date: stored.expiryDate ?? undefined,
      scope: stored.scope ?? undefined,
    });
    client.on("tokens", (tokens) => this.saveRefreshedTokens(client, tokens));
    this.client = client;
    return client;
  }

  /**
   * Google refused the refresh token. Drop the tokens, keep a reason for the
   * connect screen. Called by the calendar service with the refresh token
   * Google refused; no retry follows.
   */
  markLost(failedRefreshToken: string | null): void {
    const stored = this.readToken();
    // A newer sign-in replaced the one that failed: leave it alone.
    if (!stored?.refreshToken || stored.refreshToken !== failedRefreshToken) return;
    this.client = null;
    this.writeToken({
      version: 1,
      email: stored.email,
      lost: { at: new Date(this.now()).toISOString(), reason: LOST_ACCESS_REASON },
    });
    console.warn("[google-oauth] Google refused the saved sign-in (invalid_grant); showing the connect screen");
  }

  /**
   * Revoke at Google (best effort: the kiosk may be offline, or the grant
   * already gone) and delete the token file. Returns whether Google
   * confirmed the revoke.
   */
  async signOut(): Promise<{ revoked: boolean }> {
    const stored = this.readToken();
    this.client = null;
    this.pending = null;
    let revoked = false;
    if (stored?.refreshToken) {
      try {
        await this.makeClient().revokeToken(stored.refreshToken);
        revoked = true;
      } catch (error) {
        console.warn("[google-oauth] revoke at Google failed; deleting the local tokens anyway:", describeError(error));
      }
    }
    fs.rmSync(this.tokenFile, { force: true });
    console.log("[google-oauth] signed out; data/google-oauth.json deleted");
    return { revoked };
  }

  // --- Storage ------------------------------------------------------------

  private saveRefreshedTokens(client: OAuth2Client, tokens: Credentials): void {
    // A sign-out or a new sign-in since this client was made: ignore it.
    if (this.client !== client) return;
    const stored = this.readToken();
    if (!stored?.refreshToken) return;
    this.writeToken({
      ...stored,
      refreshToken: tokens.refresh_token ?? stored.refreshToken,
      accessToken: tokens.access_token ?? stored.accessToken ?? null,
      expiryDate: tokens.expiry_date ?? stored.expiryDate ?? null,
    });
  }

  private readToken(): StoredToken | null {
    let raw: string;
    try {
      raw = fs.readFileSync(this.tokenFile, "utf-8");
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") return null;
      console.error("[google-oauth] could not read data/google-oauth.json:", (error as Error).message);
      return null;
    }
    try {
      const parsed = JSON.parse(raw) as Partial<StoredToken>;
      if (parsed.version !== 1) throw new Error("unknown version");
      return {
        version: 1,
        email: typeof parsed.email === "string" ? parsed.email : null,
        refreshToken: typeof parsed.refreshToken === "string" && parsed.refreshToken ? parsed.refreshToken : undefined,
        accessToken: typeof parsed.accessToken === "string" ? parsed.accessToken : null,
        expiryDate: typeof parsed.expiryDate === "number" ? parsed.expiryDate : null,
        scope: typeof parsed.scope === "string" ? parsed.scope : null,
        signedInAt: typeof parsed.signedInAt === "string" ? parsed.signedInAt : undefined,
        lost:
          parsed.lost && typeof parsed.lost.reason === "string" && typeof parsed.lost.at === "string"
            ? { at: parsed.lost.at, reason: parsed.lost.reason }
            : undefined,
      };
    } catch (error) {
      // Damaged: treat as signed out but leave the file for hand recovery.
      console.error("[google-oauth] data/google-oauth.json is not valid; treating it as signed out:", (error as Error).message);
      return null;
    }
  }

  /** Atomic, owner-only (0600) write, like data/paired-devices.json. */
  private writeToken(token: StoredToken): void {
    fs.mkdirSync(path.dirname(this.tokenFile), { recursive: true });
    const tmpPath = `${this.tokenFile}.tmp`;
    fs.writeFileSync(tmpPath, JSON.stringify(token, null, 2) + "\n", { encoding: "utf-8", mode: 0o600 });
    // mode applies only when the file is created; force it for a leftover tmp.
    fs.chmodSync(tmpPath, 0o600);
    fs.renameSync(tmpPath, this.tokenFile);
  }
}

/** Constant-time equality for two strings of any length. */
function safeEqual(a: string, b: string): boolean {
  return crypto.timingSafeEqual(
    crypto.createHash("sha256").update(a).digest(),
    crypto.createHash("sha256").update(b).digest(),
  );
}

/** An error's message and Google's error code, never a request or response body. */
function describeError(error: unknown): string {
  const e = error as { message?: unknown; response?: { status?: unknown; data?: { error?: unknown } } } | null;
  const code = typeof e?.response?.data?.error === "string" ? ` (${e.response.data.error})` : "";
  const status = typeof e?.response?.status === "number" ? ` HTTP ${e.response.status}` : "";
  const message = typeof e?.message === "string" ? e.message : "unknown error";
  return `${message}${status}${code}`;
}

export const googleOAuthService = new GoogleOAuthService();
