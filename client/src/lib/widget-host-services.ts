import { APP_VERSION } from "@shared/version";
import { WIDGET_API_VERSION } from "@shared/widget-manifest";
import type { WidgetHost } from "@/widgets/types";
import { AppStateClient } from "./app-state-client";

/**
 * Built-in widgets keep their legacy app_state keys so existing kiosk data
 * survives the widget-system migration untouched (value-only-accrues: a
 * migration must never lose family data). Community widgets get the
 * `widget:<id>` namespace. See CONTRACT.md §4 "Storage key mapping".
 */
export const LEGACY_KEY_ALIASES = {
  chores: "chores",
  dinner: "dinner",
} as const;

export interface CreateWidgetHostOptions {
  widgetId: string;
  appVersion?: string;
  getSettings: () => Record<string, unknown>;
  subscribeSettings: (cb: (next: Record<string, unknown>) => void) => () => void;
  setBadge: (count: number | null) => void;
  sleep: () => void;
}

export interface WidgetHostHandle {
  host: WidgetHost;
  /** Flushes any pending storage write, then disposes the underlying
   *  AppStateClient. Callers MUST call flush() before dispose() — flush's
   *  dispatch is a microtask, and dispose() synchronously cancels timers,
   *  so this ordering (flush, then dispose) is the intended contract. This
   *  helper does exactly that, in that order. */
  dispose: () => void;
}

/**
 * Builds the per-instance WidgetHost object handed to a widget's mount().
 * Pure factory + thin glue — no widget-specific logic lives here.
 */
export function createWidgetHost(opts: CreateWidgetHostOptions): WidgetHostHandle {
  const storageKey =
    LEGACY_KEY_ALIASES[opts.widgetId as keyof typeof LEGACY_KEY_ALIASES] ??
    `widget:${opts.widgetId}`;
  const storageClient = new AppStateClient(storageKey);

  const host: WidgetHost = {
    apiVersion: WIDGET_API_VERSION as 1,
    appVersion: opts.appVersion ?? APP_VERSION,
    widgetId: opts.widgetId,

    storage: {
      get: <T,>() => storageClient.load() as Promise<T | null>,
      set: <T,>(value: T) => storageClient.set(value),
    },

    settings: {
      get: opts.getSettings,
      subscribe: opts.subscribeSettings,
    },

    theme: {
      getToken: (name: string) =>
        getComputedStyle(document.documentElement).getPropertyValue(name).trim(),
      // Stub until the theme engine exists (tracked separately) — themes
      // are static for now, so there's nothing to subscribe to yet.
      subscribe: () => () => {},
    },

    fetch: window.fetch.bind(window),

    ui: {
      setBadge: opts.setBadge,
      sleep: opts.sleep,
    },
  };

  return {
    host,
    dispose: () => {
      storageClient.flush();
      storageClient.dispose();
    },
  };
}
