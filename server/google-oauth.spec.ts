/**
 * Google sign-in (beta-launch brief 02 §4 "npm test covers"): PKCE, the
 * token file round-trip at mode 0600, provider precedence, invalid_grant,
 * the kiosk-only guards and the absolute redirect back to the app.
 *
 * Google is a mock: a local HTTP server plays the token and revoke
 * endpoints, and the real google-auth-library OAuth2Client is pointed at it,
 * so the code exchange, the PKCE verifier and the refresh all go over the
 * wire exactly as they would to Google. No real client id or secret is used.
 */
import crypto from "crypto";
import fs from "fs";
import http from "http";
import os from "os";
import path from "path";
import type { AddressInfo } from "net";
import express from "express";
import { OAuth2Client } from "google-auth-library";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, test, vi } from "vitest";

const storageMock = vi.hoisted(() => ({
  deleteAllCalendarEvents: vi.fn(async () => 3),
  getCalendarEventByGoogleIdAndCalendar: vi.fn(async () => undefined),
  createCalendarEvent: vi.fn(async (e: object) => ({ id: 1, ...e })),
  updateCalendarEvent: vi.fn(async () => undefined),
  deleteCalendarEventsByCalendarNotIn: vi.fn(async () => 0),
  deleteCalendarEventsEndedBefore: vi.fn(async () => 0),
}));
// googleCalendar.ts imports the SQLite storage; keep the test off the disk.
vi.mock("./storage", () => ({ storage: storageMock }));

import {
  GoogleOAuthService,
  OAUTH_REDIRECT_URI,
  KIOSK_APP_URL,
  LOST_ACCESS_REASON,
  SIGN_IN_TTL_MS,
  createPkcePair,
  isInvalidGrant,
} from "./services/googleOAuth";
import { GoogleAccessLostError, GoogleCalendarService, SIGNED_IN_LIST_MESSAGE } from "./services/googleCalendar";
import { registerGoogleRoutes, callbackRedirectUrl } from "./google-routes";

// --- Mock Google -------------------------------------------------------------

interface TokenRequest {
  [key: string]: string;
}

const google = {
  tokenRequests: [] as TokenRequest[],
  revokeRequests: [] as string[],
  /** What the token endpoint answers next, per grant type. */
  onCode: (_req: TokenRequest): [number, object] => [
    200,
    { access_token: "access-1", refresh_token: "refresh-1", expires_in: 3600, scope: "calendar", token_type: "Bearer" },
  ],
  onRefresh: (_req: TokenRequest): [number, object] => [200, { access_token: "access-2", expires_in: 3600, token_type: "Bearer" }],
  revokeStatus: 200,
  /** The Calendar API: requests seen, and a gate the events list waits on. */
  apiRequests: [] as Array<{ path: string; authorization: string }>,
  eventsGate: null as Promise<void> | null,
};

let googleServer: http.Server;
let googleBase = "";

function makeClient(): OAuth2Client {
  return new OAuth2Client({
    clientId: "test-client.apps.example.test",
    clientSecret: "test-secret",
    redirectUri: OAUTH_REDIRECT_URI,
    endpoints: {
      oauth2AuthBaseUrl: `${googleBase}/auth`,
      oauth2TokenUrl: `${googleBase}/token`,
      oauth2RevokeUrl: `${googleBase}/revoke`,
    },
  });
}

let tmpDir = "";
let tokenFile = "";
let now = Date.parse("2026-11-16T12:00:00Z");

function newService(lookupEmail = vi.fn(async () => "owner@example.com")) {
  return new GoogleOAuthService({ tokenFile, now: () => now, makeClient, lookupEmail });
}

function readStored() {
  return JSON.parse(fs.readFileSync(tokenFile, "utf-8"));
}

/** Start a sign-in and return the `state` and `code_challenge` Google would receive. */
function start(service: GoogleOAuthService) {
  const url = new URL(service.startSignIn());
  return { url, state: url.searchParams.get("state")!, challenge: url.searchParams.get("code_challenge")! };
}

