/**
 * Who may call /api/* (beta-launch brief 05, decision 0020), exercised
 * against the real route table from registerRoutes. The services behind the
 * routes are mocked: this file tests the guard, not the handlers.
 *
 * A request's peer address is set per request with the test-only
 * `x-test-peer` header (a middleware ahead of the routes overrides req.ip),
 * so "from the LAN" means exactly what the guard sees in production: a
 * non-loopback socket address. 192.0.2.0/24 is the documentation range.
 */
import fs from "fs";
import os from "os";
import path from "path";
import type { AddressInfo } from "net";
import type { Server } from "http";
import express from "express";
import { afterAll, afterEach, beforeAll, describe, expect, test, vi } from "vitest";
import { defaultDashboardConfig } from "@shared/dashboard-config";
// vi.mock calls below are hoisted above these imports by Vitest.
import { registerRoutes } from "./routes";
import { PairingService, PAIRING_CODE_TTL_MS } from "./services/pairingService";

vi.mock("./storage", () => ({
  storage: {
    getCalendarEvents: vi.fn(async () => []),
    deleteCalendarEventsByCalendarNotIn: vi.fn(async () => 0),
    getAppState: vi.fn(async () => null),
    setAppState: vi.fn(async () => undefined),
  },
}));
vi.mock("./services/googleCalendar", () => ({
  googleCalendarService: {
    getCalendarList: vi.fn(async () => []),
    unsubscribeFromCalendar: vi.fn(async () => undefined),
    createEvent: vi.fn(async () => ({})),
    updateEvent: vi.fn(async () => ({})),
    deleteEvent: vi.fn(async () => undefined),
    subscribeToCalendar: vi.fn(async () => ({})),
    syncCalendarEvents: vi.fn(async () => []),
    getSyncStatus: vi.fn(() => ({ lastSyncAt: null, lastSyncError: null, syncing: false })),
    getServiceAccountEmail: vi.fn(() => null),
    isConnected: vi.fn(() => false),
    getInitError: vi.fn(() => null),
  },
}));
vi.mock("./services/updateService", () => ({
  checkForUpdate: vi.fn(async () => ({ updateAvailable: false })),
  applyUpdate: vi.fn(async () => undefined),
  rollback: vi.fn(async () => ({ success: true, restoredVersion: "0" })),
  getUpdateStatus: vi.fn(() => ({ status: "idle", message: "", progress: 0 })),
  getAvailableBackups: vi.fn(() => []),
}));
vi.mock("./services/weatherService", () => ({
  getWeather: vi.fn(async () => ({ enabled: false })),
  getWeatherStatus: vi.fn(() => ({ configured: false, lastSuccessAt: null, lastError: null })),
}));
vi.mock("./services/weatherLookup", () => ({
  lookupPostalCode: vi.fn(async () => ({ status: "bad-input" })),
}));
vi.mock("./services/configService", () => ({
  readDashboardConfig: vi.fn(() => ({ config: defaultDashboardConfig(), source: "default", warnings: [] })),
  writeDashboardConfig: vi.fn(),
}));
vi.mock("./services/diagnosticsService", () => ({
  getDiagnostics: vi.fn(async (view: string) => ({ view })),
}));


const LAN = "192.0.2.10";
const LOOPBACK = "127.0.0.1";

