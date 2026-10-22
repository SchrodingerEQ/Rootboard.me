/**
 * Weather via Open-Meteo (https://open-meteo.com) — free, HTTPS, no API key,
 * so there is nothing secret to leak through this public repo or the
 * auto-update tarball.
 *
 * Config comes from .env (gitignored — coordinates are treated as PII and
 * never live in source):
 *   WEATHER_ENABLED=true
 *   WEATHER_LAT=…            decimal degrees
 *   WEATHER_LON=…
 *   WEATHER_UNITS=celsius    or fahrenheit
 *   WEATHER_LOCATION_LABEL=… optional display name for the header chip
 *
 * The kiosk is a 24/7 client, so responses are cached in memory for 30
 * minutes and the last good forecast is served if an upstream fetch fails.
 * Weather must never break the calendar: every failure path returns either
 * stale data or a disabled/empty payload — nothing throws into the route.
 */

export interface WeatherCurrent {
  temp: number;
  code: number;
  icon: string;
  label: string;
}

export interface WeatherDaily {
  date: string; // YYYY-MM-DD (local to the configured location)
  hi: number;
  lo: number;
  code: number;
  icon: string;
}

/** One forecast hour for the What to Wear widget (additive).
 *  `temp`/`feelsLike` follow WEATHER_UNITS; wind is km/h, precipitation mm,
 *  snowfall cm regardless. The widget normalises to Celsius client-side. */
export interface WeatherHourly {
  time: string; // ISO local time, "YYYY-MM-DDTHH:MM"
  temp: number;
  feelsLike: number;
  precipChance: number; // 0–100
  precipMm: number;
  snowCm: number;
  code: number;
  windKmh: number;
  uv: number;
}

export interface WeatherPayload {
  enabled: true;
  current: WeatherCurrent;
  daily: WeatherDaily[];
  /** Next 48 hours from the start of the current local day (additive). */
  hourly: WeatherHourly[];
  /** Unit of `current`, `daily`, and `hourly` temperatures (additive). */
  units: "celsius" | "fahrenheit";
  location: string;
  updatedAt: string;
  /** Present (additive) when this is the last good forecast re-served
   *  because the latest upstream fetch failed; `updatedAt` then says how
   *  old it is. Fresh responses omit it. */
  stale?: true;
}

/** `configured: true` on a disabled response means weather IS configured but
 *  the upstream fetch failed with a cold cache (an outage), as opposed to
 *  `{ enabled: false }` alone, which means weather is not configured. */
export type WeatherResponse = WeatherPayload | { enabled: false; configured?: true };

const CACHE_TTL_MS = 30 * 60 * 1000; // 30 minutes
const FETCH_TIMEOUT_MS = 20 * 1000; // the kiosk's Wi-Fi stalls for seconds at a time; 10 s lost real fetches
const HOURLY_FIELDS =
  "temperature_2m,apparent_temperature,precipitation_probability,precipitation,snowfall,weather_code,wind_speed_10m,uv_index";
const HOURLY_COUNT = 48;

let cached: WeatherPayload | null = null;
let cachedAt = 0;
let inflight: Promise<WeatherPayload | null> | null = null;

/** Upstream health for the Settings → System panel, so a family can read
 *  why the weather stopped updating off the touchscreen — no terminal.
 *  Kept in memory only (resets on restart); never leaves the kiosk. */
export interface WeatherStatus {
  configured: boolean;
  /** When the server last got a good forecast from Open-Meteo. */
  lastSuccessAt: string | null;
  /** The most recent failure; kept after a later success for context. */
  lastError: { at: string; reason: string } | null;
}

let lastSuccessAt: string | null = null;
let lastError: WeatherStatus["lastError"] = null;

const NETWORK_CODES = new Set(["ECONNREFUSED", "ECONNRESET", "ENETUNREACH", "EHOSTUNREACH", "EPIPE", "ENETDOWN"]);

