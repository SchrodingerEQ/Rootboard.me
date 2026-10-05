import { describe, expect, test } from "vitest";
import type { ForecastBundle, HourPoint, ResolvedSettings } from "./types";
import { bandFor, buildAdvice } from "./advice";

// 2030-03-12 is a Tuesday. `now` is 07:00 local → "Today" is selected.
const DAY = "2030-03-12";
const NOW = new Date(2030, 2, 12, 7, 0);
const SETTINGS: ResolvedSettings = { zipCode: "", units: "celsius", schoolStartMin: 8 * 60, schoolEndMin: 15 * 60 };

function hour(time: string, over: Partial<HourPoint> = {}): HourPoint {
  return { time, tempC: 15, feelsLikeC: 15, precipChance: 0, precipMm: 0, snowCm: 0, code: 0, windKmh: 10, uv: 2, ...over };
}
/** 24 hours of `dateKey`; `over(h)` customises each hour. */
function bundle(over: (h: number) => Partial<HourPoint> = () => ({})): ForecastBundle {
  const hours = Array.from({ length: 24 }, (_, h) => hour(`${DAY}T${String(h).padStart(2, "0")}:00`, over(h)));
  return { location: "Testville", fetchedAt: NOW.toISOString(), hours };
}
const ids = (items: { id: string }[]) => items.map((i) => i.id);

describe("bandFor", () => {
  test("band edges follow brief §6.1", () => {
    expect(bandFor(24)).toBe("hot");
    expect(bandFor(23.9)).toBe("warm");
    expect(bandFor(18)).toBe("warm");
    expect(bandFor(17.9)).toBe("cool");
    expect(bandFor(12)).toBe("cool");
    expect(bandFor(11.9)).toBe("chilly");
    expect(bandFor(5)).toBe("chilly");
    expect(bandFor(4.9)).toBe("cold");
    expect(bandFor(-5)).toBe("cold");
    expect(bandFor(-5.1)).toBe("freezing");
  });
});

describe("buildAdvice — founder scenarios (brief §8)", () => {
  test("1: cool morning, hot afternoon → shorts + T-shirt + hoodie; take the hoodie off", () => {
    const a = buildAdvice(bundle((h) => ({ feelsLikeC: h <= 10 ? 13 : h >= 13 ? 24 : 18, tempC: h <= 10 ? 13 : 24 })), SETTINGS, NOW)!;
    expect(a.dayLabel).toBe("Today");
    expect(a.weekday).toBe("Tuesday");
    expect(a.windows.map((w) => w.band)).toEqual(["cool", "hot", "hot"]);
    expect(ids(a.wear)).toEqual(expect.arrayContaining(["tshirt", "shorts", "sneakers", "hoodie"]));
    expect(ids(a.wear)).not.toContain("pants");
    expect(a.afternoonNotes).toEqual(["Take off your hoodie when it warms up ☀️"]);
    // Rule 6.6: a hot afternoon always adds a water bottle; nothing else extra.
    expect(ids(a.backpack)).toEqual(["waterBottle"]);
  });

  test("2: dry morning, 65% rain at 15:00 → raincoat packed, afternoon says put it on", () => {
    const a = buildAdvice(bundle((h) => ({ feelsLikeC: 20, precipChance: h >= 14 && h <= 16 ? 65 : 0, code: h >= 14 ? 61 : 2 })), SETTINGS, NOW)!;
    expect(ids(a.wear)).not.toContain("raincoat");
    expect(ids(a.backpack)).toContain("raincoat");
    expect(ids(a.backpack)).not.toContain("umbrella");
    expect(a.afternoonNotes).toContain("Put your raincoat on before you go outside 🌧️");
    expect(a.windows[0].chips).toEqual([]);
    expect(a.windows[1].chips).toContain("💧 65% rain");
  });

  test("3: 80% rain at 08:00 → raincoat worn; umbrella packed, rain boots worn", () => {
    const a = buildAdvice(bundle((h) => ({ feelsLikeC: 14, precipChance: h >= 7 && h <= 9 ? 80 : 10, code: h <= 9 ? 63 : 3 })), SETTINGS, NOW)!;
    expect(ids(a.wear)).toContain("raincoat");
    expect(ids(a.wear)).toContain("rainBoots");
    expect(ids(a.backpack)).toContain("umbrella");
    expect(ids(a.backpack)).not.toContain("raincoat");
    expect(a.windows[0].chips).toContain("💧 80% rain");
  });

  test("4: −8 °C with 3 cm of snow → freezing band, boots, gloves, hat, snow pants", () => {
    const a = buildAdvice(bundle((h) => ({ feelsLikeC: -8, tempC: -6, snowCm: h >= 8 && h <= 13 ? 0.5 : 0, code: 73 })), SETTINGS, NOW)!;
    expect(a.windows[0].band).toBe("freezing");
    expect(ids(a.wear)).toEqual(expect.arrayContaining(["heavyCoat", "boots", "gloves", "warmHat", "snowPants", "pants"]));
    expect(ids(a.wear)).not.toContain("shorts");
    expect(ids(a.wear)).not.toContain("sneakers");
    expect(a.headline).toContain("Snowy");
  });
});

