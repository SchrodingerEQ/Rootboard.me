import { describe, expect, test, vi } from "vitest";
import {
  THEME_IMAGE_PROPERTY_NAMES,
  THEME_LAYER_PROPERTY_NAMES,
  THEME_STYLE_PROPERTY_NAMES,
  THEME_TOKEN_NAMES,
  type ThemeManifest,
} from "@shared/theme-manifest";
import {
  DEFAULT_THEME_ID,
  THEME_CACHE_KEY,
  applyTheme,
  getActiveConfettiShapes,
  getActiveThemeLogo,
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
    expect(setProperty).toHaveBeenCalledTimes(
      THEME_TOKEN_NAMES.length +
        THEME_STYLE_PROPERTY_NAMES.length +
        THEME_IMAGE_PROPERTY_NAMES.length +
        THEME_LAYER_PROPERTY_NAMES.length,
    );
    expect(setProperty).toHaveBeenCalledWith("--rb-canvas", "#0b1220");
    // A v1 manifest (no font, no shape) is backfilled from Default.
    expect(setProperty).toHaveBeenCalledWith("--rb-radius-scale", "1");
    expect(setProperty).toHaveBeenCalledWith("--rb-font-family", "'Nunito', system-ui, 'Segoe UI', sans-serif");
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
    expect(cache?.engineVersion).toBe(3);
    expect(cache?.tokens["--rb-ink"]).toBe("#0b1220");
    expect(cache?.style?.["--rb-shadow-softness"]).toBe("1");
    expect(cache?.layers?.["--rb-backing-header-color"]).toBe("#0b1220");
    expect(cache?.layers?.["--rb-view-fill"]).toBe("#0b1220");
  });

  test("a v2 cache (no layers) still reads", () => {
    const v2 = JSON.stringify({ engineVersion: 2, id: "x", tokens: { "--rb-ink": "#e6edf7" }, style: { "--rb-radius-scale": "1" } });
    const cache = readThemeCache(memoryStorage({ [THEME_CACHE_KEY]: v2 }));
    expect(cache?.style?.["--rb-radius-scale"]).toBe("1");
    expect(cache?.layers).toBeUndefined();
  });

  test("a theme's own shape and font reach the root and the cache", () => {
    const setProperty = vi.fn();
    const storage = memoryStorage();
    const squared: ThemeManifest = {
      ...manifest("square"),
      engineVersion: 2,
      shape: { radiusScale: 0.3, shadowSoftness: 0 },
      font: { family: "Nunito", fallback: ["serif"], files: ["nunito/nunito-latin.woff2"] },
    };
    applyTheme(squared, { style: { setProperty } }, storage);
    expect(setProperty).toHaveBeenCalledWith("--rb-radius-scale", "0.3");
    expect(setProperty).toHaveBeenCalledWith("--rb-shadow-softness", "0");
    expect(setProperty).toHaveBeenCalledWith("--rb-font-family", "'Nunito', serif");
    expect(readThemeCache(storage)?.style).toEqual({
      "--rb-font-family": "'Nunito', serif",
      "--rb-radius-scale": "0.3",
      "--rb-shadow-softness": "0",
    });
  });

  test("a v1 cache (no style) still reads", () => {
    const v1 = JSON.stringify({ engineVersion: 1, id: "deep-space", tokens: { "--rb-ink": "#e6edf7" } });
    const cache = readThemeCache(memoryStorage({ [THEME_CACHE_KEY]: v1 }));
    expect(cache?.tokens["--rb-ink"]).toBe("#e6edf7");
    expect(cache?.style).toBeUndefined();
  });
  test("malformed or missing cache reads as null", () => {
    expect(readThemeCache(memoryStorage())).toBeNull();
    expect(readThemeCache(memoryStorage({ [THEME_CACHE_KEY]: "{not json" }))).toBeNull();
    expect(readThemeCache(memoryStorage({ [THEME_CACHE_KEY]: JSON.stringify({ id: 1 }) }))).toBeNull();
    expect(readThemeCache(null)).toBeNull();
  });
});