/** Reachable from the LAN without a token. */
const OPEN = new Set(["GET /api/version", "GET /api/system/diagnostics", "POST /api/pair"]);
/** Kiosk screen only, even with a token (403 from anywhere else). */
const LOCALHOST_ONLY = new Set([
  "POST /api/update/apply",
  "POST /api/update/rollback",
  "POST /api/system/pairing-code",
  "GET /api/system/pairing-code",
  "DELETE /api/system/pairing-code",
]);
/** Every /api route and its expected guard. A new route fails the inventory test until it is listed here. */
const INVENTORY = [
  "GET /api/version",
  "GET /api/weather",
  "GET /api/weather/status",
  "GET /api/weather/lookup",
  "GET /api/calendar/events",
  "GET /api/calendar/calendars",
  "DELETE /api/calendar/calendars/:calendarId",
  "POST /api/calendar/events",
  "PATCH /api/calendar/events/:id",
  "DELETE /api/calendar/events/:id",
  "POST /api/calendar/subscribe",
  "POST /api/calendar/sync",
  "GET /api/calendar/sync-status",
  "GET /api/calendar/service-account-email",
  "GET /api/calendar/auth-status",
  "GET /api/update/check",
  "GET /api/update/status",
  "POST /api/update/apply",
  "POST /api/update/rollback",
  "GET /api/update/backups",
  "GET /api/system/diagnostics",
  "POST /api/system/pairing-code",
  "GET /api/system/pairing-code",
  "DELETE /api/system/pairing-code",
  "POST /api/pair",
  "GET /api/system/paired-devices",
  "DELETE /api/system/paired-devices/:id",
  "GET /api/state/:key",
  "PUT /api/state/:key",
  "GET /api/config/dashboard",
  "PUT /api/config/dashboard",
  "GET /api/widgets",
];

let now = Date.parse("2026-11-14T12:00:00Z");
const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "rootboard-lan-auth-"));
const devicesFile = path.join(tmpDir, "paired-devices.json");
const pairing = new PairingService(devicesFile, () => now);

const app = express();
app.use(express.json());
app.use((req, _res, next) => {
  const peer = req.get("x-test-peer");
  if (peer) Object.defineProperty(req, "ip", { value: peer });
  next();
});
let server: Server;
let base = "";

beforeAll(async () => {
  server = await registerRoutes(app, { pairing });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});