describe("buildAdvice — other rules", () => {
  test("afternoon colder by a band: dress for morning, pack the afternoon layer", () => {
    const a = buildAdvice(bundle((h) => ({ feelsLikeC: h < 12 ? 20 : 14 })), SETTINGS, NOW)!;
    expect(ids(a.wear)).toEqual(expect.arrayContaining(["tshirt", "shorts"]));
    expect(ids(a.backpack)).toContain("hoodie");
    expect(a.afternoonNotes).toContain("Put on your hoodie when it gets cooler 🧥");
  });

  test("same band both windows → 'Same as this morning 👍'", () => {
    const a = buildAdvice(bundle(() => ({ feelsLikeC: 20 })), SETTINGS, NOW)!;
    expect(a.afternoonNotes).toEqual(["Same as this morning 👍"]);
  });

  test("never shorts when the morning is cold, even if the afternoon is warm", () => {
    const a = buildAdvice(bundle((h) => ({ feelsLikeC: h < 12 ? 0 : 20 })), SETTINGS, NOW)!;
    expect(ids(a.wear)).not.toContain("shorts");
    expect(ids(a.wear)).toContain("pants");
    expect(ids(a.wear)).toContain("winterCoat");
  });

  test("thunderstorm in the school day → gentle storm headline", () => {
    const a = buildAdvice(bundle((h) => ({ code: h === 13 ? 95 : 3, precipChance: h === 13 ? 50 : 0 })), SETTINGS, NOW)!;
    expect(a.headline).toBe("Storms today — stay cozy inside 🌩️");
  });

  test("wind ≥ 30 adds a windbreaker when there is no jacket and chips the windy windows; ≥ 45 changes the headline", () => {
    const a = buildAdvice(bundle((h) => ({ feelsLikeC: 20, windKmh: h >= 13 && h <= 16 ? 35 : 5 })), SETTINGS, NOW)!;
    expect(ids(a.wear)).toContain("windbreaker");
    expect(a.windows[0].chips).not.toContain("💨 windy");
    expect(a.windows[1].chips).toContain("💨 windy");
    const b = buildAdvice(bundle(() => ({ feelsLikeC: 20, windKmh: 50 })), SETTINGS, NOW)!;
    expect(b.headline).toBe("Super windy — hold onto your hat! 💨");
  });

  test("wind ≥ 30 does not add a windbreaker when the band already has a jacket", () => {
    const a = buildAdvice(bundle(() => ({ feelsLikeC: 8, windKmh: 35 })), SETTINGS, NOW)!;
    expect(ids(a.wear)).toContain("jacket");
    expect(ids(a.wear)).not.toContain("windbreaker");
  });

  test("UV ≥ 6 packs sunscreen, sun hat, water bottle and chips the sunniest window", () => {
    const a = buildAdvice(bundle((h) => ({ feelsLikeC: 20, uv: h >= 12 && h <= 15 ? 7 : 2 })), SETTINGS, NOW)!;
    expect(ids(a.backpack)).toEqual(expect.arrayContaining(["sunscreen", "sunHat", "waterBottle"]));
    expect(a.windows[1].chips).toContain("☀️ strong sun");
    expect(a.windows[0].chips).not.toContain("☀️ strong sun");
  });

  test("UV 3–5 with a sunny afternoon packs sunscreen only", () => {
    const a = buildAdvice(bundle(() => ({ feelsLikeC: 20, uv: 4, code: 0 })), SETTINGS, NOW)!;
    expect(ids(a.backpack)).toEqual(["sunscreen"]);
    const cloudy = buildAdvice(bundle(() => ({ feelsLikeC: 20, uv: 4, code: 3 })), SETTINGS, NOW)!;
    expect(ids(cloudy.backpack)).toEqual([]);
  });

  test("window summaries carry titles, times, temps, and phrases", () => {
    const a = buildAdvice(bundle(() => ({ feelsLikeC: 20, tempC: 21 })), SETTINGS, NOW)!;
    expect(a.windows.map((w) => w.title)).toEqual(["Morning", "Afternoon", "Evening"]);
    expect(a.windows.map((w) => w.timeLabel)).toEqual(["8:00 AM", "3:00 PM", "6:00 PM"]);
    expect(a.windows[0].tempC).toBe(21);
    expect(a.windows[0].phrase).toBe("Nice and warm");
    expect(a.windows[0].emoji).toBe("☀️");
    expect(a.headline).toBe("Sunny and nice and warm ☀️");
  });

  test("returns null when the bundle has no hours for the selected day", () => {
    const b = bundle();
    expect(buildAdvice(b, SETTINGS, new Date(2030, 2, 12, 16, 0))).toBeNull(); // tomorrow not in fixture
  });
});
