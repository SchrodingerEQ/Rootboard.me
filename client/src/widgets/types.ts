/**
 * Widget contract types — transcribed exactly from
 * docs/plans/widget-system/CONTRACT.md §3 (entry module / lifecycle) and §4
 * (host services), plus the founder-ratified `ui.sleep()` addendum (see
 * CONTRACT.md §4's traceability paragraph: all three first-party widgets
 * carry a Sleep button; the power-saving overlay itself stays shell-owned).
 *
 * This file has no runtime behavior of its own — it is the shape every
 * widget entry module (built-in or sideloaded) and every host
 * implementation must satisfy. See client/src/lib/widget-host-services.ts
 * for the concrete WidgetHost factory.
 */

// ---------------------------------------------------------------------------
// §3 — Entry module and lifecycle
// ---------------------------------------------------------------------------

/** Default export of a widget's entry module. */
export interface RootboardWidget {
  mount(container: HTMLElement, host: WidgetHost): WidgetInstance;
}

export interface WidgetInstance {
  unmount(): void;
  refresh?(): void | Promise<void>;
  onVisibilityChange?(visible: boolean): void;
}

// ---------------------------------------------------------------------------
// §4 — Host services (WidgetHost)
// ---------------------------------------------------------------------------

export interface WidgetHost {
  readonly apiVersion: 1;
  /** From shared/version.ts. */
  readonly appVersion: string;
  readonly widgetId: string;

  /** One persistent JSON blob per widget, server-side (survives browser
   *  resets). Serialized size <= 64,000 chars — writes above the cap are
   *  rejected. Backed by app_state key `widget:<id>` with the hardened
   *  debounce/retry semantics of use-app-state (600 ms debounced PUT,
   *  15 s retry, never-overwrite-before-first-successful-load). */
  storage: {
    get<T>(): Promise<T | null>;
    set<T>(value: T): void; // debounced, fire-and-forget like today
  };

  /** Read-only view of this widget instance's settings values (as
   *  declared in the manifest, edited in the host UI, persisted in the
   *  dashboard config file). */
  settings: {
    get(): Record<string, unknown>;
    subscribe(cb: (next: Record<string, unknown>) => void): () => void;
  };

  /** Theme tokens are ambient CSS custom properties (--rb-*) inherited
   *  by the container; style with var(--rb-...) and theming is free.
   *  getToken resolves a computed value for canvas/JS use. */
  theme: {
    getToken(name: string): string; // e.g. getToken("--rb-accent")
    subscribe(cb: () => void): () => void; // fires on theme switch
  };

  /** Plain fetch — full network access per the v1 trust model. Also the
   *  path to same-origin /api/* if a widget legitimately needs it. */
  fetch: typeof fetch;

  ui: {
    /** Numeric badge on this widget's nav-rail button (null clears). */
    setBadge(count: number | null): void;

    /** Requests the shell's power-saving overlay (screensaver) immediately,
     *  as if the kiosk had gone idle. The overlay itself is shell-owned —
     *  this only triggers it; the widget has no control over dimming,
     *  timing, or exit. */
    sleep(): void;
  };
}