beforeAll(async () => {
  googleServer = http.createServer((req, res) => {
    let raw = "";
    req.on("data", (chunk) => (raw += chunk));
    req.on("end", () => {
      const url = new URL(req.url ?? "/", "http://mock");
      const reply = (status: number, body: object) => {
        res.writeHead(status, { "content-type": "application/json" });
        res.end(JSON.stringify(body));
      };
      if (url.pathname === "/token") {
        const form = Object.fromEntries(new URLSearchParams(raw)) as TokenRequest;
        google.tokenRequests.push(form);
        const [status, body] = form.grant_type === "refresh_token" ? google.onRefresh(form) : google.onCode(form);
        return reply(status, body);
      }
      if (url.pathname.startsWith("/calendar/v3/")) {
        google.apiRequests.push({ path: url.pathname, authorization: req.headers.authorization ?? "" });
        if (url.pathname.endsWith("/calendarList")) {
          return reply(200, { items: [{ id: "family@example.test", summary: "Family" }] });
        }
        if (url.pathname.endsWith("/events")) {
          const answer = () => reply(200, { items: [{ id: "ev1", summary: "Dentist", start: { date: "2026-11-20" }, end: { date: "2026-11-21" } }] });
          if (google.eventsGate) return void google.eventsGate.then(answer);
          return answer();
        }
      }
      if (url.pathname === "/revoke") {
        google.revokeRequests.push(url.searchParams.get("token") ?? "");
        return reply(google.revokeStatus, {});
      }
      reply(404, {});
    });
  });
  await new Promise<void>((resolve) => googleServer.listen(0, "127.0.0.1", resolve));
  googleBase = `http://127.0.0.1:${(googleServer.address() as AddressInfo).port}`;
});

afterAll(async () => {
  await new Promise((resolve) => googleServer.close(resolve));
});

beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "rootboard-google-oauth-"));
  tokenFile = path.join(tmpDir, "data", "google-oauth.json");
  google.tokenRequests = [];
  google.revokeRequests = [];
  google.revokeStatus = 200;
  google.onCode = () => [
    200,
    { access_token: "access-1", refresh_token: "refresh-1", expires_in: 3600, scope: "calendar", token_type: "Bearer" },
  ];
  google.onRefresh = () => [200, { access_token: "access-2", expires_in: 3600, token_type: "Bearer" }];
  google.apiRequests = [];
  google.eventsGate = null;
  for (const fn of Object.values(storageMock)) fn.mockClear();
});

afterEach(() => {
  fs.rmSync(tmpDir, { recursive: true, force: true });
  delete process.env.GOOGLE_SERVICE_ACCOUNT_KEY_FILE;
});

async function signIn(service: GoogleOAuthService) {
  const { state } = start(service);
  return service.handleCallback({ code: "auth-code", state });
}

// --- PKCE and the start URL -----------------------------------------------------

describe("PKCE", () => {
  test("a 43-character base64url verifier and its S256 challenge, fresh each time", () => {
    const a = createPkcePair();
    const b = createPkcePair();
    expect(a.codeVerifier).toMatch(/^[A-Za-z0-9_-]{43}$/);
    const expected = crypto.createHash("sha256").update(a.codeVerifier).digest("base64url");
    expect(a.codeChallenge).toBe(expected);
    expect(a.codeVerifier).not.toBe(b.codeVerifier);
  });

  test("the Google page asks for offline access, both scopes and S256, and returns to the loopback callback", () => {
    const { url, state, challenge } = start(newService());
    expect(url.origin + url.pathname).toBe(`${googleBase}/auth`);
    expect(url.searchParams.get("redirect_uri")).toBe("http://127.0.0.1:5000/api/google/callback");
    expect(url.searchParams.get("scope")).toBe(
      "https://www.googleapis.com/auth/calendar.events https://www.googleapis.com/auth/calendar.readonly",
    );
    expect(url.searchParams.get("code_challenge_method")).toBe("S256");
    expect(url.searchParams.get("access_type")).toBe("offline");
    expect(url.searchParams.get("prompt")).toBe("consent");
    expect(state).toMatch(/^[A-Za-z0-9_-]{32}$/);
    expect(challenge).toMatch(/^[A-Za-z0-9_-]{43}$/);
  });
});

// --- Callback and the token file ----------------------------------------------------

