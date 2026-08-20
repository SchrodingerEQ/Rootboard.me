import { WIDGET_API_VERSION, widgetManifestSchema, type WidgetManifest } from "@shared/widget-manifest";

/**
 * Validates a built-in widget's manifest through the same Zod schema used
 * for sideloaded community widgets (CONTRACT.md §6: "same contract,
 * different transport"), plus the apiVersion gate that schema alone can't
 * express relative to this host build. Throws with a clear message on
 * failure — a bad built-in manifest is a build-time bug, not something to
 * degrade gracefully around, so it must fail fast in dev.
 *
 * Lives in its own module (not registry.ts) so widget entry modules can
 * import it without importing the registry — the registry imports every
 * widget module to build BUILTIN_WIDGETS, so a widget importing back from
 * registry.ts would create a registry↔widget import cycle.
 */
export function validateBuiltinManifest(raw: unknown): WidgetManifest {
  const manifest = widgetManifestSchema.parse(raw);
  if (manifest.apiVersion > WIDGET_API_VERSION) {
    throw new Error(
      `Built-in widget "${manifest.id}" targets apiVersion ${manifest.apiVersion}, but this host ` +
        `implements ${WIDGET_API_VERSION}. Built-ins must never target a newer contract version ` +
        `than the host they ship with.`,
    );
  }
  return manifest;
}
