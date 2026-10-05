import type { ForecastBundle, HourPoint, ResolvedSettings } from "./types";
import { trimHours } from "./time-windows";
import { fToC } from "./units";

/**
 * Forecast acquisition for What to Wear (brief §4). Two paths produce the
 * same ForecastBundle:
 *   A. zip code set   → zippopotam.us (zip → lat/lon, cached per zip in
 *                       host.storage) then Open-Meteo hourly, via host.fetch
 *   B. zip blank      → the host's own /api/weather, which carries an
 *                       additive `hourly` array + `units` (server-side
 *                       coordinates never reach the client)
 * Exactly two outside hosts, both HTTPS and keyless. The zip code is
 * personal data: it is used only in the lookup URL and never logged.
 */

export type ForecastStatus = "ok" | "no-config" | "invalid-zip" | "unreachable";

export interface ZipCoords {
  lat: number;
  lon: number;
  label: string;
}

/** The host.storage blob. Well under the 64,000-char cap: ≤ 48 hours. */
export interface StoredState {
  v: 1;
  zipCoords: Record<string, ZipCoords>;
  forecast: ForecastBundle | null;
}

export interface FetchResult {
  status: ForecastStatus;
  bundle: ForecastBundle | null;
  state: StoredState;
}

export const OPEN_METEO_HOURLY =
  "temperature_2m,apparent_temperature,precipitation_probability,precipitation,snowfall,weather_code,wind_speed_10m,uv_index";

const FETCH_TIMEOUT_MS = 10_000;
const ZIP_RE = /^\d{5}$/;

export function emptyStoredState(): StoredState {
  return { v: 1, zipCoords: {}, forecast: null };
}

function num(v: unknown): number {
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : 0;
}

function isHourPoint(v: unknown): v is HourPoint {
  if (!v || typeof v !== "object") return false;
  const h = v as Record<string, unknown>;
  return typeof h.time === "string" && ["tempC", "feelsLikeC", "precipChance", "precipMm", "snowCm", "code", "windKmh", "uv"].every((k) => typeof h[k] === "number");
}

function isBundle(v: unknown): v is ForecastBundle {
  if (!v || typeof v !== "object") return false;
  const b = v as Record<string, unknown>;
  return typeof b.location === "string" && typeof b.fetchedAt === "string" && Array.isArray(b.hours) && b.hours.every(isHourPoint);
}

/** Defensively coerces whatever host.storage.get() returned. */
export function normalizeStoredState(raw: unknown): StoredState {
  if (!raw || typeof raw !== "object") return emptyStoredState();
  const r = raw as Record<string, unknown>;
  if (r.v !== 1) return emptyStoredState();
  const zipCoords: Record<string, ZipCoords> = {};
  if (r.zipCoords && typeof r.zipCoords === "object") {
    for (const [zip, c] of Object.entries(r.zipCoords as Record<string, unknown>)) {
      if (!ZIP_RE.test(zip) || !c || typeof c !== "object") continue;
      const cc = c as Record<string, unknown>;
      if (typeof cc.lat === "number" && typeof cc.lon === "number" && typeof cc.label === "string") {
        zipCoords[zip] = { lat: cc.lat, lon: cc.lon, label: cc.label };
      }
    }
  }
  return { v: 1, zipCoords, forecast: isBundle(r.forecast) ? r.forecast : null };
}

export function openMeteoUrl(lat: number, lon: number): string {
  return (
    `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}` +
    `&hourly=${OPEN_METEO_HOURLY}` +
    `&temperature_unit=celsius&wind_speed_unit=kmh&precipitation_unit=mm&timezone=auto&forecast_days=3`
  );
}

export function zipLookupUrl(zip: string): string {
  return `https://api.zippopotam.us/us/${zip}`;
}

/** Open-Meteo hourly JSON → bundle. Null on an unexpected shape. */
export function normalizeOpenMeteo(data: unknown, location: string, fetchedAt: string): ForecastBundle | null {
  const hourly = (data as { hourly?: Record<string, unknown> } | null)?.hourly;
  if (!hourly || !Array.isArray(hourly.time)) return null;
  const col = (key: string): unknown[] => (Array.isArray(hourly[key]) ? (hourly[key] as unknown[]) : []);
  const temp = col("temperature_2m");
  const feels = col("apparent_temperature");
  const pop = col("precipitation_probability");
  const precip = col("precipitation");
  const snow = col("snowfall");
  const code = col("weather_code");
  const wind = col("wind_speed_10m");
  const uv = col("uv_index");
  const hours: HourPoint[] = (hourly.time as unknown[]).map((t, i) => ({
    time: typeof t === "string" ? t : "",
    tempC: num(temp[i]),
    feelsLikeC: num(feels[i]),
    precipChance: num(pop[i]),
    precipMm: num(precip[i]),
    snowCm: num(snow[i]),
    code: num(code[i]),
    windKmh: num(wind[i]),
    uv: num(uv[i]),
  }));
  return { location, fetchedAt, hours };
}