describe("callback", () => {
  test("exchanges the code with the matching verifier and saves the tokens at mode 0600", async () => {
    const service = newService();
    const { state, challenge } = start(service);
    expect(await service.handleCallback({ code: "auth-code", state })).toEqual({ ok: true });

    const exchange = google.tokenRequests[0];
    expect(exchange.grant_type).toBe("authorization_code");
    expect(exchange.code).toBe("auth-code");
    expect(exchange.redirect_uri).toBe(OAUTH_REDIRECT_URI);
    expect(crypto.createHash("sha256").update(exchange.code_verifier).digest("base64url")).toBe(challenge);

    expect(fs.statSync(tokenFile).mode & 0o777).toBe(0o600);
    expect(readStored()).toMatchObject({ version: 1, email: "owner@example.com", refreshToken: "refresh-1", accessToken: "access-1" });
    expect(service.status()).toEqual({ present: true, connected: true, email: "owner@example.com", lostReason: null });
  });

  test("survives a restart: a new service on the same file is still signed in", async () => {
    await signIn(newService());
    const afterRestart = newService();
    expect(afterRestart.status().connected).toBe(true);
    expect(afterRestart.getAuthClient()?.credentials.refresh_token).toBe("refresh-1");
  });

  test("a wrong state, a replayed state and no sign-in in progress are refused", async () => {
    const service = newService();
    expect(await service.handleCallback({ code: "c", state: "x" })).toEqual({ ok: false, reason: "bad-request" });
    const { state } = start(service);
    expect(await service.handleCallback({ code: "c", state: state + "x" })).toEqual({ ok: false, reason: "bad-request" });
    expect(await service.handleCallback({ code: "c", state })).toEqual({ ok: true });
    expect(await service.handleCallback({ code: "c", state })).toEqual({ ok: false, reason: "bad-request" });
  });

  test("starting again replaces the earlier sign-in", async () => {
    const service = newService();
    const first = start(service);
    const second = start(service);
    expect(await service.handleCallback({ code: "c", state: first.state })).toEqual({ ok: false, reason: "bad-request" });
    expect(await service.handleCallback({ code: "c", state: second.state })).toEqual({ ok: true });
  });

  test("expired, cancelled at Google, and no refresh token", async () => {
    const service = newService();
    let { state } = start(service);
    now += SIGN_IN_TTL_MS + 1;
    expect(await service.handleCallback({ code: "c", state })).toEqual({ ok: false, reason: "expired" });

    ({ state } = start(service));
    expect(await service.handleCallback({ error: "access_denied", state })).toEqual({ ok: false, reason: "denied" });

    google.onCode = () => [200, { access_token: "a", expires_in: 3600, token_type: "Bearer" }];
    ({ state } = start(service));
    expect(await service.handleCallback({ code: "c", state })).toEqual({ ok: false, reason: "no-refresh-token" });

    google.onCode = () => [400, { error: "invalid_grant" }];
    ({ state } = start(service));
    expect(await service.handleCallback({ code: "c", state })).toEqual({ ok: false, reason: "exchange-failed" });
    expect(fs.existsSync(tokenFile)).toBe(false);
  });

  test("a failed email lookup still signs in", async () => {
    const service = newService(vi.fn(async () => { throw new Error("offline"); }));
    expect(await signIn(service)).toEqual({ ok: true });
    expect(service.status()).toMatchObject({ connected: true, email: null });
  });

  test("a damaged token file reads as signed out and is left for hand recovery", () => {
    fs.mkdirSync(path.dirname(tokenFile), { recursive: true });
    fs.writeFileSync(tokenFile, "{not json");
    expect(newService().status()).toEqual({ present: false, connected: false, email: null, lostReason: null });
    expect(fs.readFileSync(tokenFile, "utf-8")).toBe("{not json");
  });
});

// --- Refresh, invalid_grant, sign out ---------------------------------------------------

