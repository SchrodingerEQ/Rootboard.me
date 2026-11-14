import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import express from "express";
import type { AddressInfo } from "net";
import type { Server } from "http";
import { registerSystemRoutes } from "./system-routes";
import type { NetworkService } from "./services/networkService";

function fakeService(): NetworkService {
  return {
    status: vi.fn(async () => ({
      managed: true,
      timezoneManaged: true,
      connected: false,
      connection: null,
      hasWifiDevice: true,
      uptimeSeconds: 10,
    })),
    scan: vi.fn(async () => ({ managed: true as const, networks: [] })),
    connect: vi.fn(async () => ({ status: "connected" as const })),
    forget: vi.fn(async () => ({ status: "forgotten" as const, removed: 1 })),
    listTimezones: vi.fn(async () => ({ managed: true as const, current: "UTC", zones: ["UTC"] })),
    setTimezone: vi.fn(async (tz: string) => ({ status: "set" as const, timezone: tz })),
  };
}

let server: Server;
let base: string;
let local: boolean;
let service: NetworkService;

beforeEach(async () => {
  vi.spyOn(console, "error").mockImplementation(() => {});
  local = true;
  service = fakeService();
  const app = express();
  app.use(express.json());
  registerSystemRoutes(app, { service, isLocalRequest: () => local });
  server = app.listen(0, "127.0.0.1");
  await new Promise((r) => server.once("listening", r));
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});
afterEach(async () => {
  await new Promise((r) => server.close(r));
  vi.restoreAllMocks();
});

const post = (path: string, body: unknown) =>
  fetch(base + path, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });

describe("system routes", () => {
  test.each([
    ["/api/system/network/scan", {}],
    ["/api/system/network/connect", { ssid: "ExampleHome", password: "password1" }],
    ["/api/system/network/forget", { ssid: "ExampleHome" }],
    ["/api/system/timezone", { timezone: "UTC" }],
  ])("%s is refused from the LAN with 403 and does nothing", async (path, body) => {
    local = false;
    const res = await post(path, body);
    expect(res.status).toBe(403);
    expect(service.scan).not.toHaveBeenCalled();
    expect(service.connect).not.toHaveBeenCalled();
    expect(service.forget).not.toHaveBeenCalled();
    expect(service.setTimezone).not.toHaveBeenCalled();
  });

  test("read-only status and time zone stay open to the LAN", async () => {
    local = false;
    expect((await fetch(base + "/api/system/network/status")).status).toBe(200);
    expect((await fetch(base + "/api/system/timezone")).status).toBe(200);
  });

  test("the internet check runs only when asked", async () => {
    await fetch(base + "/api/system/network/status");
    expect(service.status).toHaveBeenLastCalledWith({ checkInternet: false });
    await fetch(base + "/api/system/network/status?internet=1");
    expect(service.status).toHaveBeenLastCalledWith({ checkInternet: true });
  });

  test("connect hands SSID and password to the service and never echoes the password", async () => {
    const res = await post("/api/system/network/connect", { ssid: "ExampleHome", password: "correct horse" });
    expect(await res.json()).toEqual({ status: "connected" });
    expect(service.connect).toHaveBeenCalledWith("ExampleHome", "correct horse", { hidden: undefined });
  });

  test("a too-short password is the wrong-password sentence, without calling nmcli or echoing it", async () => {
    const res = await post("/api/system/network/connect", { ssid: "ExampleHome", password: "short" });
    expect(res.status).toBe(400);
    const text = await res.text();
    expect(JSON.parse(text)).toEqual({ status: "failed", reason: "bad-password" });
    expect(text).not.toContain("short");
    expect(service.connect).not.toHaveBeenCalled();
  });

  test("an empty password connects to an open network", async () => {
    await post("/api/system/network/connect", { ssid: "Cafe", password: "" });
    expect(service.connect).toHaveBeenCalledWith("Cafe", undefined, { hidden: undefined });
  });

  test.each([[""], ["-x"], ["x".repeat(33)]])("SSID %j is rejected", async (ssid) => {
    expect((await post("/api/system/network/connect", { ssid })).status).toBe(400);
    expect(service.connect).not.toHaveBeenCalled();
  });

  test("unmanaged systems answer 409", async () => {
    vi.mocked(service.setTimezone).mockResolvedValueOnce({ status: "unmanaged" });
    expect((await post("/api/system/timezone", { timezone: "UTC" })).status).toBe(409);
  });
});
