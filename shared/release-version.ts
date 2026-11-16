/**
 * Release version strings and the two update channels (beta-launch brief 08,
 * decision 0022).
 *
 * Versions look like `1.8.0` or `1.8.0-beta.2`, with or without a leading
 * `v` (old tags are mixed: `v1.7.1`, `1.7.2`, `v1.7.3`). Ordering follows
 * semver's prerelease rules, which is all the grammar the release process
 * uses — no dependency needed:
 *   1.7.3 < 1.8.0-beta.1 < 1.8.0-beta.2 < 1.8.0
 * Shared so the client can tell when it is running a beta build.
 */

export const UPDATE_CHANNELS = ["stable", "beta"] as const;
export type UpdateChannel = (typeof UPDATE_CHANNELS)[number];
export const DEFAULT_UPDATE_CHANNEL: UpdateChannel = "stable";

export function isUpdateChannel(value: unknown): value is UpdateChannel {
  return typeof value === "string" && (UPDATE_CHANNELS as readonly string[]).includes(value);
}

export interface ParsedVersion {
  /** Dotted numeric core; a missing segment counts as 0 (`1.8` == `1.8.0`). */
  core: number[];
  /** Dot-separated prerelease identifiers (`["beta", "2"]`); empty for a release. */
  prerelease: string[];
}

// Core of 1–3 numeric segments, optional `-` prerelease of dot-separated
// [0-9A-Za-z-] identifiers. Anything else (build metadata, spaces, words) is
// not a version this updater will act on.
const VERSION_PATTERN = /^v?(\d+(?:\.\d+){0,2})(?:-([0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*))?$/;

/** Parses a version or tag; null when it is not one. */
export function parseVersion(raw: string): ParsedVersion | null {
  const match = VERSION_PATTERN.exec(raw.trim());
  if (!match) return null;
  return {
    core: match[1].split(".").map(Number),
    prerelease: match[2] ? match[2].split(".") : [],
  };
}

/** The version without a leading `v`, as shown to the owner. */
export function stripTagPrefix(raw: string): string {
  return raw.trim().replace(/^v/, "");
}

export function isPrereleaseVersion(raw: string): boolean {
  const parsed = parseVersion(raw);
  return parsed !== null && parsed.prerelease.length > 0;
}

const NUMERIC_IDENTIFIER = /^\d+$/;

function comparePrereleaseIdentifiers(a: string, b: string): number {
  const aNumeric = NUMERIC_IDENTIFIER.test(a);
  const bNumeric = NUMERIC_IDENTIFIER.test(b);
  if (aNumeric && bNumeric) return Math.sign(Number(a) - Number(b));
  // Semver: numeric identifiers sort before alphanumeric ones.
  if (aNumeric) return -1;
  if (bNumeric) return 1;
  return a < b ? -1 : a > b ? 1 : 0;
}

/** -1, 0 or 1, like a sort comparator. */
export function compareParsedVersions(a: ParsedVersion, b: ParsedVersion): number {
  for (let i = 0; i < Math.max(a.core.length, b.core.length); i++) {
    const diff = (a.core[i] ?? 0) - (b.core[i] ?? 0);
    if (diff !== 0) return Math.sign(diff);
  }
  // Same core: a release outranks any of its prereleases.
  if (a.prerelease.length === 0 || b.prerelease.length === 0) {
    return Math.sign(b.prerelease.length - a.prerelease.length);
  }
  for (let i = 0; i < Math.min(a.prerelease.length, b.prerelease.length); i++) {
    const diff = comparePrereleaseIdentifiers(a.prerelease[i], b.prerelease[i]);
    if (diff !== 0) return diff;
  }
  // `beta` < `beta.1`: the longer list wins when one is a prefix of the other.
  return Math.sign(a.prerelease.length - b.prerelease.length);
}

/**
 * True when `candidate` is strictly newer than `current`. If either string
 * is not a version, nothing is offered: a malformed tag must never trigger
 * an update. Callers that care log the unreadable value.
 */
export function isNewerVersion(current: string, candidate: string): boolean {
  const parsedCurrent = parseVersion(current);
  const parsedCandidate = parseVersion(candidate);
  if (!parsedCurrent || !parsedCandidate) return false;
  return compareParsedVersions(parsedCurrent, parsedCandidate) < 0;
}
