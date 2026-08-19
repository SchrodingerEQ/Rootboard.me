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

export interface InvalidWidgetEntry {
  folder: string;
  errors: string[];
}

export interface WidgetDiscoveryResult {
  widgets: WidgetManifest[];
  invalid: InvalidWidgetEntry[];
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

      let raw: string;
      try {
        raw = fs.readFileSync(manifestPath, "utf-8");
      } catch (error) {
        // No widget.json in this folder — silently ignore (not every
        // subdirectory of widgets/ is necessarily a widget folder).
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
