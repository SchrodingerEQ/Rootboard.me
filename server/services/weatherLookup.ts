/**
 * Postal code → candidate places for Settings → System → Weather
 * (beta-launch brief 01). Uses zippopotam.us — the same keyless HTTPS
 * lookup the What to Wear widget already calls — but from the server, so
 * the kiosk UI never talks to a third host for this.
 *
 * The postal code is personal data: it goes into the lookup URL and
 * nowhere else. It is never logged, and failures are reported with a
 * generic reason only (never the error message, which could carry the URL).
 */

import { WEATHER_UPSTREAM_TIMEOUT_MS } from "@shared/weather-timeouts";

export interface LookupCandidate {
  label: string;
  lat: number;
  lon: number;
}

export type LookupResult =
  | { status: "ok"; candidates: LookupCandidate[] }
  | { status: "bad-input" }
  | { status: "unreachable" };

const COUNTRY_RE = /^[A-Za-z]{2}$/;
// Letters, digits, spaces and hyphens cover every format zippopotam knows
// (e.g. "90210", "SW1A", "K1A", "10-001").
const POSTAL_RE = /^[A-Za-z0-9][A-Za-z0-9 -]{0,15}$/;

export function postalLookupUrl(postal: string, country: string): string {
  return `https://api.zippopotam.us/${encodeURIComponent(country.toLowerCase())}/${encodeURIComponent(postal)}`;
}

function placeLabel(place: Record<string, unknown>): string {
  const name = typeof place["place name"] === "string" ? place["place name"] : "";
  const abbr = typeof place["state abbreviation"] === "string" ? place["state abbreviation"] : "";
  const state = typeof place.state === "string" ? place.state : "";
  return [name, abbr || state].filter(Boolean).join(", ").slice(0, 120);
}

export async function lookupPostalCode(
  fetchFn: typeof fetch,
  rawPostal: unknown,
  rawCountry: unknown,
): Promise<LookupResult> {
  const postal = typeof rawPostal === "string" ? rawPostal.trim() : "";
  const country = typeof rawCountry === "string" ? rawCountry.trim() : "";
  if (!POSTAL_RE.test(postal) || !COUNTRY_RE.test(country)) return { status: "bad-input" };

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), WEATHER_UPSTREAM_TIMEOUT_MS);
  try {
    const res = await fetchFn(postalLookupUrl(postal, country), { signal: controller.signal });
    // zippopotam answers 404 for a code (or country) it does not know.
    if (res.status === 404) return { status: "ok", candidates: [] };
    if (!res.ok) {
      console.error(`Postal code lookup failed: HTTP ${res.status}`);
      return { status: "unreachable" };
    }
    const data = (await res.json()) as { places?: unknown } | null;
    const places = Array.isArray(data?.places) ? data.places : [];
    const candidates: LookupCandidate[] = [];
    for (const raw of places) {
      if (!raw || typeof raw !== "object") continue;
      const place = raw as Record<string, unknown>;
      const lat = Number(place.latitude);
      const lon = Number(place.longitude);
      if (!Number.isFinite(lat) || !Number.isFinite(lon) || Math.abs(lat) > 90 || Math.abs(lon) > 180) continue;
      candidates.push({ label: placeLabel(place), lat, lon });
    }
    return { status: "ok", candidates };
  } catch (err) {
    const name = (err as { name?: unknown } | null)?.name;
    console.error(`Postal code lookup failed: ${name === "AbortError" ? "timed out" : "network error"}`);
    return { status: "unreachable" };
  } finally {
    clearTimeout(timer);
  }
}
