import type { DiagnosticsBundle } from "@shared/diagnostics";
import { formatAsOf } from "@/widgets/what-to-wear/time-windows";

/** One readable line of Settings → System → Diagnostics. */
export interface DiagnosticsRow {
  label: string;
  value: string;
  /** Shown with a warning mark: probably the thing to fix. */
  warn: boolean;
}

const LOW_DISK_BYTES = 1024 ** 3;
const DISK_USED_WARN_PERCENT = 80;
const SELF_HEAL_WARN_COUNT = 3;

export function formatDuration(seconds: number): string {
  const s = Math.max(0, Math.floor(seconds));
  const days = Math.floor(s / 86400);
  const hours = Math.floor((s % 86400) / 3600);
  const minutes = Math.floor((s % 3600) / 60);
  if (days > 0) return `${days} d ${hours} h`;
  if (hours > 0) return `${hours} h ${minutes} min`;
  return `${minutes} min`;
}

export function formatBytes(bytes: number): string {
  const gb = bytes / 1024 ** 3;
  if (gb >= 1) return `${gb.toFixed(1)} GB`;
  return `${Math.round(bytes / 1024 ** 2)} MB`;
}

function updateRow(b: DiagnosticsBundle, now: Date): DiagnosticsRow {
  if (b.update.status === "error") {
    return { label: "Updates", value: `Last update failed: ${b.update.error ?? b.update.message}`, warn: true };
  }
  const check = b.update.lastCheck;
  if (!check) return { label: "Updates", value: "Not checked since the app started", warn: false };
  const when = formatAsOf(check.at, now);
  if (!check.ok) return { label: "Updates", value: `Check failed at ${when}`, warn: true };
  if (check.updateAvailable) return { label: "Updates", value: `${check.latestVersion} available (checked ${when})`, warn: false };
  return { label: "Updates", value: `Up to date (checked ${when})`, warn: false };
}

/** The unit's Google sign-in client: present or not, and its project number only. */
function googleClientRow(b: DiagnosticsBundle): DiagnosticsRow {
  const client = b.auth.oauthClient;
  if (!client) return { label: "Google sign-in client", value: "unknown", warn: false };
  if (client.status === "configured") {
    const project = client.projectNumber ? `, project ${client.projectNumber}` : "";
    return { label: "Google sign-in client", value: `configured: yes${project}`, warn: false };
  }
  // A service-account unit doesn't need one.
  const warn = b.auth.mode !== "service-account";
  return { label: "Google sign-in client", value: client.status === "missing" ? "missing" : "invalid file", warn };
}

function googleRow(b: DiagnosticsBundle): DiagnosticsRow {
  if (b.auth.mode === "none") return { label: "Google Calendar", value: "Not connected (no Google sign-in or key file)", warn: true };
  if (b.auth.connected) {
    const how = b.auth.mode === "oauth" ? "signed in with Google" : "service account";
    return { label: "Google Calendar", value: `Connected (${how})`, warn: false };
  }
  return { label: "Google Calendar", value: `Not connected: ${b.auth.error ?? "starting up"}`, warn: true };
}

function syncRow(b: DiagnosticsBundle, now: Date): DiagnosticsRow {
  const { lastSyncAt, lastSyncError, syncing } = b.calendarSync;
  const last = lastSyncAt ? formatAsOf(lastSyncAt, now) : "not yet";
  if (lastSyncError) return { label: "Calendar sync", value: `Last good: ${last}. Error: ${lastSyncError}`, warn: true };
  return { label: "Calendar sync", value: syncing ? `Syncing now (last good: ${last})` : `Last good: ${last}`, warn: false };
}

function weatherRow(b: DiagnosticsBundle, now: Date): DiagnosticsRow {
  const { configured, lastSuccessAt, lastError } = b.weather;
  if (!configured) return { label: "Weather", value: "Not set up", warn: false };
  const failing = lastError !== null && (lastSuccessAt === null || Date.parse(lastError.at) > Date.parse(lastSuccessAt));
  if (failing) return { label: "Weather", value: `Failing since ${formatAsOf(lastError!.at, now)}: ${lastError!.reason}`, warn: true };
  return { label: "Weather", value: lastSuccessAt ? `Updated ${formatAsOf(lastSuccessAt, now)}` : "Not fetched yet", warn: false };
}

