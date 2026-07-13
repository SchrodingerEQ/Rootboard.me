/**
 * Standalone test for the pure Dinner state logic (no test runner configured
 * yet). Run with:  node node_modules/tsx/dist/cli.mjs client/src/lib/dinner-state.test.ts
 *
 * Style mirrors chores-state.test.ts: check() + node:assert/strict, no framework.
 */
import assert from "node:assert/strict";
import {
  MEAL_CAP,
  VOTE_SLOTS,
  addSavedMeal,
  removeSavedMeal,
  addCandidate,
  vote,
  resetVoting,
  setDinner,
  removeDinner,
  purgeOldDinners,
  maxVoteCount,
  normalizeDinnerState,
  emptyDinnerState,
  type DinnerState,
} from "./dinner-state.ts";

let passed = 0;
const check = (name: string, fn: () => void) => {
  fn();
  passed++;
  console.log(`  ok - ${name}`);
};

console.log("addSavedMeal");
{
  let s = emptyDinnerState();
  s = addSavedMeal(s, "Taco night");
  check("appends a trimmed meal", () => {
    assert.deepEqual(s.savedMeals, ["Taco night"]);
  });
  s = addSavedMeal(s, "  Pizza  ");
  check("trims whitespace", () => {
    assert.equal(s.savedMeals[1], "Pizza");
  });
  check("blank (trimmed) title is a no-op", () => {
    const before = s;
    const after = addSavedMeal(s, "   ");
    assert.equal(after, before);
  });
  check("duplicate is ignored case-insensitively", () => {
    const before = s;
    const after = addSavedMeal(s, "TACO NIGHT");
    assert.equal(after, before);
    assert.equal(after.savedMeals.length, 2);
  });
  check("cap at 40 — the 41st add is a no-op", () => {
    let full = emptyDinnerState();
    for (let i = 0; i < MEAL_CAP; i++) full = addSavedMeal(full, `Meal ${i}`);
    assert.equal(full.savedMeals.length, MEAL_CAP);
    const after = addSavedMeal(full, "One too many");
    assert.equal(after, full);
    assert.equal(after.savedMeals.length, MEAL_CAP);
  });
}

console.log("removeSavedMeal");
{
  let s = addSavedMeal(addSavedMeal(emptyDinnerState(), "Taco night"), "Pizza");
  s = removeSavedMeal(s, "Taco night");
  check("removes the exact match", () => {
    assert.deepEqual(s.savedMeals, ["Pizza"]);
  });
  check("removing something absent is a no-op (same reference)", () => {
    const before = s;
    const after = removeSavedMeal(s, "Nope");
    assert.equal(after, before);
  });
}

console.log("addCandidate");
{
  let s = emptyDinnerState();
  s = addCandidate(s, "Homemade pizza");
  check("appends a candidate with 0 votes and an id", () => {
    assert.equal(s.candidates.length, 1);
    assert.equal(s.candidates[0].title, "Homemade pizza");
    assert.equal(s.candidates[0].votes, 0);
    assert.equal(typeof s.candidates[0].id, "string");
  });
  check("blank (trimmed) title is a no-op", () => {
    const before = s;
    const after = addCandidate(s, "   ");
    assert.equal(after, before);
  });
  check("duplicate candidate title is ignored case-insensitively", () => {
    const before = s;
    const after = addCandidate(s, "HOMEMADE PIZZA");
    assert.equal(after, before);
    assert.equal(after.candidates.length, 1);
  });
  check(`cap at ${VOTE_SLOTS} slots — the next add is a no-op`, () => {
    let full = emptyDinnerState();
    for (let i = 0; i < VOTE_SLOTS; i++) full = addCandidate(full, `Meal ${i}`);
    assert.equal(full.candidates.length, VOTE_SLOTS);
    const after = addCandidate(full, "One too many");
    assert.equal(after, full);
    assert.equal(after.candidates.length, VOTE_SLOTS);
  });
}

console.log("vote / resetVoting");
{
  let s = addCandidate(addCandidate(emptyDinnerState(), "Pizza"), "Burgers");
  const pizzaId = s.candidates[0].id;
  const burgersId = s.candidates[1].id;

  s = vote(s, pizzaId);
  s = vote(s, pizzaId);
  s = vote(s, burgersId);
  check("vote increments only the targeted candidate", () => {
    assert.equal(s.candidates.find((c) => c.id === pizzaId)!.votes, 2);
    assert.equal(s.candidates.find((c) => c.id === burgersId)!.votes, 1);
  });
  check("voting for an unknown id is a no-op (same reference)", () => {
    const before = s;
    const after = vote(s, "nope");
    assert.equal(after, before);
  });
  check("maxVoteCount returns the highest vote count", () => {
    assert.equal(maxVoteCount(s.candidates), 2);
  });
  check("maxVoteCount is 0 for an empty candidate list", () => {
    assert.equal(maxVoteCount([]), 0);
  });

  const savedBefore = s.savedMeals;
  s = resetVoting(s);
  check("resetVoting clears every candidate (options AND votes) so new options can be added", () => {
    assert.equal(s.candidates.length, 0);
    assert.equal(s.savedMeals, savedBefore);
  });
  check("resetVoting on an empty board is a no-op (same reference)", () => {
    const before = s;
    const after = resetVoting(s);
    assert.equal(after, before);
  });
  check("after resetVoting the board accepts new candidates again", () => {
    const refilled = addCandidate(s, "Stir fry");
    assert.equal(refilled.candidates.length, 1);
    assert.equal(refilled.candidates[0].votes, 0);
  });
}

