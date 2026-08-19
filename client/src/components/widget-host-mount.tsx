import { useEffect, useRef } from "react";
import { RefreshScheduler } from "@/lib/refresh-scheduler";
import type { RootboardWidget, WidgetHost, WidgetInstance } from "@/widgets/types";
import type { WidgetManifest } from "@shared/widget-manifest";

/**
 * The CALLER owns each entry's host lifecycle, not WidgetHostMount:
 *  - Create `host` (createWidgetHost, client/src/lib/widget-host-services.ts)
 *    when the widget is enabled, before the entry is ever passed in here.
 *  - When you remove an entry from `entries` (widget disabled, folder
 *    removed), call that host's `flush()` then `dispose()` yourself —
 *    WidgetHostMount only ever calls `instance.unmount()`, never anything
 *    on the host.
 *  - Hosts are NOT single-use-guarded here: WidgetHostMount does not track
 *    which hosts have been disposed, so never pass in a host you've already
 *    disposed — reusing/re-adding an entry with a disposed host will mount
 *    a widget against dead storage (get() -> null forever, set() a silent
 *    no-op) with no error raised anywhere.
 *
 * This split exists because WidgetHostMount can legitimately remount (e.g.
 * React StrictMode double-invoke, or a parent re-rendering it) while the
 * hosts passed via props keep stable identity across that remount — if this
 * component disposed hosts on its own unmount, a remount would silently and
 * irreversibly kill every widget's storage. See docs/decisions/ for the
 * fuller writeup if one exists, or CONTRACT.md §3.
 */
export interface WidgetHostMountEntry {
  manifest: WidgetManifest;
  widget: RootboardWidget;
  host: WidgetHost;
}

interface WidgetHostMountProps {
  /** Every currently-enabled widget, in nav-rail order. Keep-alive: an
   *  entry present here stays mounted across activeId switches — it is
   *  only unmounted when it disappears from this list (disabled, or its
   *  folder removed) or when WidgetHostMount itself unmounts. */
  entries: WidgetHostMountEntry[];
  activeId: string;
}

interface MountedEntry {
  instance: WidgetInstance;
  scheduler: RefreshScheduler;
}

/** Host calls every widget's RefreshScheduler.tick() on this shared
 *  cadence (CONTRACT.md §3 — the app's "all cadence is client timers,
 *  owned centrally" rule extends to the widget host). */
const REFRESH_TICK_MS = 30_000;

/**
 * Mounts every enabled widget once and keeps instances alive across section
 * switches (display-hidden, not unmounted) — this is what preserves live
 * nav badges, debounce timers, and in-memory cooldowns across navigation,
 * per CONTRACT.md §3's keep-alive guarantee.
 *
 * Nothing imports this component yet (Task 4) — it starts being exercised
 * for real once built-in widgets exist (Task 6+).
 */
