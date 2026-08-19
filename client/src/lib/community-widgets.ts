import { useEffect, useState } from "react";
import { WIDGET_API_VERSION, type WidgetManifest } from "@shared/widget-manifest";
import type { RootboardWidget } from "@/widgets/types";

/**
 * Folder-drop widget loading (Phase 4, CONTRACT.md §6): a discovered
 * manifest is turned into a mountable `RootboardWidget` through a dynamic
 * `import()` of its entry module, gated by apiVersion BEFORE the import is
 * ever attempted.
 */

export type CommunityWidgetLoadResult =
  | { status: "loaded"; widget: RootboardWidget }
  | { status: "newer-api" }
  | { status: "error"; message: string };

/** Shape of `GET /api/widgets` (server/services/widgetDiscovery.ts —
 *  WidgetDiscoveryResult). Re-declared here rather than imported: that
 *  module is server-only (uses `fs`/`path`), so the client can't import it
 *  directly; this is the wire shape, not the server's internal type. */
export interface WidgetDiscoveryResponse {
  widgets: WidgetManifest[];
  invalid: Array<{ folder: string; errors: string[] }>;
}

/**
 * Validates that a dynamically-imported module satisfies RootboardWidget's
 * shape (CONTRACT.md §3: default export is `{ mount(container, host) }`).
 * Extracted as its own pure function so this check is unit-testable without
 * needing a real dynamic-import() target — loadCommunityWidget's own tests
 * inject a fake `importFn` instead of exercising the browser's module
 * loader.
 */
export function extractWidgetFromModule(mod: unknown): RootboardWidget | null {
  const widget = (mod as { default?: unknown } | null | undefined)?.default;
  if (!widget || typeof widget !== "object") return null;
  if (typeof (widget as { mount?: unknown }).mount !== "function") return null;
  return widget as RootboardWidget;
}

type ImportFn = (url: string) => Promise<unknown>;

// vite-ignore: this URL is only known at runtime (sideloaded content, not
// something the build can resolve/bundle) — see Landmines in
// docs/plans/widget-system/PHASE4-EXECUTION.md.
const defaultImport: ImportFn = (url) => import(/* @vite-ignore */ url);

interface CacheEntry {
  version: string;
  promise: Promise<CommunityWidgetLoadResult>;
}

/** id -> {version, promise}. Module-level (not per-render) so the shell's
 *  60s /api/widgets poll and any re-render don't re-trigger a network
 *  import for an already-resolved widget. Keyed by id+version: a manifest
 *  whose `version` changes (the sideloader's contract for "I changed the
 *  code") invalidates the old entry and is re-imported; a version that
 *  hasn't changed reuses the cached promise even if that promise resolved
 *  to an error — a broken widget doesn't get hammered on every poll, but
 *  bumping its version is what makes it retry. */
const cache = new Map<string, CacheEntry>();

/**
 * Loads one community widget's entry module. The apiVersion gate runs
 * BEFORE any import is attempted (CONTRACT.md §6 — "listed but not
 * loadable"; PHASE4-EXECUTION.md Landmines — a newer-apiVersion widget must
 * never even trigger a network request for its module).
 *
 * `importFn` is overridable for tests only; production callers always use
 * the default (a real dynamic `import()`).
 */
export function loadCommunityWidget(
  manifest: WidgetManifest,
  importFn: ImportFn = defaultImport,
): Promise<CommunityWidgetLoadResult> {
  if (manifest.apiVersion > WIDGET_API_VERSION) {
    return Promise.resolve({ status: "newer-api" });
  }

  const cached = cache.get(manifest.id);
  if (cached && cached.version === manifest.version) {
    return cached.promise;
  }

  const url = `/widgets/${manifest.id}/${manifest.entry}`;
  const promise = importFn(url)
    .then((mod): CommunityWidgetLoadResult => {
      const widget = extractWidgetFromModule(mod);
      if (!widget) {
        return {
          status: "error",
          message: `"${manifest.id}" does not default-export { mount(container, host) } — malformed widget module`,
        };
      }
      return { status: "loaded", widget };
    })
    .catch((error): CommunityWidgetLoadResult => ({
      status: "error",
      message: error instanceof Error ? error.message : `Failed to load "${manifest.id}"'s entry module`,
    }));

  cache.set(manifest.id, { version: manifest.version, promise });
  return promise;
}

/** Test-only: clears the module-level load cache between spec cases so one
 *  test's cached promise can't leak into the next. */
export function _resetCommunityWidgetCacheForTests(): void {
  cache.clear();
}

/**
 * React hook: kicks off `loadCommunityWidget` for every discovered manifest
 * and returns a Map of SETTLED results only — an id with no entry yet is
 * still loading (the shell treats "not in this map" as "not renderable
 * yet", CONTRACT.md §3's keep-alive model extended to async community
 * loads). Lives here rather than inline in app-shell.tsx so the
 * async-loading concern has one owner independent of the shell's render
 * tree; no React test renderer exists in this repo (see vitest.config.ts —
 * node environment, no jsdom), so this hook itself is exercised only via
 * the manual browser verification in the Task 4 report, not a .spec.ts.
 */
export function useCommunityWidgetLoads(
  manifests: WidgetManifest[],
): Map<string, CommunityWidgetLoadResult> {
  const [results, setResults] = useState<Map<string, CommunityWidgetLoadResult>>(new Map());

  useEffect(() => {
    let cancelled = false;
    for (const manifest of manifests) {
      loadCommunityWidget(manifest).then((result) => {
        if (cancelled) return;
        setResults((prev) => {
          // Same cached promise resolves to the same object reference on
          // every .then() — skip the setState (and downstream re-render)
          // when nothing actually changed for this id.
          if (prev.get(manifest.id) === result) return prev;
          const next = new Map(prev);
          next.set(manifest.id, result);
          return next;
        });
      });
    }
    // No cleanup that prunes `results`: an id momentarily missing from
    // `manifests` (e.g. between two polls, or a folder pulled mid-request)
    // keeps its last known status instead of flashing back to "loading".
    // app-shell always filters against the CURRENT discovery response
    // before treating anything as renderable, so a stale entry here for a
    // since-removed widget is inert — bounded by how many widget folders
    // are ever sideloaded on one kiosk, not a leak in practice.
    return () => {
      cancelled = true;
    };
  }, [manifests]);

  return results;
}
