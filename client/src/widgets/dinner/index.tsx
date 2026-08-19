import { createRoot, type Root } from "react-dom/client";
import { QueryClientProvider } from "@tanstack/react-query";
import { queryClient } from "@/lib/queryClient";
import DinnerPage from "@/pages/dinner";
import { useDinnerWithHost } from "@/hooks/use-dinner";
import { validateBuiltinManifest } from "@/widgets/validate-manifest";
import type { RootboardWidget, WidgetHost, WidgetInstance } from "@/widgets/types";
import rawManifest from "./manifest.json";

/**
 * Dinner as a contract widget (CONTRACT.md §3-§4) — ported off the
 * hoisted-hook pattern the same way chores was (Task 6). `useDinnerWithHost`
 * (client/src/hooks/use-dinner.ts) reads/writes the SAME legacy `dinner`
 * app_state key as the pre-widget `useDinner()`, via the host's storage
 * alias (client/src/lib/widget-host-services.ts LEGACY_KEY_ALIASES), so
 * existing kiosk data round-trips untouched. Unlike chores, dinner has no
 * nav-rail badge.
 */
export const manifest = validateBuiltinManifest(rawManifest);

interface DinnerAppProps {
  host: WidgetHost;
}

function DinnerApp({ host }: DinnerAppProps) {
  const dinner = useDinnerWithHost(host);
  return <DinnerPage dinner={dinner} onSleep={() => host.ui.sleep()} />;
}

const dinnerWidget: RootboardWidget = {
  mount(container: HTMLElement, host: WidgetHost): WidgetInstance {
    const root: Root = createRoot(container);
    root.render(
      <QueryClientProvider client={queryClient}>
        <DinnerApp host={host} />
      </QueryClientProvider>,
    );

    return {
      unmount() {
        root.unmount();
      },
    };
  },
};

export default dinnerWidget;
