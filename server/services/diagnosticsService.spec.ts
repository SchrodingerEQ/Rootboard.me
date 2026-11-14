import { describe, expect, test, vi } from "vitest";
import type { DiagnosticsBundle } from "@shared/diagnostics";
// vi.mock calls below are hoisted above this import by Vitest.
import {
  redactDiagnostics,
  inferInternetReachable,
  countSelfHealReconnects,
  journalIsUnreadable,
  parseNmcliActiveSsid,
} from "./diagnosticsService";

// The pure helpers are under test; keep the real services (and their
// SQLite file and Google key check) out of the import graph.
vi.mock("./googleCalendar", () => ({ googleCalendarService: {} }));
vi.mock("./updateService", () => ({}));
vi.mock("./weatherService", () => ({}));
vi.mock("./configService", () => ({}));
vi.mock("./widgetDiscovery", () => ({}));


// Fixture values: documentation-range IPs, example.com mail, made-up names.
const SSID = "Example Home Wifi";
const HOSTNAME = "kiosk-host-example";
const USERNAME = "kioskuser";
const IP = "192.0.2.44";
// Obviously fake and low-entropy, so the secret scanner has nothing to flag.
const TOKEN = "rbp_" + "fake-token-".repeat(4);

function fixture(): DiagnosticsBundle {
  return {
    view: "full",
    generatedAt: "2026-11-14T12:00:00.000Z",
    version: "1.9.0",
    appUptimeSeconds: 100,
    systemUptimeSeconds: 200,
    nodeVersion: "v22.0.0",
    platform: "linux",
    arch: "arm64",
    supervised: true,
    update: {
      status: "error",
      message: `Download from 198.51.100.7 failed for ${USERNAME}`,
      error: `EACCES /home/${USERNAME}/calendar-app/.update-temp`,
      lastCheck: { at: "2026-11-14T08:00:00.000Z", ok: true, latestVersion: "1.9.0", updateAvailable: false },
    },
    auth: {
      mode: "service-account",
      connected: false,
      error: "Calendar family@example.com: requested entity was not found",
    },
    calendarSync: { lastSyncAt: null, lastSyncError: "Not Found: someone.else@example.org", syncing: false },
    weather: { configured: true, lastSuccessAt: null, lastError: { at: "2026-11-14T11:00:00.000Z", reason: "ENOTFOUND" } },
    widgets: {
      enabled: [{ id: "calendar", source: "built-in", version: "1.0.0", error: null }],
      folderErrors: [{ folder: `widgets-from-${HOSTNAME}`, error: "id must match folder" }],
    },
    themeId: "default",
    network: { interface: "wlan0", connected: true, internetReachable: false, ssid: SSID, ip: IP, hostname: HOSTNAME },
    disk: { freeBytes: 1, totalBytes: 2 },
    wifiSelfHealCount24h: 3,
    configWarnings: [`saved on ${HOSTNAME}`],
    logTail: [
      `12:00:00 PM [express] GET /api/version 200 in 2ms`,
      `Joined "${SSID}" as ${IP} (gateway 192.0.2.1, peer ::ffff:203.0.113.9)`,
      `Authorization: Bearer ${TOKEN}`,
      `token ${TOKEN} issued`,
      `Mail for someone@example.com bounced`,
      `npm package @radix-ui/react-popover loaded`,
      `cwd /home/${USERNAME}/calendar-app on ${HOSTNAME}`,
    ],
  };
}

