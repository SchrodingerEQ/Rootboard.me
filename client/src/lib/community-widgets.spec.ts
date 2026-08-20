import { afterEach, describe, expect, test, vi } from "vitest";
import {
  _resetCommunityWidgetCacheForTests,
  extractWidgetFromModule,
  filterEnabledManifests,
  loadCommunityWidget,
  pruneStaleCrashRecords,
  type CrashRecord,
} from "./community-widgets";
import type { WidgetManifest } from "@shared/widget-manifest";

afterEach(() => {
  _resetCommunityWidgetCacheForTests();
});

function manifest(overrides: Partial<WidgetManifest> = {}): WidgetManifest {
  return {
    id: "test-valid",
    name: "Test Valid Widget",
    version: "1.0.0",
    apiVersion: 1,
    entry: "index.js",
    slots: ["section"],
    ...overrides,
  };
}

describe("extractWidgetFromModule", () => {
  test("accepts a module whose default export is { mount(...) }", () => {
    const mount = () => ({ unmount() {} });
    const result = extractWidgetFromModule({ default: { mount } });
    expect(result).toEqual({ mount });
  });

  test("rejects a module with no default export", () => {
    expect(extractWidgetFromModule({})).toBeNull();
  });

  test("rejects a default export that is a bare function, not { mount }", () => {
    // The pre-Task-4 test-valid fixture shipped `export default function mount() {}`
    // — exactly the malformed shape this must catch (CONTRACT.md §3's
    // default export is an OBJECT with a mount method, not the mount
    // function itself).
    expect(extractWidgetFromModule({ default: function mount() {} })).toBeNull();
  });

  test("rejects a default export object with no mount function", () => {
    expect(extractWidgetFromModule({ default: { mount: "not a function" } })).toBeNull();
  });

  test("rejects null/undefined modules", () => {
    expect(extractWidgetFromModule(null)).toBeNull();
    expect(extractWidgetFromModule(undefined)).toBeNull();
  });
});

describe("loadCommunityWidget — apiVersion gate", () => {
  test("apiVersion > WIDGET_API_VERSION resolves to newer-api WITHOUT ever calling importFn", async () => {
    const importFn = vi.fn();
    const result = await loadCommunityWidget(manifest({ apiVersion: 2 }), importFn);
    expect(result).toEqual({ status: "newer-api" });
    expect(importFn).not.toHaveBeenCalled();
  });

  test("apiVersion === WIDGET_API_VERSION proceeds to import", async () => {
    const mount = () => ({ unmount() {} });
    const importFn = vi.fn().mockResolvedValue({ default: { mount } });
    const result = await loadCommunityWidget(manifest({ apiVersion: 1 }), importFn);
    expect(result).toEqual({ status: "loaded", widget: { mount } });
    expect(importFn).toHaveBeenCalledWith("/widgets/test-valid/index.js");
  });
});

describe("loadCommunityWidget — module shape / failure handling", () => {
  test("a malformed module (no mount) resolves to a load-error, not a throw", async () => {
    const importFn = vi.fn().mockResolvedValue({ default: {} });
    const result = await loadCommunityWidget(manifest(), importFn);
    expect(result.status).toBe("error");
  });

  test("a rejected import() resolves to a load-error, not a throw", async () => {
    const importFn = vi.fn().mockRejectedValue(new Error("network down"));
    const result = await loadCommunityWidget(manifest(), importFn);
    expect(result).toEqual({ status: "error", message: "network down" });
  });
});