describe("using the saved sign-in", () => {
  test("an expired access token refreshes silently and the new one is saved", async () => {
    const service = newService();
    await signIn(service);
    now += 2 * 3600 * 1000;
    const stored = readStored();
    fs.writeFileSync(tokenFile, JSON.stringify({ ...stored, expiryDate: Date.now() - 1000 }));

    const client = newService().getAuthClient()!;
    const { token } = await client.getAccessToken();
    expect(token).toBe("access-2");
    const refresh = google.tokenRequests.at(-1)!;
    expect(refresh).toMatchObject({ grant_type: "refresh_token", refresh_token: "refresh-1" });
    expect(readStored()).toMatchObject({ accessToken: "access-2", refreshToken: "refresh-1" });
    expect(fs.statSync(tokenFile).mode & 0o777).toBe(0o600);
  });

  test("isInvalidGrant recognises Google's refusal and nothing else", () => {
    expect(isInvalidGrant({ response: { data: { error: "invalid_grant" } } })).toBe(true);
    expect(isInvalidGrant(new Error("invalid_grant"))).toBe(true);
    expect(isInvalidGrant({ response: { status: 500, data: { error: "backend_error" } } })).toBe(false);
    expect(isInvalidGrant(new Error("socket hang up"))).toBe(false);
  });

  test("an old sign-in's invalid_grant never wipes a newer sign-in", async () => {
    const service = newService();
    await signIn(service);
    service.markLost("refresh-from-an-earlier-sign-in");
    expect(service.status()).toMatchObject({ connected: true, lostReason: null });
    service.markLost("refresh-1");
    expect(service.status()).toMatchObject({ connected: false, lostReason: LOST_ACCESS_REASON });
  });

  test("a token file that can't be written fails the sign-in instead of crashing", async () => {
    const blocker = path.join(tmpDir, "not-a-dir");
    fs.writeFileSync(blocker, "");
    const service = new GoogleOAuthService({ tokenFile: path.join(blocker, "google-oauth.json"), now: () => now, makeClient, lookupEmail: async () => null });
    const { state } = start(service);
    await expect(service.handleCallback({ code: "c", state })).rejects.toThrow();
  });

  test("sign out revokes at Google and deletes the file", async () => {
    const service = newService();
    await signIn(service);
    expect(await service.signOut()).toEqual({ revoked: true });
    expect(google.revokeRequests).toEqual(["refresh-1"]);
    expect(fs.existsSync(tokenFile)).toBe(false);
    expect(service.getAuthClient()).toBeNull();
  });

  test("sign out still deletes the file when Google can't be reached", async () => {
    const service = newService();
    await signIn(service);
    google.revokeStatus = 400;
    expect(await service.signOut()).toEqual({ revoked: false });
    expect(fs.existsSync(tokenFile)).toBe(false);
  });
});

// --- Provider precedence (decision 6) and invalid_grant through the calendar service ----------

function writeServiceAccountKey(): void {
  const keyFile = path.join(tmpDir, "service-account.json");
  // Shape only: GoogleAuth parses it at startup but nothing here calls Google with it.
  fs.writeFileSync(keyFile, JSON.stringify({
    type: "service_account",
    project_id: "test",
    client_email: "kiosk@test.example",
    private_key: "not-a-real-key",
  }));
  process.env.GOOGLE_SERVICE_ACCOUNT_KEY_FILE = keyFile;
}

describe("the calendar service through the seam", () => {
  // The Calendar API calls go to the mock too.
  const calendarFor = (oauth: GoogleOAuthService) => new GoogleCalendarService(oauth, `${googleBase}/`);

  test("signed in, a sync reads the owner's calendars with the OAuth token and stores the events", async () => {
    const oauth = newService();
    await signIn(oauth);
    const calendar = calendarFor(oauth);
    const events = await calendar.syncCalendarEvents(new Date("2026-11-01"), new Date("2026-12-01"));
    expect(events).toHaveLength(1);
    expect(google.apiRequests.map((r) => r.path)).toEqual([
      "/calendar/v3/users/me/calendarList",
      "/calendar/v3/calendars/family%40example.test/events",
    ]);
    expect(google.apiRequests.every((r) => r.authorization === "Bearer access-1")).toBe(true);
    expect(storageMock.createCalendarEvent).toHaveBeenCalledTimes(1);
  });

  test("an account change stops a running sync before it writes, and waits for it", async () => {
    const oauth = newService();
    await signIn(oauth);
    const calendar = calendarFor(oauth);
    let release!: () => void;
    google.eventsGate = new Promise<void>((resolve) => (release = resolve));
    const sync = calendar.syncCalendarEvents(new Date("2026-11-01"), new Date("2026-12-01"));
    sync.catch(() => undefined);
    await vi.waitFor(() => expect(google.apiRequests.some((r) => r.path.endsWith("/events"))).toBe(true));

    let changed = false;
    const change = calendar.beginAccountChange().then(() => (changed = true));
    await new Promise((r) => setTimeout(r, 20));
    expect(changed).toBe(false); // still waiting for the sync
    release();
    await change;
    await expect(sync).rejects.toThrow(/account changed/);
    expect(storageMock.createCalendarEvent).not.toHaveBeenCalled();
    expect(storageMock.deleteCalendarEventsByCalendarNotIn).not.toHaveBeenCalled();
  });

  test("signed in, adding or removing a calendar is refused without calling Google", async () => {
    const oauth = newService();
    await signIn(oauth);
    const calendar = calendarFor(oauth);
    await expect(calendar.subscribeToCalendar("x@example.test")).rejects.toThrow(SIGNED_IN_LIST_MESSAGE);
    await expect(calendar.unsubscribeFromCalendar("x@example.test")).rejects.toThrow(SIGNED_IN_LIST_MESSAGE);
    expect(google.apiRequests).toEqual([]);
  });
});

