/**
 * Folder-drop widget discovery: scans widgets/ (repo-root relative, gitignored
 * — sideloaded user content, never shipped in the release tarball) for
 * subdirectories containing a widget.json manifest.
 *
 * The kiosk must always boot: discoverWidgets() never throws. A missing
 * widgets/ directory is the common/expected case and yields an empty result.
 * A folder that fails to read, parse, or validate becomes an `invalid` entry
 * (with human-readable error strings for the layout picker) rather than
 * aborting the whole scan — one broken/malicious folder can't take down
 * discovery for the rest. Mirrors configService's never-throw read posture.
 *
 * apiVersion is NOT gated here — widgetManifestSchema only requires a
 * positive int. A manifest with apiVersion > WIDGET_API_VERSION is still
 * schema-valid and is included in `widgets`; the CLIENT gates loadability
 * (CONTRACT §6: listed but not loadable, "built for a newer Rootboard").
 */

import fs from "fs";
import path from "path";
import { widgetManifestSchema, type WidgetManifest } from "@shared/widget-manifest";

const WIDGETS_DIR = path.join(process.cwd(), "widgets");

// Manifest schema fields are all bounded-tiny (id <=41 chars, name <=40,
// description <=200, at most a handful of settings) — 64 KB is already
// generous. Capping the read protects the event loop on the Pi: /api/widgets
// re-scans widgets/ on every call (see file header), so an oversized
// widget.json would otherwise be synchronously read in full on every request.
const MAX_MANIFEST_BYTES = 64 * 1024;

export interface InvalidWidgetEntry {
  folder: string;
  errors: string[];
}

export interface WidgetDiscoveryResult {
  widgets: WidgetManifest[];
  invalid: InvalidWidgetEntry[];
}

/**
 * Pure containment check used to guard /widgets static serving against
 * symlink escapes (see server/routes.ts). express.static resolves requests
 * via fs.stat, which follows symlinks — a sideloaded widget folder could
 * contain e.g. `widgets/evil/x -> ../../service-account.json`, and
 * `GET /widgets/evil/x` would serve it straight through with no `..` ever
 * appearing in the URL, so neither express.static's own traversal refusal
 * nor the manifest schema's no-`..` rule ever see it.
 *
 * `rootReal` must already be the realpath of the widgets root (resolved by
 * the caller; a missing root is the caller's problem, not this function's).
 * This resolves `requestPath` (a req.path-style string, `/`-rooted) to its
 * real, symlink-resolved path and requires it to sit STRICTLY inside
 * `rootReal` (i.e. `realTarget.startsWith(rootReal + path.sep)` — equality
 * with the root itself is rejected too; the root isn't individually
 * servable content, and index:false means directory listing was never on
 * the table anyway).
 *
 * Comparison is case-insensitive on win32 (NTFS is case-insensitive by
 * default, so a request could reach the "same" file via different casing)
 * and case-sensitive elsewhere. The kiosk target is Linux — this only
 * matters for developing on Windows.
 */
export type ContainmentResult =
  | { ok: true; realPath: string }
  | { ok: false; reason: "not-found" | "forbidden" | "bad-request" };

export function resolveContainedPath(rootReal: string, requestPath: string): ContainmentResult {
  let decoded: string;
  try {
    decoded = decodeURIComponent(requestPath);
  } catch {
    return { ok: false, reason: "bad-request" };
  }

  const relative = decoded.replace(/^[/\\]+/, "");
  const candidate = path.join(rootReal, relative);

  let real: string;
  try {
    real = fs.realpathSync(candidate);
  } catch {
    // Covers both "doesn't exist" and any other resolution failure
    // (permissions, ELOOP on a broken symlink, etc.) — all collapse to
    // "not found" so the response shape doesn't leak which case it was.
    return { ok: false, reason: "not-found" };
  }

  const normalize = (p: string) => (process.platform === "win32" ? p.toLowerCase() : p);
  const requiredPrefix = normalize(rootReal) + path.sep;
  if (!normalize(real).startsWith(requiredPrefix)) {
    return { ok: false, reason: "forbidden" };
  }

  return { ok: true, realPath: real };
}

export function discoverWidgets(): WidgetDiscoveryResult {
  const widgets: WidgetManifest[] = [];
  const invalid: InvalidWidgetEntry[] = [];

  let entries: fs.Dirent[];
  try {
    entries = fs.readdirSync(WIDGETS_DIR, { withFileTypes: true });
  } catch (error) {
    // Missing widgets/ dir is the common/expected case (no sideloaded
    // widgets yet); anything else (permissions, etc.) is also non-fatal —
    // treat it the same as "nothing discovered" either way.
    if ((error as NodeJS.ErrnoException)?.code !== "ENOENT") {
      console.error(`Failed to read widgets directory at ${WIDGETS_DIR}:`, error);
    }
    return { widgets, invalid };
  }

  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    const folder = entry.name;

    try {
      const manifestPath = path.join(WIDGETS_DIR, folder, "widget.json");

      let stat: fs.Stats;
      try {
        stat = fs.statSync(manifestPath);
      } catch (error) {
        // No widget.json in this folder — silently ignore (not every
        // subdirectory of widgets/ is necessarily a widget folder).
        if ((error as NodeJS.ErrnoException)?.code === "ENOENT") continue;
        invalid.push({ folder, errors: [`Failed to read widget.json: ${(error as Error).message}`] });
        continue;
      }

      if (stat.size > MAX_MANIFEST_BYTES) {
        invalid.push({
          folder,
          errors: [`widget.json too large (${stat.size} bytes, max ${MAX_MANIFEST_BYTES})`],
        });
        continue;
      }

      let raw: string;
      try {
        raw = fs.readFileSync(manifestPath, "utf-8");
      } catch (error) {
        // Same ENOENT-silent-skip posture as the stat above (file could be
        // removed between the two calls — harmless race, not our problem).
        if ((error as NodeJS.ErrnoException)?.code === "ENOENT") continue;
        invalid.push({ folder, errors: [`Failed to read widget.json: ${(error as Error).message}`] });
        continue;
      }

      let parsedJson: unknown;
      try {
        parsedJson = JSON.parse(raw);
      } catch (error) {
        invalid.push({ folder, errors: [`widget.json is not valid JSON: ${(error as Error).message}`] });
        continue;
      }

      const result = widgetManifestSchema.safeParse(parsedJson);
      if (!result.success) {
        invalid.push({ folder, errors: flattenZodErrors(result.error) });
        continue;
      }

      if (result.data.id !== folder) {
        invalid.push({
          folder,
          errors: [`Folder name "${folder}" does not match manifest id "${result.data.id}"`],
        });
        continue;
      }

      widgets.push(result.data);
    } catch (error) {
      // Belt-and-suspenders: nothing in the per-folder path above should
      // throw, but a broken/malicious folder must never crash discovery
      // for the rest of the scan.
      invalid.push({ folder, errors: [`Unexpected error reading folder: ${(error as Error).message}`] });
    }
  }

  return { widgets, invalid };
}

function flattenZodErrors(error: { flatten(): { formErrors: string[]; fieldErrors: Record<string, string[] | undefined> } }): string[] {
  const flat = error.flatten();
  const fieldMessages = Object.entries(flat.fieldErrors).flatMap(([field, messages]) =>
    (messages ?? []).map((message) => `${field}: ${message}`)
  );
  return [...flat.formErrors, ...fieldMessages];
}
