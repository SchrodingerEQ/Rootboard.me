import { useCallback, type Dispatch, type SetStateAction } from "react";
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

/** Shared `{state, setState, isLoaded}` -> `UseChoresReturn` API, used by
 *  `useChoresWithHost()` below (built on `useWidgetState`). Kept as its own
 *  function — rather than inlined — because it used to also back a legacy
 *  `useChores()` variant (direct `useAppState`/`fetch`, pre-widget-host);
 *  that variant is gone (deleted Task 10, nothing referenced it once Chores
 *  moved onto the contract in Task 6), but this split still keeps the
 *  callbacks/derived-values shape in one place if a future persistence layer
 *  is ever added. */
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
 * Owns ChoresState for the Chores widget, built on `useWidgetState` over a
 * widget host's public `storage` surface (client/src/widgets/chores/index.tsx
 * is the only caller). Existing `app_state` data round-trips bit-for-bit
 * through the host's `chores` legacy-key alias (see
 * client/src/lib/widget-host-services.ts). Runs the midnight tally rollover
 * on load and every 60s (the kiosk runs 24/7 across midnight).
 *
 * Formerly paired with a hoisted `useChores()` (direct `useAppState`/`fetch`,
 * pre-widget-host) that lived in calendar.tsx so the nav-rail badge stayed
 * live regardless of section. That variant, and the `useAppState` hook it
 * was built on, were deleted in Task 10 once WidgetHostMount's keep-alive
 * (client/src/components/widget-host-mount.tsx) made hoisting unnecessary —
 * the badge is now fed by `host.ui.setBadge` instead (see app-shell.tsx).
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

export type UseChoresReturn = ReturnType<typeof useChoresApi>;
