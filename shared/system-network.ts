/**
 * Wire shapes of /api/system/* (first-run wizard, beta-launch brief 03),
 * shared by server/services/networkService.ts and the wizard UI so the two
 * cannot drift apart.
 */

export interface WifiNetwork {
  ssid: string;
  /** 0–100, as nmcli reports it. */
  signal: number;
  secured: boolean;
  inUse: boolean;
}

export interface ActiveConnection {
  /** `other`: a bridge, bond, VLAN … — up, but neither plain Ethernet nor Wi-Fi. */
  type: "wifi" | "ethernet" | "other";
  device: string;
  /** The SSID for Wi-Fi; the profile name otherwise. */
  name: string;
  ip: string | null;
}

export interface NetworkStatus {
  /** NetworkManager (nmcli) is installed and running. */
  managed: boolean;
  connected: boolean;
  /** The connection the wizard reports; wired wins over Wi-Fi. */
  connection: ActiveConnection | null;
  hasWifiDevice: boolean;
  /** Only when the caller asked for the internet check. */
  internet?: "reachable" | "unreachable";
  /** Seconds since the OS booted — the client's boot-time run condition. */
  uptimeSeconds: number;
}

export type ConnectFailureReason = "bad-password" | "not-found" | "timeout" | "failed";

export type ConnectResponse = { status: "connected" } | { status: "failed"; reason: ConnectFailureReason };

export type TimezoneInfo = { managed: false } | { managed: true; current: string | null; zones: string[] };

/**
 * WPA-PSK is 8–63 characters or 64 hex digits; an empty password means an
 * open network. Checked in the UI before asking, and again by the server.
 */
export function isPlausibleWifiPassword(password: string, secured: boolean): boolean {
  if (!secured) return password === "";
  return (password.length >= 8 && password.length <= 63) || /^[0-9a-fA-F]{64}$/.test(password);
}
