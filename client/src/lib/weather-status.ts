import { formatAsOf } from "@/widgets/what-to-wear/time-windows";

/** GET /api/weather/status (server/services/weatherService.ts). Covers the
 *  server's own Open-Meteo fetch — the calendar weather and What to Wear
 *  with a blank zip — not What to Wear's zip-code path, which the browser
 *  fetches directly. */
export interface WeatherStatus {
  configured: boolean;
  lastSuccessAt: string | null;
  lastError: { at: string; reason: string } | null;
}

export interface WeatherStatusView {
  /** The most recent fetch failed (no success since that error). */
  failing: boolean;
  lastUpdate: string;
  /** "" when there has been no error since the app started. */
  lastError: string;
}

/** Status → the lines Settings → System shows; null when weather isn't set up. */
export function describeWeatherStatus(status: WeatherStatus | undefined, now: Date): WeatherStatusView | null {
  if (!status?.configured) return null;
  const { lastSuccessAt, lastError } = status;
  const failing = lastError !== null && (lastSuccessAt === null || new Date(lastError.at) > new Date(lastSuccessAt));
  return {
    failing,
    lastUpdate: lastSuccessAt ? formatAsOf(lastSuccessAt, now) : "not yet, since the app started",
    lastError: lastError ? `${formatAsOf(lastError.at, now)} — ${lastError.reason}` : "",
  };
}
