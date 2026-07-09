/**
 * Pure state logic for the Chores screen. No React, no fetch — every function
 * takes a ChoresState and returns a NEW ChoresState (or the same reference
 * when nothing should change, so callers can cheaply skip a persist/rerender).
 *
 * Persistence (client/src/hooks/use-chores.ts) and UI (client/src/components/
 * chores/**) build on top of this. See client/src/lib/chores-state.test.ts for
 * the standalone assertion suite (run via tsx — no test runner configured).
 */

export interface Chore {
  id: string;
  title: string;
  done: boolean;
}

export interface Person {
  id: string;
  name: string;
  colorIdx: number;
  /** Completed-today tally. Increments on complete, decrements (floor 0) on
   *  un-complete. Survives clearPersonChores(); zeroed by rolloverTallies()
   *  at local midnight. */
  doneToday: number;
  chores: Chore[];
}

export interface ChoresState {
  people: Person[];
  /** Local YYYY-MM-DD the tallies were last zeroed for. */
  tallyDate: string;
}

export interface PersonPaletteEntry {
  /** Saturated — avatar/check-button/badge background. */
  color: string;
  /** Soft wash — column background. */
  tint: string;
  /** Dark ink — column header text on the tint. */
  text: string;
}

// 8 fixed palettes, in the order specified by CHORES_DINNER_BUILD_PLAN.md.
// New people default to colorIdx = people.length % PERSON_PALETTE.length.
export const PERSON_PALETTE: PersonPaletteEntry[] = [
  { color: "#9333ea", tint: "#f3e8fd", text: "#6b21a8" }, // purple
  { color: "#16a34a", tint: "#e3f5ea", text: "#15803d" }, // green
  { color: "#ea8c00", tint: "#fdf0db", text: "#b45309" }, // orange
  { color: "#2563eb", tint: "#e8effd", text: "#1e40af" }, // blue
  { color: "#e11d48", tint: "#fce4ea", text: "#be123c" }, // red
  { color: "#0d9488", tint: "#ddf2ef", text: "#0f766e" }, // teal
  { color: "#db2777", tint: "#fbe6f0", text: "#be185d" }, // pink
  { color: "#607d8b", tint: "#e8eef1", text: "#46606c" }, // slate
];

/** Max chores per person (done + active). Mirrors the Dinner screen's
 *  MEAL_CAP pattern: keeps columns scrollable-but-sane and the persisted
 *  blob bounded. addChore() is a no-op at the cap; the column's add button
 *  shows a "40 chores max" hint instead. */
export const CHORE_CAP = 40;

/** Family's tuned reorder-animation duration (ms). Named per the build plan. */
export const REORDER_MS = 850;
export const REORDER_EASING = "cubic-bezier(.22,1,.36,1)";

// Chore-card geometry, shared by the stack layout math and the card itself.
export const CARD_HEIGHT_PX = 84;
export const CARD_GAP_PX = 12;

