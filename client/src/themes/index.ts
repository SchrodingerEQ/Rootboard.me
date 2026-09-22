import { defaultTheme } from "./default";

/**
 * Built-in theme manifests, RAW. Typed as unknown on purpose: validation
 * happens in client/src/lib/theme-engine.ts `loadBuiltinThemes`, so a
 * malformed module is reported in the settings menu ("Theme Errors")
 * instead of throwing at import time and taking the kiosk down.
 */
export const BUILTIN_THEMES: readonly unknown[] = [defaultTheme];
