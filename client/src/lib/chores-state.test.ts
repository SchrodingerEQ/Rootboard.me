/**
 * Standalone test for the pure Chores state logic (no test runner configured
 * yet). Run with:  node node_modules/tsx/dist/cli.mjs client/src/lib/chores-state.test.ts
 *
 * Style mirrors date-range.test.ts: check() + node:assert/strict, no framework.
 */
import assert from "node:assert/strict";
import {
  PERSON_PALETTE,
  toggleChore,
  addChore,
  addPerson,
  removePerson,
  renamePerson,
  setPersonColor,
  resetChores,
  rolloverTallies,
  openChoreCount,
  doneTodayTotal,
  normalizeChoresState,
  type ChoresState,
} from "./chores-state.ts";

let passed = 0;
const check = (name: string, fn: () => void) => {
  fn();
  passed++;
  console.log(`  ok - ${name}`);
};

function emptyState(tallyDate = "2026-07-08"): ChoresState {
  return { people: [], tallyDate };
}

console.log("PERSON_PALETTE");
{
  check("has exactly 8 entries, each with color/tint/text", () => {
    assert.equal(PERSON_PALETTE.length, 8);
    for (const entry of PERSON_PALETTE) {
      assert.equal(typeof entry.color, "string");
      assert.equal(typeof entry.tint, "string");
      assert.equal(typeof entry.text, "string");
    }
  });
  check("first entry is the purple palette from the plan", () => {
    assert.deepEqual(PERSON_PALETTE[0], { color: "#9333ea", tint: "#f3e8fd", text: "#6b21a8" });
  });
}

console.log("addPerson");
{
  let s = emptyState();
  s = addPerson(s, "Mum");
  check("adds a person with colorIdx = people.length % 8 (0 for first)", () => {
    assert.equal(s.people.length, 1);
    assert.equal(s.people[0].colorIdx, 0);
    assert.equal(s.people[0].name, "Mum");
    assert.equal(s.people[0].doneToday, 0);
    assert.deepEqual(s.people[0].chores, []);
  });
  for (const name of ["Dad", "Emma", "Jack", "Five", "Six", "Seven", "Eight", "Ninth"]) {
    s = addPerson(s, name);
  }
  check("9th person wraps colorIdx back to 0 (people.length % 8)", () => {
    assert.equal(s.people.length, 9);
    assert.equal(s.people[8].colorIdx, 8 % 8);
  });
  check("blank name is a no-op", () => {
    const before = s;
    const after = addPerson(s, "   ");
    assert.equal(after, before);
  });
}

console.log("addChore");
{
  let s = addPerson(emptyState(), "Mum");
  const personId = s.people[0].id;
  s = addChore(s, personId, "Water the plants");
  check("appends an active chore", () => {
    assert.equal(s.people[0].chores.length, 1);
    assert.equal(s.people[0].chores[0].title, "Water the plants");
    assert.equal(s.people[0].chores[0].done, false);
  });
  check("blank title is a no-op", () => {
    const before = s;
    const after = addChore(s, personId, "  ");
    assert.equal(after, before);
  });
}

console.log("toggleChore — toggle both ways");
{
  let s = addPerson(emptyState(), "Mum");
  const personId = s.people[0].id;
  s = addChore(s, personId, "Fold laundry");
  const choreId = s.people[0].chores[0].id;

  s = toggleChore(s, personId, choreId);
  check("completing a chore sets done=true and doneToday += 1", () => {
    assert.equal(s.people[0].chores[0].done, true);
    assert.equal(s.people[0].doneToday, 1);
  });

  s = toggleChore(s, personId, choreId);
  check("un-completing slides it back: done=false and doneToday -= 1", () => {
    assert.equal(s.people[0].chores[0].done, false);
    assert.equal(s.people[0].doneToday, 0);
  });
}

console.log("toggleChore — tally floor at 0");
{
  let s = addPerson(emptyState(), "Mum");
  const personId = s.people[0].id;
  s = addChore(s, personId, "Fold laundry");
  const choreId = s.people[0].chores[0].id;
  // Force an already-done chore un-done twice shouldn't go negative; simulate
  // by toggling done->not done from a doneToday=0 baseline (shouldn't happen
  // in practice, but the floor must hold regardless).
  s = toggleChore(s, personId, choreId); // done, doneToday=1
  s = toggleChore(s, personId, choreId); // not done, doneToday=0
  check("doneToday never goes below 0 after an extra un-complete", () => {
    // chore is already not-done; toggling flips it to done again (can't
    // "un-complete" an active chore), so directly exercise the floor via a
    // hand-built state with doneToday already at 0 and a done chore toggled off.
    const rigged: ChoresState = {
      people: [{ id: personId, name: "Mum", colorIdx: 0, doneToday: 0, chores: [{ id: choreId, title: "x", done: true }] }],
      tallyDate: s.tallyDate,
    };
    const after = toggleChore(rigged, personId, choreId);
    assert.equal(after.people[0].doneToday, 0);
    assert.equal(after.people[0].chores[0].done, false);
  });
}

console.log("resetChores");
{
  let s = addPerson(emptyState(), "Mum");
  const personId = s.people[0].id;
  s = addChore(s, personId, "Fold laundry");
  s = addChore(s, personId, "Water plants");
  const choreId = s.people[0].chores[0].id;
  s = toggleChore(s, personId, choreId); // done, doneToday=1
  const tallyBefore = s.people[0].doneToday;
  s = resetChores(s);
  check("all chores become active again", () => {
    assert.ok(s.people[0].chores.every((c) => !c.done));
  });
  check("tally survives resetChores untouched", () => {
    assert.equal(s.people[0].doneToday, tallyBefore);
    assert.equal(s.people[0].doneToday, 1);
  });
}

