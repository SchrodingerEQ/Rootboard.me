import { useState } from "react";
import { Search } from "lucide-react";
import type { WeatherLocation } from "@shared/dashboard-config";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  defaultCountryCode,
  defaultUnitsFor,
  locationFromCandidate,
  lookupPath,
  type WeatherLookupCandidate,
} from "@/lib/weather-location";

interface WeatherLocationSettingsProps {
  /** The saved location (dashboard.json `weather`), if any. */
  location: WeatherLocation | undefined;
  onSave: (location: WeatherLocation) => void;
}

type LookupState =
  | { kind: "idle" }
  | { kind: "loading" }
  | { kind: "done"; candidates: WeatherLookupCandidate[] }
  | { kind: "error"; message: string };

/**
 * Settings → System → Weather (beta-launch brief 01): postal code, country,
 * units, "Look up", pick a place. The lookup goes through the kiosk's own
 * server (GET /api/weather/lookup) and only runs on a tap. Picking a place
 * saves it to data/config/dashboard.json; the header chip, week/day views
 * and What to Wear (blank zip) all follow it.
 */
export function WeatherLocationSettings({ location, onSave }: WeatherLocationSettingsProps) {
  const initialCountry = location?.countryCode ?? defaultCountryCode(typeof navigator !== "undefined" ? navigator.language : undefined);
  const [postal, setPostal] = useState(location?.postalCode ?? "");
  const [country, setCountry] = useState(initialCountry);
  const [units, setUnits] = useState<WeatherLocation["units"]>(location?.units ?? defaultUnitsFor(initialCountry));
  const [lookup, setLookup] = useState<LookupState>({ kind: "idle" });

  const canLookUp = postal.trim().length > 0 && /^[A-Za-z]{2}$/.test(country.trim()) && lookup.kind !== "loading";

  const handleLookUp = async () => {
    if (!canLookUp) return;
    setLookup({ kind: "loading" });
    try {
      const res = await fetch(lookupPath(postal, country), { credentials: "include" });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        setLookup({ kind: "error", message: body?.message ?? `Lookup failed (${res.status})` });
        return;
      }
      setLookup({ kind: "done", candidates: Array.isArray(body?.candidates) ? body.candidates : [] });
    } catch {
      setLookup({ kind: "error", message: "Couldn't reach the kiosk's server" });
    }
  };

  const handlePick = (candidate: WeatherLookupCandidate) => {
    onSave(locationFromCandidate(candidate, postal, country, units));
    setLookup({ kind: "idle" });
  };

  const handleUnits = (next: WeatherLocation["units"]) => {
    setUnits(next);
    // With a place already saved, the unit switch applies straight away;
    // otherwise it is used when a place is picked.
    if (location && location.units !== next) onSave({ ...location, units: next });
  };

  return (
    <div className="space-y-1.5" data-testid="weather-location">
      <p className="text-xs text-rb-muted leading-snug" data-testid="weather-location-current">
        {location ? `Location: ${location.label || location.postalCode} (${location.postalCode}, ${location.countryCode})` : "No location set"}
      </p>
      {/* 44px-tall fields and buttons: kiosk touch targets, and roomier when
          the on-screen keyboard is driving them. */}
      <div className="flex gap-2">
        <Input
          value={postal}
          onChange={(e) => { setPostal(e.target.value); setLookup({ kind: "idle" }); }}
          onKeyDown={(e) => e.key === "Enter" && void handleLookUp()}
          placeholder="Postal code"
          aria-label="Postal code"
          maxLength={16}
          className="text-sm h-11 flex-1 min-w-0"
          data-testid="weather-postal-input"
        />
        <Input
          value={country}
          onChange={(e) => { setCountry(e.target.value.toUpperCase()); setLookup({ kind: "idle" }); }}
          placeholder="US"
          aria-label="Country code"
          maxLength={2}
          className="text-sm h-11 w-14 text-center uppercase"
          data-testid="weather-country-input"
        />
        <Button
          size="sm"
          className="h-11 px-3"
          onClick={() => void handleLookUp()}
          disabled={!canLookUp}
          data-testid="weather-lookup-button"
        >
          <Search className="h-4 w-4 mr-1" />
          {lookup.kind === "loading" ? "Looking…" : "Look up"}
        </Button>
      </div>
      <div className="flex gap-2">
        {(["fahrenheit", "celsius"] as const).map((u) => (
          <Button
            key={u}
            variant={units === u ? "default" : "outline"}
            size="sm"
            className="flex-1 h-11"
            onClick={() => handleUnits(u)}
            data-testid={`weather-units-${u}`}
          >
            {u === "fahrenheit" ? "°F" : "°C"}
          </Button>
        ))}
      </div>
      {lookup.kind === "error" && <p className="text-xs text-rb-danger leading-snug">{lookup.message}</p>}
      {lookup.kind === "done" && lookup.candidates.length === 0 && (
        <p className="text-xs text-rb-warn-ink leading-snug">No place found for that postal code and country.</p>
      )}
      {lookup.kind === "done" && lookup.candidates.length > 0 && (
        <div className="space-y-1" data-testid="weather-candidates">
          {lookup.candidates.slice(0, 8).map((c, i) => (
            <Button
              key={`${c.label}-${i}`}
              variant="outline"
              size="sm"
              className="w-full h-11 justify-start"
              onClick={() => handlePick(c)}
              data-testid={`weather-candidate-${i}`}
            >
              {c.label || `${c.lat.toFixed(2)}, ${c.lon.toFixed(2)}`}
            </Button>
          ))}
        </div>
      )}
      <p className="text-xs text-rb-faint leading-snug">
        A postal code is enough — no street address needed. Look up sends it
        to zippopotam.us to find the place; it is saved only on this kiosk.
      </p>
    </div>
  );
}
