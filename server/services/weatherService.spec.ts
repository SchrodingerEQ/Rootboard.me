import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { buildAdvice } from "../../client/src/widgets/what-to-wear/advice";
import { emptyStoredState, fetchForecast } from "../../client/src/widgets/what-to-wear/forecast";
import { resolveSettings } from "../../client/src/widgets/what-to-wear/settings";
import { formatAsOf } from "../../client/src/widgets/what-to-wear/time-windows";

/** A minimal Open-Meteo response covering 7 local days from `startDay`. */
function openMeteoJson(startDay: string) {
  const pad = (n: number) => String(n).padStart(2, "0");
  const start = new Date(`${startDay}T00:00:00`);
  const time = Array.from({ length: 7 * 24 }, (_, i) => {
    const d = new Date(start.getTime());
    d.setHours(d.getHours() + i);
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:00`;
  });
  const fill = (v: number) => time.map(() => v);
  return {
    current: { temperature_2m: 10, weather_code: 1 },
    daily: { time: [startDay], weather_code: [1], temperature_2m_max: [15], temperature_2m_min: [5] },
    hourly: {
      time,
      temperature_2m: fill(10),
      apparent_temperature: fill(9),
      precipitation_probability: fill(0),
      precipitation: fill(0),
      snowfall: fill(0),
      weather_code: fill(1),
      wind_speed_10m: fill(5),
      uv_index: fill(2),
    },
  };
}

/** Upstream answers once, then is unreachable. */
function stubUpstreamThenOutage() {
  let calls = 0;
  vi.stubGlobal("fetch", async () => {
    calls++;
    if (calls === 1) return new Response(JSON.stringify(openMeteoJson("2030-03-10")), { status: 200 });
    throw new Error("fetch failed");
  });
}

async function loadService() {
  vi.resetModules(); // the service caches at module level
  return import("./weatherService");
}

beforeEach(() => {
  vi.stubEnv("WEATHER_ENABLED", "true");
  vi.stubEnv("WEATHER_LAT", "0");
  vi.stubEnv("WEATHER_LON", "0");
  vi.stubEnv("WEATHER_UNITS", "celsius");
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date(2030, 2, 10, 6, 29));
  vi.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe("getWeather stale flag", () => {
  test("a fresh forecast carries no stale flag", async () => {
    stubUpstreamThenOutage();
    const { getWeather } = await loadService();
    const w = await getWeather();
    expect(w.enabled).toBe(true);
    expect("stale" in w).toBe(false);
  });

  test("after the cache expires and upstream fails, the last good forecast is served flagged stale", async () => {
    stubUpstreamThenOutage();
    const { getWeather } = await loadService();
    const first = await getWeather();
    vi.setSystemTime(new Date(2030, 2, 11, 16, 0));
    const second = await getWeather();
    expect(second).toMatchObject({ enabled: true, stale: true });
    expect(second.enabled && second.updatedAt).toBe(first.enabled && first.updatedAt);
  });
});

// Regression for the kiosk showing "Can't reach the weather right now" under
// a footer of "Weather as of 6:29 AM · Open-Meteo": the server re-served a
// days-old forecast that the widget took for fresh.
describe("What to Wear on a long upstream outage", () => {
  test("reports the forecast as from earlier, with its day, once it no longer covers the day shown", async () => {
    stubUpstreamThenOutage();
    const { getWeather } = await loadService();
    await getWeather(); // Sun 06:29, good

    const now = new Date(2030, 2, 11, 16, 0); // Mon after school → shows Tuesday
    vi.setSystemTime(now);
    const served = await getWeather();
    const hostFetch = (async () => new Response(JSON.stringify(served), { status: 200 })) as unknown as typeof fetch;

    const settings = resolveSettings({});
    const r = await fetchForecast(hostFetch, settings, emptyStoredState(), now);
    expect(r.status).toBe("unreachable"); // footer: "Weather from earlier — as of …"
    expect(r.bundle).not.toBeNull();
    expect(buildAdvice(r.bundle!, settings, now)).toBeNull(); // → "The weather is out of date"
    expect(formatAsOf(r.bundle!.fetchedAt, now)).toBe("Sun 6:29 AM");
  });
});
