/**
 * Pure state logic for the Dinner screen. No React, no fetch — every function
 * takes a DinnerState and returns a NEW DinnerState (or the same reference
 * when nothing should change, so callers can cheaply skip a persist/rerender).
 *
 * Persistence (client/src/hooks/use-dinner.ts) and UI (client/src/components/
 * dinner/**) build on top of this. See client/src/lib/dinner-state.test.ts
 * for the standalone assertion suite (run via tsx — no test runner
 * configured). Mirrors the conventions of client/src/lib/chores-state.ts.
 */

export interface DinnerCandidate {
  id: string;
  title: string;
  votes: number;
}

export interface DinnerState {
  savedMeals: string[];
  candidates: DinnerCandidate[];
  /** dateKey (local YYYY-MM-DD) -> meal title. */
  dinners: Record<string, string>;
}

export const MEAL_CAP = 40;
export const VOTE_COOLDOWN_MS = 30_000;
export const VOTE_SLOTS = 7;

let idCounter = 0;
function makeId(prefix: string): string {
  idCounter += 1;
  return `${prefix}_${Date.now().toString(36)}_${idCounter.toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

/** Local YYYY-MM-DD for a given Date (defaults to now). */
export function localDateKey(date: Date = new Date()): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/** Parses a "YYYY-MM-DD" key as a LOCAL date (not UTC — `new Date(key)`
 *  parses as UTC midnight and can land on the wrong local day). */
export function dateKeyToDate(key: string): Date {
  const [y, m, d] = key.split("-").map(Number);
  return new Date(y, (m ?? 1) - 1, d ?? 1);
}

/** Adds `days` (may be negative) to a date key, returning a new date key. */
export function addDaysToKey(key: string, days: number): string {
  const d = dateKeyToDate(key);
  d.setDate(d.getDate() + days);
  return localDateKey(d);
}

/** The Sunday date key of the week containing `dateKey`. */
export function startOfWeekKey(dateKey: string): string {
  const d = dateKeyToDate(dateKey);
  d.setDate(d.getDate() - d.getDay());
  return localDateKey(d);
}

export function emptyDinnerState(): DinnerState {
  return { savedMeals: [], candidates: [], dinners: {} };
}

/** Appends a saved meal. Blank (trimmed) titles are a no-op; the list is
 *  capped at MEAL_CAP; duplicates (case-insensitive) are silently ignored. */
export function addSavedMeal(state: DinnerState, title: string): DinnerState {
  const trimmed = title.trim();
  if (!trimmed) return state;
  if (state.savedMeals.length >= MEAL_CAP) return state;
  if (state.savedMeals.some((m) => m.toLowerCase() === trimmed.toLowerCase())) return state;
  return { ...state, savedMeals: [...state.savedMeals, trimmed] };
}

/** Removes an exact-match saved meal. No-op (same reference) if absent. */
export function removeSavedMeal(state: DinnerState, title: string): DinnerState {
  const savedMeals = state.savedMeals.filter((m) => m !== title);
  if (savedMeals.length === state.savedMeals.length) return state;
  return { ...state, savedMeals };
}

/** Adds a voting candidate. Blank (trimmed) titles are a no-op; capped at
 *  VOTE_SLOTS; duplicate titles (case-insensitive) are silently ignored. */
export function addCandidate(state: DinnerState, title: string): DinnerState {
  const trimmed = title.trim();
  if (!trimmed) return state;
  if (state.candidates.length >= VOTE_SLOTS) return state;
  if (state.candidates.some((c) => c.title.toLowerCase() === trimmed.toLowerCase())) return state;
  return { ...state, candidates: [...state.candidates, { id: makeId("candidate"), title: trimmed, votes: 0 }] };
}

/** Increments one candidate's vote count. Cooldown enforcement is a
 *  hook-level concern (cooldownUntil is in-memory, not part of DinnerState)
 *  — this function just applies the vote unconditionally. No-op (same
 *  reference) if candidateId doesn't match anything. */
export function vote(state: DinnerState, candidateId: string): DinnerState {
  let changed = false;
  const candidates = state.candidates.map((c) => {
    if (c.id !== candidateId) return c;
    changed = true;
    return { ...c, votes: c.votes + 1 };
  });
  return changed ? { ...state, candidates } : state;
}

/** Zeroes every candidate's vote count; the candidates themselves (the
 *  meals) stay. No-op (same reference) if every count is already 0. */
export function resetVotes(state: DinnerState): DinnerState {
  if (state.candidates.every((c) => c.votes === 0)) return state;
  return { ...state, candidates: state.candidates.map((c) => (c.votes === 0 ? c : { ...c, votes: 0 })) };
}

/** Sets/overwrites the dinner for a date key. Blank (trimmed) titles are a no-op. */
export function setDinner(state: DinnerState, dateKey: string, title: string): DinnerState {
  const trimmed = title.trim();
  if (!trimmed) return state;
  return { ...state, dinners: { ...state.dinners, [dateKey]: trimmed } };
}

/** Removes the dinner for a date key. No-op (same reference) if absent. */
export function removeDinner(state: DinnerState, dateKey: string): DinnerState {
  if (!(dateKey in state.dinners)) return state;
  const dinners = { ...state.dinners };
  delete dinners[dateKey];
  return { ...state, dinners };
}

/**
 * Drops dinner entries from before the current week's Sunday — "prior
 * week's data and anything older than the visible window" per the build
 * plan, so storage never grows unbounded as the kiosk runs 24/7. The
 * boundary is inclusive: the current week's Sunday itself is kept. Date
 * keys are zero-padded ISO (YYYY-MM-DD), so lexical and chronological order
 * agree — no date parsing needed for the comparison itself.
 */
export function purgeOldDinners(state: DinnerState, todayKey: string): DinnerState {
  const sundayKey = startOfWeekKey(todayKey);
  const entries = Object.entries(state.dinners);
  const kept = entries.filter(([k]) => k >= sundayKey);
  if (kept.length === entries.length) return state;
  return { ...state, dinners: Object.fromEntries(kept) };
}

/** Highest vote count among candidates (0 if none/empty). Feeds the
 *  "leading meal" crown: a candidate is leading when votes > 0 AND votes
 *  === this max — ties are all highlighted (mirrors the mockup, which does
 *  not break ties). */
export function maxVoteCount(candidates: DinnerCandidate[]): number {
  return candidates.reduce((max, c) => Math.max(max, c.votes), 0);
}

/**
 * Defensively coerces whatever came back from GET /api/state/dinner into a
 * well-formed DinnerState. Same rationale as normalizeChoresState in
 * chores-state.ts: the state key is a whole-JSON-blob store shared across
 * the app's lifetime, and a stale/legacy/malformed value must degrade to a
 * safe empty state rather than crash the load path.
 */
export function normalizeDinnerState(value: unknown): DinnerState {
  const raw = value && typeof value === "object" ? (value as Partial<DinnerState>) : {};
  const savedMeals = Array.isArray(raw.savedMeals)
    ? raw.savedMeals.filter((m): m is string => typeof m === "string" && m.trim().length > 0)
    : [];
  const candidates = Array.isArray(raw.candidates) ? raw.candidates.filter(isCandidateLike).map(normalizeCandidate) : [];
  const dinners = isPlainObject(raw.dinners) ? normalizeDinners(raw.dinners) : {};
  return { savedMeals, candidates, dinners };
}

function isCandidateLike(c: unknown): c is DinnerCandidate {
  return !!c && typeof c === "object" && typeof (c as DinnerCandidate).id === "string" && typeof (c as DinnerCandidate).title === "string";
}

function normalizeCandidate(c: DinnerCandidate): DinnerCandidate {
  return {
    id: c.id,
    title: c.title,
    votes: Number.isFinite(c.votes) && c.votes >= 0 ? c.votes : 0,
  };
}

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return !!v && typeof v === "object" && !Array.isArray(v);
}

function normalizeDinners(raw: Record<string, unknown>): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(raw)) {
    if (typeof v === "string" && v.trim().length > 0) out[k] = v;
  }
  return out;
}
