import { describe, expect, test } from "vitest";
import {
  CALLBACK_FAILURE_COPY,
  readCallbackOutcome,
  shouldShowSyncedEvents,
  startFailureSentence,
  withoutCallbackParams,
} from "./google-sign-in";

describe("the return from Google", () => {
  test("connected, failed with a known reason, an unknown reason, and nothing", () => {
    expect(readCallbackOutcome("?google=connected")).toEqual({ kind: "connected" });
    expect(readCallbackOutcome("?google=failed&reason=denied")).toEqual({ kind: "failed", sentence: CALLBACK_FAILURE_COPY.denied });
    expect(readCallbackOutcome("?google=failed&reason=whatever")).toMatchObject({ kind: "failed" });
    expect(readCallbackOutcome("")).toBeNull();
    expect(readCallbackOutcome("?other=1")).toBeNull();
  });

  test("every reason the server sends has a sentence", () => {
    for (const reason of ["denied", "expired", "bad-request", "no-refresh-token", "exchange-failed"]) {
      expect(CALLBACK_FAILURE_COPY[reason]).toMatch(/\.$/);
    }
  });

  test("the parameters come off the URL, anything else stays", () => {
    expect(withoutCallbackParams("http://localhost:5000/?google=connected")).toBe("/");
    expect(withoutCallbackParams("http://localhost:5000/?google=failed&reason=denied&x=1#h")).toBe("/?x=1#h");
  });
});

describe("which state shows the last synced events", () => {
  test("connected either way, and a lost Google sign-in, but not signed out", () => {
    expect(shouldShowSyncedEvents({ authenticated: true, mode: "service-account" })).toBe(true);
    expect(shouldShowSyncedEvents({ authenticated: true })).toBe(true);
    expect(shouldShowSyncedEvents({ authenticated: false, mode: "oauth" })).toBe(true);
    expect(shouldShowSyncedEvents({ authenticated: false, mode: "none" })).toBe(false);
    expect(shouldShowSyncedEvents(undefined)).toBe(false);
  });
});

test("start failures in words", () => {
  expect(startFailureSentence(403)).toMatch(/kiosk's own screen/);
  expect(startFailureSentence(500)).toMatch(/try again/);
});

test("nothing in the client imports the OAuth client file (it stays out of the browser bundle)", async () => {
  const fs = await import("fs");
  const path = await import("path");
  const root = path.resolve(import.meta.dirname, "..");
  const offenders: string[] = [];
  const walk = (dir: string) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (/\.(tsx?|jsx?)$/.test(entry.name) && !entry.name.endsWith(".spec.ts")) {
        if (fs.readFileSync(full, "utf-8").includes("google-oauth-client")) offenders.push(full);
      }
    }
  };
  walk(root);
  expect(offenders).toEqual([]);
});
