// Core logic for the in-app on-screen (touch) keyboard.
//
// Split into PURE helpers (eligibility, visibility, layouts — unit-tested) and
// DOM mutation helpers (writing into the focused field) which are verified in
// the browser since they need a real DOM.

export type OskMode = "auto" | "on" | "off";

// Input types we pop the keyboard for. Deliberately excludes date/datetime-local/
// time/month/week/number (native touch pickers/spinners), and non-text controls.
export const EDITABLE_INPUT_TYPES = new Set([
  "text",
  "search",
  "email",
  "url",
  "tel",
  "password",
]);

/**
 * Is this element a text field the on-screen keyboard should type into?
 * Duck-typed (reads tagName/type/disabled/readOnly) so it works on both real
 * DOM elements and plain objects in tests.
 */
export function isEditableTarget(
  el: { tagName?: string; type?: string; disabled?: boolean; readOnly?: boolean } | null | undefined,
): boolean {
  if (!el || typeof el !== "object") return false;
  if (el.disabled || el.readOnly) return false;
  const tag = (el.tagName || "").toUpperCase();
  if (tag === "TEXTAREA") return true;
  if (tag === "INPUT") {
    const type = (el.type || "text").toLowerCase();
    return EDITABLE_INPUT_TYPES.has(type);
  }
  return false;
}

/**
 * Should the keyboard be visible, given the user's mode preference, whether the
 * device has a coarse (touch) pointer, and whether a text field is focused?
 *  - off  → never
 *  - on   → whenever a field is focused
 *  - auto → only on touch devices (so it stays hidden on a dev box with a mouse)
 */
export function shouldShowKeyboard(
  mode: OskMode,
  isCoarsePointer: boolean,
  hasEditableTarget: boolean,
): boolean {
  if (!hasEditableTarget) return false;
  if (mode === "off") return false;
  if (mode === "on") return true;
  return isCoarsePointer; // auto
}

// A keyboard key is either a literal character to type, or a named control.
export type KeyDef =
  | { type: "char"; label: string; value: string }
  | { type: "ctrl"; label: string; action: "shift" | "backspace" | "space" | "layer" | "done"; flex?: number };

const ch = (value: string, label = value): KeyDef => ({ type: "char", label, value });

export const LETTER_ROWS: KeyDef[][] = [
  ["q", "w", "e", "r", "t", "y", "u", "i", "o", "p"].map((c) => ch(c)),
  ["a", "s", "d", "f", "g", "h", "j", "k", "l"].map((c) => ch(c)),
  [
    { type: "ctrl", label: "⇧", action: "shift", flex: 1.5 },
    ...["z", "x", "c", "v", "b", "n", "m"].map((c) => ch(c)),
    { type: "ctrl", label: "⌫", action: "backspace", flex: 1.5 },
  ],
  [
    { type: "ctrl", label: "123", action: "layer", flex: 1.5 },
    ch("@"),
    { type: "ctrl", label: "space", action: "space", flex: 5 },
    ch("."),
    { type: "ctrl", label: "Done", action: "done", flex: 1.5 },
  ],
];

export const SYMBOL_ROWS: KeyDef[][] = [
  ["1", "2", "3", "4", "5", "6", "7", "8", "9", "0"].map((c) => ch(c)),
  ["@", "#", "$", "_", "&", "-", "+", "(", ")", "/"].map((c) => ch(c)),
  [
    ch(":"),
    ch(";"),
    ch("'"),
    ch('"'),
    ch(","),
    ch("?"),
    ch("!"),
    { type: "ctrl", label: "⌫", action: "backspace", flex: 1.5 },
  ],
  [
    { type: "ctrl", label: "ABC", action: "layer", flex: 1.5 },
    { type: "ctrl", label: "space", action: "space", flex: 6 },
    ch("."),
    { type: "ctrl", label: "Done", action: "done", flex: 1.5 },
  ],
];

// --- DOM mutation helpers (browser-only) ---------------------------------

function nativeSetter(el: HTMLInputElement | HTMLTextAreaElement): ((v: string) => void) | null {
  const proto = el instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
  const desc = Object.getOwnPropertyDescriptor(proto, "value");
  return desc?.set ? desc.set.bind(el) : null;
}

/**
 * Set the input's value via React's bypassed native setter and dispatch a
 * bubbling `input` event so a controlled component's onChange fires.
 */
function setValue(el: HTMLInputElement | HTMLTextAreaElement, value: string) {
  const setter = nativeSetter(el);
  if (setter) setter(value);
  else el.value = value;
  el.dispatchEvent(new Event("input", { bubbles: true }));
}

// selectionStart/End throw on some input types (email/number). Guard everything.
function getSelection(el: HTMLInputElement | HTMLTextAreaElement): [number, number] {
  try {
    const s = el.selectionStart;
    const e = el.selectionEnd;
    if (s == null || e == null) return [el.value.length, el.value.length];
    return [s, e];
  } catch {
    return [el.value.length, el.value.length];
  }
}

function setCaret(el: HTMLInputElement | HTMLTextAreaElement, pos: number) {
  try {
    el.setSelectionRange(pos, pos);
  } catch {
    /* selection unsupported on this input type — ignore */
  }
}

export function insertText(el: HTMLInputElement | HTMLTextAreaElement, text: string) {
  const [start, end] = getSelection(el);
  const next = el.value.slice(0, start) + text + el.value.slice(end);
  setValue(el, next);
  setCaret(el, start + text.length);
}

export function backspace(el: HTMLInputElement | HTMLTextAreaElement) {
  const [start, end] = getSelection(el);
  if (start === end) {
    if (start === 0) return;
    const next = el.value.slice(0, start - 1) + el.value.slice(end);
    setValue(el, next);
    setCaret(el, start - 1);
  } else {
    const next = el.value.slice(0, start) + el.value.slice(end);
    setValue(el, next);
    setCaret(el, start);
  }
}
