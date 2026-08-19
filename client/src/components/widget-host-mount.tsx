import { useEffect, useRef } from "react";
import { RefreshScheduler } from "@/lib/refresh-scheduler";
import type { RootboardWidget, WidgetHost, WidgetInstance } from "@/widgets/types";
import type { WidgetManifest } from "@shared/widget-manifest";

export interface WidgetHostMountEntry {
  manifest: WidgetManifest;
  widget: RootboardWidget;
  host: WidgetHost;
  /** Flushes pending storage writes and disposes the host's AppStateClient.
   *  See createWidgetHost's WidgetHostHandle.dispose in
   *  client/src/lib/widget-host-services.ts — it already sequences
   *  flush() before dispose() internally. */
  hostDispose: () => void;
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
  hostDispose: () => void;
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
  // settings, its folder is removed, or the app shuts down").
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

      mountedRef.current.set(entry.manifest.id, { instance, hostDispose: entry.hostDispose, scheduler });
    }

    Array.from(mountedRef.current.entries()).forEach(([id, mounted]) => {
      if (currentIds.has(id)) return;
      mounted.instance.unmount();
      mounted.hostDispose();
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

  // Component unmount (app shutdown / navigating away entirely): tear down
  // whatever is still mounted. Entry-level removal is already handled in
  // the mount/unmount effect above; this only covers the full-teardown
  // case that effect's cleanup (which only fires on a later re-run, not on
  // final unmount with an empty next entries array necessarily) might miss.
  useEffect(() => {
    return () => {
      Array.from(mountedRef.current.values()).forEach((mounted) => {
        mounted.instance.unmount();
        mounted.hostDispose();
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
