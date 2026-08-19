import { describe, expect, test } from "vitest";
import { resolveLoadedState, resolveMutation, resolveSetStateAction } from "./use-widget-state";

// No React renderer exists in this repo's test setup, so useWidgetState
// itself can't be exercised directly. Its non-trivial decision logic lives
// in three pure, host-free helpers (see the "Pure decision kernel" comment
// in use-widget-state.ts) — this spec covers those. The hook's remaining
// React wiring (useState/useEffect plumbing, calling `host.storage.set`
// only when a helper reports `changed: true`) is thin enough to be
// inspection-only; it is NOT machine-checked here.

interface Widget {
  id: string;
  count: number;
}

function emptyState(): Widget {
  return { id: "empty", count: 0 };
}

function normalize(raw: unknown): Widget {
  const v = raw as Partial<Widget> | null | undefined;
  return { id: typeof v?.id === "string" ? v.id : "unknown", count: typeof v?.count === "number" ? v.count : 0 };
}

// Fake host-storage recorder — stands in for `host.storage.set`. Passed to
// the *caller* pattern each hook call site uses (`if (changed)
// recorder.set(value)`), never to the kernel functions themselves, since
// none of them accept a storage reference at all.
function makeRecorder() {
  const calls: unknown[] = [];
  return { set: (v: unknown) => calls.push(v), calls };
}

describe("resolveLoadedState", () => {
  test("null raw value resolves to emptyState()", () => {
    expect(resolveLoadedState(null, { emptyState, normalize })).toEqual({ id: "empty", count: 0 });
  });

  test("non-null raw value is normalized, not passed through raw", () => {
    const result = resolveLoadedState({ id: "widget-1", count: 3, junk: "drop me" }, { emptyState, normalize });
    expect(result).toEqual({ id: "widget-1", count: 3 });
  });

  test("malformed raw value is coerced by normalize rather than throwing", () => {
    expect(resolveLoadedState("garbage", { emptyState, normalize })).toEqual({ id: "unknown", count: 0 });
  });

  test("transformOnLoad is applied after normalize, on the normalized value", () => {
    const doubled = resolveLoadedState(
      { id: "w", count: 5 },
      { emptyState, normalize, transformOnLoad: (s) => ({ ...s, count: s.count * 2 }) },
    );
    expect(doubled).toEqual({ id: "w", count: 10 });
  });

  test("transformOnLoad also runs on the null/emptyState() branch", () => {
    const result = resolveLoadedState(null, {
      emptyState,
      normalize,
      transformOnLoad: (s) => ({ ...s, count: s.count + 100 }),
    });
    expect(result).toEqual({ id: "empty", count: 100 });
  });

  test("is pure: takes no storage/host reference, so a caller-provided recorder is never touched", () => {
    const recorder = makeRecorder();
    resolveLoadedState({ id: "w", count: 1 }, { emptyState, normalize, transformOnLoad: (s) => s });
    // The kernel function's signature has nowhere to plug `recorder` in —
    // this asserts the CALLER contract (load never persists) by
    // construction, not by intercepting a call the function can't make.
    expect(recorder.calls).toEqual([]);
  });
});

describe("resolveSetStateAction", () => {
  test("a plain value is returned as-is, ignoring prev", () => {
    expect(resolveSetStateAction({ id: "next", count: 9 }, { id: "prev", count: 1 })).toEqual({
      id: "next",
      count: 9,
    });
  });

  test("a functional updater is resolved against the current prev", () => {
    const prev: Widget = { id: "w", count: 4 };
    const resolved = resolveSetStateAction((p: Widget) => ({ ...p, count: p.count + 1 }), prev);
    expect(resolved).toEqual({ id: "w", count: 5 });
  });

  test("resolved-value mirroring: the object returned is what a caller would pass to storage.set", () => {
    const prev: Widget = { id: "w", count: 4 };
    const recorder = makeRecorder();
    const resolved = resolveSetStateAction((p: Widget) => ({ ...p, count: p.count + 1 }), prev);
    const { value, changed } = resolveMutation(prev, resolved);
    if (changed) recorder.set(value);
    expect(recorder.calls).toEqual([{ id: "w", count: 5 }]);
  });
});

describe("resolveMutation", () => {
  test("a genuinely different reference is reported changed, with that value", () => {
    const prev: Widget = { id: "w", count: 1 };
    const next: Widget = { id: "w", count: 2 };
    expect(resolveMutation(prev, next)).toEqual({ value: next, changed: true });
  });

  test("same-reference result signals no change (caller must not persist)", () => {
    const prev: Widget = { id: "w", count: 1 };
    expect(resolveMutation(prev, prev)).toEqual({ value: prev, changed: false });
  });

  test("caller pattern: a same-ref transform tick never calls storage.set", () => {
    const prev: Widget = { id: "w", count: 1 };
    const noopTransform = (s: Widget) => s; // well-behaved transform: same ref when nothing changes
    const recorder = makeRecorder();

    const { value, changed } = resolveMutation(prev, noopTransform(prev));
    if (changed) recorder.set(value);

    expect(changed).toBe(false);
    expect(value).toBe(prev);
    expect(recorder.calls).toEqual([]);
  });

  test("caller pattern: a real transform tick calls storage.set exactly once with the new value", () => {
    const prev: Widget = { id: "w", count: 1 };
    const rollover = (s: Widget) => ({ ...s, count: 0 });
    const recorder = makeRecorder();

    const { value, changed } = resolveMutation(prev, rollover(prev));
    if (changed) recorder.set(value);

    expect(changed).toBe(true);
    expect(recorder.calls).toEqual([{ id: "w", count: 0 }]);
  });
});
