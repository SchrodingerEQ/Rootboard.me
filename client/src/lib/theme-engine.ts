import {
  THEME_ENGINE_VERSION,
  THEME_TOKEN_NAMES,
  validateThemeManifest,
  type ThemeManifest,
} from "@shared/theme-manifest";

/**
 * Theme engine — pure module, no React, no direct `document` reference
 * outside the defaults, so every branch is unit-testable in the node
 * vitest environment. Spec: docs/plans/theme-system/THEME-ENGINE-SPEC.md §4, §6.
 *
 * Flow: loadBuiltinThemes (validate) → resolveTheme (id → manifest, Default
 * fallback) → applyTheme (setProperty on <html>, notify widgets, write the
 * boot cache). The inline script in client/index.html reads that cache
 * before React mounts so a dark theme never flashes light at boot.
 */

export const DEFAULT_THEME_ID = "default";
export const THEME_CACHE_KEY = "rootboard.theme-cache";

export interface ThemeLoadFailure {
  id: string;
  message: string;
}

export interface ThemeLoadResult {
  ok: ThemeManifest[];
  failed: ThemeLoadFailure[];
}

/** Minimal shape of `document.documentElement` this module needs. */
export interface ThemeRoot {
  style: { setProperty(name: string, value: string): void };
}

/** Minimal shape of `localStorage` this module needs. */
export interface ThemeStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

export interface ThemeCache {
  engineVersion: number;
  id: string;
  tokens: Record<string, string>;
}

function bestEffortId(raw: unknown): string {
  if (raw && typeof raw === "object" && typeof (raw as { id?: unknown }).id === "string") {
    return (raw as { id: string }).id;
  }
  return "<unknown>";
}

/** Validates every raw entry. Never throws; problems land in `failed`. */
export function loadBuiltinThemes(raw: readonly unknown[]): ThemeLoadResult {
  const ok: ThemeManifest[] = [];
  const failed: ThemeLoadFailure[] = [];
  const seen = new Set<string>();
  for (const entry of raw) {
    const result = validateThemeManifest(entry);
    if (!result.ok) {
      failed.push({ id: bestEffortId(entry), message: result.message });
      continue;
    }
    if (seen.has(result.manifest.id)) {
      failed.push({ id: result.manifest.id, message: "duplicate theme id" });
      continue;
    }
    seen.add(result.manifest.id);
    ok.push(result.manifest);
  }
  return { ok, failed };
}

/** The theme for `id`, else Default, else null (only if Default itself failed validation). */
export function resolveTheme(id: string | undefined, ok: readonly ThemeManifest[]): ThemeManifest | null {
  return ok.find((t) => t.id === id) ?? ok.find((t) => t.id === DEFAULT_THEME_ID) ?? null;
}

// --- Subscriptions (widget contract `theme.subscribe`) -------------------

type Listener = () => void;
const listeners = new Set<Listener>();

export function subscribeTheme(cb: Listener): () => void {
  listeners.add(cb);
  return () => {
    listeners.delete(cb);
  };
}

function notify(): void {
  for (const cb of Array.from(listeners)) {
    try {
      cb();
    } catch (err) {
      // A widget callback is untrusted; one throwing must not block the rest.
      console.error("[theme] subscriber threw", err);
    }
  }
}

// --- Cache ----------------------------------------------------------------

function defaultStorage(): ThemeStorage | null {
  try {
    return typeof localStorage === "undefined" ? null : localStorage;
  } catch {
    return null;
  }
}

export function readThemeCache(storage: ThemeStorage | null = defaultStorage()): ThemeCache | null {
  if (!storage) return null;
  try {
    const raw = storage.getItem(THEME_CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<ThemeCache> | null;
    if (
      !parsed ||
      typeof parsed !== "object" ||
      typeof parsed.engineVersion !== "number" ||
      typeof parsed.id !== "string" ||
      !parsed.tokens ||
      typeof parsed.tokens !== "object"
    ) {
      return null;
    }
    return { engineVersion: parsed.engineVersion, id: parsed.id, tokens: parsed.tokens as Record<string, string> };
  } catch {
    return null;
  }
}

export function writeThemeCache(manifest: ThemeManifest, storage: ThemeStorage | null = defaultStorage()): void {
  if (!storage) return;
  const cache: ThemeCache = { engineVersion: THEME_ENGINE_VERSION, id: manifest.id, tokens: { ...manifest.tokens } };
  try {
    storage.setItem(THEME_CACHE_KEY, JSON.stringify(cache));
  } catch (err) {
    // Best-effort: a full/blocked storage just means one flash at next boot.
    console.warn("[theme] could not write boot cache", err);
  }
}

// --- Apply ----------------------------------------------------------------

function defaultRoot(): ThemeRoot {
  return document.documentElement;
}

/**
 * Writes every token onto the root element, then notifies subscribers,
 * then mirrors the manifest into the boot cache. Default goes through this
 * same path (no special-casing) so the path is exercised on every boot.
 */
export function applyTheme(
  manifest: ThemeManifest,
  root: ThemeRoot = defaultRoot(),
  storage: ThemeStorage | null = defaultStorage(),
): void {
  for (const name of THEME_TOKEN_NAMES) {
    root.style.setProperty(name, manifest.tokens[name]);
  }
  notify();
  writeThemeCache(manifest, storage);
}
