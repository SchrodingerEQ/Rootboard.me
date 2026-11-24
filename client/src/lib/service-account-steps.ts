import { useSyncExternalStore } from "react";

/**
 * Whether the setup wizard's "Continue with manual setup" has the
 * service-account steps open over the dashboard (brief 03 session 2).
 *
 * A module-level store rather than React state because two React roots read
 * it: the shell, which shows those steps, and the calendar widget, whose own
 * connect dialog opens by itself on an unauthenticated kiosk and would
 * otherwise stack on top of them on its Connect tab. The widget holds its
 * dialog back while this is true; closing the steps lets it open as it does
 * on any unauthenticated boot.
 */
let open = false;
const listeners = new Set<() => void>();

export function setServiceAccountStepsOpen(next: boolean): void {
  if (next === open) return;
  open = next;
  listeners.forEach((listener) => listener());
}

export function isServiceAccountStepsOpen(): boolean {
  return open;
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function useServiceAccountStepsOpen(): boolean {
  return useSyncExternalStore(subscribe, isServiceAccountStepsOpen, isServiceAccountStepsOpen);
}
