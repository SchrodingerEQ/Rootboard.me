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
      let loaded = value === null ? emptyState() : normalize(value);
      if (transformRef.current) loaded = transformRef.current(loaded);
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
        const next = transformRef.current!(prev);
        if (next === prev) return prev;
        host.storage.set(next);
        return next;
      });
    }, pollTransformMs);
    return () => clearInterval(id);
  }, [pollTransformMs, host]);

  const setState: Dispatch<SetStateAction<T>> = useCallback(
    (next) => {
      setStateInternal((prev) => {
        const resolved = typeof next === "function" ? (next as (prev: T) => T)(prev) : next;
        if (resolved === prev) return prev;
        host.storage.set(resolved);
        return resolved;
      });
    },
    [host],
  );

  return { state, setState, isLoaded };
}
