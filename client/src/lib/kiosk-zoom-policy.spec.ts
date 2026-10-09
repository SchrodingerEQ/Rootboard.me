// client/src/lib/kiosk-zoom-policy.spec.ts
//
// Guards the "no pinch zoom on the kiosk" policy (docs/decisions/0013).
// Firefox desktop ships touch pinch-zoom on (apz.allow_zooming=true) and
// ignores the viewport meta's user-scalable=no, so the only page-side
// control is CSS touch-action. `manipulation` is an alias for
// `pan-x pan-y pinch-zoom` and therefore still ALLOWS pinch zoom; the
// root must use `pan-x pan-y` (scroll yes, zoom no), and nothing below it
// may re-enable zoom with `manipulation`, `pinch-zoom`, or `auto`.
import fs from "fs";
import path from "path";
import { describe, expect, test } from "vitest";

const clientRoot = path.resolve(import.meta.dirname, "../..");
const html = fs.readFileSync(path.join(clientRoot, "index.html"), "utf-8");
const css = fs.readFileSync(path.join(clientRoot, "src/index.css"), "utf-8");

/** Every `touch-action: <value>` declaration in a stylesheet / inline <style>. */
function touchActions(source: string): string[] {
  return [...source.matchAll(/touch-action\s*:\s*([^;}]+)/g)].map((m) => m[1].trim());
}

describe("kiosk zoom policy", () => {
  test("the document root opts out of pinch zoom with touch-action: pan-x pan-y", () => {
    const inlineStyle = /<style>([\s\S]*?)<\/style>/.exec(html)?.[1] ?? "";
    const htmlRule = /html\s*,?\s*body\s*{[^}]*}|html\s*{[^}]*}/.exec(inlineStyle)?.[0] ?? "";
    expect(touchActions(htmlRule)).toEqual(["pan-x pan-y"]);
  });

  test("no touch-action anywhere in the entry HTML or global CSS re-enables zoom", () => {
    const zoomEnabling = /\b(manipulation|pinch-zoom|auto)\b/;
    for (const value of [...touchActions(html), ...touchActions(css)]) {
      expect(value, `touch-action: ${value}`).not.toMatch(zoomEnabling);
    }
  });

  test("the viewport meta still declares user-scalable=no for browsers that honor it", () => {
    expect(html).toMatch(/<meta name="viewport" content="[^"]*user-scalable=no[^"]*"/);
  });
});
