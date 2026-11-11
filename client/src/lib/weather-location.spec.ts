import { describe, expect, test } from "vitest";
import { defaultCountryCode, defaultUnitsFor, locationFromCandidate, lookupPath } from "./weather-location";

describe("weather location helpers", () => {
  test("country defaults to the browser locale's region", () => {
    expect(defaultCountryCode("en-GB")).toBe("GB");
    expect(defaultCountryCode("de_at")).toBe("AT");
    expect(defaultCountryCode("fr")).toBe("US");
    expect(defaultCountryCode(undefined)).toBe("US");
  });

  test("units default to Fahrenheit only where it is in daily use", () => {
    expect(defaultUnitsFor("US")).toBe("fahrenheit");
    expect(defaultUnitsFor("ca")).toBe("celsius");
  });

  test("a picked candidate becomes a saved location", () => {
    expect(locationFromCandidate({ label: "Testville, TS", lat: 1.5, lon: -2.25 }, " 00000 ", "us", "celsius")).toEqual({
      postalCode: "00000",
      countryCode: "US",
      label: "Testville, TS",
      lat: 1.5,
      lon: -2.25,
      units: "celsius",
    });
  });

  test("the lookup path encodes its query", () => {
    expect(lookupPath("K1A 0B1", "ca")).toBe("/api/weather/lookup?postal=K1A+0B1&country=CA");
  });
});
