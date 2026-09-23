import { describe, expect, test, vi } from "vitest";
import { THEME_TOKEN_NAMES, type ThemeManifest } from "@shared/theme-manifest";
import {
  DEFAULT_THEME_ID,
  THEME_CACHE_KEY,
  applyTheme,
  getActiveThemeTokens,
  loadBuiltinThemes,
  readThemeCache,
  resolveTheme,
  subscribeTheme,
  writeThemeCache,
  type ThemeStorage,
} from "./theme-engine";

function tokens(color = "#123456"): Record<string, string> {
  return Object.fromEntries(THEME_TOKEN_NAMES.map((n) => [n, color]));
}
function manifest(id: string, color?: string): ThemeManifest {
  return { engineVersion: 1, id, name: id, tokens: tokens(color) as ThemeManifest["tokens"] };
}
function memoryStorage(initial: Record<string, string> = {}): ThemeStorage & { data: Record<string, string> } {
  const data = { ...initial };
  return { data, getItem: (k) => (k in data ? data[k] : null), setItem: (k, v) => { data[k] = v; } };
}

describe("loadBuiltinThemes", () => {
  test("splits valid, invalid and duplicate entries; never throws", () => {
    const bad = { engineVersion: 1, id: "broken", name: "Broken", tokens: {} };
    const result = loadBuiltinThemes([manifest("default"), bad, manifest("default"), 42, null]);
    expect(result.ok.map((t) => t.id)).toEqual(["default"]);
    expect(result.failed.map((f) => f.id)).toEqual(["broken", "default", "<unknown>", "<unknown>"]);
    expect(result.failed[0].message).toContain("--rb-");
    expect(result.failed[1].message).toContain("duplicate");
  });
});

describe("resolveTheme", () => {
  const ok = [manifest("default"), manifest("deep-space")];
  test("known id resolves to that theme", () => {
    expect(resolveTheme("deep-space", ok)?.id).toBe("deep-space");
  });
  test("unknown or undefined id resolves to default", () => {
    expect(resolveTheme("nope", ok)?.id).toBe(DEFAULT_THEME_ID);
    expect(resolveTheme(undefined, ok)?.id).toBe(DEFAULT_THEME_ID);
  });
  test("returns null when even default is missing", () => {
    expect(resolveTheme("nope", [manifest("other")])).toBeNull();
  });
});

describe("applyTheme", () => {
  test("sets every token on the root, notifies once, writes the cache", () => {
    const setProperty = vi.fn();
    const storage = memoryStorage();
    const listener = vi.fn();
    const unsubscribe = subscribeTheme(listener);
    applyTheme(manifest("deep-space", "#0b1220"), { style: { setProperty } }, storage);
    expect(setProperty).toHaveBeenCalledTimes(THEME_TOKEN_NAMES.length);
    expect(setProperty).toHaveBeenCalledWith("--rb-canvas", "#0b1220");
    expect(listener).toHaveBeenCalledTimes(1);
    const cached = JSON.parse(storage.data[THEME_CACHE_KEY]);
    expect(cached.id).toBe("deep-space");
    expect(cached.tokens["--rb-canvas"]).toBe("#0b1220");
    unsubscribe();
  });

  test("unsubscribed listeners stop firing; a throwing listener does not block others", () => {
    const setProperty = vi.fn();
    const a = vi.fn(() => { throw new Error("widget bug"); });
    const b = vi.fn();
    const offA = subscribeTheme(a);
    const offB = subscribeTheme(b);
    applyTheme(manifest("x"), { style: { setProperty } }, null);
    expect(a).toHaveBeenCalledTimes(1);
    expect(b).toHaveBeenCalledTimes(1);
    offA();
    applyTheme(manifest("x"), { style: { setProperty } }, null);
    expect(a).toHaveBeenCalledTimes(1);
    expect(b).toHaveBeenCalledTimes(2);
    offB();
  });

  test("a storage that throws does not break apply", () => {
    const storage: ThemeStorage = { getItem: () => null, setItem: () => { throw new Error("quota"); } };
    expect(() => applyTheme(manifest("x"), { style: { setProperty: vi.fn() } }, storage)).not.toThrow();
  });
});

describe("getActiveThemeTokens", () => {
  test("before any applyTheme, lazily reads from the cache without throwing", async () => {
    vi.resetModules();
    const fresh = await import("./theme-engine");
    expect(() => fresh.getActiveThemeTokens()).not.toThrow();
    // Node test environment has no localStorage, so the cache read resolves to null.
    expect(fresh.getActiveThemeTokens()).toBeNull();
  });

  test("reflects the applied manifest's surface token, and updates on a later applyTheme", () => {
    applyTheme(manifest("a", "#111111"), { style: { setProperty: vi.fn() } }, null);
    expect(getActiveThemeTokens()?.["--rb-surface"]).toBe("#111111");

    applyTheme(manifest("b", "#222222"), { style: { setProperty: vi.fn() } }, null);
    expect(getActiveThemeTokens()?.["--rb-surface"]).toBe("#222222");
  });
});

describe("theme cache", () => {
  test("round-trips", () => {
    const storage = memoryStorage();
    writeThemeCache(manifest("deep-space", "#0b1220"), storage);
    const cache = readThemeCache(storage);
    expect(cache?.id).toBe("deep-space");
    expect(cache?.engineVersion).toBe(1);
    expect(cache?.tokens["--rb-ink"]).toBe("#0b1220");
  });
  test("malformed or missing cache reads as null", () => {
    expect(readThemeCache(memoryStorage())).toBeNull();
    expect(readThemeCache(memoryStorage({ [THEME_CACHE_KEY]: "{not json" }))).toBeNull();
    expect(readThemeCache(memoryStorage({ [THEME_CACHE_KEY]: JSON.stringify({ id: 1 }) }))).toBeNull();
    expect(readThemeCache(null)).toBeNull();
  });
});