let idCounter = 0;
function makeId(prefix: string): string {
  idCounter += 1;
  return `${prefix}_${Date.now().toString(36)}_${idCounter.toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

/** Local YYYY-MM-DD for a given Date (defaults to now). Used both by the
 *  persistence hook and available here so callers don't hand-roll it. */
export function localDateKey(date: Date = new Date()): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/**
 * Defensively coerces whatever came back from GET /api/state/chores into a
 * well-formed ChoresState. The state key is a whole-JSON-blob store shared
 * across the app's lifetime — earlier scratch/test data (or a future schema
 * change) can leave a value on disk that doesn't match this shape, and
 * every other function here assumes `people` is an array to .map()/.filter()
 * over. Unknown/malformed input degrades to an empty board rather than
 * throwing (which would otherwise crash the load path — see
 * client/src/hooks/use-chores.ts).
 */
export function normalizeChoresState(value: unknown): ChoresState {
  const raw = value && typeof value === "object" ? (value as Partial<ChoresState>) : {};
  const people = Array.isArray(raw.people) ? raw.people.filter(isPersonLike).map(normalizePerson) : [];
  const tallyDate = typeof raw.tallyDate === "string" ? raw.tallyDate : "";
  return { people, tallyDate };
}

function isPersonLike(p: unknown): p is Person {
  return !!p && typeof p === "object" && typeof (p as Person).id === "string";
}

/** Clamps to a valid PERSON_PALETTE index: must be an integer in [0, 7],
 *  else falls back to 0. (A raw `Number.isFinite` check let -1 or 3.5
 *  through, and PERSON_PALETTE[-1 % 8] is undefined — white-screens the
 *  Chores section, the exact failure class normalize exists to prevent.) */
function normalizeColorIdx(colorIdx: unknown): number {
  return Number.isInteger(colorIdx) && (colorIdx as number) >= 0 && (colorIdx as number) <= 7 ? (colorIdx as number) : 0;
}

/** Floors to a non-negative integer; anything else (negative, fractional,
 *  non-numeric) falls back to 0. */
function normalizeDoneToday(doneToday: unknown): number {
  return Number.isInteger(doneToday) && (doneToday as number) >= 0 ? (doneToday as number) : 0;
}

function normalizePerson(p: Person): Person {
  return {
    id: p.id,
    name: typeof p.name === "string" ? p.name : "",
    colorIdx: normalizeColorIdx(p.colorIdx),
    doneToday: normalizeDoneToday(p.doneToday),
    chores: Array.isArray(p.chores) ? p.chores.filter(isChoreLike).map((c) => ({ id: c.id, title: c.title, done: !!c.done })) : [],
  };
}

function isChoreLike(c: unknown): c is Chore {
  return !!c && typeof c === "object" && typeof (c as Chore).id === "string" && typeof (c as Chore).title === "string";
}

function mapPerson(state: ChoresState, personId: string, fn: (p: Person) => Person): ChoresState {
  let changed = false;
  const people = state.people.map((p) => {
    if (p.id !== personId) return p;
    changed = true;
    return fn(p);
  });
  return changed ? { ...state, people } : state;
}

/** Flips a chore's done state. doneToday +1 on complete, -1 (floored at 0)
 *  on un-complete. */
export function toggleChore(state: ChoresState, personId: string, choreId: string): ChoresState {
  return mapPerson(state, personId, (p) => {
    let nowDone = false;
    let found = false;
    const chores = p.chores.map((c) => {
      if (c.id !== choreId) return c;
      found = true;
      nowDone = !c.done;
      return { ...c, done: nowDone };
    });
    if (!found) return p;
    return {
      ...p,
      chores,
      doneToday: Math.max(0, p.doneToday + (nowDone ? 1 : -1)),
    };
  });
}

/** Appends a new active chore. Blank (trimmed) titles and a list already at
 *  CHORE_CAP are no-ops (same reference). */
export function addChore(state: ChoresState, personId: string, title: string): ChoresState {
  const trimmed = title.trim();
  if (!trimmed) return state;
  const person = state.people.find((p) => p.id === personId);
  if (person && person.chores.length >= CHORE_CAP) return state;
  return mapPerson(state, personId, (p) => ({
    ...p,
    chores: [...p.chores, { id: makeId("chore"), title: trimmed, done: false }],
  }));
}

/** Adds a person with colorIdx = people.length % PERSON_PALETTE.length.
 *  Blank (trimmed) names are a no-op. */
export function addPerson(state: ChoresState, name: string): ChoresState {
  const trimmed = name.trim();
  if (!trimmed) return state;
  const person: Person = {
    id: makeId("person"),
    name: trimmed,
    colorIdx: state.people.length % PERSON_PALETTE.length,
    doneToday: 0,
    chores: [],
  };
  return { ...state, people: [...state.people, person] };
}

export function removePerson(state: ChoresState, personId: string): ChoresState {
  const people = state.people.filter((p) => p.id !== personId);
  if (people.length === state.people.length) return state;
  return { ...state, people };
}

/** Blank (trimmed) names are a no-op (mirrors the mockup's saveName guard). */
export function renamePerson(state: ChoresState, personId: string, name: string): ChoresState {
  const trimmed = name.trim();
  if (!trimmed) return state;
  return mapPerson(state, personId, (p) => ({ ...p, name: trimmed }));
}

export function setPersonColor(state: ChoresState, personId: string, colorIdx: number): ChoresState {
  return mapPerson(state, personId, (p) => ({ ...p, colorIdx }));
}

/** Removes every chore (done and active) from ONE person's list — the header
 *  "Reset chores" flow asks which person, then clears their whole list.
 *  doneToday is untouched (they keep credit for what they finished today).
 *  No-op (same reference) for an unknown person or an already-empty list. */
export function clearPersonChores(state: ChoresState, personId: string): ChoresState {
  const person = state.people.find((p) => p.id === personId);
  if (!person || person.chores.length === 0) return state;
  return mapPerson(state, personId, (p) => ({ ...p, chores: [] }));
}

/** Zeroes every person's doneToday tally and stamps tallyDate when the local
 *  day has rolled over. No-op (returns the SAME reference) when today already
 *  matches state.tallyDate, so callers can skip a rerender/persist. */
export function rolloverTallies(state: ChoresState, today: string): ChoresState {
  if (state.tallyDate === today) return state;
  return {
    ...state,
    tallyDate: today,
    people: state.people.map((p) => (p.doneToday === 0 ? p : { ...p, doneToday: 0 })),
  };
}

/** Count of chores not yet done, across every person. Feeds the rail badge. */
export function openChoreCount(state: ChoresState): number {
  return state.people.reduce((sum, p) => sum + p.chores.filter((c) => !c.done).length, 0);
}

/** Count of chores CURRENTLY marked done, across every person — the header
 *  "N of M done today" chip's numerator. Deliberately reads live chore.done
 *  state (not the persistent per-person doneToday tally): the mockup's
 *  progressLabel drops to 0 immediately after Reset chores, while each
 *  column's "N today" pill (Person.doneToday) keeps counting through resets. */
export function doneTodayTotal(state: ChoresState): number {
  return state.people.reduce((sum, p) => sum + p.chores.filter((c) => c.done).length, 0);
}

/** Total chore count across every person — the header chip's denominator. */
export function totalChoreCount(state: ChoresState): number {
  return state.people.reduce((sum, p) => sum + p.chores.length, 0);
}
