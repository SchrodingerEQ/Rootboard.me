import { describe, expect, test } from "vitest";
import { DEFAULT_SCHOOL_END_MIN, DEFAULT_SCHOOL_START_MIN, parseHHMM, resolveSettings } from "./settings";

describe("parseHHMM", () => {
  test("parses zero-padded and unpadded times", () => {
    expect(parseHHMM("08:00")).toBe(480);
    expect(parseHHMM("8:05")).toBe(485);
    expect(parseHHMM("23:59")).toBe(1439);
  });

  test("rejects garbage", () => {
    expect(parseHHMM("8am")).toBeNull();
    expect(parseHHMM("24:00")).toBeNull();
    expect(parseHHMM("08:60")).toBeNull();
    expect(parseHHMM(800)).toBeNull();
    expect(parseHHMM(undefined)).toBeNull();
  });
});

describe("resolveSettings", () => {
  test("empty settings resolve to defaults", () => {
    expect(resolveSettings({})).toEqual({
      zipCode: "",
      units: "celsius",
      schoolStartMin: DEFAULT_SCHOOL_START_MIN,
      schoolEndMin: DEFAULT_SCHOOL_END_MIN,
    });
  });

  test("scenario 6: a bad schoolStart string falls back to 08:00 (and end to 15:00)", () => {
    const s = resolveSettings({ schoolStart: "8am", schoolEnd: "14:00" });
    expect(s.schoolStartMin).toBe(480);
    expect(s.schoolEndMin).toBe(900);
  });

  test("start >= end falls back to both defaults", () => {
    const s = resolveSettings({ schoolStart: "15:00", schoolEnd: "08:00" });
    expect(s.schoolStartMin).toBe(480);
    expect(s.schoolEndMin).toBe(900);
  });

  test("valid custom times are kept", () => {
    const s = resolveSettings({ schoolStart: "07:30", schoolEnd: "14:15" });
    expect(s.schoolStartMin).toBe(450);
    expect(s.schoolEndMin).toBe(855);
  });

  test("units: only the literal 'fahrenheit' selects Fahrenheit", () => {
    expect(resolveSettings({ units: "fahrenheit" }).units).toBe("fahrenheit");
    expect(resolveSettings({ units: "F" }).units).toBe("celsius");
    expect(resolveSettings({ units: 1 }).units).toBe("celsius");
  });

  test("zip is trimmed and kept verbatim; non-strings become blank", () => {
    expect(resolveSettings({ zipCode: " 00000 " }).zipCode).toBe("00000");
    expect(resolveSettings({ zipCode: "1234" }).zipCode).toBe("1234");
    expect(resolveSettings({ zipCode: 12345 }).zipCode).toBe("");
  });
});
