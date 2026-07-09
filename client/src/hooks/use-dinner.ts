import { useCallback, useEffect, useState } from "react";
import { useAppState } from "@/hooks/use-app-state";
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
  resetVotes,
  setDinner,
  vote,
} from "@/lib/dinner-state";

const STATE_KEY = "dinner";
const PURGE_CHECK_MS = 60_000;
const COOLDOWN_TICK_MS = 1_000;

/**
 * Owns DinnerState, built on the shared `useAppState` persistence hook
 * (client/src/hooks/use-app-state.ts). Lives inside DinnerPage (unlike
 * useChores, which is hoisted for the rail badge) — nothing outside the
 * Dinner section needs this state. Runs the weekly-rollover purge on load
 * and every 60s (the kiosk runs 24/7 and crosses week boundaries while
 * still mounted).
 *
 * `cooldownUntil` is intentionally NOT part of DinnerState — it's an
 * in-memory-only timestamp per the build plan, so it never persists and
 * never survives a reload (a fresh page load always starts vote-ready).
 */
export function useDinner() {
  const { state, setState, isLoaded } = useAppState<DinnerState>({
    key: STATE_KEY,
    emptyState: emptyDinnerState,
    normalize: normalizeDinnerState,
    transformOnLoad: (s) => purgeOldDinners(s, localDateKey()),
    pollTransformMs: PURGE_CHECK_MS,
  });

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
    setState((s) => resetVotes(s));
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

export type UseDinnerReturn = ReturnType<typeof useDinner>;
