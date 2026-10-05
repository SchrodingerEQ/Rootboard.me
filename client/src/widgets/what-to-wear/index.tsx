import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createRoot, type Root } from "react-dom/client";
import { validateBuiltinManifest } from "@/widgets/validate-manifest";
import type { RootboardWidget, WidgetHost, WidgetInstance } from "@/widgets/types";
import rawManifest from "./manifest.json";
import { buildAdvice } from "./advice";
import { emptyStoredState, fetchForecast, normalizeStoredState, type ForecastStatus, type StoredState } from "./forecast";
import type { ForecastBundle } from "./types";
import { resolveSettings } from "./settings";
import { formatClock } from "./time-windows";
import { WhatToWear } from "./WhatToWear";

/**
 * What to Wear as a contract widget (CONTRACT.md §3–§4; brief at
 * docs/plans/what-to-wear-widget/BRIEF.md). Pure display, no touch
 * interaction in v1. Same bridge pattern as widgets/calendar/index.tsx:
 * the host's RefreshScheduler drives `refresh()` on the manifest's
 * 30-minute cadence (visible + online + awake only); the only private
 * timer is a one-minute clock for the day flip and the "as of" footer,
 * which runs only while visible and is cleared on unmount.
 */
export const manifest = validateBuiltinManifest(rawManifest);

interface Bridge {
  visible: boolean;
  notifyVisible: ((visible: boolean) => void) | null;
  refresh: (() => Promise<void>) | null;
}

function useHostSettings(host: WidgetHost): Record<string, unknown> {
  const [settings, setSettings] = useState<Record<string, unknown>>(() => host.settings.get());
  useEffect(() => {
    setSettings(host.settings.get());
    return host.settings.subscribe(setSettings);
  }, [host]);
  return settings;
}

interface LoadState {
  loaded: boolean;
  status: ForecastStatus;
  bundle: ForecastBundle | null;
}

function WhatToWearApp({ host, bridge }: { host: WidgetHost; bridge: Bridge }) {
  const rawSettings = useHostSettings(host);
  const settings = useMemo(() => resolveSettings(rawSettings), [rawSettings]);
  const settingsRef = useRef(settings);
  settingsRef.current = settings;

  const [visible, setVisible] = useState(bridge.visible);
  const [now, setNow] = useState(() => new Date());
  const [load, setLoad] = useState<LoadState>({ loaded: false, status: "ok", bundle: null });
  const stateRef = useRef<StoredState | null>(null);
  const inflight = useRef<Promise<void> | null>(null);

  const reload = useCallback((): Promise<void> => {
    if (inflight.current) return inflight.current;
    inflight.current = (async () => {
      try {
        if (!stateRef.current) {
          const raw = await host.storage.get<unknown>().catch(() => null);
          stateRef.current = raw === null ? emptyStoredState() : normalizeStoredState(raw);
        }
        const result = await fetchForecast(host.fetch, settingsRef.current, stateRef.current, new Date());
        stateRef.current = result.state;
        if (result.status === "ok") host.storage.set(result.state);
        setLoad({ loaded: true, status: result.status, bundle: result.bundle });
        setNow(new Date());
      } catch {
        // fetchForecast never throws; this guards storage.get/set only.
        setLoad((prev) => ({ loaded: true, status: "unreachable", bundle: prev.bundle ?? stateRef.current?.forecast ?? null }));
      } finally {
        inflight.current = null;
      }
    })();
    return inflight.current;
  }, [host]);

  // Host wiring: visibility + refresh (see Bridge).
  useEffect(() => {
    bridge.notifyVisible = setVisible;
    setVisible(bridge.visible);
    return () => {
      bridge.notifyVisible = null;
    };
  }, [bridge]);
  useEffect(() => {
    bridge.refresh = reload;
    return () => {
      bridge.refresh = null;
    };
  }, [bridge, reload]);

  // Initial load, and again whenever the zip changes (units/times only
  // re-render; they don't need new data).
  useEffect(() => {
    void reload();
  }, [reload, settings.zipCode]);

  // One-minute clock for the day flip + footer, visible only (brief §4.3).
  useEffect(() => {
    if (!visible) return;
    setNow(new Date());
    const id = window.setInterval(() => setNow(new Date()), 60_000);
    return () => window.clearInterval(id);
  }, [visible]);

  const advice = useMemo(() => (load.bundle ? buildAdvice(load.bundle, settings, now) : null), [load.bundle, settings, now]);

  let footer = "";
  if (load.loaded && load.bundle) {
    const at = formatClock(load.bundle.fetchedAt);
    footer = load.status === "ok" ? `Weather as of ${at} · Open-Meteo` : `Weather from earlier — as of ${at}`;
  }

  return (
    <WhatToWear
      loaded={load.loaded}
      status={load.status}
      advice={advice}
      location={load.bundle?.location ?? ""}
      units={settings.units}
      footer={footer}
    />
  );
}

const whatToWearWidget: RootboardWidget = {
  mount(container: HTMLElement, host: WidgetHost): WidgetInstance {
    const root: Root = createRoot(container);
    const bridge: Bridge = { visible: false, notifyVisible: null, refresh: null };
    root.render(<WhatToWearApp host={host} bridge={bridge} />);
    return {
      unmount() {
        root.unmount();
      },
      async refresh() {
        await bridge.refresh?.();
      },
      onVisibilityChange(visible: boolean) {
        bridge.visible = visible;
        bridge.notifyVisible?.(visible);
      },
    };
  },
};

export default whatToWearWidget;
