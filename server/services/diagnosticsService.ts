/**
 * Assembles the diagnostics bundle (shared/diagnostics.ts) from the
 * existing services. One builder produces the full view; the redacted view
 * is that same document after `redactDiagnostics`, so the two can never
 * drift apart field by field.
 *
 * Nothing here makes a network call or writes a file. The app never sends
 * the bundle anywhere: it is read on the kiosk screen or fetched by a caller.
 */

import { execFile } from "child_process";
import fs from "fs";
import os from "os";
import { APP_VERSION } from "@shared/version";
import { WIDGET_API_VERSION } from "@shared/widget-manifest";
import type { DiagnosticsBundle, DiagnosticsView } from "@shared/diagnostics";
import calendarManifest from "../../client/src/widgets/calendar/manifest.json";
import choresManifest from "../../client/src/widgets/chores/manifest.json";
import dinnerManifest from "../../client/src/widgets/dinner/manifest.json";
import whatToWearManifest from "../../client/src/widgets/what-to-wear/manifest.json";
import { googleCalendarService } from "./googleCalendar";
import { getLastUpdateCheck, getUpdateStatus, isSupervised } from "./updateService";
import { getWeatherStatus } from "./weatherService";
import { readDashboardConfig } from "./configService";
import { discoverWidgets } from "./widgetDiscovery";
import { logRing, scrubSecrets } from "./logRing";

export const DIAGNOSTICS_LOG_TAIL_LINES = 50;

const BUILTIN_WIDGET_VERSIONS: Record<string, string> = Object.fromEntries(
  [calendarManifest, choresManifest, dinnerManifest, whatToWearManifest].map((m) => [m.id, m.version]),
);

/** A success older than this no longer counts as "the internet works". */
const REACHABILITY_WINDOW_MS = 2 * 60 * 60 * 1000;
/** Values shorter than this are too common to scrub without mangling the bundle (and identify nobody). */
const MIN_SCRUB_LENGTH = 3;

const IPV4_RE = /\b(?:\d{1,3}\.){3}\d{1,3}\b/g;
const HOME_PATH_RE = /\/home\/[^/\s"']+/g;

/**
 * Turn the full bundle into the redacted one: drop the network identifiers,
 * then scrub every string for them (they can turn up in log lines or error
 * messages), plus the Linux username, IPv4 literals, home paths, emails,
 * tokens, and any remaining "@".
 *
 * `extraSecrets` are values that must not appear anywhere (the username);
 * the SSID, IP and hostname are taken from the bundle itself.
 */
export function redactDiagnostics(full: DiagnosticsBundle, extraSecrets: string[] = []): DiagnosticsBundle {
  const secrets = [full.network.ssid, full.network.ip, full.network.hostname, ...extraSecrets]
    .filter((s): s is string => typeof s === "string" && s.length >= MIN_SCRUB_LENGTH)
    // Longest first, so a value that contains another is replaced whole.
    .sort((a, b) => b.length - a.length);

  const scrub = (text: string): string => {
    let out = text;
    for (const secret of secrets) out = out.split(secret).join("[redacted]");
    return scrubSecrets(out)
      .replace(IPV4_RE, "[ip]")
      .replace(HOME_PATH_RE, "/home/[user]")
      .replace(/@/g, "[at]");
  };

  const { ssid: _ssid, ip: _ip, hostname: _hostname, ...network } = full.network;
  return scrubStrings({ ...full, view: "redacted", network }, scrub);
}

function scrubStrings<T>(value: T, scrub: (s: string) => string): T {
  if (typeof value === "string") return scrub(value) as T;
  if (Array.isArray(value)) return value.map((v) => scrubStrings(v, scrub)) as T;
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(([k, v]) => [k, scrubStrings(v, scrub)]),
    ) as T;
  }
  return value;
}

/** The full view still never carries an email or token (auth mode, never the account). */
function scrubFull(bundle: DiagnosticsBundle): DiagnosticsBundle {
  return scrubStrings(bundle, scrubSecrets);
}

/**
 * Most recent of: weather success, weather failure, calendar sync success.
 * A calendar sync failure has no timestamp, so it only counts when there
 * is nothing else to go on.
 */
