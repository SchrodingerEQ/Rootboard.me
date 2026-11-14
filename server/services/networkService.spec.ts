import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import {
  classifyConnectFailure,
  createNetworkService,
  INTERNET_CHECK_URL,
  parseDeviceStatus,
  parseFirstIpv4,
  parseWifiConnections,
  parseSingleValue,
  parseWifiList,
  splitTerseLine,
  STATUS_REUSE_MS,
  type CommandResult,
  type RunCommand,
} from "./networkService";
import * as fx from "./networkService.fixtures";

const ok = (stdout = ""): CommandResult => ({ code: 0, stdout, stderr: "", missing: false, timedOut: false });
const fail = (code: number, stderr = ""): CommandResult => ({ code, stdout: "", stderr, missing: false, timedOut: false });
const missing: CommandResult = { code: null, stdout: "", stderr: "", missing: true, timedOut: false };

/** A fake runner keyed on "file arg arg …"; unmatched commands fail loudly. */
function fakeRun(table: Record<string, CommandResult | ((args: string[]) => CommandResult)>) {
  const calls: string[][] = [];
  const run: RunCommand = async (file, args) => {
    calls.push([file, ...args]);
    const key = [file, ...args].join(" ");
    const entry = table[key] ?? Object.entries(table).find(([k]) => k.endsWith("*") && key.startsWith(k.slice(0, -1)))?.[1];
    if (!entry) throw new Error(`unexpected command: ${key}`);
    return typeof entry === "function" ? entry(args) : entry;
  };
  return { run, calls };
}

const NMCLI_VERSION = {
  "nmcli --version": ok("nmcli tool, version 1.42.4\n"),
  "nmcli -t -f RUNNING general": ok("running\n"),
};
const TIMEDATECTL_VERSION = {
  "timedatectl --version": ok("systemd 252\n"),
  "timedatectl show --property=Timezone --value": ok("Europe/London\n"),
};
const DEVICE_STATUS = "nmcli -t -f DEVICE,TYPE,STATE,CONNECTION device status";
const GENERAL_CONNECTED = { "nmcli -t -f STATE general": ok("connected\n") };
const GENERAL_DISCONNECTED = { "nmcli -t -f STATE general": ok("disconnected\n") };
const WIFI_LIST_CACHED = "nmcli -t -f IN-USE,SSID,SIGNAL,SECURITY device wifi list --rescan no";
const WIFI_LIST_RESCAN = "nmcli -t -f IN-USE,SSID,SIGNAL,SECURITY device wifi list --rescan yes";

beforeEach(() => {
  vi.spyOn(console, "error").mockImplementation(() => {});
});
afterEach(() => {
  vi.restoreAllMocks();
});

describe("terse-output parsing", () => {
  test("splits on unescaped colons and unescapes \\: and \\\\", () => {
    expect(splitTerseLine("a:b\\:c:d\\\\e:")).toEqual(["a", "b:c", "d\\e", ""]);
  });

  test("device status", () => {
    expect(parseDeviceStatus(fx.DEVICE_STATUS_WIFI_CONNECTED)).toEqual([
      { device: "wlan0", type: "wifi", state: "connected", connection: "ExampleHome" },
      { device: "lo", type: "loopback", state: "connected (externally)", connection: "lo" },
      { device: "eth0", type: "ethernet", state: "unavailable", connection: "" },
      { device: "p2p-dev-wlan0", type: "wifi-p2p", state: "disconnected", connection: "" },
    ]);
  });

  test("Wi-Fi list: dedupes by SSID at the best signal, drops hidden, keeps escaped names, strongest first", () => {
    expect(parseWifiList(fx.WIFI_LIST)).toEqual([
      { ssid: "Neighbor 5G", signal: 81, secured: true, inUse: false },
      { ssid: "ExampleHome", signal: 72, secured: true, inUse: true },
      { ssid: "Cafe:Guest", signal: 55, secured: false, inUse: false },
      { ssid: "Back\\Slash", signal: 20, secured: true, inUse: false },
    ]);
  });

  test("first IPv4 address without its prefix length", () => {
    expect(parseFirstIpv4(fx.DEVICE_SHOW_IP4)).toBe("192.0.2.23");
    expect(parseFirstIpv4("")).toBeNull();
  });

  test("saved Wi-Fi profiles only", () => {
    expect(parseWifiConnections(fx.CONNECTION_SHOW).map((c) => c.name)).toEqual(["ExampleHome", "ExampleHome 1"]);
  });

  test.each([
    [fail(4, fx.CONNECT_WRONG_PASSWORD_STDERR), "bad-password"],
    [fail(10, fx.CONNECT_NOT_FOUND_STDERR), "not-found"],
    [{ ...fail(0), code: null, timedOut: true }, "timeout"],
    [fail(4, "Error: Connection activation failed: (53) The Wi-Fi network could not be found.\n"), "failed"],
  ] as const)("connect failure %#", (result, reason) => {
    expect(classifyConnectFailure(result)).toBe(reason);
  });
});

