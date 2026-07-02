import { useEffect, useState } from "react";
import { isEditableTarget, isInsideOsk } from "@/lib/osk";

type EditableEl = HTMLInputElement | HTMLTextAreaElement;

/**
 * Tracks the currently focused editable text field (or null). Updates on
 * focusin/focusout at the document level so it works for any field anywhere in
 * the app without per-field wiring.
 *
 * The keyboard prevents default on pointerdown/mousedown/touchstart so tapping
 * keys shouldn't move focus — but some touch stacks (Firefox/Linux kiosks)
 * move focus to the tapped key button regardless. Focus transfers INTO the
 * keyboard are therefore ignored here: the tracked field survives the tap and
 * the keyboard re-focuses the field right after handling the key.
 */
export function useFocusedInput(): EditableEl | null {
  const [el, setEl] = useState<EditableEl | null>(null);

  useEffect(() => {
    const onFocusIn = (e: FocusEvent) => {
      const target = e.target as Element | null;
      if (isEditableTarget(target as EditableEl)) {
        setEl(target as EditableEl);
      }
    };
    const onFocusOut = () => {
      // Defer so we can read the new activeElement after focus settles.
      setTimeout(() => {
        const active = document.activeElement;
        if (isEditableTarget(active as EditableEl)) {
          setEl(active as EditableEl);
        } else if (!isInsideOsk(active)) {
          setEl(null);
        }
        // else: focus landed on the keyboard itself — keep the tracked field.
      }, 0);
    };
    document.addEventListener("focusin", onFocusIn);
    document.addEventListener("focusout", onFocusOut);
    return () => {
      document.removeEventListener("focusin", onFocusIn);
      document.removeEventListener("focusout", onFocusOut);
    };
  }, []);

  return el;
}
