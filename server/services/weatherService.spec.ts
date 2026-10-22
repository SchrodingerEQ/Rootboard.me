import fs from "fs";
import os from "os";
import path from "path";
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

// Every test gets its own cwd so data/weather-cache.json lands in a temp
// dir, never in the checkout.
let dir = "";
const cacheFile = () => path.join(dir, "data", "weather-cache.json");

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
  dir = fs.mkdtempSync(path.join(os.tmpdir(), "rb-weather-"));
  vi.spyOn(process, "cwd").mockReturnValue(dir);
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
  fs.rmSync(dir, { recursive: true, force: true });
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

describe("describeFetchError", () => {
  test.each([
    [Object.assign(new Error("aborted"), { name: "AbortError" }), "Timed out — Open-Meteo didn't answer in 20 seconds"],
    [new TypeError("fetch failed", { cause: { code: "ENOTFOUND" } }), "Couldn't look up api.open-meteo.com — no internet, or a DNS problem (ENOTFOUND)"],
    [new TypeError("fetch failed", { cause: { code: "UND_ERR_CONNECT_TIMEOUT" } }), "Timed out — Open-Meteo didn't answer in 20 seconds (UND_ERR_CONNECT_TIMEOUT)"],
    [new TypeError("fetch failed", { cause: { errors: [{ code: "ENETUNREACH" }] } }), "Couldn't connect to Open-Meteo — network problem (ENETUNREACH)"],
    [new TypeError("fetch failed", { cause: { code: "CERT_NOT_YET_VALID" } }), "Secure connection failed — check the kiosk's date and time (CERT_NOT_YET_VALID)"],
    [new SyntaxError("Unexpected token <"), "Open-Meteo sent an unexpected response"],
    [new TypeError("fetch failed"), "Network error"],
  ])("%s", async (err, expected) => {
    const { describeFetchError } = await loadService();
    expect(describeFetchError(err)).toBe(expected);
  });

  test("never echoes the error message, which could carry the request URL", async () => {
    const { describeFetchError } = await loadService();
    const reason = describeFetchError(new Error("GET https://api.open-meteo.com/v1/forecast?latitude=12.34 failed", { cause: { code: "lat=12.34" } }));
    expect(reason).toBe("Network error");
  });
});

