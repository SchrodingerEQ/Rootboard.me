import { describe, expect, test } from "vitest";
import fs from "fs";
import path from "path";

/**
 * scripts/polkit/50-rootboard-network.rules is JavaScript run by polkit.
 * Evaluate it against a stub `polkit` object to pin down exactly what it
 * grants (brief 03, decision 0018): four actions, one group, nothing else.
 */
type Rule = (action: { id: string }, subject: { isInGroup: (g: string) => boolean }) => string;

function loadRule(): Rule {
  const src = fs.readFileSync(path.resolve("scripts/polkit/50-rootboard-network.rules"), "utf8");
  let rule: Rule | undefined;
  const polkit = { addRule: (f: Rule) => (rule = f), Result: { YES: "yes", NOT_HANDLED: "not-handled" } };
  new Function("polkit", src)(polkit);
  if (!rule) throw new Error("rules file registered no rule");
  return rule;
}

const member = { isInGroup: (g: string) => g === "rootboard-system" };
const stranger = { isInGroup: () => false };

describe("polkit rule", () => {
  const rule = loadRule();

  test.each([
    "org.freedesktop.NetworkManager.settings.modify.system",
    "org.freedesktop.NetworkManager.network-control",
    "org.freedesktop.NetworkManager.wifi.scan",
    "org.freedesktop.timedate1.set-timezone",
  ])("grants %s to the rootboard-system group only", (id) => {
    expect(rule({ id }, member)).toBe("yes");
    expect(rule({ id }, stranger)).toBe("not-handled");
  });

  test.each([
    "org.freedesktop.login1.reboot",
    "org.freedesktop.timedate1.set-time",
    "org.freedesktop.NetworkManager.enable-disable-network",
    "org.freedesktop.systemd1.manage-units",
  ])("leaves %s alone", (id) => {
    expect(rule({ id }, member)).toBe("not-handled");
  });

  test("names no user", () => {
    const src = fs.readFileSync(path.resolve("scripts/polkit/50-rootboard-network.rules"), "utf8");
    expect(src).not.toMatch(/subject\.user\s*==/);
  });
});
