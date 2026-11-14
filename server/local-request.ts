import type { Request } from "express";

/**
 * True when the request comes from the kiosk itself. Compares the direct
 * socket peer: no `trust proxy` is configured, so `req.ip` cannot be steered
 * by an X-Forwarded-For header. Re-verify if a reverse proxy is ever added.
 */
export function isLocalRequest(req: Request): boolean {
  const ip = req.ip || req.socket?.remoteAddress || "";
  return ip === "127.0.0.1" || ip === "::1" || ip === "::ffff:127.0.0.1" || ip === "localhost";
}