describe("getWeatherStatus", () => {
  test("not configured", async () => {
    vi.stubEnv("WEATHER_ENABLED", "false");
    const { getWeatherStatus } = await loadService();
    expect(getWeatherStatus()).toEqual({ configured: false, lastSuccessAt: null, lastError: null });
  });

  test("records the last success, then the failure reason", async () => {
    let calls = 0;
    vi.stubGlobal("fetch", async () => {
      calls++;
      if (calls === 1) return new Response(JSON.stringify(openMeteoJson("2030-03-10")), { status: 200 });
      throw new TypeError("fetch failed", { cause: { code: "EAI_AGAIN" } });
    });
    const { getWeather, getWeatherStatus } = await loadService();
    const first = await getWeather();
    expect(getWeatherStatus()).toMatchObject({ configured: true, lastError: null });
    expect(getWeatherStatus().lastSuccessAt).toBe(first.enabled && first.updatedAt);

    vi.setSystemTime(new Date(2030, 2, 11, 16, 0));
    await getWeather();
    expect(getWeatherStatus().lastError).toEqual({
      at: new Date(2030, 2, 11, 16, 0).toISOString(),
      reason: "Couldn't look up api.open-meteo.com — no internet, or a DNS problem (EAI_AGAIN)",
    });
  });

  test("an HTTP error names the status", async () => {
    vi.stubGlobal("fetch", async () => new Response("{}", { status: 429 }));
    const { getWeather, getWeatherStatus } = await loadService();
    await getWeather();
    expect(getWeatherStatus().lastError?.reason).toBe("Open-Meteo answered HTTP 429 (too many requests)");
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

// The kiosk's Wi-Fi drops packets in multi-second bursts; a 10 s budget was
// turning a single stall into a failed fetch (and, with 30-minute client
// polling, half an hour without weather).
describe("upstream timeout", () => {
  test("waits 20 seconds for Open-Meteo before giving up", async () => {
    vi.useFakeTimers({ toFake: ["Date", "setTimeout", "clearTimeout"] });
    vi.setSystemTime(new Date(2030, 2, 10, 6, 29));
    vi.stubGlobal(
      "fetch",
      (_url: string, init: { signal: AbortSignal }) =>
        new Promise((_resolve, reject) => {
          init.signal.addEventListener("abort", () => reject(Object.assign(new Error("aborted"), { name: "AbortError" })));
        }),
    );
    const { getWeather, getWeatherStatus } = await loadService();
    let settled = false;
    const pending = getWeather().then((w) => {
      settled = true;
      return w;
    });

    await vi.advanceTimersByTimeAsync(15_000);
    expect(settled).toBe(false); // 10 s used to be the cut-off

    await vi.advanceTimersByTimeAsync(5_000);
    expect(settled).toBe(true);
    expect(await pending).toEqual({ enabled: false, configured: true });
    expect(getWeatherStatus().lastError?.reason).toBe("Timed out — Open-Meteo didn't answer in 20 seconds");
  });
});

// The kiosk is rebooted to clear Wi-Fi trouble, and the in-memory cache
// went with it: the first fetch after boot failing meant a blank header
// and "Can't reach the weather" with nothing to fall back on. The last
// good forecast now survives under data/ (preserved across updates).
describe("persisted last good forecast", () => {
  test("a good forecast is written to data/weather-cache.json", async () => {
    stubUpstreamThenOutage();
    const { getWeather } = await loadService();
    const w = await getWeather();
    expect(JSON.parse(fs.readFileSync(cacheFile(), "utf8"))).toEqual(w);
  });

  test("after a restart with the upstream down, the persisted forecast is served flagged stale", async () => {
    stubUpstreamThenOutage();
    const first = await (await loadService()).getWeather();
    const { getWeather, getWeatherStatus } = await loadService(); // "restart"; the stub is now in outage mode
    const w = await getWeather();
    expect(w).toMatchObject({ enabled: true, stale: true });
    expect(w.enabled && w.updatedAt).toBe(first.enabled && first.updatedAt);
    expect(getWeatherStatus().lastSuccessAt).toBe(first.enabled && first.updatedAt);
  });

  test("after a restart the upstream is asked before the persisted forecast is trusted", async () => {
    vi.stubGlobal("fetch", async () => new Response(JSON.stringify(openMeteoJson("2030-03-10")), { status: 200 }));
    const first = await (await loadService()).getWeather();
    vi.setSystemTime(new Date(2030, 2, 10, 6, 30));
    const w = await (await loadService()).getWeather();
    expect(w.enabled && w.updatedAt).toBe(new Date(2030, 2, 10, 6, 30).toISOString());
    expect(w.enabled && w.updatedAt).not.toBe(first.enabled && first.updatedAt);
    expect("stale" in w).toBe(false);
  });

  test("a corrupt or foreign cache file is ignored", async () => {
    fs.mkdirSync(path.dirname(cacheFile()), { recursive: true });
    fs.writeFileSync(cacheFile(), "{not json");
    vi.stubGlobal("fetch", async () => {
      throw new Error("fetch failed");
    });
    expect(await (await loadService()).getWeather()).toEqual({ enabled: false, configured: true });

    fs.writeFileSync(cacheFile(), JSON.stringify({ enabled: true, current: null }));
    expect(await (await loadService()).getWeather()).toEqual({ enabled: false, configured: true });
  });
});

// Review findings on the persistence change (2026-10-21).
describe("persistence under concurrent requests and config changes", () => {
  test("requests that share one upstream fetch write the cache file once", async () => {
    vi.stubGlobal("fetch", async () => new Response(JSON.stringify(openMeteoJson("2030-03-10")), { status: 200 }));
    const renames = vi.spyOn(fs.promises, "rename");
    const { getWeather } = await loadService();
    const [a, b] = await Promise.all([getWeather(), getWeather()]);
    expect(a).toEqual(b);
    expect(renames).toHaveBeenCalledTimes(1);
    expect(console.error).not.toHaveBeenCalled();
  });

  test("a persisted forecast for a different units/location config is not served after a restart", async () => {
    stubUpstreamThenOutage();
    await (await loadService()).getWeather(); // celsius, label "" → persisted
    vi.stubEnv("WEATHER_UNITS", "fahrenheit");
    const { getWeather, getWeatherStatus } = await loadService();
    expect(await getWeather()).toEqual({ enabled: false, configured: true });
    expect(getWeatherStatus().lastSuccessAt).toBeNull();
  });
});
