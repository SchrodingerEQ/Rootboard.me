import { useCallback, useEffect, useState, type Dispatch, type SetStateAction } from "react";
import { useWidgetState } from "@/hooks/use-widget-state";
import type { WidgetHost } from "@/widgets/types";
import {
  type DinnerState,
  VOTE_COOLDOWN_MS,
  addCandidate,
  addSavedMeal,
  emptyDinnerState,
  localDateKey,
  normalizeDinnerState,
  purgeOldDinners,
  removeDinner,
  removeSavedMeal,
  resetVoting,
  setDinner,
  vote,
} from "@/lib/dinner-state";

const STATE_KEY = "dinner";
const PURGE_CHECK_MS = 60_000;
const COOLDOWN_TICK_MS = 1_000;

/** Shared `{state, setState, isLoaded}` -> `UseDinnerReturn` API, used by
 *  `useDinnerWithHost()` below (built on `useWidgetState`). Formerly also
 *  backed a legacy `useDinner()` variant (direct `useAppState`/`fetch`,
 *  pre-widget-host) — deleted in Task 10 once nothing referenced it anymore.
 *
 *  `cooldownUntil` is intentionally NOT part of DinnerState — it's an
 *  in-memory-only timestamp per the build plan, so it never persists and
 *  never survives a reload (a fresh page load always starts vote-ready).
 *  Owning it here (rather than inline in `useDinnerWithHost`) keeps that
 *  semantic in one place, including "not resettable by bouncing sections":
 *  the widget only unmounts if the host itself is disposed, not on a mere
 *  section switch (WidgetHostMount keeps it mounted-but-hidden). */
function useDinnerApi(state: DinnerState, setState: Dispatch<SetStateAction<DinnerState>>, isLoaded: boolean) {
  const [cooldownUntil, setCooldownUntil] = useState(0);
  const [now, setNow] = useState(() => Date.now());

  // 1s ticker while a cooldown is active, so the "You can vote again in Ns"
  // countdown updates. Self-clears once the cooldown has actually elapsed
  // (cooldownUntil itself doesn't reset to 0 on expiry — only vote()/
  // onResetVotes() change it — so the interval can't rely on a dep change
  // to know when to stop).
  useEffect(() => {
    if (cooldownUntil <= Date.now()) return;
    const id = setInterval(() => {
      setNow(Date.now());
      if (Date.now() >= cooldownUntil) clearInterval(id);
    }, COOLDOWN_TICK_MS);
    return () => clearInterval(id);
  }, [cooldownUntil]);

  const cooldownRemainingMs = Math.max(0, cooldownUntil - now);
  const cooldownActive = cooldownRemainingMs > 0;
  const cooldownSeconds = Math.ceil(cooldownRemainingMs / 1000);

  const onVote = useCallback(
    (candidateId: string) => {
      if (Date.now() < cooldownUntil) return;
      setState((s) => vote(s, candidateId));
      const until = Date.now() + VOTE_COOLDOWN_MS;
      setCooldownUntil(until);
      setNow(Date.now());
    },
    [cooldownUntil, setState],
  );

  const onResetVotes = useCallback(() => {
    setState((s) => resetVoting(s));
    setCooldownUntil(0);
  }, [setState]);

  const onAddCandidate = useCallback((title: string) => setState((s) => addCandidate(s, title)), [setState]);
  const onAddSavedMeal = useCallback((title: string) => setState((s) => addSavedMeal(s, title)), [setState]);
  const onRemoveSavedMeal = useCallback((title: string) => setState((s) => removeSavedMeal(s, title)), [setState]);
  const onSetDinner = useCallback(
    (dateKey: string, title: string) => setState((s) => setDinner(s, dateKey, title)),
    [setState],
  );
  const onRemoveDinner = useCallback((dateKey: string) => setState((s) => removeDinner(s, dateKey)), [setState]);

  return {
    state,
    savedMeals: state.savedMeals,
    candidates: state.candidates,
    dinners: state.dinners,
    isLoaded,
    cooldownActive,
    cooldownSeconds,
    onVote,
    onResetVotes,
    onAddCandidate,
    onAddSavedMeal,
    onRemoveSavedMeal,
    onSetDinner,
    onRemoveDinner,
  };
}

/**
 * Owns DinnerState for the Dinner widget, built on `useWidgetState` over a
 * widget host's public `storage` surface (client/src/widgets/dinner/index.tsx
 * is the only caller). Existing `app_state` data round-trips bit-for-bit
 * through the host's `dinner` legacy-key alias (see
 * client/src/lib/widget-host-services.ts). Runs the weekly-rollover purge on
 * load and every 60s (the kiosk runs 24/7 and crosses week boundaries while
 * still mounted).
 *
 * Formerly paired with a hoisted `useDinner()` (direct `useAppState`/`fetch`,
 * pre-widget-host) — deleted in Task 10 along with `useAppState` itself once
 * Dinner moved onto the contract in Task 6 and nothing referenced it anymore.
 */
export function useDinnerWithHost(host: WidgetHost) {
  const { state, setState, isLoaded } = useWidgetState<DinnerState>(host, {
    emptyState: emptyDinnerState,
    normalize: normalizeDinnerState,
    transformOnLoad: (s) => purgeOldDinners(s, localDateKey()),
    pollTransformMs: PURGE_CHECK_MS,
  });

  return useDinnerApi(state, setState, isLoaded);
}

export type UseDinnerReturn = ReturnType<typeof useDinnerApi>;