export function WidgetHostMount({ entries, activeId }: WidgetHostMountProps) {
  const containerRefs = useRef(new Map<string, HTMLDivElement>());
  const mountedRef = useRef(new Map<string, MountedEntry>());
  const prevActiveIdRef = useRef<string | null>(null);
  const activeIdRef = useRef(activeId);
  activeIdRef.current = activeId;

  // Mount every not-yet-mounted entry exactly once (ref-guarded via
  // mountedRef), and tear down any entry that has disappeared from the
  // list since the last render (widget disabled, or its folder removed —
  // CONTRACT.md §3: "unmount() is called only when a widget is disabled in
  // settings, its folder is removed, or the app shuts down"). Symmetric
  // with the component-unmount cleanup below: this effect only ever calls
  // `instance.unmount()`, never anything on the entry's host — host
  // creation/flush/dispose is the caller's job (see WidgetHostMountEntry).
  //
  // `entries` should be a referentially-stable array from the caller
  // (e.g. memoized) — a fresh array identity every render is harmless
  // (mountedRef guards against re-mounting) but makes this effect and the
  // one below it re-run needlessly on every render.
  useEffect(() => {
    const currentIds = new Set(entries.map((e) => e.manifest.id));

    for (const entry of entries) {
      if (mountedRef.current.has(entry.manifest.id)) continue;
      const container = containerRefs.current.get(entry.manifest.id);
      if (!container) continue;

      const instance = entry.widget.mount(container, entry.host);
      const scheduler = new RefreshScheduler({
        intervalSeconds: entry.manifest.refresh?.intervalSeconds,
        onRefresh: () => {
          Promise.resolve(instance.refresh?.()).finally(() => scheduler.noteRefreshed());
        },
      });
      scheduler.setOnline(navigator.onLine);
      scheduler.setVisible(entry.manifest.id === activeIdRef.current);

      mountedRef.current.set(entry.manifest.id, { instance, scheduler });
    }

    Array.from(mountedRef.current.entries()).forEach(([id, mounted]) => {
      if (currentIds.has(id)) return;
      mounted.instance.unmount();
      mountedRef.current.delete(id);
    });
  }, [entries]);

  // onVisibilityChange on active-section switch: hide the previously
  // active widget, show the newly active one. Runs after the mount effect
  // above (declaration order), so a widget that just got mounted this same
  // render is already in mountedRef by the time this fires.
  useEffect(() => {
    const prevId = prevActiveIdRef.current;
    if (prevId !== null && prevId !== activeId) {
      const prev = mountedRef.current.get(prevId);
      prev?.instance.onVisibilityChange?.(false);
      prev?.scheduler.setVisible(false);
    }
    const next = mountedRef.current.get(activeId);
    next?.instance.onVisibilityChange?.(true);
    next?.scheduler.setVisible(true);
    prevActiveIdRef.current = activeId;
  }, [activeId, entries]);

  // Screensaver dim/wake: dim hides every widget (onVisibilityChange(false)
  // for all); wake shows only the currently active one. "Awake" is a
  // separate, screen-wide flag on every scheduler regardless of which
  // widget is active — refresh must not fire for anyone while the overlay
  // is up.
  useEffect(() => {
    const handleScreensaverChange = (event: Event) => {
      const { isActive } = (event as CustomEvent<{ isActive: boolean }>).detail;
      Array.from(mountedRef.current.entries()).forEach(([id, mounted]) => {
        mounted.scheduler.setAwake(!isActive);
        if (isActive) {
          mounted.instance.onVisibilityChange?.(false);
          mounted.scheduler.setVisible(false);
        } else if (id === activeIdRef.current) {
          mounted.instance.onVisibilityChange?.(true);
          mounted.scheduler.setVisible(true);
        }
      });
    };
    window.addEventListener("screensaver-state-change", handleScreensaverChange);
    return () => window.removeEventListener("screensaver-state-change", handleScreensaverChange);
  }, []);

  // navigator.onLine, tracked for every scheduler.
  useEffect(() => {
    const handleOnline = () => {
      Array.from(mountedRef.current.values()).forEach((mounted) => mounted.scheduler.setOnline(true));
    };
    const handleOffline = () => {
      Array.from(mountedRef.current.values()).forEach((mounted) => mounted.scheduler.setOnline(false));
    };
    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  // Single shared 30s interval driving every mounted widget's scheduler.
  useEffect(() => {
    const interval = setInterval(() => {
      Array.from(mountedRef.current.values()).forEach((mounted) => mounted.scheduler.tick());
    }, REFRESH_TICK_MS);
    return () => clearInterval(interval);
  }, []);

  // Component unmount (app shutdown / navigating away entirely, OR a
  // React remount such as StrictMode's dev-mode double-invoke): tear down
  // whatever is still mounted, but do NOT touch the hosts — they arrive
  // via props with stable identity and are owned by the caller (see
  // WidgetHostMountEntry). Clearing mountedRef (rather than leaving stale
  // entries in it) is what makes a subsequent remount of this component
  // safe: the entries effect above will see nothing mounted and cleanly
  // re-mount every still-present entry against its still-live host,
  // instead of either double-mounting or silently no-op'ing.
  useEffect(() => {
    return () => {
      Array.from(mountedRef.current.values()).forEach((mounted) => {
        mounted.instance.unmount();
      });
      mountedRef.current.clear();
    };
  }, []);

  return (
    <>
      {entries.map((entry) => (
        <div
          key={entry.manifest.id}
          ref={(el) => {
            if (el) containerRefs.current.set(entry.manifest.id, el);
            else containerRefs.current.delete(entry.manifest.id);
          }}
          className="h-full"
          style={{ display: entry.manifest.id === activeId ? undefined : "none" }}
        />
      ))}
    </>
  );
}
