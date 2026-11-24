import { useSyncExternalStore } from "react";
import appLogo from "@assets/image_1753142842256.png";
import { getActiveThemeLogo, subscribeTheme } from "@/lib/theme-engine";

/**
 * The logo to show in the nav rail and on the screensaver: the active
 * theme's `images.logo` when it declares one, otherwise the app's own.
 * Re-renders on every theme switch. Render it with `<img src>` only, never
 * inline SVG or innerHTML (the nav rail's icon rule, decision 0026).
 */
export function useThemeLogo(): string {
  const themeLogo = useSyncExternalStore(subscribeTheme, getActiveThemeLogo, getActiveThemeLogo);
  return themeLogo ?? appLogo;
}
