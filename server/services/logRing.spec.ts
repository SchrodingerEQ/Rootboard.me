import { describe, expect, test } from "vitest";
import { LogRing, logPrivate, scrubLogLine, shouldRecord } from "./logRing";

describe("scrubLogLine", () => {
  test("removes emails and tokens", () => {
    expect(scrubLogLine("Calendar family@example.com not found")).toBe("Calendar [email] not found");
    expect(scrubLogLine("Authorization: Bearer abc.def-123")).toBe("Authorization: Bearer [token]");
    expect(scrubLogLine("issued rbp_Zm9vYmFy-_baz")).toBe("issued [token]");
    expect(scrubLogLine("refresh failed for ya29.a0Abc-def_123.x")).toBe("refresh failed for [token]");
    expect(scrubLogLine('{"refresh_token":"1//0gAbcDEF-ghi_jkl"}')).toBe('{"refresh_token":"[token]"}');
  });

  test("drops the response body from request log lines, keeps the request line", () => {
    const line = '12:00:01 PM [express] GET /api/calendar/events 200 in 12ms :: [{"title":"Dentist","loc…';
    expect(scrubLogLine(line)).toBe("12:00:01 PM [express] GET /api/calendar/events 200 in 12ms");
  });

  test("drops values marked private (calendar and device names)", () => {
    const line = `Synced 12 events from calendar: ${logPrivate("Soccer practice")}`;
    expect(line).toContain("Soccer practice"); // the journal still shows it
    expect(scrubLogLine(line)).toBe("Synced 12 events from calendar: [name]");
    expect(scrubLogLine(`cut short: ${logPrivate("Spare laptop").slice(0, 6)}`)).toBe("cut short: [name]");
    expect(scrubLogLine(`Paired: "${logPrivate("two\nlines")}"`)).toBe('Paired: "[name]"');
  });

  test("leaves other lines alone", () => {
    expect(scrubLogLine("Service account auth initialized from: ./service-account.json")).toBe(
      "Service account auth initialized from: ./service-account.json",
    );
  });

  test("caps very long lines", () => {
    expect(scrubLogLine("x".repeat(2000)).length).toBe(500);
  });
});

describe("shouldRecord", () => {
  test("request lines only for server errors", () => {
    expect(shouldRecord("8:10:53 PM [express] GET /api/calendar/events 200 in 1ms :: []")).toBe(false);
    expect(shouldRecord("8:10:53 PM [express] GET /api/widgets 401 in 0ms :: {\"message\"…")).toBe(false);
    expect(shouldRecord("8:10:53 PM [express] POST /api/calendar/sync 500 in 9ms :: {\"message\"…")).toBe(true);
    expect(shouldRecord("Weather fetch failed: ENOTFOUND")).toBe(true);
  });
});

describe("LogRing", () => {
  test("keeps only the newest lines up to capacity", () => {
    const ring = new LogRing(3);
    for (let i = 1; i <= 5; i++) ring.push(`line ${i}`);
    expect(ring.tail(10)).toEqual(["line 3", "line 4", "line 5"]);
    expect(ring.tail(2)).toEqual(["line 4", "line 5"]);
  });

  test("splits multi-line output (stack traces) and skips blank lines", () => {
    const ring = new LogRing(10);
    ring.push("Error: boom\n    at a (x.ts:1)\n\n    at b (y.ts:2)");
    expect(ring.tail(10)).toEqual(["Error: boom", "    at a (x.ts:1)", "    at b (y.ts:2)"]);
  });

  test("scrubs before storing", () => {
    const ring = new LogRing(10);
    ring.push("sync failed for someone@example.com");
    expect(ring.tail(1)).toEqual(["sync failed for [email]"]);
  });
});
