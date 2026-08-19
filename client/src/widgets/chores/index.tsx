import { useEffect } from "react";
import { createRoot, type Root } from "react-dom/client";
import { QueryClientProvider } from "@tanstack/react-query";
import { queryClient } from "@/lib/queryClient";
import ChoresPage from "@/pages/chores";
import { useChoresWithHost } from "@/hooks/use-chores";
import { validateBuiltinManifest } from "@/widgets/registry";
import type { RootboardWidget, WidgetHost, WidgetInstance } from "@/widgets/types";
import rawManifest from "./manifest.json";

/**
 * Chores as a contract widget (CONTRACT.md §3-§4) — the first built-in
 * ported off the hoisted-hook pattern. `useChoresWithHost` (client/src/
 * hooks/use-chores.ts) reads/writes the SAME legacy `chores` app_state key
 * as the pre-widget `useChores()`, via the host's storage alias
 * (client/src/lib/widget-host-services.ts LEGACY_KEY_ALIASES), so existing
 * kiosk data round-trips untouched.
 */
export const manifest = validateBuiltinManifest(rawManifest);

interface ChoresAppProps {
  host: WidgetHost;
}

function ChoresApp({ host }: ChoresAppProps) {
  const chores = useChoresWithHost(host);

  // Mirrors the pre-widget rail badge exactly: NavRail shows a badge iff
  // the count is truthy (0/null both hide it), independent of which
  // section is active. Previously fed by a hoisted useChores() at the
  // shell level; now pushed through the host on every openChoreCount
  // change, keep-alive mounting (WidgetHostMount) is what keeps this
  // effect (and therefore the badge) live while another section is shown.
  useEffect(() => {
    host.ui.setBadge(chores.openChoreCount);
  }, [host, chores.openChoreCount]);

  return <ChoresPage chores={chores} onSleep={() => host.ui.sleep()} />;
}

const choresWidget: RootboardWidget = {
  mount(container: HTMLElement, host: WidgetHost): WidgetInstance {
    const root: Root = createRoot(container);
    root.render(
      <QueryClientProvider client={queryClient}>
        <ChoresApp host={host} />
      </QueryClientProvider>,
    );

    return {
      unmount() {
        root.unmount();
      },
    };
  },
};

export default choresWidget;
