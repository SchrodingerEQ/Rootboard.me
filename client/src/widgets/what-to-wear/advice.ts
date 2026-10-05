import type { Advice, Band, ForecastBundle, HourPoint, Item, ResolvedSettings, WindowKey, WindowSummary } from "./types";
import { EVENING_MIN } from "./settings";
import { formatTimeLabel, hoursInRange, pickHour, selectDay } from "./time-windows";
import {
  BAND_PHRASE,
  BASE_OUTFIT,
  COPY,
  ITEMS,
  LAYER_FOR_BAND,
  OUTER_LAYER_IDS,
  isSnowCode,
  weatherEmoji,
  weatherWord,
} from "./phrases";

/** Brief §6.1 — bands on feels-like Celsius. */
export function bandFor(feelsLikeC: number): Band {
  if (feelsLikeC >= 24) return "hot";
  if (feelsLikeC >= 18) return "warm";
  if (feelsLikeC >= 12) return "cool";
  if (feelsLikeC >= 5) return "chilly";
  if (feelsLikeC >= -5) return "cold";
  return "freezing";
}

/** Higher = colder. "At least one band warmer" ⇔ smaller COLDNESS. */
const COLDNESS: Record<Band, number> = { hot: 0, warm: 1, cool: 2, chilly: 3, cold: 4, freezing: 5 };

function addItem(list: Item[], item: Item): void {
  if (!list.some((i) => i.id === item.id)) list.push(item);
}
function removeItem(list: Item[], id: string): void {
  const idx = list.findIndex((i) => i.id === id);
  if (idx !== -1) list.splice(idx, 1);
}
function maxOf(hours: HourPoint[], pick: (h: HourPoint) => number): number {
  return hours.reduce((m, h) => Math.max(m, pick(h)), 0);
}
function lowerFirst(s: string): string {
  return s.charAt(0).toLowerCase() + s.slice(1);
}

interface Window {
  key: WindowKey;
  title: string;
  minutes: number;
  point: HourPoint;
  range: HourPoint[];
}

/**
 * The pure rules engine (brief §6). No DOM, no fetch, no Date.now() — `now`
 * is a parameter so day selection is testable. Returns null only when the
 * bundle has no hours for the selected day (e.g. stale cache); the UI then
 * shows the "can't reach the weather" panel.
 */
