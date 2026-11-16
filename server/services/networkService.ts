/**
 * On-device network and time-zone control for the first-run wizard
 * (beta-launch brief 03, decision 0018). Thin wrappers over NetworkManager's
 * `nmcli -t` (terse) output and `timedatectl`, run as the app's own user.
 * A polkit rule shipped in scripts/polkit/ grants that user the few actions
 * these need — no sudo, no root.
 *
 * When a tool is missing (a laptop, CI), that is reported as a capability
 * (`managed: false`), never as an error: the wizard then shows "managed
 * outside Rootboard" and moves on.
 *
 * Wi-Fi passwords go to NetworkManager's own store and nowhere else. They are
 * never logged, never returned, and never part of an error this module
 * throws — `runCommand` resolves with a plain result object instead of
 * rejecting with Node's exec error, because that error carries the whole
 * command line (`err.cmd`), password included.
 */

import { execFile } from "child_process";
import os from "os";
import type {
  ActiveConnection,
  ConnectFailureReason,
  NetworkStatus,
  TimezoneInfo,
  WifiNetwork,
} from "@shared/system-network";

export type { ActiveConnection, ConnectFailureReason, NetworkStatus, TimezoneInfo, WifiNetwork };

export const COMMAND_TIMEOUT_MS = 30_000;
/** nmcli's own wait for an activation, kept under COMMAND_TIMEOUT_MS so nmcli
 *  reports the failure itself instead of being killed mid-way. */
const NMCLI_CONNECT_WAIT_SECONDS = 25;
const INTERNET_CHECK_TIMEOUT_MS = 10_000;
/** A repeat ask within this window reuses the last answer, so polling (or a
 *  LAN client hammering the open status route) never multiplies the calls. */
export const INTERNET_CHECK_REUSE_MS = 15_000;
/** Status is reused this long, so the 5 s polls (and anyone on the LAN
 *  asking in a loop) cost at most a handful of nmcli runs a few times a
 *  minute. */
export const STATUS_REUSE_MS = 3_000;
/** Google's API host: what the app needs anyway (brief 03, decision 9). */
export const INTERNET_CHECK_URL = "https://www.googleapis.com/";

export interface CommandResult {
  /** Exit code; null when the process never ran or was killed. */
  code: number | null;
  stdout: string;
  stderr: string;
  /** The binary is not installed (ENOENT). */
  missing: boolean;
  timedOut: boolean;
}

export type RunCommand = (file: string, args: string[]) => Promise<CommandResult>;

/**
 * execFile, never a shell: arguments (an SSID, a password) are passed as-is.
 * C.UTF-8, not C: messages stay in English for classifyConnectFailure, and
 * nmcli keeps non-ASCII SSIDs ("Café", a phone's curly apostrophe) intact —
 * under plain C it transliterates them and the name no longer matches.
 */
export const runCommand: RunCommand = (file, args) =>
  new Promise((resolve) => {
    execFile(
      file,
      args,
      { timeout: COMMAND_TIMEOUT_MS, env: { ...process.env, LC_ALL: "C.UTF-8" }, maxBuffer: 1024 * 1024 },
      (error, stdout, stderr) => {
        const err = error as (NodeJS.ErrnoException & { killed?: boolean; signal?: string | null }) | null;
        resolve({
          code: err ? (typeof err.code === "number" ? err.code : null) : 0,
          stdout: String(stdout ?? ""),
          stderr: String(stderr ?? ""),
          missing: err?.code === "ENOENT",
          timedOut: Boolean(err?.killed && err.signal === "SIGTERM"),
        });
      },
    );
  });

// --- nmcli terse output -----------------------------------------------------

/**
 * Splits one line of `nmcli -t` output into fields. Terse mode separates
 * fields with `:` and escapes a literal `:` or `\` inside a value as `\:` and
 * `\\` (an SSID may contain either).
 */
