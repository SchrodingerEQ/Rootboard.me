/**
 * Google OAuth client secrets never enter the repo (decision 0017, "Client
 * credentials"). gitleaks' default ruleset does not match them, so
 * .gitleaks.toml carries its own rule; this pins that rule, checks nothing
 * is allowlisted for it, and scans every tracked file with the same pattern.
 * The sample secret is built at run time so this file holds no match itself.
 */
import { execFileSync } from "child_process";
import fs from "fs";
import path from "path";
import { describe, expect, test } from "vitest";

const root = path.resolve(import.meta.dirname, "..");
const config = fs.readFileSync(path.join(root, ".gitleaks.toml"), "utf-8");

function ruleRegex(): RegExp {
  const block = config.split("[[rules]]").find((b) => b.includes('id = "rootboard-google-oauth-client-secret"'));
  if (!block) throw new Error("rule rootboard-google-oauth-client-secret is missing from .gitleaks.toml");
  const match = block.match(/regex = '''(.+)'''/);
  if (!match) throw new Error("the rule has no regex");
  return new RegExp(match[1]);
}

const sample = ["GOC", "SPX-", "AbCdEf012345_-ghIJklMNopQR"].join("");

describe("Google OAuth client secret rule", () => {
  test("the rule matches a client secret and keys on its prefix", () => {
    expect(ruleRegex().test(sample)).toBe(true);
    expect(ruleRegex().test(`const s = "${sample}";`)).toBe(true);
    expect(config).toMatch(/keywords = \["gocspx-"\]/);
  });

  test("no allowlist exempts a path for it", () => {
    const allowedPaths = Array.from(config.matchAll(/^paths = \[([\s\S]*?)\]/gm), (m) => m[1]).join("\n");
    expect(allowedPaths).not.toMatch(/google-oauth/);
    expect(allowedPaths).not.toMatch(/\.ts\b/);
  });

  test("no tracked file contains a client secret", () => {
    let files: string[];
    try {
      files = execFileSync("git", ["ls-files", "-z"], { cwd: root, encoding: "utf-8" }).split("\0").filter(Boolean);
    } catch {
      // Not a git checkout (e.g. an unpacked release tarball): nothing to scan.
      return;
    }
    const rule = ruleRegex();
    const hits = files.filter((file) => {
      const full = path.join(root, file);
      if (!fs.existsSync(full) || fs.statSync(full).size > 2_000_000) return false;
      return rule.test(fs.readFileSync(full, "utf-8"));
    });
    expect(hits).toEqual([]);
  });
});
