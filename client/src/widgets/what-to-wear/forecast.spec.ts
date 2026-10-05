import { describe, expect, test } from "vitest";
import type { ResolvedSettings } from "./types";
import {
  emptyStoredState,
  fetchForecast,
  normalizeHostWeather,
  normalizeOpenMeteo,
  normalizeStoredState,
  openMeteoUrl,
  zipLookupUrl,
} from "./forecast";

const NOW = new Date(2030, 2, 12, 7, 0);
const DAY = "2030-03-12";
const base: ResolvedSettings = { zipCode: "", units: "celsius", schoolStartMin: 480, schoolEndMin: 900 };

function openMeteoJson(dateKey = DAY, count = 24) {
  const time = Array.from({ length: count }, (_, i) => `${dateKey}T${String(i).padStart(2, "0")}:00`);
  const fill = (v: number) => time.map(() => v);
  return {
    hourly: {
      time,
      temperature_2m: fill(12),
      apparent_temperature: fill(10.5),
      precipitation_probability: fill(30),
      precipitation: fill(0.2),
      snowfall: fill(0),
      weather_code: fill(2),
      wind_speed_10m: fill(15),
      uv_index: fill(3),
    },
  };
}

/** A fetch stub keyed by URL prefix; records every URL it was asked for. */
function fakeFetch(routes: Record<string, () => Response>): typeof fetch & { calls: string[] } {
  const calls: string[] = [];
  const fn = (async (input: RequestInfo | URL) => {
    const url = String(input);
    calls.push(url);
    const key = Object.keys(routes).find((k) => url.startsWith(k));
    if (!key) throw new Error("network down");
    return routes[key]();
  }) as unknown as typeof fetch & { calls: string[] };
  fn.calls = calls;
  return fn;
}
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

describe("normalizeOpenMeteo", () => {
  test("maps hourly arrays to HourPoints", () => {
    const b = normalizeOpenMeteo(openMeteoJson(), "Testville", NOW.toISOString())!;
    expect(b.location).toBe("Testville");
    expect(b.hours).toHaveLength(24);
    expect(b.hours[8]).toEqual({ time: `${DAY}T08:00`, tempC: 12, feelsLikeC: 10.5, precipChance: 30, precipMm: 0.2, snowCm: 0, code: 2, windKmh: 15, uv: 3 });
  });
  test("nulls become 0 and bad shapes become null", () => {
    const data = openMeteoJson();
    (data.hourly.uv_index as unknown[])[0] = null;
    expect(normalizeOpenMeteo(data, "x", NOW.toISOString())!.hours[0].uv).toBe(0);
    expect(normalizeOpenMeteo({}, "x", NOW.toISOString())).toBeNull();
    expect(normalizeOpenMeteo(null, "x", NOW.toISOString())).toBeNull();
  });
});

describe("normalizeHostWeather", () => {
  const hourly = [{ time: `${DAY}T08:00`, temp: 50, feelsLike: 41, precipChance: 10, precipMm: 0, snowCm: 0, code: 0, windKmh: 5, uv: 1 }];
  test("converts Fahrenheit payloads to Celsius", () => {
    const b = normalizeHostWeather({ enabled: true, units: "fahrenheit", location: "Home", hourly, updatedAt: NOW.toISOString() }, NOW.toISOString())!;
    expect(b.location).toBe("Home");
    expect(b.hours[0].tempC).toBe(10);
    expect(b.hours[0].feelsLikeC).toBe(5);
  });
  test("keeps Celsius payloads and returns null for disabled or hourly-less payloads", () => {
    expect(normalizeHostWeather({ enabled: true, units: "celsius", location: "", hourly }, NOW.toISOString())!.hours[0].tempC).toBe(50);
    expect(normalizeHostWeather({ enabled: false }, NOW.toISOString())).toBeNull();
    expect(normalizeHostWeather({ enabled: true, current: {} }, NOW.toISOString())).toBeNull();
  });
});

describe("normalizeStoredState", () => {
  test("garbage degrades to the empty state", () => {
    expect(normalizeStoredState(null)).toEqual(emptyStoredState());
    expect(normalizeStoredState("nope")).toEqual(emptyStoredState());
    expect(normalizeStoredState({ v: 2 })).toEqual(emptyStoredState());
  });
  test("keeps well-formed coords and forecast", () => {
    const stored = { v: 1, zipCoords: { "00000": { lat: 1, lon: 2, label: "A, B" } }, forecast: { location: "A, B", fetchedAt: NOW.toISOString(), hours: [] } };
    expect(normalizeStoredState(stored)).toEqual(stored);
  });
});

