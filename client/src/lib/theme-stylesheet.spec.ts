// client/src/lib/theme-stylesheet.spec.ts
import fs from "fs";
import path from "path";
import { describe, expect, test } from "vitest";
import { THEME_TOKEN_NAMES } from "@shared/theme-manifest";
import { parseRootDeclarations, resolveRootTokens } from "./theme-stylesheet";

const css = fs.readFileSync(path.resolve(import.meta.dirname, "../index.css"), "utf-8");

const SHADCN_TOKENS = [
  "--background", "--foreground", "--muted", "--muted-foreground",
  "--popover", "--popover-foreground", "--card", "--card-foreground",
  "--border", "--input", "--primary", "--primary-foreground",
  "--secondary", "--secondary-foreground", "--accent", "--accent-foreground",
  "--destructive", "--destructive-foreground", "--ring",
];

describe("index.css :root vs THEME_TOKEN_NAMES", () => {
  const decls = parseRootDeclarations(css);

  test("the --rb-* names declared in :root equal THEME_TOKEN_NAMES exactly", () => {
    const declared = Array.from(decls.keys()).filter((k) => k.startsWith("--rb-")).sort();
    expect(declared).toEqual([...THEME_TOKEN_NAMES].sort());
  });

  test("every shadcn token is an alias of a --rb-* token", () => {
    for (const name of SHADCN_TOKENS) {
      expect(decls.get(name), name).toMatch(/^var\(--rb-[a-z0-9-]+\)$/);
    }
  });

  test("--rb-ink-tertiary carries the former --muted-foreground value", () => {
    expect(decls.get("--rb-ink-tertiary")).toBe("#787f8c");
  });

  test("resolveRootTokens yields a literal for every token", () => {
    const resolved = resolveRootTokens(css);
    for (const name of THEME_TOKEN_NAMES) {
      expect(resolved[name], name).toMatch(/^(#[0-9a-f]{6}|rgba?\()/i);
    }
    expect(resolved["--rb-nav-active-bg"]).toBe("#fdeae8"); // var(--rb-accent-wash) resolved
  });
});

describe("parser edge cases", () => {
  test("ignores comments and resolves chained var() references", () => {
    const sample = `:root {\n  --rb-a: #111111; /* c */\n  --rb-b: var(--rb-a);\n  --rb-c: var(--rb-b);\n  --x: var(--rb-a);\n}\n.dark {\n  --rb-a: #000000;\n}`;
    expect(resolveRootTokens(sample)).toEqual({ "--rb-a": "#111111", "--rb-b": "#111111", "--rb-c": "#111111" });
  });

  test("throws on a dangling reference", () => {
    expect(() => resolveRootTokens(`:root {\n  --rb-a: var(--rb-nope);\n}`)).toThrow(/--rb-nope/);
  });
});