describe("theme images and confetti shapes", () => {
  test("a theme without images clears every region image and falls back to the app logo and plain confetti", () => {
    const setProperty = vi.fn();
    applyTheme(manifest("plain"), { style: { setProperty } }, null);
    for (const name of THEME_IMAGE_PROPERTY_NAMES) expect(setProperty).toHaveBeenCalledWith(name, "none");
    expect(getActiveThemeLogo()).toBeNull();
    expect(getActiveConfettiShapes()).toEqual([]);
  });

  test("a theme's slots reach the root, and its logo and shapes are readable; switching away clears them", () => {
    const setProperty = vi.fn();
    const pictured: ThemeManifest = {
      ...manifest("pictured"),
      engineVersion: 2,
      images: { background: "/assets/bg.jpg", logo: "/assets/logo.png" },
      confettiShapes: ["M0 0H24V24H0Z"],
    };
    applyTheme(pictured, { style: { setProperty } }, null);
    expect(setProperty).toHaveBeenCalledWith("--rb-image-background", 'url("/assets/bg.jpg")');
    expect(setProperty).toHaveBeenCalledWith("--rb-image-header", "none");
    expect(getActiveThemeLogo()).toBe("/assets/logo.png");
    expect(getActiveConfettiShapes()).toEqual(["M0 0H24V24H0Z"]);

    applyTheme(manifest("plain"), { style: { setProperty } }, null);
    expect(setProperty).toHaveBeenCalledWith("--rb-image-background", "none");
    expect(setProperty).toHaveBeenLastCalledWith("--rb-view-fill", "#123456");
    expect(getActiveThemeLogo()).toBeNull();
    expect(getActiveConfettiShapes()).toEqual([]);
  });

  test("images and shapes are not written to the boot cache (colour shows until the theme loads)", () => {
    const storage = memoryStorage();
    applyTheme({ ...manifest("pictured"), images: { background: "/assets/bg.jpg" } }, { style: { setProperty: vi.fn() } }, storage);
    expect(storage.data[THEME_CACHE_KEY]).not.toContain("bg.jpg");
  });
});

describe("text backing and the shell background (manifest v3, decision 0027)", () => {
  const pictured = (backing?: ThemeManifest["backing"]): ThemeManifest => ({
    ...manifest("pictured", "#f7f6f3"),
    engineVersion: 3,
    images: { background: "/assets/bg.jpg" },
    ...(backing ? { backing } : {}),
  });
  function applied(m: ThemeManifest): Record<string, string> {
    const out: Record<string, string> = {};
    applyTheme(m, { style: { setProperty: (n, v) => { out[n] = v; } } }, null);
    return out;
  }

  test("no background image: bars are the surface token, the vote strip bare, the views filled", () => {
    const props = applied(manifest("plain", "#abcdef"));
    expect(props["--rb-backing-header-color"]).toBe("#abcdef");
    expect(props["--rb-backing-header-image"]).toBe("none");
    expect(props["--rb-backing-rail-color"]).toBe("#abcdef");
    expect(props["--rb-backing-vote-strip-color"]).toBe("transparent");
    expect(props["--rb-view-fill"]).toBe("#abcdef");
  });

  test("a background image and no backing: bars at the canvas colour, 70 %; views transparent", () => {
    const props = applied(pictured());
    expect(props["--rb-backing-header-color"]).toBe("rgba(247, 246, 243, 0.7)");
    expect(props["--rb-backing-rail-color"]).toBe("rgba(247, 246, 243, 0.7)");
    expect(props["--rb-backing-vote-strip-color"]).toBe("transparent");
    expect(props["--rb-backing-vote-strip-image"]).toBe("none");
    expect(props["--rb-view-fill"]).toBe("transparent");
  });

  test("each backing kind builds its two layers", () => {
    const props = applied(
      pictured({
        header: { kind: "gradient", from: "rgba(10, 20, 30, 0.8)", to: "rgba(10, 20, 30, 0)", direction: "down" },
        rail: { kind: "gradient", from: "#000000cc", to: "#00000000", direction: "right" },
        voteStrip: { kind: "solid", color: "rgba(255, 255, 255, 0.6)" },
      }),
    );
    expect(props["--rb-backing-header-color"]).toBe("transparent");
    expect(props["--rb-backing-header-image"]).toBe("linear-gradient(to bottom, rgba(10, 20, 30, 0.8), rgba(10, 20, 30, 0))");
    expect(props["--rb-backing-rail-image"]).toBe("linear-gradient(to right, #000000cc, #00000000)");
    expect(props["--rb-backing-vote-strip-color"]).toBe("rgba(255, 255, 255, 0.6)");
    expect(props["--rb-backing-vote-strip-image"]).toBe("none");

    const none = applied(pictured({ header: { kind: "none" } }));
    expect(none["--rb-backing-header-color"]).toBe("transparent");
    expect(none["--rb-backing-header-image"]).toBe("none");
  });

  test("the cache carries the layers, so the boot script can repaint them", () => {
    const storage = memoryStorage();
    applyTheme(pictured({ voteStrip: { kind: "none" } }), { style: { setProperty: vi.fn() } }, storage);
    const cached = JSON.parse(storage.data[THEME_CACHE_KEY]);
    expect(Object.keys(cached.layers).sort()).toEqual([...THEME_LAYER_PROPERTY_NAMES].sort());
  });
});
