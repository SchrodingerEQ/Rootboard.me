/**
 * Pure-logic tests for the on-screen keyboard.
 * Run with:  npx tsx client/src/lib/osk.test.ts
 */
import assert from "node:assert/strict";
import { isEditableTarget, shouldShowKeyboard } from "./osk.ts";

let passed = 0;
const check = (name: string, fn: () => void) => {
  fn();
  passed++;
  console.log(`  ok - ${name}`);
};

console.log("isEditableTarget");
check("text input is editable", () =>
  assert.ok(isEditableTarget({ tagName: "INPUT", type: "text" })),
);
check("default input (no type) is editable", () =>
  assert.ok(isEditableTarget({ tagName: "INPUT" })),
);
check("email/url/tel/search/password are editable", () => {
  for (const type of ["email", "url", "tel", "search", "password"]) {
    assert.ok(isEditableTarget({ tagName: "INPUT", type }), type);
  }
});
check("textarea is editable", () =>
  assert.ok(isEditableTarget({ tagName: "TEXTAREA" })),
);
check("date/datetime-local/time/number are NOT editable (native pickers)", () => {
  for (const type of ["date", "datetime-local", "time", "month", "week", "number"]) {
    assert.ok(!isEditableTarget({ tagName: "INPUT", type }), type);
  }
});
check("checkbox/radio/range are NOT editable", () => {
  for (const type of ["checkbox", "radio", "range", "color"]) {
    assert.ok(!isEditableTarget({ tagName: "INPUT", type }), type);
  }
});
check("disabled / readOnly fields are NOT editable", () => {
  assert.ok(!isEditableTarget({ tagName: "INPUT", type: "text", disabled: true }));
  assert.ok(!isEditableTarget({ tagName: "INPUT", type: "text", readOnly: true }));
});
check("non-form elements and null are NOT editable", () => {
  assert.ok(!isEditableTarget({ tagName: "DIV" }));
  assert.ok(!isEditableTarget({ tagName: "SELECT" }));
  assert.ok(!isEditableTarget(null));
});

console.log("shouldShowKeyboard");
check("no focused field → never show", () => {
  assert.ok(!shouldShowKeyboard("on", true, false));
  assert.ok(!shouldShowKeyboard("auto", true, false));
});
check("off → never show even with a field focused", () =>
  assert.ok(!shouldShowKeyboard("off", true, true)),
);
check("on → show whenever a field is focused, any pointer", () => {
  assert.ok(shouldShowKeyboard("on", false, true));
  assert.ok(shouldShowKeyboard("on", true, true));
});
check("auto → show only on a coarse (touch) pointer", () => {
  assert.ok(shouldShowKeyboard("auto", true, true)); // Pi touchscreen
  assert.ok(!shouldShowKeyboard("auto", false, true)); // Windows mouse
});

console.log(`\nAll ${passed} assertions passed.`);