/** /api/weather payload (server/services/weatherService.ts) → bundle, with
 *  temperatures normalised to Celsius. Null when weather is disabled or the
 *  server predates the `hourly` field. */
export function normalizeHostWeather(data: unknown, fetchedAt: string): ForecastBundle | null {
  const d = data as { enabled?: boolean; units?: string; location?: string; hourly?: unknown[]; updatedAt?: unknown } | null;
  if (!d || d.enabled !== true || !Array.isArray(d.hourly)) return null;
  const toC = d.units === "fahrenheit" ? fToC : (x: number) => x;
  const hours: HourPoint[] = d.hourly.map((raw) => {
    const h = (raw ?? {}) as Record<string, unknown>;
    return {
      time: String(h.time ?? ""),
      tempC: toC(num(h.temp)),
      feelsLikeC: toC(num(h.feelsLike)),
      precipChance: num(h.precipChance),
      precipMm: num(h.precipMm),
      snowCm: num(h.snowCm),
      code: num(h.code),
      windKmh: num(h.windKmh),
      uv: num(h.uv),
    };
  });
  // The footer shows when the DATA was fetched (server cache time), not when
  // this client last asked; fall back to the client's time if absent/invalid.
  const dataTime = typeof d.updatedAt === "string" && !Number.isNaN(new Date(d.updatedAt).getTime()) ? d.updatedAt : fetchedAt;
  return { location: typeof d.location === "string" ? d.location : "", fetchedAt: dataTime, hours };
}

/** Fetches and (when ok) parses JSON under one timeout that covers the body read. */
async function fetchJson(fetchFn: typeof fetch, url: string): Promise<{ status: number; ok: boolean; data: unknown }> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetchFn(url, { signal: controller.signal });
    const data: unknown = res.ok ? await res.json() : null;
    return { status: res.status, ok: res.ok, data };
  } finally {
    clearTimeout(timer);
  }
}

/** zippopotam.us lookup. "invalid" on 404; throws on network/other errors. */
export async function lookupZip(fetchFn: typeof fetch, zip: string): Promise<ZipCoords | "invalid"> {
  const res = await fetchJson(fetchFn, zipLookupUrl(zip));
  if (res.status === 404) return "invalid";
  if (!res.ok) throw new Error(`zip lookup HTTP ${res.status}`);
  const data = res.data as { places?: Array<Record<string, unknown>> } | null;
  const place = data?.places?.[0];
  const lat = Number(place?.latitude);
  const lon = Number(place?.longitude);
  if (!place || !Number.isFinite(lat) || !Number.isFinite(lon)) return "invalid";
  const name = typeof place["place name"] === "string" ? (place["place name"] as string) : "";
  const st = typeof place["state abbreviation"] === "string" ? (place["state abbreviation"] as string) : "";
  const label = [name, st].filter(Boolean).join(", ");
  return { lat, lon, label };
}

/**
 * Resolves the forecast for the current settings. Never throws; every
 * failure maps to a status, with the last good bundle from `state` returned
 * for "unreachable" so an outage still renders something (brief §3 error
 * states). On "ok" the returned `state` carries the trimmed bundle and any
 * newly learned zip coordinates — the caller persists it via host.storage.
 */
export async function fetchForecast(
  fetchFn: typeof fetch,
  settings: ResolvedSettings,
  state: StoredState,
  now: Date,
): Promise<FetchResult> {
  const fetchedAt = now.toISOString();
  const fail = (status: ForecastStatus): FetchResult => ({ status, bundle: status === "unreachable" ? state.forecast : null, state });
  const ok = (bundle: ForecastBundle, next: StoredState): FetchResult => {
    const trimmed = { ...bundle, hours: trimHours(bundle.hours, now) };
    return { status: "ok", bundle: trimmed, state: { ...next, forecast: trimmed } };
  };

  let next = state;
  try {
    if (settings.zipCode === "") {
      const res = await fetchJson(fetchFn, "/api/weather");
      if (!res.ok) return fail("unreachable");
      const data = res.data;
      const hostData = data as { enabled?: boolean; configured?: boolean } | null;
      if (hostData?.enabled !== true) return fail(hostData?.configured === true ? "unreachable" : "no-config");
      const bundle = normalizeHostWeather(data, fetchedAt);
      return bundle ? ok(bundle, state) : fail("unreachable");
    }

    if (!ZIP_RE.test(settings.zipCode)) return fail("invalid-zip");

    let coords = state.zipCoords[settings.zipCode];
    if (!coords) {
      const looked = await lookupZip(fetchFn, settings.zipCode);
      if (looked === "invalid") return fail("invalid-zip");
      coords = looked;
      next = { ...state, zipCoords: { [settings.zipCode]: coords } };
    }

    const res = await fetchJson(fetchFn, openMeteoUrl(coords.lat, coords.lon));
    if (!res.ok) return { ...fail("unreachable"), state: next };
    const bundle = normalizeOpenMeteo(res.data, coords.label, fetchedAt);
    return bundle ? ok(bundle, next) : { ...fail("unreachable"), state: next };
  } catch {
    return { ...fail("unreachable"), state: next };
  }
}
