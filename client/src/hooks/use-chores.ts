import { useCallback, type Dispatch, type SetStateAction } from "react";
import { useAppState } from "@/hooks/use-app-state";
import { useWidgetState } from "@/hooks/use-widget-state";
import type { WidgetHost } from "@/widgets/types";
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
  clearPersonChores,
  rolloverTallies,
  setPersonColor,
  toggleChore,
  totalChoreCount,
} from "@/lib/chores-state";

const STATE_KEY = "chores";
const ROLLOVER_CHECK_MS = 60_000;

function emptyState(): ChoresState {
  return { people: [], tallyDate: localDateKey() };
}

/** Shared `{state, setState, isLoaded}` -> `UseChoresReturn` API, built once
 *  so `useChores()` (legacy `useAppState`) and `useChoresWithHost()` (new
 *  `useWidgetState`) stay byte-for-byte identical in the callbacks/derived
 *  values they expose — only the persistence layer underneath differs. */
function useChoresApi(
  state: ChoresState,
  setState: Dispatch<SetStateAction<ChoresState>>,
  isLoaded: boolean,
) {
  const onToggleChore = useCallback(
    (personId: string, choreId: string) => setState((s) => toggleChore(s, personId, choreId)),
    [setState],
  );
  const onAddChore = useCallback(
    (personId: string, title: string) => setState((s) => addChore(s, personId, title)),
    [setState],
  );
  const onAddPerson = useCallback((name: string) => setState((s) => addPerson(s, name)), [setState]);
  const onRemovePerson = useCallback((personId: string) => setState((s) => removePerson(s, personId)), [setState]);
  const onRenamePerson = useCallback(
    (personId: string, name: string) => setState((s) => renamePerson(s, personId, name)),
    [setState],
  );
  const onSetPersonColor = useCallback(
    (personId: string, colorIdx: number) => setState((s) => setPersonColor(s, personId, colorIdx)),
    [setState],
  );
  const onClearPersonChores = useCallback(
    (personId: string) => setState((s) => clearPersonChores(s, personId)),
    [setState],
  );

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
    onClearPersonChores,
  };
}

/**
 * Owns ChoresState for the whole app (hoisted in calendar.tsx so the rail
 * badge stays live regardless of which section is showing). Built on the
 * shared `useAppState` persistence hook (client/src/hooks/use-app-state.ts)
 * — see that file for the hardened load/persist/retry pattern. Runs the
 * midnight tally rollover on load and every 60s (the kiosk runs 24/7 across
 * midnight).
 *
 * Superseded by `useChoresWithHost` now that Chores runs as a contract
 * widget (client/src/widgets/chores/index.tsx) — left in place per the
 * phase-3 migration plan even though nothing references it anymore
 * (deletion is a later task).
 */
export function useChores() {
  const { state, setState, isLoaded } = useAppState<ChoresState>({
    key: STATE_KEY,
    emptyState,
    normalize: normalizeChoresState,
    transformOnLoad: (s) => rolloverTallies(s, localDateKey()),
    pollTransformMs: ROLLOVER_CHECK_MS,
  });

  return useChoresApi(state, setState, isLoaded);
}

/**
 * Same `UseChoresReturn` shape as `useChores()`, but built on
 * `useWidgetState` over a widget host's public `storage` surface instead of
 * the direct `useAppState`/`fetch` path — this is what the Chores widget
 * (client/src/widgets/chores/index.tsx) actually uses. Identical
 * emptyState/normalize/rollover config, so existing `app_state` data (read
 * through the host's `chores` legacy-key alias, see
 * client/src/lib/widget-host-services.ts) round-trips bit-for-bit.
 */
export function useChoresWithHost(host: WidgetHost) {
  const { state, setState, isLoaded } = useWidgetState<ChoresState>(host, {
    emptyState,
    normalize: normalizeChoresState,
    transformOnLoad: (s) => rolloverTallies(s, localDateKey()),
    pollTransformMs: ROLLOVER_CHECK_MS,
  });

  return useChoresApi(state, setState, isLoaded);
}

export type UseChoresReturn = ReturnType<typeof useChores>;
