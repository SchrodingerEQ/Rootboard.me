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

function emptyState(): ChoresState {
  return { people: [], tallyDate: localDateKey() };
}

/**
 * Owns ChoresState for the whole app (hoisted in calendar.tsx so the rail
 * badge stays live regardless of which section is showing). Loads once from
 * GET /api/state/chores, applies every mutation locally for instant UI, and
 * persists the whole blob via a debounced PUT. Runs the midnight tally
 * rollover on load and every 60s (the kiosk runs 24/7 across midnight).
 */
export function useChores() {
  const [state, setState] = useState<ChoresState>(emptyState);
  const [isLoaded, setIsLoaded] = useState(false);
  const persistTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Load once.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/state/${STATE_KEY}`, { credentials: "include" });
        if (!res.ok) throw new Error(`Failed to load chores state: ${res.status}`);
        const body = (await res.json()) as { key: string; value: unknown };
        if (cancelled) return;
        const loaded = body.value === null ? emptyState() : normalizeChoresState(body.value);
        setState(rolloverTallies(loaded, localDateKey()));
      } catch (err) {
        console.error("Failed to load chores state:", err);
      } finally {
        if (!cancelled) setIsLoaded(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // Debounced whole-blob persist on every change, once loaded.
  useEffect(() => {
    if (!isLoaded) return;
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
  // poll rather than relying only on the load-time check above.
  useEffect(() => {
    const id = setInterval(() => {
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
