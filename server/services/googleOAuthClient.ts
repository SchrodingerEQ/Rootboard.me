/**
 * The Google OAuth "Desktop app" client this unit signs in with
 * (beta-launch brief 02, decision 0017 "Client credentials").
 *
 * Never in the repo. It lives on the unit in data/google-oauth-client.json
 * (gitignored, kept across updates, mode 0600), in the exact shape Google's
 * console downloads: `{"installed": {"client_id", "client_secret", …}}`.
 * Units the project ships get it when their card is built (brief 09);
 * self-hosters download their own. It is read on demand, so a file that
 * appears (scp, or PUT /api/google/client) works without a restart.
 *
 * The secret is never logged, returned, or put in the diagnostics bundle.
 * Only the project number from the client id may be shown.
 */

import fs from "fs";
import path from "path";
import { z } from "zod";

export const DEFAULT_CLIENT_FILE = path.resolve("data", "google-oauth-client.json");
/** Google's download is well under 1 KB; anything larger is not one. */
export const MAX_CLIENT_FILE_BYTES = 8 * 1024;

export type OAuthClientStatus = "missing" | "configured" | "invalid";

export interface OAuthClientCredentials {
  clientId: string;
  clientSecret: string;
}

const installedClientSchema = z.object({
  installed: z
    .object({
      client_id: z.string().trim().regex(/^[A-Za-z0-9._-]+\.apps\.googleusercontent\.com$/),
      client_secret: z.string().trim().min(1),
    })
    .passthrough(),
});

/** Google's client JSON, checked: an `installed` block, a real client id, a secret. */
export function parseClientJson(value: unknown): OAuthClientCredentials | null {
  const parsed = installedClientSchema.safeParse(value);
  if (!parsed.success) return null;
  return { clientId: parsed.data.installed.client_id, clientSecret: parsed.data.installed.client_secret };
}

/** "221480…-abc.apps.googleusercontent.com" → "221480…": the Cloud project number. */
export function projectNumberOf(clientId: string): string | null {
  const match = clientId.match(/^(\d+)-/);
  return match ? match[1] : null;
}

export type ClientRead =
  | { status: "missing" }
  | { status: "invalid" }
  | { status: "configured"; credentials: OAuthClientCredentials; projectNumber: string | null };

export function readClientFile(file: string = DEFAULT_CLIENT_FILE): ClientRead {
  let raw: string;
  try {
    const stat = fs.statSync(file);
    if (stat.size > MAX_CLIENT_FILE_BYTES) return { status: "invalid" };
    raw = fs.readFileSync(file, "utf-8");
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return { status: "missing" };
    console.error("[google-oauth] could not read data/google-oauth-client.json:", (error as Error).message);
    return { status: "invalid" };
  }
  let json: unknown;
  try {
    json = JSON.parse(raw);
  } catch {
    return { status: "invalid" };
  }
  const credentials = parseClientJson(json);
  if (!credentials) return { status: "invalid" };
  return { status: "configured", credentials, projectNumber: projectNumberOf(credentials.clientId) };
}

/**
 * Validate and save Google's client JSON as-is: temp file, then rename,
 * mode 0600. Returns false (and writes nothing) when it isn't a valid
 * Desktop client.
 */
export function writeClientFile(value: unknown, file: string = DEFAULT_CLIENT_FILE): boolean {
  if (!parseClientJson(value)) return false;
  const text = JSON.stringify(value, null, 2) + "\n";
  if (Buffer.byteLength(text) > MAX_CLIENT_FILE_BYTES) return false;
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const tmpPath = `${file}.tmp`;
  fs.writeFileSync(tmpPath, text, { encoding: "utf-8", mode: 0o600 });
  fs.chmodSync(tmpPath, 0o600);
  fs.renameSync(tmpPath, file);
  console.log("[google-oauth] sign-in client saved to data/google-oauth-client.json");
  return true;
}
