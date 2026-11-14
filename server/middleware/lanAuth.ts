/**
 * Who may call `/api/*` (beta-launch brief 05, decision 0020).
 *
 * - The kiosk's own browser (loopback) needs nothing, exactly as before.
 * - Anything else on the network must send `Authorization: Bearer <token>`
 *   from pairing (pairingService.ts), or it gets a 401 that says how to pair.
 * - Three requests stay open without a token:
 *   `GET /api/version` (the supervisor health check in scripts/start.sh),
 *   `GET /api/system/diagnostics` (the handler limits an unpaired caller to
 *   the redacted view), and `POST /api/pair` (the code is the credential).
 * - `LAN_API_OPEN=true` turns the token check off for hosted/dev use.
 *
 * Mounted with `app.use("/api", …)` so Express's own case-insensitive,
 * trailing-slash-tolerant prefix matching decides what is "under /api" —
 * the same matching the routes use, so `/API/calendar/events` can't slip
 * past the guard and still reach a handler.
 */

import type { NextFunction, Request, Response } from "express";
import type { PairedDevice, PairingService } from "../services/pairingService";

/** How a request got past the guard; read by handlers via `res.locals.apiAccess`. */
export type ApiAccess = "loopback" | "paired" | "lan-open" | "unpaired";

export const PAIRING_HINT =
  "This kiosk's API needs pairing. On the kiosk screen open Settings → System → Pair a device, " +
  'then POST /api/pair with {"code": "<6 digits>", "name": "<your device>"} and send the returned ' +
  "token on every call as: Authorization: Bearer <token>";

const LOOPBACK_ADDRESSES = new Set(["127.0.0.1", "::1", "::ffff:127.0.0.1", "localhost"]);

/**
 * The direct socket peer only. No `trust proxy` is configured, so `req.ip`
 * is the socket address and an `X-Forwarded-For` header can't fake it. If a
 * reverse proxy is ever added, this must be re-verified (CLAUDE.md).
 */
export function isLocalRequest(req: Request): boolean {
  const ip = req.ip || req.socket?.remoteAddress || "";
  return LOOPBACK_ADDRESSES.has(ip);
}

export function isLanApiOpen(): boolean {
  return process.env.LAN_API_OPEN === "true";
}

/** Requests (path relative to the `/api` mount) that never need a token. */
function isOpenWithoutToken(req: Request): boolean {
  return (
    (req.method === "GET" && req.path === "/version") ||
    (req.method === "GET" && req.path === "/system/diagnostics") ||
    (req.method === "POST" && req.path === "/pair")
  );
}

function bearerToken(req: Request): string | null {
  const header = req.get("authorization");
  const match = header?.match(/^Bearer\s+(\S+)\s*$/i);
  return match ? match[1] : null;
}

export function sendPairingRequired(res: Response): void {
  res.set("WWW-Authenticate", 'Bearer realm="rootboard"');
  res.status(401).json({ message: "Pairing required", pairing: PAIRING_HINT });
}

export function createLanAuthGuard(pairing: Pick<PairingService, "verifyToken">) {
  return function lanAuthGuard(req: Request, res: Response, next: NextFunction) {
    if (isLocalRequest(req)) {
      res.locals.apiAccess = "loopback" satisfies ApiAccess;
      return next();
    }
    if (isLanApiOpen()) {
      res.locals.apiAccess = "lan-open" satisfies ApiAccess;
      return next();
    }
    const token = bearerToken(req);
    const device: PairedDevice | null = token ? pairing.verifyToken(token) : null;
    if (device) {
      res.locals.apiAccess = "paired" satisfies ApiAccess;
      res.locals.pairedDevice = device;
      return next();
    }
    if (isOpenWithoutToken(req)) {
      res.locals.apiAccess = "unpaired" satisfies ApiAccess;
      return next();
    }
    sendPairingRequired(res);
  };
}
