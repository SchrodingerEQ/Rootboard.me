import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  EMOJI_ROWS,
  LETTER_ROWS,
  SYMBOL_ROWS,
  backspace,
  insertText,
  isInsideOsk,
  isTouchCapable,
  shouldShowKeyboard,
  type KeyDef,
  type OskLayer,
} from "@/lib/osk";
import { useFocusedInput } from "@/hooks/use-focused-input";
import { useOskMode } from "@/hooks/use-osk-mode";

function readTouchCapable(): boolean {
  if (typeof window === "undefined") return false;
  return isTouchCapable({
    anyPointerCoarse: !!window.matchMedia?.("(any-pointer: coarse)").matches,
    maxTouchPoints: typeof navigator !== "undefined" ? navigator.maxTouchPoints : 0,
    hasTouchStart: "ontouchstart" in window,
  });
}

function useTouchDevice(): boolean {
  // Start from static capability detection (works where the browser reports it),
  // then latch true on the first real touch interaction. The dynamic latch is
  // the reliable path on Firefox/Linux kiosks, where the static media/touch
  // queries frequently under-report touch even though the touchscreen works.
  const [touch, setTouch] = useState(readTouchCapable);
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (touch) return; // already known — no need to listen

    const markTouch = () => setTouch(true);
    const onPointerDown = (e: PointerEvent) => {
      if (e.pointerType === "touch") markTouch();
    };
    // capture phase so we still see it even if a handler stops propagation.
    window.addEventListener("pointerdown", onPointerDown, { capture: true, passive: true });
    window.addEventListener("touchstart", markTouch, { capture: true, passive: true });

    const mq = window.matchMedia?.("(any-pointer: coarse)");
    const onMq = () => {
      if (readTouchCapable()) setTouch(true);
    };
    mq?.addEventListener?.("change", onMq);

    return () => {
      window.removeEventListener("pointerdown", onPointerDown, { capture: true } as EventListenerOptions);
      window.removeEventListener("touchstart", markTouch, { capture: true } as EventListenerOptions);
      mq?.removeEventListener?.("change", onMq);
    };
  }, [touch]);
  return touch;
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
  const isTouchDevice = useTouchDevice();
  const [layer, setLayer] = useState<OskLayer>("letters");
  const [shift, setShift] = useState(false);
  const containerRef = useRef<HTMLDivElement | null>(null);

  const visible = shouldShowKeyboard(mode, isTouchDevice, !!focused);

  // Cancel touchstart on the keyboard NATIVELY and non-passively. React's
  // root-level touch listeners are passive, so onTouchStart preventDefault
  // would be silently ignored. Canceling touchstart stops touch browsers from
  // focusing the tapped button (and suppresses the compatibility mouse events)
  // — the primary defense against the tap blurring the input on touchscreens.
  // Key dispatch is unaffected: pointerdown fires before touchstart.
  useEffect(() => {
    const node = containerRef.current;
    if (!node) return;
    const onTouchStart = (e: TouchEvent) => {
      e.preventDefault();
      e.stopPropagation();
    };
    node.addEventListener("touchstart", onTouchStart, { passive: false });
    return () => node.removeEventListener("touchstart", onTouchStart);
  }, [visible]);

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

  // Bring the focused field into view once the keyboard is up — inside capped
  // scroll containers (dialog forms, the Settings popover) the field can start
  // out below the keyboard line.
  useEffect(() => {
    if (visible && focused) {
      const id = setTimeout(() => {
        try {
          focused.scrollIntoView({ block: "center", behavior: "smooth" });
        } catch {
          /* older engines without options support — ignore */
        }
      }, 180); // after the dialog-lift transition settles
      return () => clearTimeout(id);
    }
  }, [visible, focused]);

  if (!visible || !focused) return null;

  const rows = layer === "letters" ? LETTER_ROWS : layer === "symbols" ? SYMBOL_ROWS : EMOJI_ROWS;

  const handleKey = (key: KeyDef) => {
    const target = focused;
    if (key.type === "char") {
      const value = shift && isLetter(key.value) ? key.value.toUpperCase() : key.value;
      insertText(target, value);
      // One-shot shift, like phone keyboards: it applies to the next
      // character only, then releases itself.
      if (shift) setShift(false);
      restoreFocus(target);
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
        setLayer(key.layer);
        setShift(false);
        break;
      case "done": {
        // Deliberately closing: release focus from wherever it actually sits.
        // On touch stacks that moved focus onto the Done key itself, blurring
        // only the field would be a no-op and the keyboard would never close.
        target.blur();
        const active = document.activeElement as HTMLElement | null;
        if (active && isInsideOsk(active)) active.blur();
        return; // don't re-focus
      }
    }
    restoreFocus(target);
  };

  // If the browser moved focus to the tapped key anyway (Firefox/Linux touch
  // does, despite all the preventDefaults), put it back on the field so the
  // caret stays visible and the keyboard stays anchored to its target.
  const restoreFocus = (target: HTMLElement) => {
    if (document.activeElement !== target) {
      target.focus({ preventScroll: true });
    }
  };

  const labelFor = (key: KeyDef) => {
    if (key.type === "ctrl") return key.label;
    return shift && isLetter(key.value) ? key.value.toUpperCase() : key.label;
  };

  return createPortal(
    <div
      ref={containerRef}
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
      // Floating boxed panel, lifted off the bottom edge. The background is a
      // SOLID color on purpose (the old hsl(var(--google-light-gray),...) was
      // an undefined variable — invalid CSS, so the whole panel was
      // transparent and the app showed through between the keys).
      className="fixed bottom-4 left-1/2 z-[60] w-[min(64rem,calc(100vw-24px))] -translate-x-1/2 select-none rounded-2xl border-2 border-[#c9c4b8] bg-[#e8e6e1] p-1.5 shadow-[0_8px_28px_rgba(0,0,0,0.28)]"
      // pointerEvents auto is LOAD-BEARING: modal Radix dialogs set
      // `pointer-events: none` on document.body, and this keyboard is portaled
      // into body — without the explicit re-enable, every tap falls through
      // the (visible) keyboard to the dialog overlay beneath it, which blurs
      // the field and closes the keyboard. That was the kiosk bug: the
      // keyboard's own handlers never ran at all.
      style={{ touchAction: "manipulation", pointerEvents: "auto" }}
    >
      <div className="flex flex-col">
        {rows.map((row, r) => (
          <div key={r} className="flex">
            {row.map((key, c) => {
              const active = key.type === "ctrl" && key.action === "shift" && shift;
              return (
                // The CELL is the touch target (it carries the row/col dispatch
                // attributes), padded so the visual gaps between keys are still
                // pressable — the panel has no dead zones, and every tap lands
                // on the key whose visual it is nearest.
                <div
                  key={c}
                  data-osk-row={r}
                  data-osk-col={c}
                  className="group p-[3px]"
                  style={{ flexGrow: key.type === "ctrl" ? (key.flex ?? 1) : 1, flexBasis: 0, minWidth: 0 }}
                >
                  <button
                    type="button"
                    tabIndex={-1}
                    className={
                      "pointer-events-none flex h-14 w-full items-center justify-center rounded-lg border font-medium shadow-sm transition-colors " +
                      (layer === "emoji" && key.type === "char" ? "text-2xl " : "text-lg ") +
                      (active
                        ? "border-[#2b3038] bg-[#2b3038] text-white"
                        : key.type === "ctrl"
                          ? "border-[#d5d0c6] bg-[#d9d5cc] text-gray-800 group-active:bg-[#cbc6bb]"
                          : "border-[#d5d0c6] bg-white text-gray-900 group-active:bg-gray-100")
                    }
                  >
                    {labelFor(key)}
                  </button>
                </div>
              );
            })}
          </div>
        ))}
      </div>
    </div>,
    document.body,
  );
}
