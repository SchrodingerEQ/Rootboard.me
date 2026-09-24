/**
 * Power-saving overlay dimming rules (pure, unit-tested in
 * power-saving-dim.spec.ts).
 *
 * Power-saving can be entered two ways:
 * - idle timeout: useScreensaver already dims the whole page (<html>) to
 *   its dimBrightness (0.2), and the overlay sits inside that page;
 * - manual Sleep button: the page is left at the user's brightness.
 *
 * Before 2026-09-23 the overlay ALSO applied its own brightness(0.2) and the
 * logo sat at 40% opacity, so on the idle path the logo rendered at
 * ~rgb(1,2,3) — invisible. Now the overlay's content is dimmed exactly once,
 * to POWER_SAVING_DIM, whichever way power-saving was entered, and the logo
 * and wake hint are faint but visible on the black background.
 */

/** Keep equal to app-shell's useScreensaver `dimBrightness`. */
export const POWER_SAVING_DIM = 0.2;

/** Logo opacity inside the dimmed overlay (brightest pixels land ~43/255). */
export const POWER_SAVING_LOGO_OPACITY = 1;

/** Wake-hint opacity inside the dimmed overlay (white lands ~41/255). */
export const POWER_SAVING_HINT_OPACITY = 0.8;

/**
 * CSS `filter` for the overlay container. `pageDimmed` is true when the
 * idle timeout has already dimmed the whole page, so the overlay must not
 * dim a second time.
 */
export function powerSavingOverlayFilter(pageDimmed: boolean): string | undefined {
  return pageDimmed ? undefined : `brightness(${POWER_SAVING_DIM})`;
}
