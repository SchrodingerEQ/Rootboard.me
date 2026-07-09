import { useEffect, useRef, useState, type Dispatch, type SetStateAction } from "react";
import { apiRequest } from "@/lib/queryClient";

const PERSIST_DEBOUNCE_MS = 600;
const LOAD_RETRY_MS = 15_000;

export interface UseAppStateConfig<T> {
  /** GET/PUT /api/state/:key. */
  key: string;
  emptyState: () => T;
  /** Defensively coerces whatever GET returned into a well-formed T. */
  normalize: (value: unknown) => T;
  /**
   * Applied to state right after a successful load, and again on every
   * `pollTransformMs` tick thereafter (e.g. midnight tally rollover, weekly
   * data purge — the kiosk runs 24/7 and crosses those boundaries while
   * still mounted). MUST return the SAME reference when there's nothing to
   * change, so a no-op tick doesn't trigger a rerender/persist.
   */
  transformOnLoad?: (state: T) => T;
  /** Interval (ms) to re-apply `transformOnLoad`. Ignored if that's omitted. */
  pollTransformMs?: number;
}

export interface UseAppStateResult<T> {
  state: T;
  setState: Dispatch<SetStateAction<T>>;
  isLoaded: boolean;
}

/**
 * Generic hardened persistence hook shared by every kiosk section that owns
 * a whole-JSON-blob slice of GET/PUT /api/state/:key (Chores, Dinner, ...).
 * Extracted from the original client/src/hooks/use-chores.ts, which was
 * review-hardened against a data-wipe-on-failed-load bug — see the notes
 * below, which apply verbatim to every caller.
 *
 * This is a 24/7 kiosk with nobody around to click "retry" — a transient
 * failure of the initial GET must NEVER be allowed to result in a PUT that
 * overwrites the family's real stored data with the empty initial state.
 * `loadSucceededRef` is the single source of truth for "safe to persist";
 * `isLoaded` (state) only flips once that ref has already been set, so the
 * two can't drift. On failure we keep retrying the GET on an interval
 * instead of ever falling through to "loaded".
 */
export function useAppState<T>({
  key,
  emptyState,
  normalize,
  transformOnLoad,
  pollTransformMs,
}: UseAppStateConfig<T>): UseAppStateResult<T> {
  const [state, setState] = useState<T>(emptyState);
  const [isLoaded, setIsLoaded] = useState(false);
  const persistTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const loadSucceededRef = useRef(false);
  // Swallows the persist effect's first run right after a successful load,
  // so re-saving the state we just fetched doesn't fire a pointless PUT.
  const skipNextPersistRef = useRef(true);
  // Callers pass fresh closures each render (e.g. `(s) => rolloverTallies(s,
  // localDateKey())`); their BEHAVIOR is stable (pure, reads current time at
  // call time) even though the reference isn't. Track the latest one in a
  // ref so the poll effect below can call it without restarting its
  // interval on every render.
  const transformRef = useRef(transformOnLoad);
  transformRef.current = transformOnLoad;

  // Load once, retrying on an interval until it succeeds — there's no user
  // on a kiosk to retry manually, and we must never treat a failed load as
  // "loaded" (that would let the persist effect below overwrite real data).
  useEffect(() => {
    let cancelled = false;
    let retryTimer: ReturnType<typeof setTimeout> | null = null;

    const load = async () => {
      try {
        const res = await fetch(`/api/state/${key}`, { credentials: "include" });
        if (!res.ok) throw new Error(`Failed to load ${key} state: ${res.status}`);
        const body = (await res.json()) as { key: string; value: unknown };
        if (cancelled) return;
        let loaded = body.value === null ? emptyState() : normalize(body.value);
        if (transformRef.current) loaded = transformRef.current(loaded);
        setState(loaded);
        loadSucceededRef.current = true;
        setIsLoaded(true);
      } catch (err) {
        console.error(`Failed to load ${key} state:`, err);
        if (!cancelled) retryTimer = setTimeout(load, LOAD_RETRY_MS);
      }
    };

    load();

    return () => {
      cancelled = true;
      if (retryTimer) clearTimeout(retryTimer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- key is constant per call site; emptyState/normalize are stable pure functions.
  }, [key]);

  // Debounced whole-blob persist on every change, once a load has actually
  // succeeded (isLoaded alone isn't enough of a guard — check the ref too).
  // Skip the run that fires immediately after load finishes, so we don't PUT
  // right back the state we just fetched; only a real local mutation persists.
  useEffect(() => {
    if (!isLoaded || !loadSucceededRef.current) return;
    if (skipNextPersistRef.current) {
      skipNextPersistRef.current = false;
      return;
    }
    if (persistTimer.current) clearTimeout(persistTimer.current);
    persistTimer.current = setTimeout(() => {
      apiRequest("PUT", `/api/state/${key}`, { value: state }).catch((err) => {
        console.error(`Failed to persist ${key} state:`, err);
      });
    }, PERSIST_DEBOUNCE_MS);
    return () => {
      if (persistTimer.current) clearTimeout(persistTimer.current);
    };
  }, [state, isLoaded, key]);

  // Periodic re-apply of transformOnLoad (midnight rollover / weekly purge).
  // Gated on a successful load so it can't touch/persist the placeholder
  // empty state while the initial load is still retrying. Set up once per
  // `pollTransformMs` (not once per render) — see transformRef above.
  useEffect(() => {
    if (!pollTransformMs) return;
    const id = setInterval(() => {
      if (!loadSucceededRef.current || !transformRef.current) return;
      setState((s) => transformRef.current!(s));
    }, pollTransformMs);
    return () => clearInterval(id);
  }, [pollTransformMs]);

  return { state, setState, isLoaded };
}
