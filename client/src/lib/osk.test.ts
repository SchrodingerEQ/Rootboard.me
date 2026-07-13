/**
 * Pure-logic tests for the on-screen keyboard.
 * Run with:  npx tsx client/src/lib/osk.test.ts
 */
import assert from "node:assert/strict";
import {
  EMOJI_ROWS,
  LETTER_ROWS,
  SYMBOL_ROWS,
  deleteBackward,
  isEditableTarget,
  isInsideOsk,
  isTouchCapable,
  lastGraphemeLength,
  shouldShowKeyboard,
} from "./osk.ts";

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
check("auto → show only on a touch device", () => {
  assert.ok(shouldShowKeyboard("auto", true, true)); // Pi touchscreen
  assert.ok(!shouldShowKeyboard("auto", false, true)); // Windows mouse
});

console.log("isTouchCapable");
check("no signals → not touch (mouse-only desktop)", () =>
  assert.ok(!isTouchCapable({ anyPointerCoarse: false, maxTouchPoints: 0, hasTouchStart: false })),
);
check("empty env → not touch", () => assert.ok(!isTouchCapable({})));
check("any-pointer:coarse → touch", () =>
  assert.ok(isTouchCapable({ anyPointerCoarse: true, maxTouchPoints: 0, hasTouchStart: false })),
);
check("maxTouchPoints > 0 → touch", () =>
  assert.ok(isTouchCapable({ anyPointerCoarse: false, maxTouchPoints: 1, hasTouchStart: false })),
);
check("ontouchstart present → touch", () =>
  assert.ok(isTouchCapable({ anyPointerCoarse: false, maxTouchPoints: 0, hasTouchStart: true })),
);
check("Pi regression: primary pointer fine but touch available → touch", () => {
  // The exact kiosk case that broke auto mode: pointer:coarse was false, but
  // any-pointer:coarse / maxTouchPoints reveal the touchscreen.
  assert.ok(isTouchCapable({ anyPointerCoarse: true, maxTouchPoints: 10, hasTouchStart: true }));
});

console.log("isInsideOsk (touchscreen blur-guard)");
check("element inside the keyboard → true", () =>
  assert.ok(isInsideOsk({ closest: (sel: string) => (sel === '[data-osk="true"]' ? {} : null) })),
);
check("element outside the keyboard → false", () =>
  assert.ok(!isInsideOsk({ closest: () => null })),
);
check("null / body-like element without closest → false", () => {
  assert.ok(!isInsideOsk(null));
  assert.ok(!isInsideOsk(undefined));
  assert.ok(!isInsideOsk({}));
});
check("Pi regression: focus stolen by a key button must NOT clear the target", () => {
  // Firefox/Linux touch moves focus to the tapped key despite preventDefault.
  // The focus tracker keeps the field when the new activeElement is inside
  // the keyboard — this is what stopped the keyboard closing on every tap.
  const keyButton = { closest: (sel: string) => (sel === '[data-osk="true"]' ? {} : null) };
  const shouldClearTarget = !isEditableTarget(keyButton as any) && !isInsideOsk(keyButton);
  assert.equal(shouldClearTarget, false);
});

console.log("deleteBackward (emoji-safe backspace)");
check("plain ascii deletes one character", () =>
  assert.deepEqual(deleteBackward("abc", 3, 3), { value: "ab", caret: 2 }),
);
check("deleting mid-string works", () =>
  assert.deepEqual(deleteBackward("abc", 2, 2), { value: "ac", caret: 1 }),
);
check("at position 0 nothing happens", () =>
  assert.deepEqual(deleteBackward("abc", 0, 0), { value: "abc", caret: 0 }),
);
check("a selection deletes exactly the selection", () =>
  assert.deepEqual(deleteBackward("abcdef", 1, 4), { value: "aef", caret: 1 }),
);
check("an emoji (surrogate pair) is deleted whole — never split", () => {
  const s = "hi🎂"; // 🎂 is 2 UTF-16 units
  assert.deepEqual(deleteBackward(s, s.length, s.length), { value: "hi", caret: 2 });
});
check("a variation-selector emoji (❤️) is deleted whole", () => {
  const s = "a❤️";
  const r = deleteBackward(s, s.length, s.length);
  assert.equal(r.value, "a");
});
check("emoji followed by ascii still deletes just the ascii", () => {
  const s = "🎂x";
  assert.deepEqual(deleteBackward(s, s.length, s.length), { value: "🎂", caret: 2 });
});
check("lastGraphemeLength: empty string is 0, ascii is 1, emoji is 2+", () => {
  assert.equal(lastGraphemeLength(""), 0);
  assert.equal(lastGraphemeLength("a"), 1);
  assert.ok(lastGraphemeLength("🎂") >= 2);
});

console.log("keyboard layouts");
check("every layer's layer-switch keys point at a real layer", () => {
  for (const rows of [LETTER_ROWS, SYMBOL_ROWS, EMOJI_ROWS]) {
    for (const key of rows.flat()) {
      if (key.type === "ctrl" && key.action === "layer") {
        assert.ok(["letters", "symbols", "emoji"].includes(key.layer));
      }
    }
  }
});
check("letters layer has a route to the emoji layer and back", () => {
  const toEmoji = LETTER_ROWS.flat().some((k) => k.type === "ctrl" && k.action === "layer" && k.layer === "emoji");
  const backToLetters = EMOJI_ROWS.flat().some((k) => k.type === "ctrl" && k.action === "layer" && k.layer === "letters");
  assert.ok(toEmoji && backToLetters);
});
check("emoji keys are plain char keys (typed like any character)", () => {
  const chars = EMOJI_ROWS.flat().filter((k) => k.type === "char");
  assert.ok(chars.length >= 20);
  for (const k of chars) {
    // Some emoji (⭐, ☕) are single UTF-16 units; all must be non-ascii.
    assert.ok(k.type === "char" && k.value.length >= 1 && k.value.charCodeAt(0) > 0x7f, `${"label" in k ? k.label : "?"} should be an emoji`);
  }
});
check("emoji set avoids ZWJ sequences (kiosk font compatibility)", () => {
  for (const k of EMOJI_ROWS.flat()) {
    if (k.type === "char") assert.ok(!k.value.includes("‍"), k.value);
  }
});

console.log(`\nAll ${passed} assertions passed.`);
