import { useCallback, useEffect, useRef, useState, type Dispatch, type SetStateAction } from "react";
import type { WidgetHost } from "@/widgets/types";

export interface UseWidgetStateConfig<T> {
  emptyState: () => T;
  /** Defensively coerces whatever `host.storage.get()` returned into a
   *  well-formed T. */
  normalize: (value: unknown) => T;
  /**
   * Applied to state right after a successful load, and again on every
   * `pollTransformMs` tick thereafter (e.g. midnight tally rollover — the
   * kiosk runs 24/7 and crosses those boundaries while still mounted).
   * MUST return the SAME reference when there's nothing to change, so a
   * no-op tick doesn't trigger a rerender/persist.
   */
  transformOnLoad?: (state: T) => T;
  /** Interval (ms) to re-apply `transformOnLoad`. Ignored if that's omitted. */
  pollTransformMs?: number;
}

export interface UseWidgetStateResult<T> {
  state: T;
  setState: Dispatch<SetStateAction<T>>;
  isLoaded: boolean;
}

// --- Pure decision kernel ---------------------------------------------
//
// No React renderer exists in this repo's test setup, so the hook itself
// can't be exercised directly (see use-widget-state.spec.ts). These three
// functions carry ALL of the hook's non-trivial decision logic and take no
// `host`/storage reference at all — so by construction none of them can
// call `host.storage.set()`. The hook below is thin wiring around them:
// each call site is responsible for invoking `host.storage.set()` (the
// side effect) itself, only when the kernel reports `changed: true`. That
// caller contract — "set on mutation only, never on load" — is exactly
// what's asserted from the outside in the spec.

/** Resolves what state a load should produce: `null` (host had nothing
 *  stored yet) becomes `emptyState()`; anything else is defensively
 *  coerced via `normalize`. `transformOnLoad`, if given, is applied last
 *  in both cases (e.g. midnight tally rollover already due at load time).
 *  Pure — has no access to storage, so it cannot itself persist anything;
 *  the caller (the hook's load effect) must never call `storage.set` with
 *  this result, only `setState`-the-React-setter. */
export function resolveLoadedState<T>(
  raw: unknown,
  { emptyState, normalize, transformOnLoad }: Pick<UseWidgetStateConfig<T>, "emptyState" | "normalize" | "transformOnLoad">,
): T {
  let loaded = raw === null ? emptyState() : normalize(raw);
  if (transformOnLoad) loaded = transformOnLoad(loaded);
  return loaded;
}

/** Resolves a `SetStateAction<T>` (either a plain value or a React-style
 *  functional updater) against the current state, exactly like React's own
 *  `setState` would. Extracted so the resolved value — the object that
 *  actually gets mirrored to `host.storage.set()` — can be asserted
 *  directly instead of only indirectly through hook behavior. */
export function resolveSetStateAction<T>(action: SetStateAction<T>, prev: T): T {
  return typeof action === "function" ? (action as (prev: T) => T)(prev) : action;
}

export interface MutationResult<T> {
  value: T;
  /** False iff `next` is reference-equal to `prev` — the shared "no-op"
   *  bailout both `setState` and the poll-transform tick rely on. */
  changed: boolean;
}

/** Compares a candidate next value against the previous one and reports
 *  whether it actually changed. Both `setState` (candidate = the resolved
 *  `SetStateAction`) and the poll-transform tick (candidate =
 *  `transformOnLoad(prev)`) route through this so "same reference -> no
 *  persist, no state churn" is one rule instead of two hand-duplicated
 *  `=== ` checks. The caller mirrors to `host.storage.set(value)` iff
 *  `changed` is true; this function itself never touches storage. */
export function resolveMutation<T>(prev: T, next: T): MutationResult<T> {
  return next === prev ? { value: prev, changed: false } : { value: next, changed: true };
}

