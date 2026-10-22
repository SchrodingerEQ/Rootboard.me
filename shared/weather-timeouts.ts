/**
 * Timeouts shared by the server's Open-Meteo fetch and the What to Wear
 * widget's browser fetch. The widget's host path is browser → /api/weather
 * → server → Open-Meteo, so the browser must wait longer than the server
 * does upstream — otherwise it abandons a request the server is about to
 * answer (the cache fills, nothing is shown, nothing is logged). Keeping
 * both numbers here keeps that relationship from drifting.
 */

/** How long the server waits for Open-Meteo. The kiosk's Wi-Fi can stall
 *  for seconds at a time; 10 s lost real fetches. */
export const WEATHER_UPSTREAM_TIMEOUT_MS = 20_000;

/** What to Wear's own fetch timeout, on both of its paths. */
export const WHAT_TO_WEAR_FETCH_TIMEOUT_MS = WEATHER_UPSTREAM_TIMEOUT_MS + 10_000;
