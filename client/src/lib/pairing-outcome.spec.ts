import { describe, expect, test } from "vitest";
import { PAIRING_CODE_TTL_MS, pairingOutcome } from "./pairing-outcome";

const ISSUED = Date.parse("2026-11-14T12:00:00Z");
const EXPIRES = new Date(ISSUED + PAIRING_CODE_TTL_MS).toISOString();
const old = { id: "a", name: "Old laptop", createdAt: "2026-11-01T09:00:00Z" };

describe("pairingOutcome", () => {
  test("an existing device is never taken for a new pairing (list loaded after the code)", () => {
    expect(pairingOutcome(EXPIRES, true, [old])).toEqual({ kind: "waiting" });
    expect(pairingOutcome(EXPIRES, undefined, [old])).toEqual({ kind: "waiting" });
  });

  test("a device created after the code was issued is the pairing", () => {
    const fresh = { id: "b", name: "New laptop", createdAt: "2026-11-14T12:01:30Z" };
    expect(pairingOutcome(EXPIRES, false, [old, fresh])).toEqual({ kind: "paired", name: "New laptop" });
  });

  test("the code stopped working with no new device → ended", () => {
    expect(pairingOutcome(EXPIRES, false, [old])).toEqual({ kind: "ended" });
  });

  test("status not known yet → still waiting", () => {
    expect(pairingOutcome(EXPIRES, undefined, [])).toEqual({ kind: "waiting" });
  });
});