describe("provider precedence", () => {
  test("no key file and no sign-in → none", async () => {
    process.env.GOOGLE_SERVICE_ACCOUNT_KEY_FILE = path.join(tmpDir, "missing.json");
    const calendar = new GoogleCalendarService(newService());
    await calendar.getCalendarList().catch(() => undefined);
    expect(calendar.getAuthStatus()).toMatchObject({ mode: "none", authenticated: false });
  });

  test("a key file and no sign-in → service account, unchanged", async () => {
    writeServiceAccountKey();
    const calendar = new GoogleCalendarService(newService());
    await vi.waitFor(() => expect(calendar.getAuthStatus().mode).toBe("service-account"));
    expect(calendar.getAuthStatus()).toEqual({ mode: "service-account", authenticated: true, error: null, email: null });
  });

  test("a key file and a sign-in → the sign-in wins, with a log line", async () => {
    writeServiceAccountKey();
    const oauth = newService();
    await signIn(oauth);
    const log = vi.spyOn(console, "log");
    const calendar = new GoogleCalendarService(oauth);
    await vi.waitFor(() => expect(log.mock.calls.flat().join("\n")).toMatch(/Service account auth initialized/));
    expect(calendar.getAuthStatus()).toEqual({ mode: "oauth", authenticated: true, error: null, email: "owner@example.com" });
    expect(log.mock.calls.flat().join("\n")).toMatch(/Google sign-in .* is used instead of the service account/);
    log.mockRestore();
  });

  test("invalid_grant: the tokens are dropped, the reason shows, and Google is not asked again", async () => {
    const oauth = newService();
    await signIn(oauth);
    // Force a refresh on the next call; Google refuses it.
    fs.writeFileSync(tokenFile, JSON.stringify({ ...readStored(), expiryDate: Date.now() - 1000 }));
    google.onRefresh = () => [400, { error: "invalid_grant", error_description: "Token has been expired or revoked." }];
    const calendar = new GoogleCalendarService(oauth);

    await expect(calendar.getCalendarList()).rejects.toBeInstanceOf(GoogleAccessLostError);
    expect(calendar.getAuthStatus()).toEqual({ mode: "oauth", authenticated: false, error: LOST_ACCESS_REASON, email: "owner@example.com" });
    expect(readStored().refreshToken).toBeUndefined();
    expect(fs.statSync(tokenFile).mode & 0o777).toBe(0o600);

    const requestsSoFar = google.tokenRequests.length;
    await expect(calendar.syncCalendarEvents(new Date(), new Date())).rejects.toBeInstanceOf(GoogleAccessLostError);
    expect(google.tokenRequests.length).toBe(requestsSoFar);
    // Still lost after a restart.
    expect(new GoogleCalendarService(newService()).getAuthStatus().authenticated).toBe(false);
  });
});

// --- Routes -----------------------------------------------------------------------

