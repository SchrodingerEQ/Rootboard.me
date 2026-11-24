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

  test("applies a v2 cache's font and shape properties", () => {
    const { setProperty, info } = runWithConsole(JSON.stringify({ engineVersion: 2, id: "x", tokens: { "--rb-canvas": "#000000" }, style: V2_STYLE }));
    for (const [name, value] of Object.entries(V2_STYLE)) expect(setProperty).toHaveBeenCalledWith(name, value);
    expect(setProperty).toHaveBeenCalledTimes(4);
    expect(info).not.toHaveBeenCalled();
  });

  test("ignores style values outside each property's grammar, and unknown style names", () => {
    const { setProperty, info } = runWithConsole(JSON.stringify({ engineVersion: 2, id: "x", tokens: {}, style: {
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