describe("redactDiagnostics", () => {
  const redacted = redactDiagnostics(fixture(), [USERNAME]);
  const text = JSON.stringify(redacted);

  test("is marked as the redacted view", () => {
    expect(redacted.view).toBe("redacted");
  });

  test("drops the SSID, IP and hostname fields", () => {
    expect(redacted.network).not.toHaveProperty("ssid");
    expect(redacted.network).not.toHaveProperty("ip");
    expect(redacted.network).not.toHaveProperty("hostname");
    expect(redacted.network).toMatchObject({ interface: "wlan0", connected: true, internetReachable: false });
  });

  test("contains no @ at all", () => {
    expect(text).not.toContain("@");
  });

  test("contains no SSID, hostname or username anywhere", () => {
    expect(text).not.toContain(SSID);
    expect(text).not.toContain(HOSTNAME);
    expect(text).not.toContain(USERNAME);
  });

  test("contains no IPv4 literal", () => {
    expect(text).not.toMatch(/\b\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}\b/);
  });

  test("contains no token", () => {
    expect(text).not.toContain(TOKEN);
    expect(text).not.toMatch(/rbp_[A-Za-z0-9_-]{8,}/);
    expect(text).not.toMatch(/Bearer\s+(?!\[token\])\S+/);
  });

  test("keeps the non-identifying content readable", () => {
    expect(redacted.logTail[0]).toBe("12:00:00 PM [express] GET /api/version 200 in 2ms");
    expect(redacted.update.error).toBe("EACCES /home/[user]/calendar-app/.update-temp");
    expect(redacted.version).toBe("1.9.0");
    expect(redacted.wifiSelfHealCount24h).toBe(3);
  });

  test("does not modify the full bundle it was given", () => {
    const full = fixture();
    redactDiagnostics(full, [USERNAME]);
    expect(full.network.ssid).toBe(SSID);
    expect(full.logTail[1]).toContain(IP);
  });

  test("a very short SSID is dropped from the fields but not scrubbed from text", () => {
    const f = fixture();
    f.network.ssid = "ab";
    const r = redactDiagnostics(f);
    expect(r.network).not.toHaveProperty("ssid");
    expect(r.version).toBe("1.9.0");
  });
});

describe("inferInternetReachable", () => {
  const now = Date.parse("2026-11-14T12:00:00Z");
  const noSync = { lastSyncAt: null, lastSyncError: null, syncing: false };

  test("null when nothing has run yet", () => {
    expect(inferInternetReachable({ configured: false, lastSuccessAt: null, lastError: null }, noSync, now)).toBeNull();
  });

  test("true after a recent success", () => {
    const w = { configured: true, lastSuccessAt: "2026-11-14T11:30:00Z", lastError: null };
    expect(inferInternetReachable(w, noSync, now)).toBe(true);
  });

  test("false when the latest event is a failure", () => {
    const w = { configured: true, lastSuccessAt: "2026-11-14T10:00:00Z", lastError: { at: "2026-11-14T11:00:00Z", reason: "x" } };
    expect(inferInternetReachable(w, noSync, now)).toBe(false);
  });

  test("a later calendar sync outranks an older weather failure", () => {
    const w = { configured: true, lastSuccessAt: null, lastError: { at: "2026-11-14T10:00:00Z", reason: "x" } };
    expect(inferInternetReachable(w, { ...noSync, lastSyncAt: "2026-11-14T11:59:00Z" }, now)).toBe(true);
  });

  test("an old success is not evidence either way", () => {
    const w = { configured: true, lastSuccessAt: "2026-11-13T00:00:00Z", lastError: null };
    expect(inferInternetReachable(w, noSync, now)).toBeNull();
  });

  test("a sync error with nothing else to go on → false", () => {
    const w = { configured: false, lastSuccessAt: null, lastError: null };
    expect(inferInternetReachable(w, { ...noSync, lastSyncError: "getaddrinfo ENOTFOUND" }, now)).toBe(false);
  });
});

describe("wifi-selfheal journal parsing", () => {
  test("counts only the reconnected lines", () => {
    const out = [
      "wlan0 is 'disconnected', bringing up home-wifi",
      "reconnected",
      "wlan0 is 'missing', bringing up home-wifi",
      "nmcli con up failed",
      "reconnected",
      "",
    ].join("\n");
    expect(countSelfHealReconnects(out)).toBe(2);
    expect(countSelfHealReconnects("")).toBe(0);
  });

  test("the permissions hint means unreadable, not zero", () => {
    expect(journalIsUnreadable("Hint: You are currently not seeing messages from other users and the system.")).toBe(true);
    expect(journalIsUnreadable("No journal files were opened due to insufficient permissions.")).toBe(true);
    expect(journalIsUnreadable("")).toBe(false);
  });
});

describe("parseNmcliActiveSsid", () => {
  test("picks the active row and unescapes colons", () => {
    expect(parseNmcliActiveSsid("no:Neighbour\nyes:Cafe\\:Guest\nno:Other\n")).toBe("Cafe:Guest");
  });

  test("null when nothing is active", () => {
    expect(parseNmcliActiveSsid("no:Neighbour\n")).toBeNull();
    expect(parseNmcliActiveSsid("")).toBeNull();
  });
});
