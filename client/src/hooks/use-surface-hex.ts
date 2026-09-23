import { useSyncExternalStore } from "react";
import { getActiveThemeTokens, subscribeTheme } from "@/lib/theme-engine";

/**
 * The active theme's `--rb-surface` hex, live-updating on theme switch.
 * Used to pick surface-aware ink (see `eventTextColor`'s `surface` option)
 * for calendar chips, which draw straight to canvas/CSS instead of relying
 * on CSS custom properties for their text color.
 */
export function useSurfaceHex(): string | undefined {
  return useSyncExternalStore(subscribeTheme, () => getActiveThemeTokens()?.["--rb-surface"]);
}
