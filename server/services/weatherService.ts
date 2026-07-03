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

export interface WeatherPayload {
  enabled: true;
  current: WeatherCurrent;
  daily: WeatherDaily[];
  location: string;
  updatedAt: string;
}

export type WeatherResponse = WeatherPayload | { enabled: false };

const CACHE_TTL_MS = 30 * 60 * 1000; // 30 minutes
const FETCH_TIMEOUT_MS = 10 * 1000;

let cached: WeatherPayload | null = null;
let cachedAt = 0;
let inflight: Promise<WeatherPayload | null> | null = null;

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

async function fetchForecast(cfg: WeatherConfig): Promise<WeatherPayload | null> {
  const url =
    `https://api.open-meteo.com/v1/forecast` +
    `?latitude=${cfg.lat}&longitude=${cfg.lon}` +
    `&current=temperature_2m,weather_code` +
    `&daily=weather_code,temperature_2m_max,temperature_2m_min` +
    `&temperature_unit=${cfg.units}&timezone=auto&forecast_days=7`;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(url, { signal: controller.signal });
    if (!res.ok) {
      console.error(`Weather fetch failed: HTTP ${res.status}`);
      return null;
    }
    const data: any = await res.json();
    if (!data?.current || !data?.daily?.time) {
      console.error("Weather fetch returned unexpected shape");
      return null;
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
      location: cfg.label,
      updatedAt: new Date().toISOString(),
    };
  } catch (err) {
    console.error("Weather fetch error:", err instanceof Error ? err.message : err);
    return null;
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
    return result;
  }
  // Fetch failed: serve last-good (stale) if we have it, else report disabled
  // so the UI simply hides weather rather than showing an error.
  if (cached) return cached;
  return { enabled: false };
}
