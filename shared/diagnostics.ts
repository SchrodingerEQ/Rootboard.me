/**
 * The diagnostics bundle (`GET /api/system/diagnostics`, beta-launch brief
 * 05). One JSON document describing the unit's health. Two views:
 *
 * - `redacted`: safe to paste anywhere. No SSID, IP, hostname, email,
 *   token, or home path; open to any caller on the network.
 * - `full`: adds the SSID, IP and hostname. Kiosk screen and paired callers only.
 */

export type DiagnosticsView = "redacted" | "full";

export interface DiagnosticsBundle {
  view: DiagnosticsView;
  generatedAt: string;
  version: string;
  appUptimeSeconds: number;
  systemUptimeSeconds: number;
  nodeVersion: string;
  platform: string;
  arch: string;
  /** Running under scripts/start.sh, systemd or pm2 (can self-restart after an update). */
  supervised: boolean;
  update: {
    status: string;
    message: string;
    error: string | null;
    lastCheck: { at: string; ok: boolean; latestVersion: string | null; updateAvailable: boolean } | null;
  };
  /** How the unit reads Google Calendar. Never carries the account email. */
  auth: {
    mode: "service-account" | "oauth" | "none";
    connected: boolean;
    error: string | null;
    /** data/google-oauth-client.json (brief 02). Never the secret or the full
     *  client id: only the Cloud project number, when configured. */
    oauthClient?: { status: "missing" | "configured" | "invalid"; projectNumber: string | null };
  };
  calendarSync: { lastSyncAt: string | null; lastSyncError: string | null; syncing: boolean };
  weather: { configured: boolean; lastSuccessAt: string | null; lastError: { at: string; reason: string } | null };
  widgets: {
    enabled: Array<{ id: string; source: "built-in" | "community"; version: string | null; error: string | null }>;
    folderErrors: Array<{ folder: string; error: string }>;
  };
  themeId: string | null;
  network: {
    /** Name of the interface carrying the LAN address (e.g. wlan0), or null. */
    interface: string | null;
    connected: boolean;
    /**
     * Inferred from the latest weather fetch / calendar sync (the bundle
     * makes no network call of its own); null when neither has run yet.
     */
    internetReachable: boolean | null;
    /** Full view only. */
    ssid?: string | null;
    ip?: string | null;
    hostname?: string | null;
  };
  disk: { freeBytes: number; totalBytes: number } | null;
  /**
   * Times the wifi-selfheal timer (INSTALLATION.md §12.3) reconnected Wi-Fi
   * in the last 24 h; null when the timer isn't installed or the journal
   * isn't readable by the app's user.
   */
  wifiSelfHealCount24h: number | null;
  configWarnings: string[];
  /** Last 50 lines of the app's own in-memory log, scrubbed. */
  logTail: string[];
}
