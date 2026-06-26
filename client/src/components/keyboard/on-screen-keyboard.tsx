import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import {
  LETTER_ROWS,
  SYMBOL_ROWS,
  backspace,
  insertText,
  shouldShowKeyboard,
  type KeyDef,
} from "@/lib/osk";
import { useFocusedInput } from "@/hooks/use-focused-input";
import { useOskMode } from "@/hooks/use-osk-mode";

function useCoarsePointer(): boolean {
  const [coarse, setCoarse] = useState(
    () => typeof window !== "undefined" && !!window.matchMedia?.("(pointer: coarse)").matches,
  );
  useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia) return;
    const mq = window.matchMedia("(pointer: coarse)");
    const handler = () => setCoarse(mq.matches);
    mq.addEventListener?.("change", handler);
    return () => mq.removeEventListener?.("change", handler);
  }, []);
  return coarse;
}

const isLetter = (s: string) => /^[a-z]$/.test(s);

/**
 * App-wide on-screen touch keyboard. Mounted once at the app root. Shows when a
 * text field is focused and the user's mode (auto/on/off) says so, then types
 * into whatever field is focused — no per-field wiring.
 */
export function OnScreenKeyboard() {
  const focused = useFocusedInput();
  const [mode] = useOskMode();
  const coarse = useCoarsePointer();
  const [layer, setLayer] = useState<"letters" | "symbols">("letters");
  const [shift, setShift] = useState(false);

  const visible = shouldShowKeyboard(mode, coarse, !!focused);

  // Shift the centered dialog up (CSS in index.css keys off this attribute) so
  // the keyboard doesn't cover the focused field and footer buttons.
  useEffect(() => {
    const root = document.documentElement;
    if (visible) root.setAttribute("data-osk-open", "true");
    else root.removeAttribute("data-osk-open");
    return () => root.removeAttribute("data-osk-open");
  }, [visible]);

  // Reset to the letter layer each time the keyboard re-opens.
  useEffect(() => {
    if (visible) {
      setLayer("letters");
      setShift(false);
    }
  }, [visible]);

  if (!visible || !focused) return null;

  const rows = layer === "letters" ? LETTER_ROWS : SYMBOL_ROWS;

  const handleKey = (key: KeyDef) => {
    const target = focused;
    if (key.type === "char") {
      const value = shift && isLetter(key.value) ? key.value.toUpperCase() : key.value;
      insertText(target, value);
      return;
    }
    switch (key.action) {
      case "shift":
        setShift((s) => !s);
        break;
      case "backspace":
        backspace(target);
        break;
      case "space":
        insertText(target, " ");
        break;
      case "layer":
        setLayer((l) => (l === "letters" ? "symbols" : "letters"));
        setShift(false);
        break;
      case "done":
        target.blur();
        break;
    }
  };

  const labelFor = (key: KeyDef) => {
    if (key.type === "ctrl") return key.label;
    return shift && isLetter(key.value) ? key.value.toUpperCase() : key.label;
  };

  return createPortal(
    <div
      data-osk="true"
      // mousedown preventDefault is what actually keeps focus on the input: a
      // tap on a button would otherwise move focus to it (even tabIndex=-1),
      // firing focusout and hiding the keyboard. Block that on both the pointer
      // and the compatibility mouse event. stopPropagation stops Radix
      // dialogs/popovers from treating the tap as an outside click and closing.
      onMouseDown={(e) => {
        e.preventDefault();
        e.stopPropagation();
      }}
      onPointerDown={(e) => {
        e.preventDefault();
        e.stopPropagation();
        const keyEl = (e.target as HTMLElement).closest<HTMLElement>("[data-osk-row][data-osk-col]");
        if (!keyEl) return;
        const r = Number(keyEl.getAttribute("data-osk-row"));
        const c = Number(keyEl.getAttribute("data-osk-col"));
        const key = rows[r]?.[c];
        if (key) handleKey(key);
      }}
      className="fixed inset-x-0 bottom-0 z-[60] select-none border-t border-border bg-[hsl(var(--google-light-gray),#f1f3f4)] px-1.5 pb-[max(0.5rem,env(safe-area-inset-bottom))] pt-2 shadow-[0_-2px_10px_rgba(0,0,0,0.15)]"
      style={{ touchAction: "manipulation" }}
    >
      <div className="mx-auto flex max-w-5xl flex-col gap-1.5">
        {rows.map((row, r) => (
          <div key={r} className="flex gap-1.5">
            {row.map((key, c) => {
              const active = key.type === "ctrl" && key.action === "shift" && shift;
              return (
                <button
                  key={c}
                  type="button"
                  tabIndex={-1}
                  data-osk-row={r}
                  data-osk-col={c}
                  style={{ flexGrow: key.type === "ctrl" ? (key.flex ?? 1) : 1, flexBasis: 0 }}
                  className={
                    "flex h-12 items-center justify-center rounded-md border text-lg font-medium shadow-sm transition-colors " +
                    (active
                      ? "border-[hsl(var(--google-blue))] bg-[hsl(var(--google-blue))] text-white"
                      : key.type === "ctrl"
                        ? "border-border bg-gray-200 text-gray-800 active:bg-gray-300"
                        : "border-border bg-white text-gray-900 active:bg-gray-100")
                  }
                >
                  {labelFor(key)}
                </button>
              );
            })}
          </div>
        ))}
      </div>
    </div>,
    document.body,
  );
}
