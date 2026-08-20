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
  /** Fired when a widget's `mount()` throws, or returns something that
   *  isn't `{ unmount(): void, ... }` — a widget (first-party or
   *  sideloaded) is otherwise-untrusted, host-executed code (CONTRACT
   *  §7), and a single bad `mount()` call must not white-screen the
   *  whole kiosk. The entry is never added to mountedRef on crash — its
   *  pane simply stays empty. The caller (app-shell.tsx) is expected to
   *  record `id` as crashed and drop it from the next `entries` array it
   *  passes in (dropping the id from `entries` is what stops this
   *  component from retrying the mount every render — WidgetHostMount
   *  itself has no memory of past crashes). */
  onWidgetCrash?: (id: string, error: unknown) => void;
}

interface MountedEntry {
  instance: WidgetInstance;
  scheduler: RefreshScheduler;
  /** The exact `entry.widget` object this instance was mounted from —
   *  compared by reference on every mount-effect pass so a widget object
   *  identity change (e.g. a community widget's `version` bumped and
   *  re-imported by community-widgets.ts's id+version cache) triggers an
   *  unmount-then-remount instead of silently keeping the stale instance
   *  alive forever. Builtins never change identity (static import), so
   *  this only ever fires for community widgets in practice. */
  widget: RootboardWidget;
}

/**
 * Runs `widget.mount()` guarded: a widget's entry module is
 * otherwise-untrusted code (CONTRACT §7) and `mount()` is the one call
 * site with no other safety net before an instance exists. Also
 * validates the return value's SHAPE (object with a callable `unmount`)
 * rather than trusting the TypeScript type, since a widget returning
 * `undefined`/a bare function/etc. would otherwise crash later at
 * unmount time instead of failing loudly here.
 */
function safeMount(
  id: string,
  widget: RootboardWidget,
  container: HTMLElement,
  host: WidgetHost,
): { ok: true; instance: WidgetInstance } | { ok: false; error: unknown } {
  try {
    const instance = widget.mount(container, host);
    if (
      !instance ||
      typeof instance !== "object" ||
      typeof (instance as { unmount?: unknown }).unmount !== "function"
    ) {
      return {
        ok: false,
        error: new Error(
          `"${id}" mount() did not return an object with a callable unmount()`,
        ),
      };
    }
    return { ok: true, instance };
  } catch (error) {
    return { ok: false, error };
  }
}

/** Guards `instance.unmount()` — teardown must keep going past a
 *  throwing widget so one bad `unmount()` can't strand every OTHER
 *  widget's teardown in the same pass (component unmount, or the
 *  disappeared-from-`entries` sweep). Callers still always delete the
 *  mountedRef entry themselves regardless of whether this throws. */
function safeUnmount(id: string, instance: WidgetInstance): void {
  try {
    instance.unmount();
  } catch (error) {
    console.error(`[widget-host] "${id}" unmount() threw`, error);
  }
}

/** Guards every `instance.onVisibilityChange()` call site — a widget's
 *  visibility handler is as untrusted as its mount()/unmount(), and a
 *  throw here must not abort whichever effect (mount, active-switch,
 *  screensaver dim/wake) happened to be driving it, which would strand
 *  every OTHER widget mid-loop. */
function safeVisibilityChange(id: string, instance: WidgetInstance, visible: boolean): void {
  try {
    instance.onVisibilityChange?.(visible);
  } catch (error) {
    console.error(`[widget-host] "${id}" onVisibilityChange() threw`, error);
  }
}

/** Host calls every widget's RefreshScheduler.tick() on this shared
 *  cadence (CONTRACT.md §3 — the app's "all cadence is client timers,
 *  owned centrally" rule extends to the widget host). */
const REFRESH_TICK_MS = 30_000;