/** A failed fetch → one plain-language sentence plus the error code. Only
 *  the code is taken from the error, never its message, so nothing from the
 *  request (the coordinates are in the URL) can reach the client. */
export function describeFetchError(err: unknown): string {
  const e = err as { name?: unknown; code?: unknown; cause?: { code?: unknown; errors?: Array<{ code?: unknown }> } } | null;
  const name = typeof e?.name === "string" ? e.name : "";
  const rawCode = e?.cause?.code ?? e?.cause?.errors?.[0]?.code ?? e?.code;
  const code = typeof rawCode === "string" && /^[A-Z0-9_]+$/.test(rawCode) ? rawCode : "";
  const tag = code ? ` (${code})` : "";

  if (name === "AbortError" || name === "TimeoutError" || code === "UND_ERR_CONNECT_TIMEOUT" || code === "ETIMEDOUT") {
    return `Timed out — Open-Meteo didn't answer in ${FETCH_TIMEOUT_MS / 1000} seconds${tag}`;
  }
  if (name === "SyntaxError") return "Open-Meteo sent an unexpected response";
  if (code === "ENOTFOUND" || code === "EAI_AGAIN") {
    return `Couldn't look up api.open-meteo.com — no internet, or a DNS problem${tag}`;
  }
  if (NETWORK_CODES.has(code)) return `Couldn't connect to Open-Meteo — network problem${tag}`;
  if (/CERT|TLS|SSL|UNABLE_TO_|SELF_SIGNED/.test(code)) {
    return `Secure connection failed — check the kiosk's date and time${tag}`;
  }
  return `Network error${tag}`;
}

function recordFailure(reason: string): null {
  console.error(`Weather fetch failed: ${reason}`);
  lastError = { at: new Date().toISOString(), reason };
  return null;
}

export function getWeatherStatus(): WeatherStatus {
  return { configured: getConfig() !== null, lastSuccessAt, lastError };
}

interface WeatherConfig {
  lat: number;
  lon: number;
  units: "celsius" | "fahrenheit";
  label: string;
}

function getConfig(): WeatherConfig | null {
  if (process.env.WEATHER_ENABLED !== "true") return null;
  const lat = Number(process.env.WEATHER_LAT);
  const lon = Number(process.env.WEATHER_LON);
  if (!isFinite(lat) || !isFinite(lon)) return null;
  const units = process.env.WEATHER_UNITS === "fahrenheit" ? "fahrenheit" : "celsius";
  const label = process.env.WEATHER_LOCATION_LABEL || "";
  return { lat, lon, units, label };
}

/** Map WMO weather codes to an icon name the client understands. */
function iconForCode(code: number): { icon: string; label: string } {
  if (code === 0) return { icon: "sun", label: "Sunny" };
  if (code === 1) return { icon: "sun", label: "Mostly sunny" };
  if (code === 2) return { icon: "cloud-sun", label: "Partly cloudy" };
  if (code === 3) return { icon: "cloud", label: "Cloudy" };
  if (code === 45 || code === 48) return { icon: "fog", label: "Fog" };
  if (code >= 51 && code <= 57) return { icon: "drizzle", label: "Drizzle" };
  if ((code >= 61 && code <= 67) || (code >= 80 && code <= 82)) return { icon: "rain", label: "Rain" };
  if ((code >= 71 && code <= 77) || code === 85 || code === 86) return { icon: "snow", label: "Snow" };
  if (code >= 95) return { icon: "storm", label: "Storm" };
  return { icon: "cloud", label: "Cloudy" };
}

function num(v: unknown): number {
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : 0;
}

/** Slice the hourly arrays to HOURLY_COUNT entries starting at the first
 *  hour of the current local day (Open-Meteo returns local times with
 *  timezone=auto; the kiosk runs in its location's timezone). Missing or
 *  malformed hourly data yields [] — never a throw. */