console.log("rolloverTallies");
{
  let s = addPerson(emptyState("2026-07-07"), "Mum");
  s = addPerson(s, "Dad");
  const mumId = s.people[0].id;
  s = addChore(s, mumId, "Fold laundry");
  const choreId = s.people[0].chores[0].id;
  s = toggleChore(s, mumId, choreId); // Mum doneToday=1

  const rolledOnce = rolloverTallies(s, "2026-07-08");
  check("crossing to a new day zeroes every doneToday and updates tallyDate", () => {
    assert.equal(rolledOnce.tallyDate, "2026-07-08");
    assert.ok(rolledOnce.people.every((p) => p.doneToday === 0));
  });

  const rolledTwice = rolloverTallies(rolledOnce, "2026-07-08");
  check("calling again on the same day is a no-op (returns the same state)", () => {
    assert.equal(rolledTwice, rolledOnce);
  });

  check("calling on the ORIGINAL (pre-rollover) date is also a no-op", () => {
    const same = rolloverTallies(s, "2026-07-07");
    assert.equal(same, s);
  });
}

console.log("removePerson / renamePerson / setPersonColor");
{
  let s = addPerson(emptyState(), "Mum");
  s = addPerson(s, "Dad");
  const mumId = s.people[0].id;
  const dadId = s.people[1].id;

  s = renamePerson(s, mumId, "Mummy");
  check("renamePerson updates the name", () => {
    assert.equal(s.people[0].name, "Mummy");
  });
  check("renamePerson with a blank name is a no-op", () => {
    const before = s;
    const after = renamePerson(s, mumId, "   ");
    assert.equal(after, before);
  });

  s = setPersonColor(s, dadId, 5);
  check("setPersonColor updates colorIdx", () => {
    assert.equal(s.people[1].colorIdx, 5);
  });

  s = removePerson(s, mumId);
  check("removePerson drops that person only", () => {
    assert.equal(s.people.length, 1);
    assert.equal(s.people[0].id, dadId);
  });
}

console.log("selectors");
{
  let s = addPerson(emptyState(), "Mum");
  s = addPerson(s, "Dad");
  const mumId = s.people[0].id;
  const dadId = s.people[1].id;
  s = addChore(s, mumId, "Water plants");
  s = addChore(s, mumId, "Fold laundry");
  s = addChore(s, dadId, "Take out bins");
  check("openChoreCount counts active chores across all people", () => {
    assert.equal(openChoreCount(s), 3);
  });
  const c1 = s.people[0].chores[0].id;
  s = toggleChore(s, mumId, c1);
  check("openChoreCount drops after completing one", () => {
    assert.equal(openChoreCount(s), 2);
  });
  check("doneTodayTotal counts currently-completed chores across all people", () => {
    assert.equal(doneTodayTotal(s), 1);
  });
  s = resetChores(s);
  check("doneTodayTotal drops back to 0 after resetChores (live-done based), while per-person doneToday tally is untouched", () => {
    assert.equal(doneTodayTotal(s), 0);
    assert.equal(s.people[0].doneToday, 1);
  });
}

console.log("normalizeChoresState — defends the load path against stale/malformed blobs");
{
  // Regression: an unrelated legacy blob left in the app-state KV store
  // (e.g. `{ items: ["a", "b"] }` from an earlier scratch test) crashed
  // rolloverTallies() on load because it assumed `people` was always an
  // array. Reproduced live against the dev server before this guard existed.
  check("a completely unrelated shape degrades to an empty, valid board", () => {
    const s = normalizeChoresState({ items: ["a", "b"] });
    assert.deepEqual(s, { people: [], tallyDate: "" });
    // Must survive the exact call that crashed: rolloverTallies() maps over
    // people and reads tallyDate.
    const rolled = rolloverTallies(s, "2026-07-08");
    assert.equal(rolled.tallyDate, "2026-07-08");
    assert.deepEqual(rolled.people, []);
  });
  check("null/undefined/non-object input also degrades safely", () => {
    assert.deepEqual(normalizeChoresState(null), { people: [], tallyDate: "" });
    assert.deepEqual(normalizeChoresState(undefined), { people: [], tallyDate: "" });
    assert.deepEqual(normalizeChoresState("garbage"), { people: [], tallyDate: "" });
    assert.deepEqual(normalizeChoresState(42), { people: [], tallyDate: "" });
  });
  check("a well-formed state round-trips unchanged", () => {
    let s = addPerson(emptyState("2026-07-08"), "Mum");
    s = addChore(s, s.people[0].id, "Fold laundry");
    const normalized = normalizeChoresState(JSON.parse(JSON.stringify(s)));
    assert.deepEqual(normalized, s);
  });
  check("a person missing/malformed fields is coerced, not dropped or crashed on", () => {
    const s = normalizeChoresState({
      tallyDate: "2026-07-08",
      people: [
        { id: "p1", name: "Mum", colorIdx: 0, doneToday: -3, chores: [{ id: "c1", title: "x" }, { id: "c2" }, "junk"] },
        "not a person",
        { name: "no id" },
      ],
    });
    assert.equal(s.people.length, 1);
    assert.equal(s.people[0].doneToday, 0); // negative tally coerced to 0
    assert.equal(s.people[0].chores.length, 1); // entries missing a title are dropped
    assert.equal(s.people[0].chores[0].done, false);
  });
}

console.log(`\nAll ${passed} assertions passed.`);
