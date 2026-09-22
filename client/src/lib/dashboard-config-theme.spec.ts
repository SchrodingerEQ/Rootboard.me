import { describe, expect, test } from "vitest";
import { dashboardConfigSchema, defaultDashboardConfig } from "@shared/dashboard-config";

describe("dashboard config `theme` field", () => {
  test("absent by default and optional", () => {
    expect(defaultDashboardConfig().theme).toBeUndefined();
    expect(dashboardConfigSchema.safeParse(defaultDashboardConfig()).success).toBe(true);
  });

  test("a valid id survives a round trip", () => {
    const parsed = dashboardConfigSchema.parse({ ...defaultDashboardConfig(), theme: "deep-space" });
    expect(parsed.theme).toBe("deep-space");
  });

  test("a malformed value becomes undefined WITHOUT failing the document (lenient)", () => {
    for (const bad of [123, "../x", "Bad Id", "", null, { id: "x" }]) {
      const result = dashboardConfigSchema.safeParse({ ...defaultDashboardConfig(), theme: bad });
      expect(result.success, String(bad)).toBe(true);
      if (result.success) {
        expect(result.data.theme).toBeUndefined();
        expect(result.data.widgets).toHaveLength(3); // rest of the document intact
      }
    }
  });
});