export function splitTerseLine(line: string): string[] {
  const fields: string[] = [];
  let current = "";
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === "\\" && i + 1 < line.length) {
      current += line[i + 1];
      i++;
    } else if (ch === ":") {
      fields.push(current);
      current = "";
    } else {
      current += ch;
    }
  }
  fields.push(current);
  return fields;
}

function terseLines(stdout: string): string[][] {
  return stdout
    .split("\n")
    .map((l) => l.replace(/\r$/, ""))
    .filter((l) => l.length > 0)
    .map(splitTerseLine);
}

export interface NetworkDevice {
  device: string;
  type: string;
  state: string;
  connection: string;
}

/** `nmcli -t -f DEVICE,TYPE,STATE,CONNECTION device status` */
export function parseDeviceStatus(stdout: string): NetworkDevice[] {
  return terseLines(stdout)
    .filter((f) => f.length >= 4)
    .map(([device, type, state, connection]) => ({ device, type, state, connection }));
}

/**
 * `nmcli -t -f IN-USE,SSID,SIGNAL,SECURITY device wifi list`. Hidden networks
 * (empty SSID) are dropped — the wizard offers "type it" for those — and an
 * SSID seen on several access points is listed once, at its best signal.
 * Sorted strongest first.
 */
export function parseWifiList(stdout: string): WifiNetwork[] {
  const bySsid = new Map<string, WifiNetwork>();
  for (const fields of terseLines(stdout)) {
    if (fields.length < 4) continue;
    const [inUseField, ssid, signalField, security] = fields;
    if (!ssid || ssid === "--") continue;
    const signal = Number.parseInt(signalField, 10);
    const network: WifiNetwork = {
      ssid,
      signal: Number.isFinite(signal) ? Math.max(0, Math.min(100, signal)) : 0,
      // Open networks show an empty SECURITY field in terse mode ("--" in the
      // table mode), and some drivers report "--" in terse mode too.
      secured: security.trim() !== "" && security.trim() !== "--",
      inUse: inUseField.trim() === "*",
    };
    const existing = bySsid.get(ssid);
    if (!existing) {
      bySsid.set(ssid, network);
    } else {
      bySsid.set(ssid, {
        ssid,
        signal: Math.max(existing.signal, network.signal),
        secured: existing.secured || network.secured,
        inUse: existing.inUse || network.inUse,
      });
    }
  }
  return Array.from(bySsid.values()).sort((a, b) => b.signal - a.signal || a.ssid.localeCompare(b.ssid));
}

/** `nmcli -t -f IP4.ADDRESS device show <dev>` → the first address, no prefix length. */
export function parseFirstIpv4(stdout: string): string | null {
  for (const fields of terseLines(stdout)) {
    if (fields[0]?.startsWith("IP4.ADDRESS") && fields[1]) {
      return fields[1].split("/")[0] || null;
    }
  }
  return null;
}

/** `nmcli -t -f NAME,UUID,TYPE connection show` → Wi-Fi profiles only. */
export function parseWifiConnections(stdout: string): { name: string; uuid: string }[] {
  return terseLines(stdout)
    .filter((f) => f.length >= 3 && (f[2] === "802-11-wireless" || f[2] === "wifi"))
    .map(([name, uuid]) => ({ name, uuid }));
}

/**
 * Maps a failed `nmcli device wifi connect` to a reason the wizard turns into
 * one plain sentence. Exit code 10 is nmcli's "connection, device or access
 * point does not exist"; a rejected key shows up as missing secrets or a
 * failed 4-way handshake.
 */
export function classifyConnectFailure(result: CommandResult): ConnectFailureReason {
  if (result.timedOut) return "timeout";
  const text = `${result.stdout}\n${result.stderr}`;
  if (result.code === 10 || /No network with SSID/i.test(text)) return "not-found";
  if (/secrets were required|no-secrets|802-1x supplicant|password|psk|handshake/i.test(text)) return "bad-password";
  if (/timeout|timed out/i.test(text)) return "timeout";
  return "failed";
}