function widgetsRow(b: DiagnosticsBundle): DiagnosticsRow {
  const parts = b.widgets.enabled.map((w) => {
    const version = w.version ? ` ${w.version}` : "";
    return w.error ? `${w.id}${version} (${w.error})` : `${w.id}${version}`;
  });
  const warn = b.widgets.enabled.some((w) => w.error !== null);
  return { label: "Widgets", value: parts.length > 0 ? parts.join(", ") : "None enabled", warn };
}

function networkRow(b: DiagnosticsBundle): DiagnosticsRow {
  if (!b.network.connected) return { label: "Network", value: "No network connection", warn: true };
  return { label: "Network", value: `Connected${b.network.interface ? ` (${b.network.interface})` : ""}`, warn: false };
}

function internetRow(b: DiagnosticsBundle): DiagnosticsRow {
  const r = b.network.internetReachable;
  const value = r === true ? "Reachable" : r === false ? "Not reachable (latest weather/calendar request failed)" : "Unknown yet";
  return { label: "Internet", value, warn: r === false };
}

// Warn on either rule: a big card can be mostly full with gigabytes left,
// and a small one can be under 1 GB free while still under 80 % used.
// "Used" is total minus the space the app can still write (statfs bavail),
// so blocks the filesystem reserves for root count as used: on ext4 this
// reads a few points above `df`'s Use%.
function diskRow(b: DiagnosticsBundle): DiagnosticsRow {
  if (!b.disk) return { label: "Disk", value: "Unknown", warn: false };
  const { freeBytes, totalBytes } = b.disk;
  const usedBytes = Math.max(0, totalBytes - freeBytes);
  const usedPercent = totalBytes > 0 ? Math.round((usedBytes / totalBytes) * 100) : 0;
  const lowFree = freeBytes < LOW_DISK_BYTES || (totalBytes > 0 && freeBytes / totalBytes < 0.05);
  // Compared after rounding, so the warning agrees with the percentage shown.
  const mostlyFull = usedPercent > DISK_USED_WARN_PERCENT;
  return {
    label: "Disk",
    value: `${formatBytes(usedBytes)} of ${formatBytes(totalBytes)} used (${usedPercent}%)`,
    warn: lowFree || mostlyFull,
  };
}

function selfHealRow(b: DiagnosticsBundle): DiagnosticsRow {
  const n = b.wifiSelfHealCount24h;
  if (n === null) return { label: "Wi-Fi self-heal (24 h)", value: "Not available", warn: false };
  const value = n === 0 ? "No reconnects needed" : `Reconnected ${n} time${n === 1 ? "" : "s"}`;
  return { label: "Wi-Fi self-heal (24 h)", value, warn: n >= SELF_HEAL_WARN_COUNT };
}

/** The bundle as plain rows, in the order someone troubleshooting would read them. */
export function diagnosticsRows(b: DiagnosticsBundle, now: Date): DiagnosticsRow[] {
  return [
    { label: "Version", value: b.version, warn: false },
    { label: "Running for", value: formatDuration(b.appUptimeSeconds), warn: false },
    { label: "Supervisor", value: b.supervised ? "Yes (restarts itself after updates)" : "No (restart by hand after updates)", warn: !b.supervised },
    updateRow(b, now),
    googleRow(b),
    googleClientRow(b),
    syncRow(b, now),
    weatherRow(b, now),
    networkRow(b),
    internetRow(b),
    selfHealRow(b),
    diskRow(b),
    widgetsRow(b),
    ...b.widgets.folderErrors.map((e) => ({ label: "Widget folder", value: `${e.folder}: ${e.error}`, warn: true })),
    { label: "Theme", value: b.themeId ?? "default", warn: false },
    ...b.configWarnings.map((w) => ({ label: "Config", value: w, warn: true })),
    { label: "System", value: `${b.platform}/${b.arch}, Node ${b.nodeVersion}, up ${formatDuration(b.systemUptimeSeconds)}`, warn: false },
  ];
}
