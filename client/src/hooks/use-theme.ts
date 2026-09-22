import { useCallback, useEffect, useMemo } from "react";
import type { DashboardConfig } from "@shared/dashboard-config";
import type { ThemeManifest } from "@shared/theme-manifest";
import { BUILTIN_THEMES } from "@/themes";
import {
  DEFAULT_THEME_ID,
  applyTheme,
  loadBuiltinThemes,
  resolveTheme,
  type ThemeLoadFailure,
} from "@/lib/theme-engine";

export interface UseThemeResult {
  /** Every built-in theme that validated, in registry order. */
  themes: readonly ThemeManifest[];
  /** Built-ins that failed validation — shown in the settings menu "Theme Errors". */
  failed: readonly ThemeLoadFailure[];
  activeId: string;
  /** Persists the choice via the shell's dashboard-config writer; applies on the next render. */
  setTheme: (id: string) => void;
}

type WriteConfig = (
  buildNext: (current: DashboardConfig) => DashboardConfig | null,
  errorTitle: string,
) => unknown;

/**
 * Shell-side theme wiring. Resolution is derived from `config.theme`;
 * applying happens in an effect and is gated on `configLoaded` so the
 * boot cache (client/index.html) is not overwritten with Default while
 * the config request is still in flight — that would reintroduce the
 * flash the cache exists to prevent.
 */
export function useTheme(config: DashboardConfig, configLoaded: boolean, writeConfig: WriteConfig): UseThemeResult {
  const loaded = useMemo(() => loadBuiltinThemes(BUILTIN_THEMES), []);
  const active = useMemo(() => resolveTheme(config.theme, loaded.ok), [config.theme, loaded]);

  useEffect(() => {
    if (!configLoaded || !active) return;
    applyTheme(active);
  }, [active, configLoaded]);

  const setTheme = useCallback(
    (id: string) => {
      void writeConfig((current) => (current.theme === id ? null : { ...current, theme: id }), "Couldn't change theme");
    },
    [writeConfig],
  );

  return {
    themes: loaded.ok,
    failed: loaded.failed,
    activeId: active?.id ?? DEFAULT_THEME_ID,
    setTheme,
  };
}
