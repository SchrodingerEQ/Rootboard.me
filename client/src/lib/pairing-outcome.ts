/** The server's code lifetime (server/services/pairingService.ts PAIRING_CODE_TTL_MS). */
export const PAIRING_CODE_TTL_MS = 5 * 60 * 1000;

export interface PairedDeviceSummary {
  id: string;
  name: string;
  createdAt: string;
}

export type PairingOutcome =
  | { kind: "waiting" }
  | { kind: "paired"; name: string }
  /** The code stopped working without a pairing: expired, 5 wrong tries, replaced, or a restart. */
  | { kind: "ended" };

/**
 * What became of the code the kiosk is showing. A device created at or
 * after the code was issued paired with it: both times come from the same
 * server clock, so this needs no snapshot of the list taken at issue time
 * (which could be taken before the list had loaded).
 */
export function pairingOutcome(
  expiresAt: string,
  codeActive: boolean | undefined,
  devices: readonly PairedDeviceSummary[],
): PairingOutcome {
  const issuedAt = Date.parse(expiresAt) - PAIRING_CODE_TTL_MS;
  const paired = devices.find((d) => Date.parse(d.createdAt) >= issuedAt);
  if (paired) return { kind: "paired", name: paired.name };
  if (codeActive === false) return { kind: "ended" };
  return { kind: "waiting" };
}