export function inferInternetReachable(
  weather: DiagnosticsBundle["weather"],
  sync: DiagnosticsBundle["calendarSync"],
  now: number,
): boolean | null {
  const events: Array<{ at: number; ok: boolean }> = [];
  if (weather.lastSuccessAt) events.push({ at: Date.parse(weather.lastSuccessAt), ok: true });
  if (weather.lastError) events.push({ at: Date.parse(weather.lastError.at), ok: false });
  if (sync.lastSyncAt) events.push({ at: Date.parse(sync.lastSyncAt), ok: true });
  const latest = events.filter((e) => Number.isFinite(e.at)).sort((a, b) => b.at - a.at)[0];
  if (!latest) return sync.lastSyncError ? false : null;
  if (!latest.ok) return false;
  return now - latest.at <= REACHABILITY_WINDOW_MS ? true : null;
}

/** Lines the wifi-selfheal script logs after a successful `nmcli con up` (INSTALLATION.md §12.3). */
export function countSelfHealReconnects(journalOutput: string): number {
  return journalOutput.split(/\r?\n/).filter((line) => line.trim() === "reconnected").length;
}

/**
 * journalctl prints this hint (and exits 0 with no entries) when the
 * service user can't see the system journal; that is "unknown", not zero.
 */
export function journalIsUnreadable(stderr: string): boolean {
  return /not seeing messages|insufficient permissions|no journal files/i.test(stderr);
}

/** `nmcli -t -f active,ssid dev wifi` → the active SSID (colons in -t output are escaped as `\:`). */
export function parseNmcliActiveSsid(output: string): string | null {
  for (const line of output.split(/\r?\n/)) {
    if (line.startsWith("yes:")) {
      const ssid = line.slice(4).replace(/\\:/g, ":").trim();
      return ssid.length > 0 ? ssid : null;
    }
  }
  return null;
}

function run(cmd: string, args: string[]): Promise<{ ok: boolean; stdout: string; stderr: string }> {
  return new Promise((resolve) => {
    execFile(cmd, args, { timeout: 2000, maxBuffer: 256 * 1024 }, (error, stdout, stderr) => {
      resolve({ ok: !error, stdout: String(stdout ?? ""), stderr: String(stderr ?? "") });
    });
  });
}

async function readSsid(): Promise<string | null> {
  const nm = await run("nmcli", ["-t", "-f", "active,ssid", "dev", "wifi"]);
  if (nm.ok) return parseNmcliActiveSsid(nm.stdout);
  const iw = await run("iwgetid", ["-r"]);
  return iw.ok && iw.stdout.trim() ? iw.stdout.trim() : null;
}

const SELFHEAL_TIMER_UNIT = "/etc/systemd/system/wifi-selfheal.timer";

async function readSelfHealCount(): Promise<number | null> {
  if (!fs.existsSync(SELFHEAL_TIMER_UNIT)) return null;
  const result = await run("journalctl", ["-t", "wifi-selfheal", "--since", "-24h", "-o", "cat", "--no-pager"]);
  if (!result.ok || journalIsUnreadable(result.stderr)) return null;
  return countSelfHealReconnects(result.stdout);
}

/** Prefer Wi-Fi, then wired; the first external IPv4 address wins. */
function primaryInterface(): { name: string; ip: string } | null {
  const candidates: Array<{ name: string; ip: string }> = [];
  for (const [name, addrs] of Object.entries(os.networkInterfaces())) {
    for (const addr of addrs ?? []) {
      if (addr.family === "IPv4" && !addr.internal) candidates.push({ name, ip: addr.address });
    }
  }
  const rank = (n: string) => (n.startsWith("wl") ? 0 : n.startsWith("eth") || n.startsWith("en") ? 1 : 2);
  return candidates.sort((a, b) => rank(a.name) - rank(b.name))[0] ?? null;
}

/** Only the service-account path exists today; brief 02 adds "oauth". */
function authMode(): DiagnosticsBundle["auth"]["mode"] {
  const keyFile = process.env.GOOGLE_SERVICE_ACCOUNT_KEY_FILE || "./service-account.json";
  return fs.existsSync(keyFile) ? "service-account" : "none";
}

