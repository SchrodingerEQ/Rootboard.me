import type { WeatherLocation } from "@shared/dashboard-config";

/** One place a postal code matched (GET /api/weather/lookup). */
export interface WeatherLookupCandidate {
  label: string;
  lat: number;
  lon: number;
}

/** Country the Weather row starts on: the region of the browser locale
 *  ("en-US" → "US"), else "US" (the lookup service's default country). */
export function defaultCountryCode(locale: string | undefined): string {
  const region = locale?.split(/[-_]/)[1];
  return region && /^[A-Za-z]{2}$/.test(region) ? region.toUpperCase() : "US";
}

/** Fahrenheit for the countries that use it day to day, Celsius elsewhere. */
export function defaultUnitsFor(countryCode: string): WeatherLocation["units"] {
  return ["US", "LR", "BS", "BZ", "KY", "PW", "FM", "MH"].includes(countryCode.toUpperCase()) ? "fahrenheit" : "celsius";
}

/** The `weather` value saved when a candidate is picked. */
export function locationFromCandidate(
  candidate: WeatherLookupCandidate,
  postalCode: string,
  countryCode: string,
  units: WeatherLocation["units"],
): WeatherLocation {
  return {
    postalCode: postalCode.trim(),
    countryCode: countryCode.trim().toUpperCase(),
    label: candidate.label,
    lat: candidate.lat,
    lon: candidate.lon,
    units,
  };
}

export function lookupPath(postalCode: string, countryCode: string): string {
  const q = new URLSearchParams({ postal: postalCode.trim(), country: countryCode.trim().toUpperCase() });
  return `/api/weather/lookup?${q.toString()}`;
}