console.log("setDinner / removeDinner");
{
  let s = emptyDinnerState();
  s = setDinner(s, "2026-07-08", "Taco night");
  check("sets the dinner for a date key", () => {
    assert.equal(s.dinners["2026-07-08"], "Taco night");
  });
  check("blank (trimmed) title is a no-op", () => {
    const before = s;
    const after = setDinner(s, "2026-07-09", "   ");
    assert.equal(after, before);
  });
  s = setDinner(s, "2026-07-08", "Stir fry");
  check("setting again overwrites the same date key", () => {
    assert.equal(s.dinners["2026-07-08"], "Stir fry");
    assert.equal(Object.keys(s.dinners).length, 1);
  });
  s = removeDinner(s, "2026-07-08");
  check("removeDinner clears the entry", () => {
    assert.equal("2026-07-08" in s.dinners, false);
  });
  check("removing an absent date key is a no-op (same reference)", () => {
    const before = s;
    const after = removeDinner(s, "2026-07-08");
    assert.equal(after, before);
  });
}

console.log("purgeOldDinners — drops the prior week, keeps the current week's Sunday onward");
{
  // 2026-07-08 is a Wednesday; the current week's Sunday is 2026-07-05.
  const todayKey = "2026-07-08";
  let s: DinnerState = {
    savedMeals: [],
    candidates: [],
    dinners: {
      "2026-06-27": "Ancient leftovers", // well before the window
      "2026-07-04": "Prior Saturday", // last day of the PRIOR week — must be dropped
      "2026-07-05": "Current Sunday", // first day of THIS week — must be kept
      "2026-07-08": "Today", // must be kept
      "2026-07-13": "Next week Monday", // must be kept
    },
  };
  const purged = purgeOldDinners(s, todayKey);
  check("prior Saturday (and anything older) is dropped", () => {
    assert.equal("2026-06-27" in purged.dinners, false);
    assert.equal("2026-07-04" in purged.dinners, false);
  });
  check("the current week's Sunday is kept (boundary is inclusive)", () => {
    assert.equal(purged.dinners["2026-07-05"], "Current Sunday");
  });
  check("today and next week are kept", () => {
    assert.equal(purged.dinners["2026-07-08"], "Today");
    assert.equal(purged.dinners["2026-07-13"], "Next week Monday");
  });
  check("nothing dropped is a no-op (same reference)", () => {
    const clean: DinnerState = { savedMeals: [], candidates: [], dinners: { "2026-07-08": "Today" } };
    const before = clean;
    const after = purgeOldDinners(clean, todayKey);
    assert.equal(after, before);
  });
}

console.log("normalizeDinnerState — defends the load path against stale/malformed blobs");
{
  check("a completely unrelated shape degrades to an empty, valid state", () => {
    const s = normalizeDinnerState({ items: ["a", "b"] });
    assert.deepEqual(s, emptyDinnerState());
  });
  check("null/undefined/non-object input also degrades safely", () => {
    assert.deepEqual(normalizeDinnerState(null), emptyDinnerState());
    assert.deepEqual(normalizeDinnerState(undefined), emptyDinnerState());
    assert.deepEqual(normalizeDinnerState("garbage"), emptyDinnerState());
    assert.deepEqual(normalizeDinnerState(42), emptyDinnerState());
  });
  check("a well-formed state round-trips unchanged", () => {
    let s = addSavedMeal(emptyDinnerState(), "Taco night");
    s = addCandidate(s, "Pizza");
    s = setDinner(s, "2026-07-08", "Stir fry");
    const normalized = normalizeDinnerState(JSON.parse(JSON.stringify(s)));
    assert.deepEqual(normalized, s);
  });
  check("malformed savedMeals entries (non-strings, blanks) are dropped, not crashed on", () => {
    const s = normalizeDinnerState({ savedMeals: ["Pizza", 42, null, "   ", "Tacos"], candidates: [], dinners: {} });
    assert.deepEqual(s.savedMeals, ["Pizza", "Tacos"]);
  });
  check("malformed candidate entries are coerced/dropped, not crashed on", () => {
    const s = normalizeDinnerState({
      savedMeals: [],
      candidates: [
        { id: "c1", title: "Pizza", votes: -5 },
        { id: "c2", title: "Burgers" },
        { title: "no id" },
        "junk",
      ],
      dinners: {},
    });
    assert.equal(s.candidates.length, 2);
    assert.equal(s.candidates[0].votes, 0); // negative votes coerced to 0
    assert.equal(s.candidates[1].votes, 0); // missing votes coerced to 0
  });
  check("malformed dinners map entries (non-string values) are dropped, not crashed on", () => {
    const s = normalizeDinnerState({
      savedMeals: [],
      candidates: [],
      dinners: { "2026-07-08": "Tacos", "2026-07-09": 42, "2026-07-10": "" },
    });
    assert.deepEqual(s.dinners, { "2026-07-08": "Tacos" });
  });
  check("a non-object dinners value degrades to an empty map, not a crash", () => {
    const s = normalizeDinnerState({ savedMeals: [], candidates: [], dinners: ["not", "a", "map"] });
    assert.deepEqual(s.dinners, {});
  });
}

console.log(`\nAll ${passed} assertions passed.`);
