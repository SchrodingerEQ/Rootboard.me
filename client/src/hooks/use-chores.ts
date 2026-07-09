import { useCallback, useEffect, useRef, useState } from "react";
import { apiRequest } from "@/lib/queryClient";
import {
  type ChoresState,
  addChore,
  addPerson,
  doneTodayTotal,
  localDateKey,
  normalizeChoresState,
  openChoreCount,
  removePerson,
  renamePerson,
  resetChores,
  rolloverTallies,
  setPersonColor,
  toggleChore,
  totalChoreCount,
} from "@/lib/chores-state";

const STATE_KEY = "chores";
const PERSIST_DEBOUNCE_MS = 600;
const ROLLOVER_CHECK_MS = 60_000;
const LOAD_RETRY_MS = 15_000;

function emptyState(): ChoresState {
  return { people: [], tallyDate: localDateKey() };
}

/**
 * Owns ChoresState for the whole app (hoisted in calendar.tsx so the rail
 * badge stays live regardless of which section is showing). Loads once from
 * GET /api/state/chores, applies every mutation locally for instant UI, and
 * persists the whole blob via a debounced PUT. Runs the midnight tally
 * rollover on load and every 60s (the kiosk runs 24/7 across midnight).
 *
 * This is a 24/7 kiosk with nobody around to click "retry" — a transient
 * failure of the initial GET must NEVER be allowed to result in a PUT that
 * overwrites the family's real stored data with the empty initial state.
 * `loadSucceededRef` is the single source of truth for "safe to persist";
 * `isLoaded` (state) only flips once that ref has already been set, so the
 * two can't drift. On failure we keep retrying the GET on an interval
 * instead of ever falling through to "loaded".
 */
export function useChores() {
  const [state, setState] = useState<ChoresState>(emptyState);
  const [isLoaded, setIsLoaded] = useState(false);
  const persistTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const loadSucceededRef = useRef(false);
  // Swallows the persist effect's first run right after a successful load,
  // so re-saving the state we just fetched doesn't fire a pointless PUT.
  const skipNextPersistRef = useRef(true);

  // Load once, retrying on an interval until it succeeds — there's no user
  // on a kiosk to retry manually, and we must never treat a failed load as
  // "loaded" (that would let the persist effect below overwrite real data).
  useEffect(() => {
    let cancelled = false;
    let retryTimer: ReturnType<typeof setTimeout> | null = null;

    const load = async () => {
      try {
        const res = await fetch(`/api/state/${STATE_KEY}`, { credentials: "include" });
        if (!res.ok) throw new Error(`Failed to load chores state: ${res.status}`);
        const body = (await res.json()) as { key: string; value: unknown };
        if (cancelled) return;
        const loaded = body.value === null ? emptyState() : normalizeChoresState(body.value);
        setState(rolloverTallies(loaded, localDateKey()));
        loadSucceededRef.current = true;
        setIsLoaded(true);
      } catch (err) {
        console.error("Failed to load chores state:", err);
        if (!cancelled) retryTimer = setTimeout(load, LOAD_RETRY_MS);
      }
    };

    load();

    return () => {
      cancelled = true;
      if (retryTimer) clearTimeout(retryTimer);
    };
  }, []);

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
      apiRequest("PUT", `/api/state/${STATE_KEY}`, { value: state }).catch((err) => {
        console.error("Failed to persist chores state:", err);
      });
    }, PERSIST_DEBOUNCE_MS);
    return () => {
      if (persistTimer.current) clearTimeout(persistTimer.current);
    };
  }, [state, isLoaded]);

  // Local-midnight tally rollover — the kiosk never reloads on its own, so
  // poll rather than relying only on the load-time check above. Gated on a
  // successful load so it can't touch/persist the placeholder empty state
  // while the initial load is still retrying.
  useEffect(() => {
    const id = setInterval(() => {
      if (!loadSucceededRef.current) return;
      setState((s) => rolloverTallies(s, localDateKey()));
    }, ROLLOVER_CHECK_MS);
    return () => clearInterval(id);
  }, []);

  const onToggleChore = useCallback(
    (personId: string, choreId: string) => setState((s) => toggleChore(s, personId, choreId)),
    [],
  );
  const onAddChore = useCallback(
    (personId: string, title: string) => setState((s) => addChore(s, personId, title)),
    [],
  );
  const onAddPerson = useCallback((name: string) => setState((s) => addPerson(s, name)), []);
  const onRemovePerson = useCallback((personId: string) => setState((s) => removePerson(s, personId)), []);
  const onRenamePerson = useCallback(
    (personId: string, name: string) => setState((s) => renamePerson(s, personId, name)),
    [],
  );
  const onSetPersonColor = useCallback(
    (personId: string, colorIdx: number) => setState((s) => setPersonColor(s, personId, colorIdx)),
    [],
  );
  const onResetChores = useCallback(() => setState((s) => resetChores(s)), []);

  return {
    state,
    people: state.people,
    isLoaded,
    openChoreCount: openChoreCount(state),
    doneTodayTotal: doneTodayTotal(state),
    totalChoreCount: totalChoreCount(state),
    onToggleChore,
    onAddChore,
    onAddPerson,
    onRemovePerson,
    onRenamePerson,
    onSetPersonColor,
    onResetChores,
  };
}

export type UseChoresReturn = ReturnType<typeof useChores>;