/**
 * Gives a widget the old `useAppState` ergonomics (client/src/hooks/
 * use-app-state.ts), rebuilt on top of the PUBLIC `host.storage` surface
 * only (`get()`/`set()` — see client/src/widgets/types.ts). This is the
 * generic hook `use-chores.ts`'s `useChoresWithHost` (and future widget
 * hooks) build on.
 *
 * `host.storage.get()` is backed by `AppStateClient` (client/src/lib/
 * app-state-client.ts), which already retries the GET forever until it
 * succeeds — so unlike `use-app-state.ts` this hook does not need its own
 * load-retry loop, it just awaits the one promise `get()` returns.
 *
 * Load-vs-mutation separation: the initial load (and every poll-transform
 * tick that turns out to be a no-op) updates React state via a private
 * setter that never touches `host.storage`. Only the `setState` returned
 * to the caller — and a poll-transform tick that actually changes the
 * reference — calls `host.storage.set()`. This is what guarantees "do not
 * persist the just-loaded state" without needing use-app-state's
 * `skipNextPersistRef` flag: the load path simply never runs through the
 * persisting setter.
 *
 * `host.storage.set()` itself is a hard no-op (with a console.error) until
 * the underlying `AppStateClient` has completed a successful load — so
 * "never persist before load" holds even if this hook's own `isLoaded`
 * bookkeeping were ever wrong, e.g. a host disposed mid-load (see that
 * class's `set()`/`dispose()` docs). That backstop is the actual source of
 * truth for the invariant; this hook's `isLoaded` is UI ergonomics on top.
 */
export function useWidgetState<T>(
  host: WidgetHost,
  { emptyState, normalize, transformOnLoad, pollTransformMs }: UseWidgetStateConfig<T>,
): UseWidgetStateResult<T> {
  const [state, setStateInternal] = useState<T>(emptyState);
  const [isLoaded, setIsLoaded] = useState(false);
  // True once the initial load has resolved — gates the poll-transform
  // effect so it can't touch/persist the placeholder empty state while
  // the load is still outstanding.
  const loadedRef = useRef(false);
  // Callers may pass a fresh closure each render (e.g. `(s) =>
  // rolloverTallies(s, localDateKey())`); its BEHAVIOR is stable (pure,
  // reads current time at call time) even though the reference isn't.
  // Tracked in a ref so the poll effect below doesn't restart its
  // interval on every render.
  const transformRef = useRef(transformOnLoad);
  transformRef.current = transformOnLoad;

  useEffect(() => {
    let cancelled = false;
    host.storage.get<T>().then((value) => {
      if (cancelled) return;
      const loaded = resolveLoadedState(value, { emptyState, normalize, transformOnLoad: transformRef.current });
      setStateInternal(loaded);
      loadedRef.current = true;
      setIsLoaded(true);
    });
    return () => {
      cancelled = true;
    };
    // host is expected stable for the lifetime of this hook instance (one
    // host per widget instance, created once by the shell); emptyState/
    // normalize are stable pure functions from the caller — same
    // contract as use-app-state's `key`/`emptyState`/`normalize`.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [host]);

  // Periodic re-apply of transformOnLoad (e.g. midnight tally rollover).
  // Gated on a successful load. A no-op tick (transform returns the SAME
  // reference) resolves to `prev` from the updater, which is React's
  // documented bailout — no rerender, and (since we never call
  // host.storage.set in that branch) no persist either. A real change
  // both updates state AND mirrors it to storage, exactly like a normal
  // mutation through `setState` below.
  useEffect(() => {
    if (!pollTransformMs) return;
    const id = setInterval(() => {
      if (!loadedRef.current || !transformRef.current) return;
      setStateInternal((prev) => {
        const { value, changed } = resolveMutation(prev, transformRef.current!(prev));
        if (changed) host.storage.set(value);
        return value;
      });
    }, pollTransformMs);
    return () => clearInterval(id);
  }, [pollTransformMs, host]);

  const setState: Dispatch<SetStateAction<T>> = useCallback(
    (next) => {
      setStateInternal((prev) => {
        const { value, changed } = resolveMutation(prev, resolveSetStateAction(next, prev));
        if (changed) host.storage.set(value);
        return value;
      });
    },
    [host],
  );

  return { state, setState, isLoaded };
}