describe("routes", () => {
  let server: http.Server;
  let base = "";
  let oauth: GoogleOAuthService;
  let mode: "oauth" | "service-account" | "none" = "none";

  beforeEach(async () => {
    oauth = newService();
    mode = "none";
    const app = express();
    app.use(express.json());
    app.use((req, _res, next) => {
      const peer = req.get("x-test-peer");
      if (peer) Object.defineProperty(req, "ip", { value: peer });
      next();
    });
    registerGoogleRoutes(app, {
      oauth,
      authStatus: () => ({ mode, authenticated: mode !== "none", error: null, email: null }),
      beginAccountChange: async () => undefined,
      clearSyncedEvents: storageMock.deleteAllCalendarEvents,
      isLocalRequest: (req) => (req.ip ?? "") === "127.0.0.1",
    });
    server = app.listen(0, "127.0.0.1");
    await new Promise((resolve) => server.once("listening", resolve));
    base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  });

  afterEach(async () => {
    await new Promise((resolve) => server.close(resolve));
  });

  const kioskJson = { "content-type": "application/json", "x-test-peer": "127.0.0.1" };

  test("the callback redirects to the absolute localhost app URL, never a relative /", async () => {
    expect(KIOSK_APP_URL).toBe("http://localhost:5000/");
    const started = await fetch(`${base}/api/google/start`, { method: "POST", headers: kioskJson, body: "{}" });
    const { url } = (await started.json()) as { url: string };
    const state = new URL(url).searchParams.get("state");

    const res = await fetch(`${base}/api/google/callback?code=auth-code&state=${state}`, {
      headers: { "x-test-peer": "127.0.0.1" },
      redirect: "manual",
    });
    expect(res.status).toBe(302);
    expect(res.headers.get("location")).toBe("http://localhost:5000/?google=connected");
    expect(oauth.status().connected).toBe(true);
    expect(storageMock.deleteAllCalendarEvents).toHaveBeenCalledTimes(1);
  });

  test("a failed callback redirects to the app with the reason", async () => {
    const res = await fetch(`${base}/api/google/callback?code=x&state=nope`, {
      headers: { "x-test-peer": "127.0.0.1" },
      redirect: "manual",
    });
    expect(res.headers.get("location")).toBe("http://localhost:5000/?google=failed&reason=bad-request");
    expect(callbackRedirectUrl({ ok: false, reason: "denied" })).toBe("http://localhost:5000/?google=failed&reason=denied");
    expect(storageMock.deleteAllCalendarEvents).not.toHaveBeenCalled();
  });

  test("start, callback and sign out are refused from any other device", async () => {
    const lan = { "content-type": "application/json", "x-test-peer": "192.0.2.10" };
    expect((await fetch(`${base}/api/google/start`, { method: "POST", headers: lan, body: "{}" })).status).toBe(403);
    const { state } = start(oauth);
    const cb = await fetch(`${base}/api/google/callback?code=c&state=${state}`, { headers: lan, redirect: "manual" });
    expect(cb.status).toBe(403);
    // The sign-in started on the kiosk is not used up by the refused request.
    expect(await oauth.handleCallback({ code: "c", state })).toEqual({ ok: true });
    mode = "oauth";
    expect((await fetch(`${base}/api/google/signout`, { method: "POST", headers: lan, body: "{}" })).status).toBe(403);
    expect(oauth.status().connected).toBe(true);
  });

  test("a web page in the kiosk browser can't form-post or cross-site-post a sign-out", async () => {
    await signIn(oauth);
    mode = "oauth";
    const form = await fetch(`${base}/api/google/signout`, {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded", "x-test-peer": "127.0.0.1" },
      body: "a=1",
    });
    expect(form.status).toBe(403);
    const crossSite = await fetch(`${base}/api/google/signout`, {
      method: "POST",
      headers: { ...kioskJson, "sec-fetch-site": "cross-site" },
      body: "{}",
    });
    expect(crossSite.status).toBe(403);
    expect(oauth.status().connected).toBe(true);
  });

  test("sign out on the kiosk: revoke, delete the tokens, clear the event cache", async () => {
    await signIn(oauth);
    mode = "oauth";
    const res = await fetch(`${base}/api/google/signout`, { method: "POST", headers: kioskJson, body: "{}" });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ signedOut: true, revoked: true, cleared: true });
    expect(fs.existsSync(tokenFile)).toBe(false);
    expect(storageMock.deleteAllCalendarEvents).toHaveBeenCalledTimes(1);
  });

  test("sign out without a Google sign-in leaves the service account's cache alone", async () => {
    mode = "service-account";
    const res = await fetch(`${base}/api/google/signout`, { method: "POST", headers: kioskJson, body: "{}" });
    expect(res.status).toBe(409);
    expect(storageMock.deleteAllCalendarEvents).not.toHaveBeenCalled();
  });

  test("a sign-in that can't be saved redirects with a reason instead of crashing", async () => {
    vi.spyOn(oauth, "handleCallback").mockRejectedValueOnce(new Error("ENOSPC"));
    const res = await fetch(`${base}/api/google/callback?code=c&state=s`, { headers: { "x-test-peer": "127.0.0.1" }, redirect: "manual" });
    expect(res.headers.get("location")).toBe("http://localhost:5000/?google=failed&reason=exchange-failed");
  });

  test("status is a plain read", async () => {
    mode = "service-account";
    const res = await fetch(`${base}/api/google/status`, { headers: { "x-test-peer": "127.0.0.1" } });
    expect(await res.json()).toMatchObject({ mode: "service-account", authenticated: true });
    expect(res.headers.get("cache-control")).toMatch(/no-store/);
  });
});