/**
 * Mounts every enabled widget once and keeps instances alive across section
 * switches (display-hidden, not unmounted) — this is what preserves live
 * nav badges and in-memory-only widget state (e.g. dinner's vote cooldown,
 * client/src/hooks/use-dinner.ts) across navigation, per CONTRACT.md §3's
 * keep-alive guarantee.
 *
 * A widget's PERSISTED-state debounce timer does NOT depend on this: it
 * lives inside that widget's `AppStateClient` instance (client/src/lib/
 * app-state-client.ts), owned by app-shell's `hostsRef` for as long as the
 * widget is enabled — independent of whether WidgetHostMount currently has
 * it mounted. Even if this component unmounted/remounted widgets on every
 * section switch, a pending debounced PUT would still survive.
 */
export function WidgetHostMount({ entries, activeId, onWidgetCrash }: WidgetHostMountProps) {
  const containerRefs = useRef(new Map<string, HTMLDivElement>());
  const mountedRef = useRef(new Map<string, MountedEntry>());
  const prevActiveIdRef = useRef<string | null>(null);
  const activeIdRef = useRef(activeId);
  activeIdRef.current = activeId;
  // Screen-wide awake flag, mirrored here so a scheduler created LATER (a
  // widget enabled mid-session) starts from the truth rather than from
  // RefreshScheduler's "nothing has been told to me yet" default. Without
  // seeding it at construction, `awake` would stay false until the first
  // screensaver dim/wake, and no widget's refresh() could ever fire before
  // then — the app starts awake, so that is the correct initial value.
  const awakeRef = useRef(true);

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
      const existing = mountedRef.current.get(entry.manifest.id);
      if (existing) {
        // Minor #2: a version-bumped community widget re-imports to a NEW
        // widget object (community-widgets.ts's id+version cache) — that
        // new object arrives here as a different `entry.widget` reference
        // while `existing` is still the stale instance. Unmount the stale
        // one (guarded — a crashing unmount must not block the remount
        // below) and fall through to mount the fresh module, so an
        // SSH'd-in version bump takes effect without a full page reload.
        // Builtins never change identity (static import), so this branch
        // is a no-op for them (`entry.widget === existing.widget` always).
        if (existing.widget === entry.widget) continue;
        safeUnmount(entry.manifest.id, existing.instance);
        mountedRef.current.delete(entry.manifest.id);
      }
      const container = containerRefs.current.get(entry.manifest.id);
      if (!container) continue;

      const mounted = safeMount(entry.manifest.id, entry.widget, container, entry.host);
      if (!mounted.ok) {
        // CONTRACT §7: a widget's mount() is otherwise-untrusted code — a
        // throw (or a malformed return, caught inside safeMount) must not
        // white-screen the kiosk. Report it and leave the pane empty; the
        // caller is expected to drop this id from the NEXT `entries` array
        // (see onWidgetCrash's doc comment) so this effect doesn't retry
        // the same crashing mount() on every future render.
        console.error(`[widget-host] "${entry.manifest.id}" crashed on mount`, mounted.error);
        onWidgetCrash?.(entry.manifest.id, mounted.error);
        continue;
      }
      const instance = mounted.instance;
      const scheduler = new RefreshScheduler({
        intervalSeconds: entry.manifest.refresh?.intervalSeconds,
        onRefresh: () => {
          // Guard the SYNCHRONOUS call: `instance.refresh?.()` executes
          // immediately as this function body runs (it is NOT already
          // wrapped by the Promise.resolve() below — that only wraps its
          // return value). This closure runs from inside the shared 30s
          // interval's forEach (see the tick effect further down), one
          // call per mounted widget — an uncaught synchronous throw here
          // would propagate straight out of that forEach iteration and
          // abort every OTHER widget's tick for this cycle. Catching it
          // HERE, inside this widget's own onRefresh, keeps the blast
          // radius to just this one widget.
          let result: void | Promise<void>;
          try {
            result = instance.refresh?.();
          } catch (error) {
            console.error(`[widget-host] "${entry.manifest.id}" refresh() threw`, error);
            scheduler.noteRefreshed();
            return;
          }
          Promise.resolve(result)
            .catch((error) => {
              console.error(`[widget-host] "${entry.manifest.id}" refresh() rejected`, error);
            })
            .finally(() => scheduler.noteRefreshed());
        },
      });
      scheduler.setAwake(awakeRef.current);
      scheduler.setOnline(navigator.onLine);
      // A widget can now be mounted mid-session (the layout picker enabling
      // it, Task 9) instead of only at startup — so "is this the active
      // section" is no longer enough on its own: if `awakeRef` is currently
      // false, this entry must come up hidden even when it happens to be the
      // active id (e.g. it becomes the fallback section right as it's
      // enabled). `awake ⇒ false` mirrors the screensaver dim/wake handler
      // below, which drives every OTHER mounted widget the same way.
      // Explicitly calling onVisibilityChange(false) here (rather than
      // relying on the widget's own default) is a deliberate belt: a future
      // widget's internal default isn't contract, so a freshly mounted
      // active-while-dimmed entry gets told "hidden" for real.
      //
      // Caveat inherited from `awakeRef` itself: it only tracks the
      // `screensaver-state-change` event, i.e. the AUTO screensaver
      // (useScreensaver's inactivity timeout). Manual sleep
      // (host.ui.sleep() -> app-shell's handleSleep -> setIsPowerSaving)
      // does not dispatch that event, so `awakeRef` stays true and a widget
      // mounted while manually put to sleep comes up visible — a pre-
      // existing asymmetry (docs/SPEC.md §6 quirks index), not something
      // this mid-session-mount handling introduced or fixes.
      const isActiveNow = entry.manifest.id === activeIdRef.current;
      const initiallyVisible = isActiveNow && awakeRef.current;
      scheduler.setVisible(initiallyVisible);
      if (isActiveNow) {
        safeVisibilityChange(entry.manifest.id, instance, initiallyVisible);
      }

      mountedRef.current.set(entry.manifest.id, { instance, scheduler, widget: entry.widget });
    }

    Array.from(mountedRef.current.entries()).forEach(([id, mounted]) => {
      if (currentIds.has(id)) return;
      safeUnmount(id, mounted.instance);
      mountedRef.current.delete(id);
    });
  }, [entries, onWidgetCrash]);

  // onVisibilityChange on active-section switch: hide the previously
  // active widget, show the newly active one. Runs after the mount effect
  // above (declaration order), so a widget that just got mounted this same
  // render is already in mountedRef by the time this fires.
  //
  // Depends on `entries`, not just `activeId` — a layout-picker enable/
  // disable (Task 9) changes `entries` without necessarily changing
  // `activeId`, and this effect re-runs either way. Gating the "show" call
  // on `awakeRef.current` (rather than unconditionally firing `true`) stops
  // that re-run from incorrectly un-hiding the active widget while the
  // screensaver is dimmed — the screensaver dim/wake handler below is the
  // one place that's supposed to flip visibility while dimmed, and it
  // always drives every widget to `false`.
  useEffect(() => {
    const prevId = prevActiveIdRef.current;
    if (prevId !== null && prevId !== activeId) {
      const prev = mountedRef.current.get(prevId);
      if (prev) safeVisibilityChange(prevId, prev.instance, false);
      prev?.scheduler.setVisible(false);
    }
    const next = mountedRef.current.get(activeId);
    const nextVisible = awakeRef.current;
    if (next) safeVisibilityChange(activeId, next.instance, nextVisible);
    next?.scheduler.setVisible(nextVisible);
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
      awakeRef.current = !isActive;
      Array.from(mountedRef.current.entries()).forEach(([id, mounted]) => {
        mounted.scheduler.setAwake(!isActive);
        if (isActive) {
          safeVisibilityChange(id, mounted.instance, false);
          mounted.scheduler.setVisible(false);
        } else if (id === activeIdRef.current) {
          safeVisibilityChange(id, mounted.instance, true);
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
      Array.from(mountedRef.current.entries()).forEach(([id, mounted]) => {
        safeUnmount(id, mounted.instance);
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
