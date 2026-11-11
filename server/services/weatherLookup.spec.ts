import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { lookupPostalCode, postalLookupUrl } from "./weatherLookup";

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status });

beforeEach(() => {
  vi.spyOn(console, "error").mockImplementation(() => {});
});
afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe("lookupPostalCode", () => {
  test("builds the zippopotam URL from the country and the encoded postal code", () => {
    expect(postalLookupUrl("SW1A", "GB")).toBe("https://api.zippopotam.us/gb/SW1A");
    expect(postalLookupUrl("K1A 0B1", "CA")).toBe("https://api.zippopotam.us/ca/K1A%200B1");
  });

  test("returns every place as a candidate", async () => {
    const fetchFn = vi.fn(async () =>
      json({
        places: [
          { "place name": "Testville", "state abbreviation": "TS", latitude: "1.5", longitude: "-2.25" },
          { "place name": "Otherton", state: "Region", latitude: "3", longitude: "4" },
          { "place name": "Broken", latitude: "x", longitude: "4" },
        ],
      }),
    );
    const result = await lookupPostalCode(fetchFn as unknown as typeof fetch, " 00000 ", "us");
    expect(fetchFn).toHaveBeenCalledWith("https://api.zippopotam.us/us/00000", expect.anything());
    expect(result).toEqual({
      status: "ok",
      candidates: [
        { label: "Testville, TS", lat: 1.5, lon: -2.25 },
        { label: "Otherton, Region", lat: 3, lon: 4 },
      ],
    });
  });

  test("an unknown code is no candidates, not an error", async () => {
    const result = await lookupPostalCode((async () => json({}, 404)) as unknown as typeof fetch, "00000", "US");
    expect(result).toEqual({ status: "ok", candidates: [] });
  });

  test.each([
    ["no postal code", "", "US"],
    ["a country that is not two letters", "00000", "USA"],
    ["characters outside a postal code", "00000/../x", "US"],
    ["a non-string query value", ["00000"], "US"],
  ])("%s is rejected without a network call", async (_name, postal, country) => {
    const fetchFn = vi.fn();
    expect(await lookupPostalCode(fetchFn as unknown as typeof fetch, postal, country)).toEqual({ status: "bad-input" });
    expect(fetchFn).not.toHaveBeenCalled();
  });

  test("an upstream HTTP error is unreachable", async () => {
    expect(await lookupPostalCode((async () => json({}, 503)) as unknown as typeof fetch, "00000", "US")).toEqual({ status: "unreachable" });
  });

  test("a network error is unreachable and the log never carries the postal code", async () => {
    const fetchFn = async () => {
      throw new Error("GET https://api.zippopotam.us/us/00000 failed");
    };
    expect(await lookupPostalCode(fetchFn as unknown as typeof fetch, "00000", "US")).toEqual({ status: "unreachable" });
    const logged = vi.mocked(console.error).mock.calls.flat().join(" ");
    expect(logged).not.toContain("00000");
  });

  test("gives up after the shared upstream timeout", async () => {
    vi.useFakeTimers();
    const fetchFn = (_url: string, init?: RequestInit) =>
      new Promise<Response>((_resolve, reject) => {
        init?.signal?.addEventListener("abort", () => reject(Object.assign(new Error("aborted"), { name: "AbortError" })));
      });
    const pending = lookupPostalCode(fetchFn as unknown as typeof fetch, "00000", "US");
    await vi.advanceTimersByTimeAsync(20_000);
    expect(await pending).toEqual({ status: "unreachable" });
  });
});