describe("status", () => {
  test("Wi-Fi connected: SSID from the in-use row, IP from device show", async () => {
    const { run } = fakeRun({
      ...NMCLI_VERSION,
      ...TIMEDATECTL_VERSION,
      ...GENERAL_CONNECTED,
      [DEVICE_STATUS]: ok(fx.DEVICE_STATUS_WIFI_CONNECTED),
      [WIFI_LIST_CACHED]: ok(fx.WIFI_LIST),
      "nmcli -t -f IP4.ADDRESS device show wlan0": ok(fx.DEVICE_SHOW_IP4),
    });
    const svc = createNetworkService({ run, uptime: () => 42.7 });
    expect(await svc.status()).toEqual({
      managed: true,
      connected: true,
      connection: { type: "wifi", device: "wlan0", name: "ExampleHome", ip: "192.0.2.23" },
      hasWifiDevice: true,
      uptimeSeconds: 42,
    });
  });

  test("Ethernet wins and needs no Wi-Fi lookup", async () => {
    const { run, calls } = fakeRun({
      ...NMCLI_VERSION,
      ...TIMEDATECTL_VERSION,
      ...GENERAL_CONNECTED,
      [DEVICE_STATUS]: ok(fx.DEVICE_STATUS_ETHERNET_CONNECTED),
      "nmcli -t -f IP4.ADDRESS device show eth0": ok(fx.DEVICE_SHOW_IP4),
    });
    const status = await createNetworkService({ run, uptime: () => 1 }).status();
    expect(status.connection).toEqual({ type: "ethernet", device: "eth0", name: "Wired connection 1", ip: "192.0.2.23" });
    expect(calls.some((c) => c.includes("wifi"))).toBe(false);
  });

  test.each([
    ["a link configured outside NetworkManager", "eth0:ethernet:connected (externally):eth0\nlo:loopback:connected (externally):lo\n", "ethernet"],
    ["a bridge", "br0:bridge:connected:br0\nwlan0:wifi:disconnected:\n", "other"],
  ])("%s counts as connected", async (_name, out, type) => {
    const { run } = fakeRun({ ...NMCLI_VERSION, ...GENERAL_CONNECTED, [DEVICE_STATUS]: ok(out), "nmcli -t -f IP4.ADDRESS device show *": ok("") });
    const status = await createNetworkService({ run, uptime: () => 1 }).status();
    expect(status.connected).toBe(true);
    expect(status.connection?.type).toBe(type);
  });

  test("a Docker bridge or VPN interface alone is not a network (NetworkManager says local only)", async () => {
    const { run } = fakeRun({
      ...NMCLI_VERSION,
      "nmcli -t -f STATE general": ok("connected (local only)\n"),
      [DEVICE_STATUS]: ok("docker0:bridge:connected (externally):docker0\nwlan0:wifi:disconnected:\n"),
    });
    const status = await createNetworkService({ run, uptime: () => 1 }).status();
    expect(status.connected).toBe(false);
    expect(status.connection).toBeNull();
  });

  test("with Wi-Fi and a VPN both up, the Wi-Fi link is the one named", async () => {
    const { run } = fakeRun({
      ...NMCLI_VERSION,
      ...GENERAL_CONNECTED,
      [DEVICE_STATUS]: ok("tailscale0:tun:connected (externally):tailscale0\n" + fx.DEVICE_STATUS_WIFI_CONNECTED),
      [WIFI_LIST_CACHED]: ok(fx.WIFI_LIST),
      "nmcli -t -f IP4.ADDRESS device show wlan0": ok(fx.DEVICE_SHOW_IP4),
    });
    const status = await createNetworkService({ run, uptime: () => 1 }).status();
    expect(status.connection).toMatchObject({ type: "wifi", device: "wlan0", name: "ExampleHome" });
  });

  test("a status read still in flight is shared, however slow", async () => {
    let release!: () => void;
    const gate = new Promise<void>((r) => (release = r));
    let t = 0;
    let reads = 0;
    const run: RunCommand = async (file, args) => {
      const key = [file, ...args].join(" ");
      if (key === "nmcli --version") return ok("1.42\n");
      if (key === "nmcli -t -f RUNNING general") return ok("running\n");
      if (key === "nmcli -t -f STATE general") return ok("disconnected\n");
      if (key === DEVICE_STATUS) {
        reads++;
        await gate;
        return ok(fx.DEVICE_STATUS_NOTHING_CONNECTED);
      }
      throw new Error(key);
    };
    const svc = createNetworkService({ run, uptime: () => 1, now: () => t });
    const first = svc.status();
    await new Promise((r) => setTimeout(r, 0));
    t = 10_000;
    const second = svc.status();
    release();
    await Promise.all([first, second]);
    expect(reads).toBe(1);
  });

  test("repeat asks within a few seconds reuse one nmcli read", async () => {
    let t = 0;
    const { run, calls } = fakeRun({ ...NMCLI_VERSION, ...GENERAL_DISCONNECTED, [DEVICE_STATUS]: ok(fx.DEVICE_STATUS_NOTHING_CONNECTED) });
    const svc = createNetworkService({ run, uptime: () => 1, now: () => t });
    await svc.status();
    await svc.status();
    const reads = () => calls.filter((c) => c.join(" ") === DEVICE_STATUS).length;
    expect(reads()).toBe(1);
    t = STATUS_REUSE_MS;
    await svc.status();
    expect(reads()).toBe(2);
  });

  test.each([
    ["nothing saved", fx.DEVICE_STATUS_NOTHING_CONNECTED],
    ["still connecting", fx.DEVICE_STATUS_WIFI_CONNECTING],
  ])("%s is not connected (loopback never counts)", async (_name, out) => {
    const { run } = fakeRun({ ...NMCLI_VERSION, ...GENERAL_DISCONNECTED, [DEVICE_STATUS]: ok(out) });
    const status = await createNetworkService({ run, uptime: () => 1 }).status();
    expect(status.connected).toBe(false);
    expect(status.connection).toBeNull();
  });

  test("no nmcli or timedatectl is a capability, not an error", async () => {
    const { run } = fakeRun({ "nmcli --version": missing, "timedatectl --version": missing });
    const svc = createNetworkService({ run, uptime: () => 5 });
    expect(await svc.status()).toEqual({
      managed: false,
      connected: false,
      connection: null,
      hasWifiDevice: false,
      uptimeSeconds: 5,
    });
    expect(await svc.scan()).toEqual({ status: "unmanaged" });
    expect(await svc.connect("x", "password1")).toEqual({ status: "unmanaged" });
    expect(await svc.listTimezones()).toEqual({ managed: false });
    expect(await svc.setTimezone("UTC")).toEqual({ status: "unmanaged" });
  });

  test("installed tools with no daemon behind them are managed outside Rootboard too", async () => {
    const { run } = fakeRun({
      "nmcli --version": ok("nmcli tool, version 1.42.4\n"),
      "nmcli -t -f RUNNING general": fail(8, "Error: NetworkManager is not running.\n"),
      "timedatectl --version": ok("systemd 252\n"),
      "timedatectl show --property=Timezone --value": fail(1, "System has not been booted with systemd as init system (PID 1).\n"),
    });
    const svc = createNetworkService({ run, uptime: () => 5 });
    expect(await svc.status()).toMatchObject({ managed: false });
    expect(await svc.listTimezones()).toEqual({ managed: false });
  });

  test("internet check: HEAD to Google's API host only when asked, any answer is reachable, reused briefly", async () => {
    const { run } = fakeRun({ "nmcli --version": missing, "timedatectl --version": missing });
    let t = 0;
    const fetchFn = vi.fn(async () => new Response(null, { status: 404 }));
    const svc = createNetworkService({ run, fetchFn, uptime: () => 1, now: () => t });
    expect((await svc.status()).internet).toBeUndefined();
    expect(fetchFn).not.toHaveBeenCalled();
    expect((await svc.status({ checkInternet: true })).internet).toBe("reachable");
    expect(fetchFn).toHaveBeenCalledWith(INTERNET_CHECK_URL, expect.objectContaining({ method: "HEAD" }));
    await svc.status({ checkInternet: true });
    expect(fetchFn).toHaveBeenCalledTimes(1);
    t = 60_000;
    fetchFn.mockRejectedValueOnce(new TypeError("fetch failed"));
    expect((await svc.status({ checkInternet: true })).internet).toBe("unreachable");
  });
});

