import { describe, expect, test } from "vitest";
import { formatTemp } from "./units";

describe("formatTemp (scenario 7)", () => {
  test("Celsius rounds to whole degrees", () => {
    expect(formatTemp(13.4, "celsius")).toBe("13°");
    expect(formatTemp(-7.6, "celsius")).toBe("-8°");
  });
  test("Fahrenheit converts and rounds to whole degrees", () => {
    expect(formatTemp(13, "fahrenheit")).toBe("55°");   // 55.4
    expect(formatTemp(24, "fahrenheit")).toBe("75°");   // 75.2
    expect(formatTemp(-8, "fahrenheit")).toBe("18°");   // 17.6
    expect(formatTemp(0, "fahrenheit")).toBe("32°");
  });
});
