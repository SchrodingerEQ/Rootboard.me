// client/src/lib/theme-boot-script.spec.ts
import fs from "fs";
import path from "path";
import { describe, expect, test, vi } from "vitest";

const html = fs.readFileSync(path.resolve(import.meta.dirname, "../../index.html"), "utf-8");

function bootScript(): string {
  const m = /<script id="rb-theme-boot">([\s\S]*?)<\/script>/.exec(html);
  if (!m) throw new Error("rb-theme-boot script not found in client/index.html");
  return m[1];
}

function runWithConsole(stored: string | null) {
  const setProperty = vi.fn();
  const localStorage = { getItem: vi.fn(() => stored) };
  const document = { documentElement: { style: { setProperty } } };
  const console = { info: vi.fn() };
  new Function("localStorage", "document", "console", bootScript())(localStorage, document, console);
  return { setProperty, info: console.info };
}

function run(stored: string | null) {
  return runWithConsole(stored).setProperty;
}

const V2_STYLE = {
  "--rb-font-family": "'Nunito', system-ui, 'Segoe UI', sans-serif",
  "--rb-radius-scale": "0.5",
  "--rb-shadow-softness": "2",
};

const V3_LAYERS = {
  "--rb-backing-header-color": "transparent",
  "--rb-backing-header-image": "linear-gradient(to bottom, rgba(10, 20, 30, 0.8), rgba(10, 20, 30, 0))",
  "--rb-backing-rail-color": "rgba(247, 246, 243, 0.7)",
  "--rb-backing-rail-image": "none",
  "--rb-backing-vote-strip-color": "#ffffff99",
  "--rb-backing-vote-strip-image": "linear-gradient(to right, #000000, #ffffff)",
  "--rb-view-fill": "transparent",
};

describe("client/index.html theme boot script", () => {
  test("applies cached --rb-* tokens with valid color values", () => {
    const setProperty = run(JSON.stringify({ engineVersion: 2, id: "deep-space", tokens: { "--rb-canvas": "#0b1220", "--rb-shadow-card": "rgba(0, 0, 0, 0.4)" }, style: {} }));
    expect(setProperty).toHaveBeenCalledWith("--rb-canvas", "#0b1220");
    expect(setProperty).toHaveBeenCalledWith("--rb-shadow-card", "rgba(0, 0, 0, 0.4)");
    expect(setProperty).toHaveBeenCalledTimes(2);
  });

  test("ignores non --rb- keys and non-color values", () => {
    const setProperty = run(JSON.stringify({ engineVersion: 2, id: "x", style: {}, tokens: {
      "--background": "#000000",
      "--rb-canvas": "url(javascript:alert(1))",
      "--rb-ink": "var(--rb-canvas)",
      "--rb-surface": 12,
      "--rb-ok": "#ffffff",
    } }));
    expect(setProperty).toHaveBeenCalledTimes(1);
    expect(setProperty).toHaveBeenCalledWith("--rb-ok", "#ffffff");
  });

  test("applies a v3 cache's font, shape, backing and view-fill properties", () => {
    const { setProperty, info } = runWithConsole(JSON.stringify({ engineVersion: 3, id: "x", tokens: { "--rb-canvas": "#000000" }, style: V2_STYLE, layers: V3_LAYERS }));
    for (const [name, value] of Object.entries(V2_STYLE)) expect(setProperty).toHaveBeenCalledWith(name, value);
    for (const [name, value] of Object.entries(V3_LAYERS)) expect(setProperty).toHaveBeenCalledWith(name, value);
    expect(setProperty).toHaveBeenCalledTimes(1 + Object.keys(V2_STYLE).length + Object.keys(V3_LAYERS).length);
    expect(info).not.toHaveBeenCalled();
  });

  test("a v2 cache (written before manifest v3) applies its font and shape and logs one line", () => {
    const { setProperty, info } = runWithConsole(JSON.stringify({ engineVersion: 2, id: "x", tokens: { "--rb-canvas": "#000000" }, style: V2_STYLE }));
    for (const [name, value] of Object.entries(V2_STYLE)) expect(setProperty).toHaveBeenCalledWith(name, value);
    expect(setProperty).toHaveBeenCalledTimes(4);
    expect(info).toHaveBeenCalledTimes(1);
    expect(info.mock.calls[0][0]).toMatch(/predates theme manifest v3/);
  });

  test("ignores backing values outside the layer grammar (no url, var, raw CSS or other gradients)", () => {
    const { setProperty, info } = runWithConsole(JSON.stringify({ engineVersion: 3, id: "x", tokens: {}, style: {}, layers: {
      "--rb-backing-header-color": "var(--rb-canvas)",
      "--rb-backing-header-image": "url(https://example.invalid/a.png)",
      "--rb-backing-rail-color": "red; background: url(x)",
      "--rb-backing-rail-image": "radial-gradient(#000000, #ffffff)",
      "--rb-backing-vote-strip-image": "linear-gradient(to bottom, #000000, url(x))",
      "--rb-view-fill": 0,
      "--rb-other": "transparent",
    } }));
    expect(setProperty).not.toHaveBeenCalled();
    expect(info).toHaveBeenCalledTimes(6);
  });

  test("ignores style values outside each property's grammar, and unknown style names", () => {
    const { setProperty, info } = runWithConsole(JSON.stringify({ engineVersion: 3, id: "x", tokens: {}, layers: {}, style: {
      "--rb-font-family": "x; background: url(https://example.invalid)",
      "--rb-radius-scale": "calc(1)",
      "--rb-shadow-softness": 2,
      "--rb-other": "1",
    } }));
    expect(setProperty).not.toHaveBeenCalled();
    expect(info).toHaveBeenCalledTimes(3); // one line per rejected known property; unknown names are not read
  });

  test("a v1 cache (written before manifest v2) repaints its colours and logs one line", () => {
    const { setProperty, info } = runWithConsole(JSON.stringify({ engineVersion: 1, id: "deep-space", tokens: { "--rb-canvas": "#0b1220" } }));
    expect(setProperty).toHaveBeenCalledTimes(1);
    expect(setProperty).toHaveBeenCalledWith("--rb-canvas", "#0b1220");
    expect(info).toHaveBeenCalledTimes(1);
    expect(info.mock.calls[0][0]).toMatch(/predates theme manifest v2/);
  });

  test("does nothing and does not throw on missing or malformed cache", () => {
    expect(run(null)).not.toHaveBeenCalled();
    expect(run("{not json")).not.toHaveBeenCalled();
    expect(run(JSON.stringify({ tokens: "nope" }))).not.toHaveBeenCalled();
  });

  test("survives a localStorage that throws", () => {
    const setProperty = vi.fn();
    const localStorage = { getItem: () => { throw new Error("blocked"); } };
    const document = { documentElement: { style: { setProperty } } };
    expect(() => new Function("localStorage", "document", bootScript())(localStorage, document)).not.toThrow();
    expect(setProperty).not.toHaveBeenCalled();
  });
});