describe("Wi-Fi actions", () => {
  test("scan rescans and parses", async () => {
    const { run } = fakeRun({ ...NMCLI_VERSION, [WIFI_LIST_RESCAN]: ok(fx.WIFI_LIST) });
    const result = await createNetworkService({ run }).scan();
    expect(result.status === "ok" && result.networks.map((n) => n.ssid)).toEqual(["Neighbor 5G", "ExampleHome", "Cafe:Guest", "Back\\Slash"]);
  });

  test("a refused scan is a failure, not an empty neighbourhood", async () => {
    const { run } = fakeRun({ ...NMCLI_VERSION, [WIFI_LIST_RESCAN]: fail(1, "Error: Scanning not allowed.\n") });
    expect(await createNetworkService({ run }).scan()).toEqual({ status: "failed" });
  });

  test.skipIf(process.platform === "win32")("runs nmcli in a UTF-8 locale so non-ASCII SSIDs survive", async () => {
    const { runCommand } = await import("./networkService");
    const r = await runCommand("sh", ["-c", "printf %s \"$LC_ALL\""]);
    expect(r.stdout).toBe("C.UTF-8");
  });

  test("connect passes SSID and password as separate argv entries, hidden on request", async () => {
    const { run, calls } = fakeRun({ ...NMCLI_VERSION, "nmcli --wait 25 device wifi connect *": ok(fx.CONNECT_OK_STDOUT) });
    const svc = createNetworkService({ run });
    expect(await svc.connect("My; Net", "pa ss$word", { hidden: true })).toEqual({ status: "connected" });
    expect(calls.at(-1)).toEqual(["nmcli", "--wait", "25", "device", "wifi", "connect", "My; Net", "password", "pa ss$word", "hidden", "yes"]);
    await svc.connect("Open", undefined);
    expect(calls.at(-1)).toEqual(["nmcli", "--wait", "25", "device", "wifi", "connect", "Open"]);
  });

  test("a wrong password is reported as such and never logged", async () => {
    const { run } = fakeRun({ ...NMCLI_VERSION, "nmcli --wait 25 device wifi connect *": fail(4, fx.CONNECT_WRONG_PASSWORD_STDERR) });
    const errors = vi.spyOn(console, "error");
    const logs = vi.spyOn(console, "log");
    expect(await createNetworkService({ run }).connect("ExampleHome", "hunter2-secret")).toEqual({ status: "failed", reason: "bad-password" });
    const logged = [...errors.mock.calls, ...logs.mock.calls].flat().map(String).join("\n");
    expect(logged).not.toContain("hunter2-secret");
    expect(logged).not.toContain("ExampleHome");
  });

  test("forget deletes every profile whose SSID matches, whatever its name", async () => {
    const { run, calls } = fakeRun({
      ...NMCLI_VERSION,
      "nmcli -t -f NAME,UUID,TYPE connection show": ok(fx.CONNECTION_SHOW),
      "nmcli -g 802-11-wireless.ssid connection show uuid 00000000-0000-4000-8000-000000000001": ok("ExampleHome\n"),
      "nmcli -g 802-11-wireless.ssid connection show uuid 00000000-0000-4000-8000-000000000003": ok("ExampleHome\n"),
      "nmcli -g 802-11-wireless.ssid connection show uuid 00000000-0000-4000-8000-000000000004": ok("Example\\:Home \n"),
      "nmcli connection delete uuid *": ok(),
    });
    expect(await createNetworkService({ run }).forget("ExampleHome")).toEqual({ status: "forgotten", removed: 2 });
    expect(calls.filter((c) => c.includes("delete")).length).toBe(2);
  });

  test("forget reads the stored SSID unescaped and untrimmed", () => {
    expect(parseSingleValue("Example\\:Home \n")).toBe("Example:Home ");
    expect(parseSingleValue("Back\\\\Slash\n")).toBe("Back\\Slash");
  });
});

