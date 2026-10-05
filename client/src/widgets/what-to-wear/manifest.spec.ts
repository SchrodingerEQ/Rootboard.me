import { describe, expect, test } from "vitest";
import { validateBuiltinManifest } from "@/widgets/validate-manifest";
import rawManifest from "./manifest.json";

describe("what-to-wear manifest", () => {
  test("passes the shared Zod schema and apiVersion gate", () => {
    const m = validateBuiltinManifest(rawManifest);
    expect(m.id).toBe("what-to-wear");
    expect(m.slots).toContain("section");
    expect(m.refresh?.intervalSeconds).toBe(1800);
    expect(m.settings?.map((s) => s.key)).toEqual(["zipCode", "units", "schoolStart", "schoolEnd"]);
  });
});
