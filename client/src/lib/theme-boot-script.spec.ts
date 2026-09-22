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

function run(stored: string | null) {
  const setProperty = vi.fn();
  const localStorage = { getItem: vi.fn(() => stored) };
  const document = { documentElement: { style: { setProperty } } };
  new Function("localStorage", "document", bootScript())(localStorage, document);
  return setProperty;
}

describe("client/index.html theme boot script", () => {
  test("applies cached --rb-* tokens with valid color values", () => {
    const setProperty = run(JSON.stringify({ engineVersion: 1, id: "deep-space", tokens: { "--rb-canvas": "#0b1220", "--rb-shadow-card": "rgba(0, 0, 0, 0.4)" } }));
    expect(setProperty).toHaveBeenCalledWith("--rb-canvas", "#0b1220");
    expect(setProperty).toHaveBeenCalledWith("--rb-shadow-card", "rgba(0, 0, 0, 0.4)");
    expect(setProperty).toHaveBeenCalledTimes(2);
  });

  test("ignores non --rb- keys and non-color values", () => {
    const setProperty = run(JSON.stringify({ engineVersion: 1, id: "x", tokens: {
      "--background": "#000000",
      "--rb-canvas": "url(javascript:alert(1))",
      "--rb-ink": "var(--rb-canvas)",
      "--rb-surface": 12,
      "--rb-ok": "#ffffff",
    } }));
    expect(setProperty).toHaveBeenCalledTimes(1);
    expect(setProperty).toHaveBeenCalledWith("--rb-ok", "#ffffff");
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