afterAll(async () => {
  await new Promise((resolve) => server.close(resolve));
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

afterEach(() => {
  delete process.env.LAN_API_OPEN;
});

interface CallOptions {
  peer?: string;
  token?: string;
  authorization?: string;
  body?: unknown;
  headers?: Record<string, string>;
}

async function call(method: string, urlPath: string, opts: CallOptions = {}) {
  const headers: Record<string, string> = { "x-test-peer": opts.peer ?? LAN, ...opts.headers };
  if (opts.token) headers.authorization = `Bearer ${opts.token}`;
  if (opts.authorization) headers.authorization = opts.authorization;
  if (opts.body !== undefined) headers["content-type"] = "application/json";
  const res = await fetch(base + urlPath, {
    method,
    headers,
    body: opts.body === undefined ? undefined : JSON.stringify(opts.body),
  });
  const text = await res.text();
  let json: any = null;
  try {
    json = JSON.parse(text);
  } catch {
    json = null;
  }
  return { status: res.status, json, headers: res.headers };
}

/** A concrete URL for a route pattern, with query params the handler wants. */
function sampleUrl(routePath: string): string {
  const filled = routePath
    .replace(":calendarId", "cal-1")
    .replace(":id", "1")
    .replace(":key", "chores");
  if (filled === "/api/calendar/events") return `${filled}?from=2026-11-01&to=2026-11-30`;
  return filled;
}

async function pairDevice(name = "laptop"): Promise<string> {
  const issued = await call("POST", "/api/system/pairing-code", { peer: LOOPBACK });
  expect(issued.status).toBe(201);
  const paired = await call("POST", "/api/pair", { body: { code: issued.json.code, name } });
  expect(paired.status).toBe(201);
  return paired.json.token as string;
}

function routeTable(): string[] {
  const stack = (app as any)._router.stack as Array<{ route?: { path: string; methods: Record<string, boolean> } }>;
  return stack
    .filter((layer) => layer.route && layer.route.path.startsWith("/api"))
    .flatMap((layer) =>
      Object.keys(layer.route!.methods).map((m) => `${m.toUpperCase()} ${layer.route!.path}`),
    );
}

describe("route inventory", () => {
  test("every /api route registered by registerRoutes is classified in this file", () => {
    expect(routeTable().sort()).toEqual([...INVENTORY].sort());
  });
});

describe("from a LAN address without a token", () => {
  for (const route of INVENTORY) {
    const [method, routePath] = route.split(" ");
    const expected = OPEN.has(route) ? "open" : "401";
    test(`${route} → ${expected}`, async () => {
      const res = await call(method, sampleUrl(routePath), { body: method === "GET" ? undefined : {} });
      if (OPEN.has(route)) {
        expect(res.status).not.toBe(401);
      } else {
        expect(res.status).toBe(401);
        expect(res.json.pairing).toMatch(/Pair a device/);
        expect(res.headers.get("www-authenticate")).toMatch(/^Bearer/);
      }
    });
  }

  test("GET /api/version answers 200 (the supervisor health check)", async () => {
    const res = await call("GET", "/api/version");
    expect(res.status).toBe(200);
    expect(res.json.version).toBeTruthy();
  });

  test("diagnostics: redacted view is served, the full view needs pairing", async () => {
    expect((await call("GET", "/api/system/diagnostics")).json).toEqual({ view: "redacted" });
    expect((await call("GET", "/api/system/diagnostics?view=redacted")).json).toEqual({ view: "redacted" });
    expect((await call("GET", "/api/system/diagnostics?view=full")).status).toBe(401);
  });

  const bypassAttempts: Array<[string, string]> = [
    ["upper-case path", "/API/calendar/events?from=2026-11-01&to=2026-11-30"],
    ["mixed-case path", "/Api/Calendar/Events?from=2026-11-01&to=2026-11-30"],
    ["trailing slash", "/api/calendar/events/?from=2026-11-01&to=2026-11-30"],
    ["upper-case open-route lookalike", "/API/STATE/chores"],
    ["dot segment", "/api/version/../calendar/events?from=2026-11-01&to=2026-11-30"],
    ["encoded slash", "/api/version%2F..%2Fcalendar/events"],
  ];
  for (const [label, url] of bypassAttempts) {
    test(`no bypass via ${label}`, async () => {
      expect((await call("GET", url)).status).toBe(401);
    });
  }

  test("the open routes stay open in every form Express routes to them", async () => {
    expect((await call("HEAD", "/api/version")).status).toBe(200);
    expect((await call("GET", "/API/VERSION")).status).toBe(200);
    expect((await call("GET", "/api/version/")).status).toBe(200);
    expect((await call("GET", "/api/system/diagnostics/")).status).toBe(200);
    expect((await call("POST", "/api/pair/", { body: {} })).status).not.toBe(401);
  });

  test("an X-Forwarded-For header claiming loopback is ignored", async () => {
    const res = await call("GET", "/api/config/dashboard", { headers: { "x-forwarded-for": LOOPBACK } });
    expect(res.status).toBe(401);
  });

  const badAuth: Array<[string, string]> = [
    ["empty bearer", "Bearer "],
    ["wrong scheme", "Basic dXNlcjpwYXNz"],
    ["unknown token", "Bearer rbp_not-a-real-token"],
    ["token without scheme", "rbp_not-a-real-token"],
  ];
  for (const [label, authorization] of badAuth) {
    test(`refused: ${label}`, async () => {
      expect((await call("GET", "/api/widgets", { authorization })).status).toBe(401);
    });
  }
});

describe("from a LAN address with a paired token", () => {
  let token = "";
  beforeAll(async () => {
    token = await pairDevice("guard-test");
  });

  for (const route of INVENTORY) {
    const [method, routePath] = route.split(" ");
    const expected = LOCALHOST_ONLY.has(route) ? "403 (kiosk only)" : "passes the guard";
    test(`${route} → ${expected}`, async () => {
      const res = await call(method, sampleUrl(routePath), { token, body: method === "GET" ? undefined : {} });
      if (LOCALHOST_ONLY.has(route)) expect(res.status).toBe(403);
      else expect(res.status).not.toBe(401);
    });
  }

  test("the full diagnostics view is served", async () => {
    expect((await call("GET", "/api/system/diagnostics?view=full", { token })).json).toEqual({ view: "full" });
  });
});

describe("from the kiosk (loopback) without a token", () => {
  for (const route of INVENTORY) {
    const [method, routePath] = route.split(" ");
    test(`${route} → passes the guard`, async () => {
      const res = await call(method, sampleUrl(routePath), { peer: LOOPBACK, body: method === "GET" ? undefined : {} });
      expect(res.status).not.toBe(401);
      expect(res.status).not.toBe(403);
    });
  }

  for (const peer of ["::1", "::ffff:127.0.0.1"]) {
    test(`${peer} counts as loopback`, async () => {
      expect((await call("GET", "/api/config/dashboard", { peer })).status).toBe(200);
    });
  }
});

describe("LAN_API_OPEN=true", () => {
  test("LAN calls pass without a token, but kiosk-only routes stay kiosk-only", async () => {
    process.env.LAN_API_OPEN = "true";
    expect((await call("GET", "/api/config/dashboard")).status).toBe(200);
    expect((await call("GET", "/api/system/diagnostics?view=full")).json).toEqual({ view: "full" });
    expect((await call("POST", "/api/update/apply")).status).toBe(403);
    expect((await call("POST", "/api/system/pairing-code")).status).toBe(403);
  });

  test("any other value keeps the guard on", async () => {
    process.env.LAN_API_OPEN = "1";
    expect((await call("GET", "/api/config/dashboard")).status).toBe(401);
  });
});

describe("pairing flow (brief 05 §5 acceptance)", () => {
  test("401 → pair with the code → 200 → revoke on the kiosk → 401", async () => {
    const events = "/api/calendar/events?from=2026-11-01&to=2026-11-30";
    const before = await call("GET", events);
    expect(before.status).toBe(401);
    expect(before.json.pairing).toMatch(/POST \/api\/pair/);

    const token = await pairDevice("acceptance-laptop");
    expect(token).toMatch(/^rbp_[A-Za-z0-9_-]{40,}$/);
    expect((await call("GET", events, { token })).status).toBe(200);

    const listed = await call("GET", "/api/system/paired-devices", { peer: LOOPBACK });
    const device = listed.json.devices.find((d: { name: string }) => d.name === "acceptance-laptop");
    expect(device).toBeTruthy();
    expect(JSON.stringify(listed.json)).not.toContain(token);

    expect((await call("DELETE", `/api/system/paired-devices/${device.id}`, { peer: LOOPBACK })).status).toBe(204);
    expect((await call("GET", events, { token })).status).toBe(401);
  });

  test("the token is stored hashed, never in plain text", async () => {
    const token = await pairDevice("hash-check");
    const stored = fs.readFileSync(devicesFile, "utf-8");
    expect(stored).not.toContain(token);
    expect(stored).toMatch(/"tokenHash": "[0-9a-f]{64}"/);
  });

  test("a code is single use", async () => {
    const issued = await call("POST", "/api/system/pairing-code", { peer: LOOPBACK });
    expect((await call("POST", "/api/pair", { body: { code: issued.json.code, name: "one" } })).status).toBe(201);
    expect((await call("POST", "/api/pair", { body: { code: issued.json.code, name: "two" } })).status).toBe(410);
  });

  test("an expired code → 410", async () => {
    const issued = await call("POST", "/api/system/pairing-code", { peer: LOOPBACK });
    now += PAIRING_CODE_TTL_MS;
    const res = await call("POST", "/api/pair", { body: { code: issued.json.code, name: "late" } });
    expect(res.status).toBe(410);
  });

  test("cancelling a code that is no longer showing leaves the newer code alone", async () => {
    const first = await call("POST", "/api/system/pairing-code", { peer: LOOPBACK });
    const second = await call("POST", "/api/system/pairing-code", { peer: LOOPBACK });
    await call("DELETE", `/api/system/pairing-code?code=${first.json.code}`, { peer: LOOPBACK });
    if (first.json.code !== second.json.code) {
      expect((await call("POST", "/api/pair", { body: { code: second.json.code, name: "newer" } })).status).toBe(201);
    }
  });

  test("a numeric code is accepted, leading zeros included", async () => {
    const issued = await call("POST", "/api/system/pairing-code", { peer: LOOPBACK });
    const res = await call("POST", "/api/pair", { body: { code: Number(issued.json.code), name: "numeric" } });
    expect(res.status).toBe(201);
  });

  test("the kiosk can ask whether its code still works; it never gets a code back", async () => {
    const issued = await call("POST", "/api/system/pairing-code", { peer: LOOPBACK });
    const status = (code: string) => call("GET", `/api/system/pairing-code?code=${code}`, { peer: LOOPBACK });
    expect((await status(issued.json.code)).json).toEqual({ active: true });
    const wrong = issued.json.code === "000000" ? "000001" : "000000";
    for (let i = 0; i < 5; i++) await call("POST", "/api/pair", { body: { code: wrong, name: "guess" } });
    expect((await status(issued.json.code)).json).toEqual({ active: false });
  });

  test("no code showing → 410", async () => {
    await call("DELETE", "/api/system/pairing-code", { peer: LOOPBACK });
    expect((await call("POST", "/api/pair", { body: { code: "123456", name: "x" } })).status).toBe(410);
  });

  test("5 wrong codes invalidate the code, even the right one then fails", async () => {
    const issued = await call("POST", "/api/system/pairing-code", { peer: LOOPBACK });
    const wrong = issued.json.code === "000000" ? "000001" : "000000";
    const left: number[] = [];
    for (let i = 0; i < 5; i++) {
      const res = await call("POST", "/api/pair", { body: { code: wrong, name: "guess" } });
      expect(res.status).toBe(403);
      left.push(res.json.attemptsLeft);
    }
    expect(left).toEqual([4, 3, 2, 1, 0]);
    expect((await call("POST", "/api/pair", { body: { code: issued.json.code, name: "real" } })).status).toBe(410);
  });

  test("a missing or blank name → 400, and the code still works afterwards", async () => {
    const issued = await call("POST", "/api/system/pairing-code", { peer: LOOPBACK });
    expect((await call("POST", "/api/pair", { body: { code: issued.json.code } })).status).toBe(400);
    expect((await call("POST", "/api/pair", { body: { code: issued.json.code, name: "   " } })).status).toBe(400);
    expect((await call("POST", "/api/pair", { body: { code: issued.json.code, name: "ok" } })).status).toBe(201);
  });

  test("a LAN caller can't issue or cancel a code, even when paired", async () => {
    const token = await pairDevice("no-issue");
    expect((await call("POST", "/api/system/pairing-code", { token })).status).toBe(403);
    expect((await call("DELETE", "/api/system/pairing-code", { token })).status).toBe(403);
  });

  test("a damaged devices file refuses every token, and the next pairing keeps it aside", async () => {
    const token = await pairDevice("before-damage");
    fs.writeFileSync(devicesFile, "{not json");
    expect((await call("GET", "/api/widgets", { token })).status).toBe(401);
    await pairDevice("after-damage");
    expect(fs.readFileSync(`${devicesFile}.damaged`, "utf-8")).toBe("{not json");
    const listed = await call("GET", "/api/system/paired-devices", { peer: LOOPBACK });
    expect(listed.json.devices.map((d: { name: string }) => d.name)).toEqual(["after-damage"]);
  });
});
