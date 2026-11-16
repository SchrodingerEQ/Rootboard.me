import { describe, expect, test } from "vitest";
import type { DiagnosticsBundle } from "@shared/diagnostics";
import { diagnosticsRows, formatBytes, formatDuration } from "./diagnostics-rows";

const NOW = new Date("2026-11-14T12:00:00");

function healthy(): DiagnosticsBundle {
  return {
    view: "redacted",
    generatedAt: "2026-11-14T12:00:00.000Z",
    version: "1.9.0",
    appUptimeSeconds: 3 * 3600 + 120,
    systemUptimeSeconds: 2 * 86400,
    nodeVersion: "v22.0.0",
    platform: "linux",
    arch: "arm64",
    supervised: true,
    update: { status: "idle", message: "", error: null, lastCheck: null },
    auth: { mode: "service-account", connected: true, error: null },
    calendarSync: { lastSyncAt: null, lastSyncError: null, syncing: false },
    weather: { configured: false, lastSuccessAt: null, lastError: null },
    widgets: { enabled: [{ id: "calendar", source: "built-in", version: "1.0.0", error: null }], folderErrors: [] },
    themeId: null,
    network: { interface: "wlan0", connected: true, internetReachable: true },
    disk: { freeBytes: 10 * 1024 ** 3, totalBytes: 30 * 1024 ** 3 },
    wifiSelfHealCount24h: 0,
    configWarnings: [],
    logTail: [],
  };
}

const row = (b: DiagnosticsBundle, label: string) => diagnosticsRows(b, NOW).find((r) => r.label === label)!;

describe("diagnosticsRows", () => {
  test("a healthy unit shows no warnings", () => {
    expect(diagnosticsRows(healthy(), NOW).filter((r) => r.warn)).toEqual([]);
  });

  test("Google: no key file, connected, and failing", () => {
    const b = healthy();
    expect(row(b, "Google Calendar").value).toBe("Connected (service account)");
    b.auth = { mode: "none", connected: false, error: "key file not found" };
    expect(row(b, "Google Calendar")).toMatchObject({ value: "Not connected (no Google sign-in or key file)", warn: true });
    b.auth = { mode: "service-account", connected: false, error: "invalid_grant" };
    expect(row(b, "Google Calendar")).toMatchObject({ value: "Not connected: invalid_grant", warn: true });
    b.auth = { mode: "oauth", connected: true, error: null };
    expect(row(b, "Google Calendar")).toMatchObject({ value: "Connected (signed in with Google)", warn: false });
    b.auth = { mode: "oauth", connected: false, error: "Google stopped accepting this kiosk's sign-in." };
    expect(row(b, "Google Calendar")).toMatchObject({ value: "Not connected: Google stopped accepting this kiosk's sign-in.", warn: true });
    // ...the sign-in client: project number only, never the id or secret.
    b.auth = { mode: "oauth", connected: true, error: null, oauthClient: { status: "configured", projectNumber: "123456789" } };
    expect(row(b, "Google sign-in client")).toMatchObject({ value: "configured: yes, project 123456789", warn: false });
    b.auth = { mode: "none", connected: false, error: null, oauthClient: { status: "missing", projectNumber: null } };
    expect(row(b, "Google sign-in client")).toMatchObject({ value: "missing", warn: true });
    b.auth = { mode: "service-account", connected: true, error: null, oauthClient: { status: "missing", projectNumber: null } };
    expect(row(b, "Google sign-in client")).toMatchObject({ value: "missing", warn: false });
  });

  test("weather failing more recently than its last success warns", () => {
    const b = healthy();
    b.weather = { configured: true, lastSuccessAt: "2026-11-14T09:00:00", lastError: { at: "2026-11-14T10:00:00", reason: "ENOTFOUND" } };
    expect(row(b, "Weather")).toMatchObject({ warn: true });
    expect(row(b, "Weather").value).toContain("ENOTFOUND");
  });

  test("network down, internet unreachable, low disk and frequent self-heals warn", () => {
    const b = healthy();
    b.network = { interface: null, connected: false, internetReachable: false };
    b.disk = { freeBytes: 500 * 1024 ** 2, totalBytes: 30 * 1024 ** 3 };
    b.wifiSelfHealCount24h = 4;
    expect(row(b, "Network").warn).toBe(true);
    expect(row(b, "Internet").warn).toBe(true);
    expect(row(b, "Disk free")).toMatchObject({ value: "500 MB of 30.0 GB", warn: true });
    expect(row(b, "Wi-Fi self-heal (24 h)")).toMatchObject({ value: "Reconnected 4 times", warn: true });
  });

  test("self-heal unavailable is neutral, not zero", () => {
    const b = healthy();
    b.wifiSelfHealCount24h = null;
    expect(row(b, "Wi-Fi self-heal (24 h)")).toMatchObject({ value: "Not available", warn: false });
  });

  test("config warnings and widget folder errors each get their own warning row", () => {
    const b = healthy();
    b.configWarnings = ["data/config/dashboard.json is not valid JSON; using the default layout"];
    b.widgets.folderErrors = [{ folder: "grocery", error: "id must match folder" }];
    const warned = diagnosticsRows(b, NOW).filter((r) => r.warn).map((r) => r.label);
    expect(warned).toEqual(["Widget folder", "Config"]);
  });

  test("update check states", () => {
    const b = healthy();
    expect(row(b, "Updates").value).toBe("Not checked since the app started");
    b.update.lastCheck = { at: "2026-11-14T08:00:00", ok: true, latestVersion: "1.9.1", updateAvailable: true };
    expect(row(b, "Updates").value).toMatch(/^1\.9\.1 available/);
    b.update.lastCheck = { at: "2026-11-14T08:00:00", ok: false, latestVersion: null, updateAvailable: false };
    expect(row(b, "Updates").warn).toBe(true);
  });
});

describe("formatters", () => {
  test("formatDuration", () => {
    expect(formatDuration(59)).toBe("0 min");
    expect(formatDuration(3 * 3600 + 120)).toBe("3 h 2 min");
    expect(formatDuration(2 * 86400 + 3600)).toBe("2 d 1 h");
  });

  test("formatBytes", () => {
    expect(formatBytes(1.5 * 1024 ** 3)).toBe("1.5 GB");
    expect(formatBytes(200 * 1024 ** 2)).toBe("200 MB");
  });
});
