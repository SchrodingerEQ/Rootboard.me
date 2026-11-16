/**
 * The server's last 500 log lines, in memory only (beta-launch brief 05,
 * decision 5/6): the diagnostics bundle shows the tail without anyone
 * opening a terminal, and nothing new is written to the SD card.
 *
 * Lines are scrubbed before they are stored, so even the full diagnostics
 * view never carries an email address, a bearer token, or the response
 * body of an API request (the request logger in server/index.ts appends a
 * truncated response body that can hold event titles; the journal keeps
 * that, the ring does not).
 */

import util from "util";
import { TOKEN_PREFIX } from "./pairingService";

export const LOG_RING_CAPACITY = 500;
const MAX_LINE_LENGTH = 500;

const EMAIL_RE = /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g;
const BEARER_RE = /Bearer\s+\S+/gi;
const PAIRING_TOKEN_RE = new RegExp(`${TOKEN_PREFIX}[A-Za-z0-9_-]+`, "g");
// Google OAuth access tokens (ya29.…) and refresh tokens (1//…). Nothing logs
// them on purpose (brief 02); this catches a library error that quotes one.
const GOOGLE_TOKEN_RE = /\b(?:ya29\.[A-Za-z0-9._-]+|1\/\/[A-Za-z0-9._-]{10,})/g;
// "<time> [express] GET /api/x 200 in 3ms :: {...body}"
const REQUEST_LINE_RE = /^(.*\[express\] [A-Z]+ \/\S* (\d{3}) in \d+ms)(?: :: .*)?$/;

// Invisible separator (U+2063) around a value marks it as private: the
// journal shows the value (it reads as plain text there), the ring drops it.
const PRIVATE_MARK = "\u2063";
// An unclosed mark (a line cut short) hides everything after it.
const PRIVATE_RE = new RegExp(`${PRIVATE_MARK}[^${PRIVATE_MARK}]*(?:${PRIVATE_MARK}|$)`, "g");

/**
 * Wrap a personal value (a calendar name, a paired device's name) in a log
 * line. The journal keeps it for whoever reads it over SSH; the ring, and so
 * the diagnostics bundle that is open to the network, never sees it. Any
 * new log line that prints a name or other personal text must use this.
 */
export function logPrivate(value: unknown): string {
  const text = String(value).replaceAll(PRIVATE_MARK, "").replace(/[\r\n]+/g, " ");
  return `${PRIVATE_MARK}${text}${PRIVATE_MARK}`;
}

/** Remove anything that identifies a person or grants access. Used by the ring and the diagnostics bundle. */
export function scrubSecrets(text: string): string {
  return text
    .replace(BEARER_RE, "Bearer [token]")
    .replace(PAIRING_TOKEN_RE, "[token]")
    .replace(GOOGLE_TOKEN_RE, "[token]")
    .replace(EMAIL_RE, "[email]");
}

export function scrubLogLine(line: string): string {
  const withoutBody = line.replace(REQUEST_LINE_RE, "$1");
  const scrubbed = scrubSecrets(withoutBody.replace(PRIVATE_RE, "[name]"));
  return scrubbed.length > MAX_LINE_LENGTH ? scrubbed.slice(0, MAX_LINE_LENGTH - 1) + "…" : scrubbed;
}

/**
 * Request lines are kept only for server errors (5xx). The kiosk polls
 * several endpoints a minute, and anyone on the network can send 401s in a
 * loop; either would otherwise push the lines worth reading out of the
 * 50-line tail. The journal still has every request line.
 */
export function shouldRecord(line: string): boolean {
  const request = line.match(REQUEST_LINE_RE);
  return !request || Number(request[2]) >= 500;
}

export class LogRing {
  private lines: string[] = [];

  constructor(private readonly capacity: number = LOG_RING_CAPACITY) {}

  push(text: string): void {
    for (const line of text.split(/\r?\n/)) {
      if (line.trim().length === 0 || !shouldRecord(line)) continue;
      this.lines.push(scrubLogLine(line));
    }
    if (this.lines.length > this.capacity) {
      this.lines.splice(0, this.lines.length - this.capacity);
    }
  }

  tail(count: number): string[] {
    return this.lines.slice(-count);
  }
}

export const logRing = new LogRing();

let installed = false;

/**
 * Copy everything written through console.log/info/warn/error into the
 * ring as well as the normal output (stdout/stderr → the systemd journal).
 * Wrapping console rather than the `log()` helper in server/vite.ts also
 * catches the services' own console.error lines (Google init, weather,
 * updates), which are the ones worth reading.
 */
export function installLogRing(ring: LogRing = logRing): void {
  if (installed) return;
  installed = true;
  for (const level of ["log", "info", "warn", "error"] as const) {
    const original = console[level].bind(console);
    console[level] = (...args: unknown[]) => {
      original(...args);
      try {
        const prefix = level === "warn" || level === "error" ? `${level.toUpperCase()} ` : "";
        ring.push(prefix + util.format(...args));
      } catch (error) {
        // The ring must never break logging itself; say so on the real stream.
        original("log ring: failed to record a line:", error);
      }
    };
  }
}