describe("loadCommunityWidget — id+version cache", () => {
  test("a second call with the SAME id+version reuses the cached promise (importFn not called again)", async () => {
    const mount = () => ({ unmount() {} });
    const importFn = vi.fn().mockResolvedValue({ default: { mount } });
    await loadCommunityWidget(manifest(), importFn);
    await loadCommunityWidget(manifest(), importFn);
    expect(importFn).toHaveBeenCalledTimes(1);
  });

  test("a failed load is also cached — re-polling with the same version does not retry", async () => {
    const importFn = vi.fn().mockRejectedValue(new Error("boom"));
    await loadCommunityWidget(manifest(), importFn);
    await loadCommunityWidget(manifest(), importFn);
    expect(importFn).toHaveBeenCalledTimes(1);
  });

  test("a version bump invalidates the cache and retries (even after a prior failure)", async () => {
    const importFn = vi.fn().mockRejectedValue(new Error("boom"));
    await loadCommunityWidget(manifest({ version: "1.0.0" }), importFn);
    await loadCommunityWidget(manifest({ version: "1.0.1" }), importFn);
    expect(importFn).toHaveBeenCalledTimes(2);
  });

  test("two different ids never share a cache entry", async () => {
    const mount = () => ({ unmount() {} });
    const importFn = vi.fn().mockResolvedValue({ default: { mount } });
    await loadCommunityWidget(manifest({ id: "a-widget" }), importFn);
    await loadCommunityWidget(manifest({ id: "b-widget" }), importFn);
    expect(importFn).toHaveBeenCalledTimes(2);
    expect(importFn).toHaveBeenCalledWith("/widgets/a-widget/index.js");
    expect(importFn).toHaveBeenCalledWith("/widgets/b-widget/index.js");
  });
});

describe("filterEnabledManifests — founder-ratified (A) enforcement point", () => {
  test("keeps only manifests whose id is in enabledIds", () => {
    const manifests = [manifest({ id: "a" }), manifest({ id: "b" }), manifest({ id: "c" })];
    const result = filterEnabledManifests(manifests, new Set(["b"]));
    expect(result.map((m) => m.id)).toEqual(["b"]);
  });

  test("an empty enabledIds set drops every manifest", () => {
    const manifests = [manifest({ id: "a" }), manifest({ id: "b" })];
    expect(filterEnabledManifests(manifests, new Set())).toEqual([]);
  });

  test("an empty manifest list returns empty regardless of enabledIds", () => {
    expect(filterEnabledManifests([], new Set(["a"]))).toEqual([]);
  });

  test("preserves input order", () => {
    const manifests = [manifest({ id: "a" }), manifest({ id: "b" }), manifest({ id: "c" })];
    const result = filterEnabledManifests(manifests, new Set(["c", "a"]));
    expect(result.map((m) => m.id)).toEqual(["a", "c"]);
  });
});

describe("pruneStaleCrashRecords — crashed-widget re-attempt path", () => {
  function record(overrides: Partial<CrashRecord> = {}): CrashRecord {
    return { version: "1.0.0", message: "boom", ...overrides };
  }

  test("drops a record whose current version differs from the recorded one", () => {
    const crashed = new Map([["a", record({ version: "1.0.0" })]]);
    const result = pruneStaleCrashRecords(crashed, () => "1.0.1");
    expect(result.has("a")).toBe(false);
  });

  test("keeps a record whose current version still matches", () => {
    const crashed = new Map([["a", record({ version: "1.0.0" })]]);
    const result = pruneStaleCrashRecords(crashed, () => "1.0.0");
    expect(result.get("a")).toEqual(record({ version: "1.0.0" }));
  });

  test("keeps a record when resolveVersion returns undefined (manifest currently unresolvable)", () => {
    const crashed = new Map([["a", record()]]);
    const result = pruneStaleCrashRecords(crashed, () => undefined);
    expect(result.get("a")).toEqual(record());
  });

  test("returns the SAME Map reference when nothing changes (setState bail-out)", () => {
    const crashed = new Map([["a", record({ version: "1.0.0" })]]);
    const result = pruneStaleCrashRecords(crashed, () => "1.0.0");
    expect(result).toBe(crashed);
  });

  test("only drops the stale entries, leaving other ids' records untouched", () => {
    const crashed = new Map([
      ["stale", record({ version: "1.0.0" })],
      ["fresh", record({ version: "2.0.0" })],
    ]);
    const result = pruneStaleCrashRecords(crashed, (id) => (id === "stale" ? "1.0.1" : "2.0.0"));
    expect(result.has("stale")).toBe(false);
    expect(result.get("fresh")).toEqual(record({ version: "2.0.0" }));
  });

  test("an empty map returns itself unchanged", () => {
    const crashed = new Map<string, CrashRecord>();
    expect(pruneStaleCrashRecords(crashed, () => "1.0.0")).toBe(crashed);
  });
});
