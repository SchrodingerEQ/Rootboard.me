import type { Band, Item } from "./types";

// ---------------------------------------------------------------------------
// Clothing and gear catalog. Ids are stable (the rules engine dedupes by id);
// emoji/labels are free to edit. Single-codepoint emoji only (SPEC §3.3).
// ---------------------------------------------------------------------------
export const ITEMS = {
  tshirt: { id: "tshirt", emoji: "👕", label: "T-shirt" },
  longSleeves: { id: "longSleeves", emoji: "👕", label: "Long sleeves" },
  shorts: { id: "shorts", emoji: "🩳", label: "Shorts" },
  pants: { id: "pants", emoji: "👖", label: "Long pants" },
  sneakers: { id: "sneakers", emoji: "👟", label: "Sneakers" },
  hoodie: { id: "hoodie", emoji: "🧥", label: "Hoodie" },
  jacket: { id: "jacket", emoji: "🧥", label: "Jacket" },
  winterCoat: { id: "winterCoat", emoji: "🧥", label: "Winter coat" },
  heavyCoat: { id: "heavyCoat", emoji: "🧥", label: "Heavy coat" },
  windbreaker: { id: "windbreaker", emoji: "🧥", label: "Windbreaker" },
  raincoat: { id: "raincoat", emoji: "🧥", label: "Raincoat" },
  warmHat: { id: "warmHat", emoji: "🧢", label: "Warm hat" },
  sunHat: { id: "sunHat", emoji: "🧢", label: "Sun hat" },
  gloves: { id: "gloves", emoji: "🧤", label: "Gloves" },
  scarf: { id: "scarf", emoji: "🧣", label: "Scarf" },
  boots: { id: "boots", emoji: "🥾", label: "Boots" },
  rainBoots: { id: "rainBoots", emoji: "🥾", label: "Rain boots" },
  snowPants: { id: "snowPants", emoji: "❄️", label: "Snow pants" },
  umbrella: { id: "umbrella", emoji: "☔", label: "Umbrella" },
  sunscreen: { id: "sunscreen", emoji: "🧴", label: "Sunscreen" },
  waterBottle: { id: "waterBottle", emoji: "💧", label: "Water bottle" },
} as const satisfies Record<string, Item>;

/** Brief §6.1 base outfits per feels-like band. */
export const BASE_OUTFIT: Record<Band, Item[]> = {
  hot: [ITEMS.tshirt, ITEMS.shorts, ITEMS.sneakers],
  warm: [ITEMS.tshirt, ITEMS.shorts, ITEMS.sneakers],
  cool: [ITEMS.tshirt, ITEMS.pants, ITEMS.hoodie, ITEMS.sneakers],
  chilly: [ITEMS.longSleeves, ITEMS.pants, ITEMS.jacket, ITEMS.sneakers],
  cold: [ITEMS.longSleeves, ITEMS.pants, ITEMS.winterCoat, ITEMS.warmHat, ITEMS.gloves],
  freezing: [ITEMS.longSleeves, ITEMS.pants, ITEMS.heavyCoat, ITEMS.scarf, ITEMS.warmHat, ITEMS.gloves],
};

/** The removable layer each band "calls for" (brief §6.2). Hot/warm: none. */
export const LAYER_FOR_BAND: Partial<Record<Band, Item>> = {
  cool: ITEMS.hoodie,
  chilly: ITEMS.jacket,
  cold: ITEMS.winterCoat,
  freezing: ITEMS.heavyCoat,
};

/** Items that count as "already has a jacket/coat" for the wind rule. */
export const OUTER_LAYER_IDS: ReadonlySet<string> = new Set([
  ITEMS.hoodie.id, ITEMS.jacket.id, ITEMS.winterCoat.id, ITEMS.heavyCoat.id, ITEMS.raincoat.id, ITEMS.windbreaker.id,
]);

// ---------------------------------------------------------------------------
// Weather phrases (brief §6.7)
// ---------------------------------------------------------------------------
export const BAND_PHRASE: Record<Band, string> = {
  hot: "Hot!",
  warm: "Nice and warm",
  cool: "A little cool",
  chilly: "Chilly",
  cold: "Cold — bundle up",
  freezing: "Freezing! Brrr",
};

export function isSnowCode(code: number): boolean {
  return (code >= 71 && code <= 77) || code === 85 || code === 86;
}

/** Short form for the headline sentence ("Sunny and nice and warm ☀️"). */
export function weatherWord(code: number): string {
  if (code <= 1) return "Sunny";
  if (code === 2) return "Partly sunny";
  if (code === 3) return "Cloudy";
  if (code === 45 || code === 48) return "Foggy";
  if (code >= 51 && code <= 57) return "Drizzly";
  if ((code >= 61 && code <= 67) || (code >= 80 && code <= 82)) return "Rainy";
  if (isSnowCode(code)) return "Snowy";
  if (code >= 95) return "Stormy";
  return "Cloudy";
}

export function weatherEmoji(code: number): string {
  if (code <= 1) return "☀️";
  if (code === 2) return "⛅";
  if (code === 3) return "☁️";
  if (code === 45 || code === 48) return "🌫️";
  if (code >= 51 && code <= 57) return "🌦️";
  if ((code >= 61 && code <= 67) || (code >= 80 && code <= 82)) return "🌧️";
  if (isSnowCode(code)) return "🌨️";
  if (code >= 95) return "⛈️";
  return "☁️";
}

// Sentences used by the rules engine. Kept here so copy edits never touch logic.
export const COPY = {
  sameAsMorning: "Same as this morning 👍",
  takeOffLayer: (label: string) => `Take off your ${label.toLowerCase()} when it warms up ☀️`,
  putOnLayer: (label: string) => `Put on your ${label.toLowerCase()} when it gets cooler 🧥`,
  raincoatOnLater: "Put your raincoat on before you go outside 🌧️",
  keepRaincoat: "Keep your raincoat on 🌧️",
  stormHeadline: (dayWord: string) => `Storms ${dayWord} — stay cozy inside 🌩️`,
  windHeadline: "Super windy — hold onto your hat! 💨",
  chipRain: (pct: number) => `💧 ${pct}% rain`,
  chipWindy: "💨 windy",
  chipSun: "☀️ strong sun",
} as const;