describe("urls", () => {
  test("Open-Meteo URL requests Celsius/kmh/mm, hourly fields, 3 days", () => {
    const u = openMeteoUrl(1.5, -2.25);
    expect(u.startsWith("https://api.open-meteo.com/v1/forecast?")).toBe(true);
    expect(u).toContain("latitude=1.5");
    expect(u).toContain("longitude=-2.25");
    expect(u).toContain("hourly=temperature_2m,apparent_temperature,precipitation_probability,precipitation,snowfall,weather_code,wind_speed_10m,uv_index");
    expect(u).toContain("temperature_unit=celsius");
    expect(u).toContain("wind_speed_unit=kmh");
    expect(u).toContain("precipitation_unit=mm");
    expect(u).toContain("timezone=auto");
    expect(u).toContain("forecast_days=3");
  });
  test("zip lookup URL", () => {
    expect(zipLookupUrl("00000")).toBe("https://api.zippopotam.us/us/00000");
  });
});

describe("fetchForecast", () => {
  test("blank zip + host weather disabled → no-config, no outside calls", async () => {
    const f = fakeFetch({ "/api/weather": () => json({ enabled: false }) });
    const r = await fetchForecast(f, base, emptyStoredState(), NOW);
    expect(r.status).toBe("no-config");
    expect(r.bundle).toBeNull();
    expect(f.calls).toEqual(["/api/weather"]);
  });

  test("blank zip + host hourly → ok, bundle stored", async () => {
    const hourly = Array.from({ length: 24 }, (_, i) => ({ time: `${DAY}T${String(i).padStart(2, "0")}:00`, temp: 10, feelsLike: 9, precipChance: 0, precipMm: 0, snowCm: 0, code: 1, windKmh: 3, uv: 2 }));
    const f = fakeFetch({ "/api/weather": () => json({ enabled: true, units: "celsius", location: "Home", hourly }) });
    const r = await fetchForecast(f, base, emptyStoredState(), NOW);
    expect(r.status).toBe("ok");
    expect(r.bundle?.hours).toHaveLength(24);
    expect(r.state.forecast).toBe(r.bundle);
  });

  test("malformed zip → invalid-zip without any fetch", async () => {
    const f = fakeFetch({});
    const r = await fetchForecast(f, { ...base, zipCode: "1234" }, emptyStoredState(), NOW);
    expect(r.status).toBe("invalid-zip");
    expect(f.calls).toEqual([]);
  });

  test("zip lookup 404 → invalid-zip", async () => {
    const f = fakeFetch({ "https://api.zippopotam.us/us/00000": () => json({}, 404) });
    const r = await fetchForecast(f, { ...base, zipCode: "00000" }, emptyStoredState(), NOW);
    expect(r.status).toBe("invalid-zip");
  });

  test("valid zip → looks up once, caches coords, fetches Open-Meteo with them", async () => {
    const f = fakeFetch({
      "https://api.zippopotam.us/us/00000": () => json({ places: [{ "place name": "Testville", "state abbreviation": "TS", latitude: "1.5", longitude: "-2.25" }] }),
      "https://api.open-meteo.com/v1/forecast": () => json(openMeteoJson()),
    });
    const r1 = await fetchForecast(f, { ...base, zipCode: "00000" }, emptyStoredState(), NOW);
    expect(r1.status).toBe("ok");
    expect(r1.bundle?.location).toBe("Testville, TS");
    expect(r1.state.zipCoords["00000"]).toEqual({ lat: 1.5, lon: -2.25, label: "Testville, TS" });
    expect(f.calls.some((u) => u.includes("latitude=1.5&longitude=-2.25"))).toBe(true);

    const r2 = await fetchForecast(f, { ...base, zipCode: "00000" }, r1.state, NOW);
    expect(r2.status).toBe("ok");
    expect(f.calls.filter((u) => u.startsWith("https://api.zippopotam.us")).length).toBe(1);
  });

  test("Open-Meteo unreachable with a cached forecast → unreachable, cached bundle returned", async () => {
    const state = emptyStoredState();
    state.zipCoords["00000"] = { lat: 1, lon: 2, label: "Cached" };
    state.forecast = { location: "Cached", fetchedAt: NOW.toISOString(), hours: [] };
    const f = fakeFetch({});
    const r = await fetchForecast(f, { ...base, zipCode: "00000" }, state, NOW);
    expect(r.status).toBe("unreachable");
    expect(r.bundle).toBe(state.forecast);
  });

  test("Open-Meteo HTTP error with no cache → unreachable, null bundle", async () => {
    const state = emptyStoredState();
    state.zipCoords["00000"] = { lat: 1, lon: 2, label: "X" };
    const f = fakeFetch({ "https://api.open-meteo.com/v1/forecast": () => json({}, 500) });
    const r = await fetchForecast(f, { ...base, zipCode: "00000" }, state, NOW);
    expect(r.status).toBe("unreachable");
    expect(r.bundle).toBeNull();
  });
});