function buildHourly(raw: any, now: Date): WeatherHourly[] {
  if (!raw || !Array.isArray(raw.time)) return [];
  const pad = (n: number) => String(n).padStart(2, "0");
  const todayKey = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
  const out: WeatherHourly[] = [];
  for (let i = 0; i < raw.time.length && out.length < HOURLY_COUNT; i++) {
    const time = String(raw.time[i]);
    if (time.slice(0, 10) < todayKey) continue;
    out.push({
      time,
      temp: num(raw.temperature_2m?.[i]),
      feelsLike: num(raw.apparent_temperature?.[i]),
      precipChance: num(raw.precipitation_probability?.[i]),
      precipMm: num(raw.precipitation?.[i]),
      snowCm: num(raw.snowfall?.[i]),
      code: num(raw.weather_code?.[i]),
      windKmh: num(raw.wind_speed_10m?.[i]),
      uv: num(raw.uv_index?.[i]),
    });
  }
  return out;
}

async function fetchForecast(cfg: WeatherConfig): Promise<WeatherPayload | null> {
  const url =
    `https://api.open-meteo.com/v1/forecast` +
    `?latitude=${cfg.lat}&longitude=${cfg.lon}` +
    `&current=temperature_2m,weather_code` +
    `&daily=weather_code,temperature_2m_max,temperature_2m_min` +
    `&hourly=${HOURLY_FIELDS}` +
    `&temperature_unit=${cfg.units}&wind_speed_unit=kmh&precipitation_unit=mm&timezone=auto&forecast_days=7`;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(url, { signal: controller.signal });
    if (!res.ok) {
      const hint = res.status === 429 ? " (too many requests)" : res.status >= 500 ? " (a problem on Open-Meteo's side)" : "";
      return recordFailure(`Open-Meteo answered HTTP ${res.status}${hint}`);
    }
    const data: any = await res.json();
    if (!data?.current || !data?.daily?.time) {
      return recordFailure("Open-Meteo sent an unexpected response");
    }

    const currentCode = Number(data.current.weather_code ?? 0);
    const cur = iconForCode(currentCode);
    const daily: WeatherDaily[] = data.daily.time.map((date: string, i: number) => {
      const code = Number(data.daily.weather_code?.[i] ?? 0);
      return {
        date,
        hi: Math.round(data.daily.temperature_2m_max?.[i] ?? 0),
        lo: Math.round(data.daily.temperature_2m_min?.[i] ?? 0),
        code,
        icon: iconForCode(code).icon,
      };
    });

    return {
      enabled: true,
      current: {
        temp: Math.round(data.current.temperature_2m ?? 0),
        code: currentCode,
        icon: cur.icon,
        label: cur.label,
      },
      daily,
      hourly: buildHourly(data.hourly, new Date()),
      units: cfg.units,
      location: cfg.label,
      updatedAt: new Date().toISOString(),
    };
  } catch (err) {
    return recordFailure(describeFetchError(err));
  } finally {
    clearTimeout(timer);
  }
}

export async function getWeather(): Promise<WeatherResponse> {
  const cfg = getConfig();
  if (!cfg) return { enabled: false };

  const fresh = cached && Date.now() - cachedAt < CACHE_TTL_MS;
  if (cached && fresh) return cached;

  // Deduplicate concurrent refreshes (header + week view mount together).
  if (!inflight) {
    inflight = fetchForecast(cfg).finally(() => {
      inflight = null;
    });
  }
  const result = await inflight;

  if (result) {
    cached = result;
    cachedAt = Date.now();
    lastSuccessAt = result.updatedAt;
    return result;
  }
  // Fetch failed: serve last-good (stale) if we have it, flagged so
  // consumers can tell it from a fresh forecast — otherwise an outage that
  // lasts days looks current. With no cache, report disabled (UI simply
  // hides weather rather than showing an error) with `configured: true`
  // so consumers can tell an outage from "not set up".
  if (cached) return { ...cached, stale: true };
  return { enabled: false, configured: true };
}
