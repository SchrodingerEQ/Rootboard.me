import { describe, expect, test } from "vitest";
import { LogRing, scrubLogLine } from "./logRing";

describe("scrubLogLine", () => {
  test("removes emails and tokens", () => {
    expect(scrubLogLine("Calendar family@example.com not found")).toBe("Calendar [email] not found");
    expect(scrubLogLine("Authorization: Bearer abc.def-123")).toBe("Authorization: Bearer [token]");
    expect(scrubLogLine("issued rbp_Zm9vYmFy-_baz")).toBe("issued [token]");
  });

  test("drops the response body from request log lines, keeps the request line", () => {
    const line = '12:00:01 PM [express] GET /api/calendar/events 200 in 12ms :: [{"title":"Dentist","loc…';
    expect(scrubLogLine(line)).toBe("12:00:01 PM [express] GET /api/calendar/events 200 in 12ms");
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
