/**
 * Standalone test for SQLiteStorage's app_state key-value store.
 * Run with:  node node_modules/tsx/dist/cli.mjs server/app-state.test.ts
 *
 * Covers the whole-blob persistence layer that backs the Chores and Dinner
 * screens: get/set round-tripping, upsert-on-conflict, and key independence.
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { SQLiteStorage } from "./sqlite-storage.ts";

let passed = 0;
const check = (name: string, fn: () => void | Promise<void>) => {
  return Promise.resolve(fn()).then(() => {
    passed++;
    console.log(`  ok - ${name}`);
  });
};

const dbPath = path.join(os.tmpdir(), `app-state-test-${Date.now()}-${Math.random().toString(36).slice(2)}.db`);
const store = new SQLiteStorage(dbPath);

const cleanup = () => {
  store.close();
  for (const suffix of ["", "-wal", "-shm"]) {
    const p = dbPath + suffix;
    if (fs.existsSync(p)) fs.rmSync(p);
  }
};

async function main() {
  console.log("getAppState / setAppState");

  await check("get of an unset key returns null", async () => {
    assert.equal(await store.getAppState("chores"), null);
  });

  await check("set then get round-trips the string", async () => {
    await store.setAppState("chores", JSON.stringify({ items: ["dishes"] }));
    assert.equal(await store.getAppState("chores"), JSON.stringify({ items: ["dishes"] }));
  });

  await check("second set overwrites (upsert, not a duplicate-key error)", async () => {
    await store.setAppState("chores", JSON.stringify({ items: ["dishes", "trash"] }));
    assert.equal(await store.getAppState("chores"), JSON.stringify({ items: ["dishes", "trash"] }));
  });

  await check("keys are independent (chores vs dinner)", async () => {
    await store.setAppState("dinner", JSON.stringify({ plan: "tacos" }));
    assert.equal(await store.getAppState("chores"), JSON.stringify({ items: ["dishes", "trash"] }));
    assert.equal(await store.getAppState("dinner"), JSON.stringify({ plan: "tacos" }));
  });
}

main()
  .then(() => {
    cleanup();
    console.log(`\nAll ${passed} assertions passed.`);
  })
  .catch((err) => {
    cleanup();
    console.error(err);
    process.exit(1);
  });
