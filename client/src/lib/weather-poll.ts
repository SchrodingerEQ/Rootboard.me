/**
 * How often the calendar header / week view re-ask `/api/weather`
 * (`hooks/use-weather.ts`). The server only contacts Open-Meteo when a
 * client asks after its 30-minute cache has expired, so the client cadence
 * is also the retry cadence: on the kiosk's lossy Wi-Fi a single failed
 * upstream attempt used to cost a full 30 minutes without weather. While
 * the last answer was a failure we poll faster; healthy or unconfigured
 * weather keeps the normal cadence so nothing is hammered.
 */

/** Shape of `/api/weather` as far as polling is concerned (2.5 in SPEC). */
export interface WeatherPollView {
  enabled: boolean;
  /** Present on `{ enabled: false }` when weather IS set up but the upstream
   *  fetch failed with a cold cache. */
  configured?: boolean;
  /** Present on an enabled payload when it is the last good forecast,
   *  re-served because the latest upstream fetch failed. */
  stale?: boolean;
}

export const WEATHER_POLL_MS = 30 * 60 * 1000;
/** Nothing to show (cold cache, request failed, or nothing loaded yet). */
export const WEATHER_RETRY_COLD_MS = 60 * 1000;
/** Something to show, but it is getting older. */
export const WEATHER_RETRY_STALE_MS = 5 * 60 * 1000;

export function weatherRefetchIntervalMs(data: WeatherPollView | undefined, errored: boolean): number {
  if (errored || !data) return WEATHER_RETRY_COLD_MS;
  if (!data.enabled) return data.configured === true ? WEATHER_RETRY_COLD_MS : WEATHER_POLL_MS;
  return data.stale === true ? WEATHER_RETRY_STALE_MS : WEATHER_POLL_MS;
}