// --- Status -----------------------------------------------------------------

/**
 * `nmcli -t -f STATE general` → whether NetworkManager has a way out: its
 * overall state is "connected" (global) or "connected (site only)" (a
 * default route, but its connectivity check failed — a captive portal, or
 * the check is unreachable). "connected (local only)" — e.g. only a Docker
 * bridge or a VPN interface is up — is not a network the wizard can stop at.
 * This is NetworkManager's own judgement, so a link it brought up and one
 * configured outside it (with a default route) both count.
 */
export function isGloballyConnected(generalState: string): boolean {
  const state = generalState.trim();
  return state === "connected" || state === "connected (site only)";
}

/** A device with a link up: any "connected…" state, including
 *  "connected (externally)", on anything but loopback and Wi-Fi P2P. */
export function isUplink(d: NetworkDevice): boolean {
  return d.state.startsWith("connected") && d.type !== "loopback" && d.type !== "wifi-p2p";
}

/** The `-g <field>` value of a one-field nmcli read: terse-escaped, and any
 *  spaces in it belong to the value (an SSID may end in one). */
export function parseSingleValue(stdout: string): string {
  return splitTerseLine(stdout.replace(/\r?\n$/, ""))[0] ?? "";
}

export type FetchFn = (url: string, init?: RequestInit) => Promise<Response>;

export interface NetworkServiceDeps {
  run?: RunCommand;
  fetchFn?: FetchFn;
  uptime?: () => number;
  now?: () => number;
}

export type ConnectResult =
  | { status: "connected" }
  | { status: "failed"; reason: ConnectFailureReason }
  | { status: "unmanaged" };

export type SetTimezoneResult =
  | { status: "set"; timezone: string }
  | { status: "invalid" }
  | { status: "failed" }
  | { status: "unmanaged" };

/** IANA zone names: letters, digits and `_ + - /`, never a leading `-`
 *  (which timedatectl would read as an option). */
const TIMEZONE_RE = /^[A-Za-z0-9_+][A-Za-z0-9_+-]*(\/[A-Za-z0-9_+-]+)*$/;

