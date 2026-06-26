import { useEffect, useState } from "react";
import { isEditableTarget } from "@/lib/osk";

type EditableEl = HTMLInputElement | HTMLTextAreaElement;

/**
 * Tracks the currently focused editable text field (or null). Updates on
 * focusin/focusout at the document level so it works for any field anywhere in
 * the app without per-field wiring.
 *
 * Note: the keyboard prevents default on pointerdown, so tapping keys never
 * moves focus and won't fire focusout — the tracked element stays put while
 * typing.
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
        if (!isEditableTarget(document.activeElement as EditableEl)) {
          setEl(null);
        } else {
          setEl(document.activeElement as EditableEl);
        }
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