describe("time zone", () => {
  const tzTable = {
    ...TIMEDATECTL_VERSION,
    "timedatectl show --property=Timezone --value": ok("Europe/London\n"),
    "timedatectl list-timezones --no-pager": ok(fx.TIMEZONES),
  };

  test("lists zones and the current one", async () => {
    const { run } = fakeRun(tzTable);
    expect(await createNetworkService({ run }).listTimezones()).toEqual({
      managed: true,
      current: "Europe/London",
      zones: ["Africa/Abidjan", "America/Chicago", "America/New_York", "Europe/London", "UTC"],
    });
  });

  test("sets a listed zone without prompting, and refuses anything else", async () => {
    const previousTz = process.env.TZ;
    try {
      const { run, calls } = fakeRun({ ...tzTable, "timedatectl --no-ask-password set-timezone America/Chicago": ok() });
      const svc = createNetworkService({ run });
      expect(await svc.setTimezone("America/Chicago")).toEqual({ status: "set", timezone: "America/Chicago" });
      expect(process.env.TZ).toBe("America/Chicago");
      expect(await svc.setTimezone("Mars/Olympus")).toEqual({ status: "invalid" });
      expect(await svc.setTimezone("--help")).toEqual({ status: "invalid" });
      expect(calls.filter((c) => c.includes("set-timezone")).length).toBe(1);
    } finally {
      if (previousTz === undefined) delete process.env.TZ;
      else process.env.TZ = previousTz;
    }
  });

  test("a polkit refusal is a failure, not a crash", async () => {
    const { run } = fakeRun({
      ...tzTable,
      "timedatectl --no-ask-password set-timezone UTC": fail(1, "Failed to set time zone: Interactive authentication required.\n"),
    });
    expect(await createNetworkService({ run }).setTimezone("UTC")).toEqual({ status: "failed" });
  });
});
