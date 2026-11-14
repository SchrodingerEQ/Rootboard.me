/**
 * LAN API pairing (beta-launch brief 05, decision 0020).
 *
 * The kiosk shows a 6-digit code for 5 minutes (Settings → System → Pair a
 * device). A caller on the local network trades that code for a long random
 * token with `POST /api/pair`; the token then goes in
 * `Authorization: Bearer <token>` on every other `/api/*` call.
 *
 * Only the SHA-256 of each token is stored, in data/paired-devices.json
 * (gitignored, and `data/` is on both updater preserve lists). The code
 * lives in memory only: a restart cancels it, which is the safe direction.
 */

import crypto from "crypto";
import fs from "fs";
import path from "path";

export const PAIRING_CODE_TTL_MS = 5 * 60 * 1000;
export const PAIRING_MAX_WRONG_ATTEMPTS = 5;
export const MAX_PAIRED_DEVICES = 20;
export const DEVICE_NAME_MAX_LENGTH = 64;
/** Prefix on every token so the log scrubber can spot one without a "Bearer" in front. */
export const TOKEN_PREFIX = "rbp_";

export interface PairedDevice {
  id: string;
  name: string;
  createdAt: string;
}

interface StoredDevice extends PairedDevice {
  tokenHash: string;
}

interface ActiveCode {
  code: string;
  expiresAt: number;
  wrongAttempts: number;
}

export type PairResult =
  | { status: "paired"; token: string; device: PairedDevice }
  | { status: "no-code" }
  | { status: "expired" }
  | { status: "wrong-code"; attemptsLeft: number }
  | { status: "bad-name" }
  | { status: "too-many-devices" };

function sha256Hex(value: string): string {
  return crypto.createHash("sha256").update(value, "utf8").digest("hex");
}

/** Constant-time equality for two strings of any length. */
function safeEqual(a: string, b: string): boolean {
  // Hashing first gives equal-length buffers, so timingSafeEqual never
  // throws and the comparison time doesn't depend on where they differ.
  return crypto.timingSafeEqual(
    crypto.createHash("sha256").update(a).digest(),
    crypto.createHash("sha256").update(b).digest(),
  );
}

/** Trim, drop control characters, and cap the length; null when nothing is left. */
export function cleanDeviceName(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const cleaned = raw.replace(/[\u0000-\u001f\u007f]/g, "").trim();
  if (cleaned.length === 0 || cleaned.length > DEVICE_NAME_MAX_LENGTH) return null;
  return cleaned;
}

export class PairingService {
  private active: ActiveCode | null = null;

  constructor(
    private readonly filePath: string,
    private readonly now: () => number = Date.now,
  ) {}

  /** Issue a fresh code, replacing any earlier one. */
  issueCode(): { code: string; expiresAt: string } {
    const code = crypto.randomInt(0, 1_000_000).toString().padStart(6, "0");
    this.active = { code, expiresAt: this.now() + PAIRING_CODE_TTL_MS, wrongAttempts: 0 };
    return { code, expiresAt: new Date(this.active.expiresAt).toISOString() };
  }

  /** Cancel the showing code; with `code`, only if that is still the one showing. */
  cancelCode(code?: string): void {
    if (code === undefined || this.active?.code === code) this.active = null;
  }

  pair(code: unknown, rawName: unknown): PairResult {
    const active = this.active;
    if (!active) return { status: "no-code" };
    if (this.now() >= active.expiresAt) {
      this.active = null;
      return { status: "expired" };
    }
    if (typeof code !== "string" || !safeEqual(code.trim(), active.code)) {
      active.wrongAttempts += 1;
      const attemptsLeft = PAIRING_MAX_WRONG_ATTEMPTS - active.wrongAttempts;
      if (attemptsLeft <= 0) this.active = null;
      return { status: "wrong-code", attemptsLeft: Math.max(0, attemptsLeft) };
    }
    const name = cleanDeviceName(rawName);
    if (!name) return { status: "bad-name" };

    const devices = this.readDevices();
    if (devices.length >= MAX_PAIRED_DEVICES) return { status: "too-many-devices" };

    const token = TOKEN_PREFIX + crypto.randomBytes(32).toString("base64url");
    const device: StoredDevice = {
      id: crypto.randomUUID(),
      name,
      createdAt: new Date(this.now()).toISOString(),
      tokenHash: sha256Hex(token),
    };
    this.writeDevices([...devices, device]);
    // Single use: the code that paired a device can't pair a second one.
    this.active = null;
    return { status: "paired", token, device: toPublic(device) };
  }

  /** The paired device a bearer token belongs to, or null. */
  verifyToken(token: string): PairedDevice | null {
    if (!token) return null;
    const presented = Buffer.from(sha256Hex(token), "hex");
    let match: StoredDevice | null = null;
    // Compare against every entry (no early exit) so timing doesn't reveal
    // how many devices are paired or which one matched.
    for (const device of this.readDevices()) {
      const stored = Buffer.from(device.tokenHash, "hex");
      if (stored.length === presented.length && crypto.timingSafeEqual(stored, presented)) {
        match = device;
      }
    }
    return match ? toPublic(match) : null;
  }

  listDevices(): PairedDevice[] {
    return this.readDevices().map(toPublic);
  }

  /** True when a device with this id existed and is now gone. */
  revoke(id: string): boolean {
    const devices = this.readDevices();
    const remaining = devices.filter((d) => d.id !== id);
    if (remaining.length === devices.length) return false;
    this.writeDevices(remaining);
    return true;
  }

  /**
   * Re-read on every call: LAN calls are rare, the file is tiny, and an
   * owner who deletes the file over SSH revokes everything at once without
   * a restart. A missing or unreadable file means "no paired devices", so
   * a damaged file fails closed (every token is refused).
   */
  private readDevices(): StoredDevice[] {
    let raw: string;
    try {
      raw = fs.readFileSync(this.filePath, "utf-8");
    } catch (error) {
      if ((error as NodeJS.ErrnoException)?.code !== "ENOENT") {
        console.error("Failed to read data/paired-devices.json:", (error as Error).message);
      }
      return [];
    }
    try {
      const parsed = JSON.parse(raw) as { devices?: unknown };
      if (!Array.isArray(parsed.devices)) throw new Error("no devices array");
      return parsed.devices.filter(isStoredDevice);
    } catch (error) {
      console.error("data/paired-devices.json is not valid; treating it as empty:", (error as Error).message);
      return [];
    }
  }

  private writeDevices(devices: StoredDevice[]): void {
    fs.mkdirSync(path.dirname(this.filePath), { recursive: true });
    const tmpPath = `${this.filePath}.tmp`;
    fs.writeFileSync(tmpPath, JSON.stringify({ devices }, null, 2) + "\n", { encoding: "utf-8", mode: 0o600 });
    fs.renameSync(tmpPath, this.filePath);
  }
}

function toPublic(device: StoredDevice): PairedDevice {
  return { id: device.id, name: device.name, createdAt: device.createdAt };
}

function isStoredDevice(value: unknown): value is StoredDevice {
  const d = value as Partial<StoredDevice> | null;
  return (
    !!d &&
    typeof d.id === "string" &&
    typeof d.name === "string" &&
    typeof d.createdAt === "string" &&
    typeof d.tokenHash === "string" &&
    /^[0-9a-f]{64}$/.test(d.tokenHash)
  );
}

export const pairingService = new PairingService(path.join(process.cwd(), "data", "paired-devices.json"));
