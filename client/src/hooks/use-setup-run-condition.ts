import { useCallback, useEffect, useRef, useState } from "react";
import type { DashboardConfig } from "@shared/dashboard-config";
import {
  BOOT_POLL_MS,
  bootNetworkDecision,
  needsFirstRun,
  type NetworkStatusLike,
  type SetupMode,
} from "@/lib/setup-wizard";

export type BootGate = "deciding" | "waiting-for-network" | "ready";

/**
 * The first-run wizard's run condition (brief 03, decision 1), decided once
 * per page load:
 *  - no `setup.completedAt` in dashboard.json → the full wizard;
 *  - otherwise, at boot only, no network after NetworkManager's grace
 *    period → the Network step alone.
 * Until it is decided the shell shows a splash instead of the widget host, so
 * no widget fetches on a dead network. A network drop later in the day never
 * opens the wizard.
 */
export function useSetupRunCondition(config: DashboardConfig | undefined, configSettled: boolean) {
  const [gate, setGate] = useState<BootGate>("deciding");
  const [bootMode, setBootMode] = useState<SetupMode | null>(null);
  const decided = useRef(false);
  // The uptime in the first status this page saw: a page loaded long after
  // the OS booted is not a boot.
  const firstUptime = useRef<number | null>(null);

  useEffect(() => {
    if (!configSettled || decided.current) return;

    if (config && needsFirstRun(config)) {
      decided.current = true;
      setBootMode("first-run");
      setGate("ready");
      return;
    }

    let cancelled = false;
    let timer: number | undefined;

    const check = async () => {
      let status: NetworkStatusLike | null = null;
      try {
        const res = await fetch("/api/system/network/status", { credentials: "include" });
        if (res.ok) status = (await res.json()) as NetworkStatusLike;
      } catch {
        status = null;
      }
      if (cancelled) return;
      if (status && firstUptime.current === null) firstUptime.current = status.uptimeSeconds;
      const decision = bootNetworkDecision(status, firstUptime.current);
      if (decision === "wait") {
        setGate("waiting-for-network");
        timer = window.setTimeout(() => void check(), BOOT_POLL_MS);
        return;
      }
      decided.current = true;
      if (decision === "offline") setBootMode("network-only");
      setGate("ready");
    };
    void check();

    return () => {
      cancelled = true;
      if (timer !== undefined) window.clearTimeout(timer);
    };
    // Decided once (the `decided` ref): a later config poll must not re-run
    // it, so `config` is read only on the render that settles.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [configSettled]);

  const clearBootMode = useCallback(() => setBootMode(null), []);
  return { gate, bootMode, clearBootMode };
}