export function createNetworkService(deps: NetworkServiceDeps = {}) {
  const run = deps.run ?? runCommand;
  const fetchFn = deps.fetchFn ?? ((url, init) => fetch(url, init));
  const uptime = deps.uptime ?? (() => os.uptime());
  const now = deps.now ?? (() => Date.now());

  // Binaries do not appear or vanish while the server runs: look once. The
  // daemons behind them are asked every time — an installed nmcli with no
  // NetworkManager running (a container, a desktop using something else) or
  // a timedatectl with no systemd is "managed outside Rootboard" too, and a
  // daemon still starting at boot must not be cached as absent.
  let nmcliInstalled: Promise<boolean> | null = null;
  let timedatectlInstalled: Promise<boolean> | null = null;
  const installed = (r: CommandResult) => !r.missing && r.code === 0;

  async function hasNmcli(): Promise<boolean> {
    if (!(await (nmcliInstalled ??= run("nmcli", ["--version"]).then(installed)))) return false;
    const r = await run("nmcli", ["-t", "-f", "RUNNING", "general"]);
    return r.code === 0 && /^(running|starting)/.test(r.stdout.trim());
  }

  /** The current zone, or null when timedatectl is absent or has no systemd to ask. */
  async function currentTimezone(): Promise<{ zone: string | null } | null> {
    if (!(await (timedatectlInstalled ??= run("timedatectl", ["--version"]).then(installed)))) return null;
    const r = await run("timedatectl", ["show", "--property=Timezone", "--value"]);
    return r.code === 0 ? { zone: r.stdout.trim() || null } : null;
  }

  async function devices(): Promise<NetworkDevice[] | null> {
    const r = await run("nmcli", ["-t", "-f", "DEVICE,TYPE,STATE,CONNECTION", "device", "status"]);
    if (r.code !== 0) {
      console.error(`[network] nmcli device status failed (exit ${r.code ?? "none"})`);
      return null;
    }
    return parseDeviceStatus(r.stdout);
  }

  async function ipv4(device: string): Promise<string | null> {
    const r = await run("nmcli", ["-t", "-f", "IP4.ADDRESS", "device", "show", device]);
    return r.code === 0 ? parseFirstIpv4(r.stdout) : null;
  }

  async function activeSsid(): Promise<string | null> {
    const r = await run("nmcli", ["-t", "-f", "IN-USE,SSID,SIGNAL,SECURITY", "device", "wifi", "list", "--rescan", "no"]);
    if (r.code !== 0) return null;
    return parseWifiList(r.stdout).find((n) => n.inUse)?.ssid ?? null;
  }

  let lastInternetCheck: { at: number; result: Promise<"reachable" | "unreachable"> } | null = null;

  function checkInternet(): Promise<"reachable" | "unreachable"> {
    if (lastInternetCheck && now() - lastInternetCheck.at < INTERNET_CHECK_REUSE_MS) return lastInternetCheck.result;
    // Any HTTP answer at all means the internet is reachable; the status
    // code of Google's bare API root is irrelevant.
    const result = fetchFn(INTERNET_CHECK_URL, { method: "HEAD", signal: AbortSignal.timeout(INTERNET_CHECK_TIMEOUT_MS) }).then(
      () => "reachable" as const,
      () => "unreachable" as const,
    );
    lastInternetCheck = { at: now(), result };
    return result;
  }

  async function readStatus(): Promise<Omit<NetworkStatus, "internet" | "uptimeSeconds">> {
    const base = { managed: await hasNmcli(), connected: false, connection: null as ActiveConnection | null, hasWifiDevice: false };
    if (!base.managed) return base;
    const [list, general] = await Promise.all([devices(), run("nmcli", ["-t", "-f", "STATE", "general"])]);
    if (!list) return base;
    base.hasWifiDevice = list.some((d) => d.type === "wifi");
    if (general.code !== 0 || !isGloballyConnected(general.stdout)) return base;
    const up = list.filter(isUplink);
    // Which link to name: wired, then Wi-Fi, then anything else that is up.
    const chosen = up.find((d) => d.type === "ethernet") ?? up.find((d) => d.type === "wifi") ?? up[0];
    base.connected = true;
    if (!chosen) return base;
    const type: ActiveConnection["type"] = chosen.type === "ethernet" ? "ethernet" : chosen.type === "wifi" ? "wifi" : "other";
    const name = type === "wifi" ? ((await activeSsid()) ?? chosen.connection) : chosen.connection;
    base.connection = { type, device: chosen.device, name, ip: await ipv4(chosen.device) };
    return base;
  }

  // Reused while in flight and for STATUS_REUSE_MS after it settles, so a
  // slow nmcli (busy with a connect) never piles up parallel reads.
  let lastStatus: { settledAt: number | null; result: ReturnType<typeof readStatus> } | null = null;

  async function status(opts: { checkInternet?: boolean } = {}): Promise<NetworkStatus> {
    if (!lastStatus || (lastStatus.settledAt !== null && now() - lastStatus.settledAt >= STATUS_REUSE_MS)) {
      const entry: { settledAt: number | null; result: ReturnType<typeof readStatus> } = { settledAt: null, result: readStatus() };
      entry.result.finally(() => {
        entry.settledAt = now();
      }).catch(() => {});
      lastStatus = entry;
    }
    const result: NetworkStatus = { ...(await lastStatus.result), uptimeSeconds: Math.floor(uptime()) };
    if (opts.checkInternet) result.internet = await checkInternet();
    return result;
  }

  async function scan(): Promise<{ status: "unmanaged" } | { status: "failed" } | { status: "ok"; networks: WifiNetwork[] }> {
    if (!(await hasNmcli())) return { status: "unmanaged" };
    const r = await run("nmcli", ["-t", "-f", "IN-USE,SSID,SIGNAL,SECURITY", "device", "wifi", "list", "--rescan", "yes"]);
    if (r.code !== 0) {
      // A denied scan (no polkit rule), a blocked radio: say so, rather than
      // let the wizard claim there are no networks nearby.
      console.error(`[network] nmcli wifi scan failed (exit ${r.code ?? "none"})`);
      return { status: "failed" };
    }
    return { status: "ok", networks: parseWifiList(r.stdout) };
  }

  async function connect(ssid: string, psk: string | undefined, opts: { hidden?: boolean } = {}): Promise<ConnectResult> {
    if (!(await hasNmcli())) return { status: "unmanaged" };
    const args = ["--wait", String(NMCLI_CONNECT_WAIT_SECONDS), "device", "wifi", "connect", ssid];
    if (psk) args.push("password", psk);
    if (opts.hidden) args.push("hidden", "yes");
    const r = await run("nmcli", args);
    // A new link (or a failed attempt that dropped the old one): the last
    // answers no longer apply.
    lastStatus = null;
    if (r.code === 0) {
      lastInternetCheck = null;
      return { status: "connected" };
    }
    const reason = classifyConnectFailure(r);
    // Never the SSID, the password, or nmcli's own text (which can echo the SSID).
    console.error(`[network] Wi-Fi connect failed: ${reason} (exit ${r.code ?? "none"})`);
    return { status: "failed", reason };
  }

  /** Deletes every saved Wi-Fi profile for this SSID. */
  async function forget(ssid: string): Promise<{ status: "forgotten"; removed: number } | { status: "unmanaged" } | { status: "failed" }> {
    if (!(await hasNmcli())) return { status: "unmanaged" };
    const list = await run("nmcli", ["-t", "-f", "NAME,UUID,TYPE", "connection", "show"]);
    if (list.code !== 0) return { status: "failed" };
    let removed = 0;
    for (const { uuid } of parseWifiConnections(list.stdout)) {
      // The profile name is not always the SSID ("Home 1"); compare the SSID itself.
      const s = await run("nmcli", ["-g", "802-11-wireless.ssid", "connection", "show", "uuid", uuid]);
      if (s.code !== 0 || parseSingleValue(s.stdout) !== ssid) continue;
      const del = await run("nmcli", ["connection", "delete", "uuid", uuid]);
      lastStatus = null;
      if (del.code !== 0) return { status: "failed" };
      removed++;
    }
    return { status: "forgotten", removed };
  }

  async function listTimezones(): Promise<TimezoneInfo> {
    const current = await currentTimezone();
    if (!current) return { managed: false };
    const list = await run("timedatectl", ["list-timezones", "--no-pager"]);
    const zones = list.code === 0 ? list.stdout.split("\n").map((z) => z.trim()).filter((z) => TIMEZONE_RE.test(z)) : [];
    return { managed: true, current: current.zone, zones };
  }

  async function setTimezone(tz: string): Promise<SetTimezoneResult> {
    const info = await listTimezones();
    if (!info.managed) return { status: "unmanaged" };
    // zones only holds names that pass TIMEZONE_RE, so this also rules out
    // anything timedatectl could read as an option.
    if (!info.zones.includes(tz)) return { status: "invalid" };
    const r = await run("timedatectl", ["--no-ask-password", "set-timezone", tz]);
    if (r.code !== 0) {
      console.error(`[network] timedatectl set-timezone failed (exit ${r.code ?? "none"})`);
      return { status: "failed" };
    }
    // Node caches the zone at startup; assigning TZ resets that cache, so the
    // server's local-time code (all-day events, event writes) follows at once.
    process.env.TZ = tz;
    return { status: "set", timezone: tz };
  }

  return { status, scan, connect, forget, listTimezones, setTimezone };
}

export type NetworkService = ReturnType<typeof createNetworkService>;

export const networkService = createNetworkService();
