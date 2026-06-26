import { useEffect, useState } from "react";
import type { OskMode } from "@/lib/osk";

const STORAGE_KEY = "calendar-osk-mode";
const CHANGE_EVENT = "osk-mode-change";

function readMode(): OskMode {
  const v = typeof localStorage !== "undefined" ? localStorage.getItem(STORAGE_KEY) : null;
  return v === "on" || v === "off" || v === "auto" ? v : "auto";
}

/**
 * On-screen keyboard mode preference ("auto" | "on" | "off"), persisted to
 * localStorage and shared live across components (Settings + the keyboard
 * itself) via a window event so changing it takes effect immediately.
 */
export function useOskMode(): [OskMode, (mode: OskMode) => void] {
  const [mode, setMode] = useState<OskMode>(readMode);

  useEffect(() => {
    const sync = () => setMode(readMode());
    window.addEventListener(CHANGE_EVENT, sync);
    window.addEventListener("storage", sync); // other tabs / windows
    return () => {
      window.removeEventListener(CHANGE_EVENT, sync);
      window.removeEventListener("storage", sync);
    };
  }, []);

  const update = (next: OskMode) => {
    localStorage.setItem(STORAGE_KEY, next);
    setMode(next);
    window.dispatchEvent(new Event(CHANGE_EVENT));
  };

  return [mode, update];
}
