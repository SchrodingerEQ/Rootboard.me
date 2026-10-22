/**
 * Retry schedule after an "unreachable" forecast result. The host drives a
 * refresh every 30 minutes (manifest `refresh.intervalSeconds`); on a lossy
 * link one failed attempt used to leave the panel on "Can't reach the
 * weather" for that whole half hour. Between host refreshes the widget
 * retries a bounded few times, spaced out, from its one-minute clock
 * (index.tsx) — so it only retries while visible, and never more than
 * three times per host cycle.
 */
export const RETRY_DELAYS_MS = [60_000, 2 * 60_000, 5 * 60_000];

/** Delay before the next retry after `consecutiveFailures` failures in a
 *  row (1 = the first failure), or null when the widget should stop and
 *  wait for the host's next refresh. */
export function retryDelayMs(consecutiveFailures: number): number | null {
  if (consecutiveFailures < 1) return null;
  return RETRY_DELAYS_MS[consecutiveFailures - 1] ?? null;
}
