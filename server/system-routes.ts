/**
 * /api/system/* — Wi-Fi and time zone for the first-run wizard (beta-launch
 * brief 03, decision 0018). Everything that changes the system, or makes the
 * radio do something (a scan), is localhost-only: a phone on the LAN must not
 * be able to re-point the kiosk's Wi-Fi, paired or not. The two read-only
 * GETs sit behind the LAN pairing guard like every other /api route
 * (middleware/lanAuth.ts, brief 05).
 *
 * Request bodies here can hold a Wi-Fi password. It is passed to nmcli and
 * dropped; no handler logs a body, and the request logger in server/index.ts
 * logs only responses (and not these — see UNLOGGED_BODY_PATHS).
 */

import type { Express, Request, Response } from "express";
import { z } from "zod";
import type { NetworkService } from "./services/networkService";
import { isSameOriginJsonRequest } from "./middleware/lanAuth";
import { isPlausibleWifiPassword } from "@shared/system-network";

export const SYSTEM_ROUTE_PATHS = {
  networkStatus: "/api/system/network/status",
  networkScan: "/api/system/network/scan",
  networkConnect: "/api/system/network/connect",
  networkForget: "/api/system/network/forget",
  timezone: "/api/system/timezone",
} as const;

/** 1–32 bytes (the 802.11 limit). A leading "-" is refused so nmcli can never
 *  read an SSID as an option. */
const ssidSchema = z
  .string()
  .min(1)
  .refine((s) => Buffer.byteLength(s, "utf8") <= 32, "SSID is longer than 32 bytes")
  .refine((s) => !s.startsWith("-"), "SSID cannot start with '-'");

/** WPA-PSK: 8–63 characters, or 64 hex digits. Absent/empty = open network. */
const pskSchema = z
  .string()
  .refine((p) => isPlausibleWifiPassword(p, p !== ""), "bad password length")
  .optional();

const connectBodySchema = z.object({ ssid: ssidSchema, password: pskSchema, hidden: z.boolean().optional() });
const forgetBodySchema = z.object({ ssid: ssidSchema });
const timezoneBodySchema = z.object({ timezone: z.string().min(1).max(64) });

const UNMANAGED_MESSAGE = "This system's network and time are managed outside Rootboard";

export function registerSystemRoutes(
  app: Express,
  deps: { service: NetworkService; isLocalRequest: (req: Request) => boolean },
): void {
  const { service, isLocalRequest } = deps;
  // Two checks. The socket peer must be this machine. And the request must
  // be same-origin JSON, so a web page the kiosk's own browser happens to
  // open cannot form-POST to localhost and re-point the Wi-Fi.
  const localOnly = (req: Request, res: Response): boolean => {
    if (isLocalRequest(req) && isSameOriginJsonRequest(req)) return true;
    res.status(403).json({ message: "System settings can only be changed on the kiosk itself" });
    return false;
  };
  const noStore = (res: Response) =>
    res.set({ "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate", Pragma: "no-cache", Expires: "0" });

  // ?internet=1 adds the reachability check (one HEAD to Google's API host,
  // reused for a few seconds). Off by default so plain polling makes no
  // outside call.
  app.get(SYSTEM_ROUTE_PATHS.networkStatus, async (req, res) => {
    noStore(res);
    try {
      res.json(await service.status({ checkInternet: req.query.internet === "1" }));
    } catch (error) {
      console.error("[network] status failed:", error instanceof Error ? error.message : "unknown error");
      res.status(500).json({ message: "Couldn't read the network status" });
    }
  });

  app.post(SYSTEM_ROUTE_PATHS.networkScan, async (req, res) => {
    if (!localOnly(req, res)) return;
    noStore(res);
    try {
      const result = await service.scan();
      if (result.status === "unmanaged") return res.status(409).json({ message: UNMANAGED_MESSAGE });
      if (result.status === "failed") return res.status(502).json({ message: "Couldn't scan for networks" });
      res.json({ networks: result.networks });
    } catch {
      console.error("[network] scan failed");
      res.status(500).json({ message: "Couldn't scan for networks" });
    }
  });

  app.post(SYSTEM_ROUTE_PATHS.networkConnect, async (req, res) => {
    if (!localOnly(req, res)) return;
    const parsed = connectBodySchema.safeParse(req.body);
    if (!parsed.success) {
      // Never echo the body or Zod's issue list: both could carry the password.
      const badPassword = parsed.error.issues.some((i) => i.path[0] === "password");
      return res.status(400).json(badPassword ? { status: "failed", reason: "bad-password" } : { message: "Invalid network name" });
    }
    try {
      const result = await service.connect(parsed.data.ssid, parsed.data.password || undefined, { hidden: parsed.data.hidden });
      if (result.status === "unmanaged") return res.status(409).json({ message: UNMANAGED_MESSAGE });
      res.json(result);
    } catch {
      console.error("[network] connect failed unexpectedly");
      res.status(500).json({ status: "failed", reason: "failed" });
    }
  });

  app.post(SYSTEM_ROUTE_PATHS.networkForget, async (req, res) => {
    if (!localOnly(req, res)) return;
    const parsed = forgetBodySchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: "Invalid network name" });
    try {
      const result = await service.forget(parsed.data.ssid);
      if (result.status === "unmanaged") return res.status(409).json({ message: UNMANAGED_MESSAGE });
      if (result.status === "failed") return res.status(500).json({ message: "Couldn't forget that network" });
      res.json(result);
    } catch {
      console.error("[network] forget failed unexpectedly");
      res.status(500).json({ message: "Couldn't forget that network" });
    }
  });

  app.get(SYSTEM_ROUTE_PATHS.timezone, async (_req, res) => {
    noStore(res);
    try {
      res.json(await service.listTimezones());
    } catch {
      console.error("[network] time zone list failed");
      res.status(500).json({ message: "Couldn't read the time zone" });
    }
  });

  app.post(SYSTEM_ROUTE_PATHS.timezone, async (req, res) => {
    if (!localOnly(req, res)) return;
    const parsed = timezoneBodySchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: "Pick a time zone from the list" });
    try {
      const result = await service.setTimezone(parsed.data.timezone);
      if (result.status === "unmanaged") return res.status(409).json({ message: UNMANAGED_MESSAGE });
      if (result.status === "invalid") return res.status(400).json({ message: "Pick a time zone from the list" });
      if (result.status === "failed") return res.status(500).json({ message: "Rootboard couldn't change the time zone." });
      res.json(result);
    } catch {
      console.error("[network] set time zone failed unexpectedly");
      res.status(500).json({ message: "Rootboard couldn't change the time zone." });
    }
  });
}