export function buildAdvice(bundle: ForecastBundle, settings: ResolvedSettings, now: Date): Advice | null {
  const day = selectDay(now, settings.schoolEndMin);
  const { schoolStartMin: start, schoolEndMin: end } = settings;
  const hours = bundle.hours;

  const morningPt = pickHour(hours, day.dateKey, start);
  const afternoonPt = pickHour(hours, day.dateKey, end);
  const eveningPt = pickHour(hours, day.dateKey, EVENING_MIN);
  if (!morningPt || !afternoonPt || !eveningPt) return null;

  const windows: Window[] = [
    { key: "morning", title: "Morning", minutes: start, point: morningPt, range: hoursInRange(hours, day.dateKey, start - 60, start + 120) },
    { key: "afternoon", title: "Afternoon", minutes: end, point: afternoonPt, range: hoursInRange(hours, day.dateKey, end - 60, end + 120) },
    { key: "evening", title: "Evening", minutes: EVENING_MIN, point: eveningPt, range: hoursInRange(hours, day.dateKey, EVENING_MIN - 60, EVENING_MIN + 120) },
  ];
  const [morning, afternoon] = windows;
  const schoolDay = hoursInRange(hours, day.dateKey, start, end);

  const mBand = bandFor(morningPt.feelsLikeC);
  const aBand = bandFor(afternoonPt.feelsLikeC);
  const wear: Item[] = [];
  const backpack: Item[] = [];
  const afternoonNotes: string[] = [];

  // --- 6.2 layering ------------------------------------------------------
  const mLayer = LAYER_FOR_BAND[mBand];
  const aLayer = LAYER_FOR_BAND[aBand];
  if (COLDNESS[aBand] < COLDNESS[mBand] && mLayer) {
    // Afternoon warmer: afternoon base + the morning's removable layer.
    for (const item of BASE_OUTFIT[aBand]) addItem(wear, item);
    addItem(wear, mLayer);
    // The morning layer replaces the afternoon's own outer layer (no coat + jacket).
    if (aLayer) removeItem(wear, aLayer.id);
    // A cold morning's accessories stay on even though the afternoon is warmer.
    for (const item of BASE_OUTFIT[mBand]) {
      if (item.id === ITEMS.warmHat.id || item.id === ITEMS.gloves.id || item.id === ITEMS.scarf.id) addItem(wear, item);
    }
    if (COLDNESS[mBand] >= COLDNESS.cold) {
      removeItem(wear, ITEMS.shorts.id);
      addItem(wear, ITEMS.pants);
    }
    afternoonNotes.push(COPY.takeOffLayer(mLayer.label));
  } else if (COLDNESS[aBand] > COLDNESS[mBand] && aLayer) {
    // Afternoon colder: dress for morning, pack the afternoon's layer.
    for (const item of BASE_OUTFIT[mBand]) addItem(wear, item);
    addItem(backpack, aLayer);
    afternoonNotes.push(COPY.putOnLayer(aLayer.label));
  } else {
    for (const item of BASE_OUTFIT[mBand]) addItem(wear, item);
  }

  // --- 6.3 rain ----------------------------------------------------------
  const mRain = maxOf(morning.range, (h) => h.precipChance);
  const aRain = maxOf(afternoon.range, (h) => h.precipChance);
  const dayRain = maxOf(schoolDay, (h) => h.precipChance);
  if (mRain >= 40) {
    addItem(wear, ITEMS.raincoat);
    if (aRain >= 40) afternoonNotes.push(COPY.keepRaincoat);
  } else if (aRain >= 40) {
    addItem(backpack, ITEMS.raincoat);
    afternoonNotes.push(COPY.raincoatOnLater);
  }
  if (dayRain >= 70) {
    removeItem(wear, ITEMS.sneakers.id);
    addItem(wear, ITEMS.rainBoots);
    addItem(backpack, ITEMS.umbrella);
  }
  const storm = schoolDay.some((h) => h.code >= 95);

  // --- 6.4 snow ----------------------------------------------------------
  const snowing = schoolDay.some((h) => h.snowCm > 0 || isSnowCode(h.code));
  const snowTotal = schoolDay.reduce((s, h) => s + h.snowCm, 0);
  if (snowing) {
    removeItem(wear, ITEMS.sneakers.id);
    removeItem(wear, ITEMS.rainBoots.id);
    addItem(wear, ITEMS.boots);
    addItem(wear, ITEMS.gloves);
    addItem(wear, ITEMS.warmHat);
  }
  if (snowTotal >= 2) addItem(wear, ITEMS.snowPants);

  // --- 6.5 wind ----------------------------------------------------------
  const dayWind = maxOf(schoolDay, (h) => h.windKmh);
  if (dayWind >= 30 && !wear.some((i) => OUTER_LAYER_IDS.has(i.id))) addItem(wear, ITEMS.windbreaker);

  // --- 6.6 sun / UV ------------------------------------------------------
  const dayUv = maxOf(schoolDay, (h) => h.uv);
  if (dayUv >= 6) {
    addItem(backpack, ITEMS.sunscreen);
    addItem(backpack, ITEMS.sunHat);
    addItem(backpack, ITEMS.waterBottle);
  } else if (dayUv >= 3 && afternoonPt.code <= 1) {
    addItem(backpack, ITEMS.sunscreen);
  }
  if (aBand === "hot") addItem(backpack, ITEMS.waterBottle);

  if (afternoonNotes.length === 0) afternoonNotes.push(COPY.sameAsMorning);

  // --- window cards ------------------------------------------------------
  let sunniest: WindowKey | null = null;
  if (dayUv >= 6) {
    let best = -1;
    for (const w of windows) {
      const uv = maxOf(w.range, (h) => h.uv);
      if (uv >= 6 && uv > best) {
        best = uv;
        sunniest = w.key;
      }
    }
  }
  const summaries: WindowSummary[] = windows.map((w) => {
    const chips: string[] = [];
    const rain = maxOf(w.range, (h) => h.precipChance);
    if (rain >= 40) chips.push(COPY.chipRain(Math.round(rain)));
    if (maxOf(w.range, (h) => h.windKmh) >= 30) chips.push(COPY.chipWindy);
    if (w.key === sunniest) chips.push(COPY.chipSun);
    const band = bandFor(w.point.feelsLikeC);
    return {
      key: w.key,
      title: w.title,
      timeLabel: formatTimeLabel(w.minutes),
      tempC: w.point.tempC,
      feelsLikeC: w.point.feelsLikeC,
      band,
      code: w.point.code,
      emoji: weatherEmoji(w.point.code),
      phrase: BAND_PHRASE[band],
      chips,
    };
  });

  // --- headline ----------------------------------------------------------
  let headline: string;
  if (storm) headline = COPY.stormHeadline(day.label === "Today" ? "today" : "tomorrow");
  else if (dayWind >= 45) headline = COPY.windHeadline;
  else headline = `${weatherWord(afternoonPt.code)} and ${lowerFirst(BAND_PHRASE[aBand])} ${weatherEmoji(afternoonPt.code)}`;

  return {
    dayLabel: day.label,
    weekday: day.weekday,
    dateKey: day.dateKey,
    headline,
    windows: summaries,
    wear,
    afternoonNotes,
    backpack,
  };
}