function readDisk(): DiagnosticsBundle["disk"] {
  try {
    const s = fs.statfsSync(process.cwd());
    return { freeBytes: s.bavail * s.bsize, totalBytes: s.blocks * s.bsize };
  } catch (error) {
    console.error("Diagnostics: could not read free disk space:", (error as Error).message);
    return null;
  }
}

function readUsername(): string | null {
  try {
    return os.userInfo().username;
  } catch {
    return null;
  }
}

async function collectFull(): Promise<DiagnosticsBundle> {
  const { config, warnings } = readDashboardConfig();
  const discovery = discoverWidgets();
  const discovered = new Map(discovery.widgets.map((m) => [m.id, m]));

  const enabled = config.widgets
    .filter((w) => w.enabled)
    .map((w) => {
      const builtinVersion = BUILTIN_WIDGET_VERSIONS[w.id];
      if (builtinVersion) return { id: w.id, source: "built-in" as const, version: builtinVersion, error: null };
      const manifest = discovered.get(w.id);
      if (!manifest) return { id: w.id, source: "community" as const, version: null, error: "folder missing" };
      const error = manifest.apiVersion > WIDGET_API_VERSION ? "built for a newer Rootboard" : null;
      return { id: w.id, source: "community" as const, version: manifest.version, error };
    });

  const update = getUpdateStatus();
  const connected = googleCalendarService.isConnected();
  const initError = googleCalendarService.getInitError();
  const calendarSync = googleCalendarService.getSyncStatus();
  const weather = getWeatherStatus();
  const iface = primaryInterface();
  const [ssid, selfHeal] = await Promise.all([readSsid(), readSelfHealCount()]);

  return scrubFull({
    view: "full",
    generatedAt: new Date().toISOString(),
    version: APP_VERSION,
    appUptimeSeconds: Math.round(process.uptime()),
    systemUptimeSeconds: Math.round(os.uptime()),
    nodeVersion: process.version,
    platform: process.platform,
    arch: process.arch,
    supervised: isSupervised(),
    update: {
      status: update.status,
      message: update.message,
      error: update.error ?? null,
      lastCheck: getLastUpdateCheck(),
    },
    auth: { mode: authMode(), connected, error: initError },
    calendarSync,
    weather,
    widgets: {
      enabled,
      folderErrors: discovery.invalid.map((i) => ({ folder: i.folder, error: i.errors[0] ?? "invalid widget.json" })),
    },
    themeId: config.theme ?? null,
    network: {
      interface: iface?.name ?? null,
      connected: iface !== null,
      internetReachable: inferInternetReachable(weather, calendarSync, Date.now()),
      ssid,
      ip: iface?.ip ?? null,
      hostname: os.hostname(),
    },
    disk: readDisk(),
    wifiSelfHealCount24h: selfHeal,
    configWarnings: warnings,
    logTail: logRing.tail(DIAGNOSTICS_LOG_TAIL_LINES),
  });
}

// The redacted view is open to anything on the network: answer repeat
// calls from one recent build (shared while in flight), so a caller in a
// loop can't make the Pi re-read config, rescan widgets/ and spawn probes
// on every request.
const BUNDLE_CACHE_MS = 5_000;
let bundleCache: { at: number; full: Promise<DiagnosticsBundle> } | null = null;

function cachedFull(): Promise<DiagnosticsBundle> {
  const now = Date.now();
  if (!bundleCache || now - bundleCache.at >= BUNDLE_CACHE_MS) {
    const full = collectFull();
    bundleCache = { at: now, full };
    // A failed build is not cached; the next call tries again.
    full.catch(() => {
      if (bundleCache?.full === full) bundleCache = null;
    });
  }
  return bundleCache.full;
}

export async function getDiagnostics(view: DiagnosticsView): Promise<DiagnosticsBundle> {
  const full = await cachedFull();
  if (view === "full") return full;
  const username = readUsername();
  return redactDiagnostics(full, username ? [username] : []);
}
