/**
 * First-run setup wizard (beta-launch brief 03): which steps run, when the
 * wizard opens at boot, and the failure sentences. Pure, so it is
 * unit-tested without a renderer; pages/setup-wizard.tsx is the UI.
 */

import type { DashboardConfig } from "@shared/dashboard-config";

export type SetupStepId = "welcome" | "network" | "timezone" | "google" | "weather" | "done";

/**
 * - `first-run`: no completion record in dashboard.json — every step.
 * - `network-only`: set up before, but booted with no network — the Network
 *   step alone, back to the dashboard once a connection is up.
 * - `rerun`: Settings → System → Run setup again — every step, current
 *   values pre-filled, nothing changed until confirmed.
 * - `network` / `timezone`: Settings' direct entries — that one step.
 */
export type SetupMode = "first-run" | "network-only" | "rerun" | "network" | "timezone";

const ALL_STEPS: readonly SetupStepId[] = ["welcome", "network", "timezone", "google", "weather", "done"];

export function stepsFor(mode: SetupMode): readonly SetupStepId[] {
  switch (mode) {
    case "first-run":
    case "rerun":
      return ALL_STEPS;
    case "network-only":
    case "network":
      return ["network"];
    case "timezone":
      return ["timezone"];
  }
}

/** Whether finishing this mode records `setup.completedAt`. */
export function recordsCompletion(mode: SetupMode): boolean {
  return mode === "first-run" || mode === "rerun";
}

/** Opened from Settings over a running dashboard (it can be closed at any
 *  time) rather than in place of it at boot. */
export function isOpenedFromSettings(mode: SetupMode): boolean {
  return mode === "rerun" || mode === "network" || mode === "timezone";
}

/** Every step but Network can be skipped (decision 2); Welcome and Done
 *  only move on. */
export function canSkip(step: SetupStepId): boolean {
  return step === "timezone" || step === "google" || step === "weather";
}

/**
 * "Continue without network" (founder 2026-11-16): only on the boot-time
 * Network screen, where the unit was set up before and its dashboard works
 * offline. The first-run Network step stays required (brief 03 decision 2),
 * and from Settings the Close button already leads back.
 */
export function canContinueWithoutNetwork(mode: SetupMode): boolean {
  return mode === "network-only";
}

/** The run condition's config half: no completion record → the full wizard. */
export function needsFirstRun(config: DashboardConfig): boolean {
  return !config.setup?.completedAt;
}

// --- Google step (brief 03 session 2) --------------------------------------------

/**
 * Where the wizard opens. Google's callback reloads the app at
 * `/?google=connected` (or `?google=failed&reason=`), and with no completion
 * record every page load is `first-run`, so without this rule the owner would
 * be sent back to Welcome to redo Wi-Fi and time zone. In `first-run` the
 * return resumes at the Google step, which then shows the result (connected
 * and Continue, or the panel again after the failure toast). Every other mode
 * starts at its first step: a `rerun` from Settings is not open after the
 * reload (it lands on the dashboard, where Settings → Google shows the result).
 *
 * @param search `window.location.search` as the page loaded, before the shell
 *   takes the callback's parameters off the URL
 */
export function startingStep(search: string, mode: SetupMode): SetupStepId {
  const steps = stepsFor(mode);
  const google = new URLSearchParams(search).get("google");
  if (mode === "first-run" && (google === "connected" || google === "failed")) return "google";
  return steps[0];
}

export type GoogleStepState = "connected" | "needs-client" | "connect";

/** The slice of the auth status (`GET /api/calendar/auth-status`) the step reads. */
export interface GoogleStatusLike {
  authenticated: boolean;
  oauthClient?: "missing" | "configured" | "invalid";
}

/**
 * What the Google step shows. Connected in either mode (Google sign-in or a
 * service-account key file, brief 02 decision 6); otherwise the connect
 * panel, which says what to do when this unit has no usable sign-in client.
 * An unknown status (still loading) shows the panel's button.
 */
export function googleStepState(status: GoogleStatusLike | undefined): GoogleStepState {
  if (status?.authenticated) return "connected";
  if (status?.oauthClient === "missing" || status?.oauthClient === "invalid") return "needs-client";
  return "connect";
}

export type ManualSetupChoice = "back" | "continue";

export interface ManualSetupOutcome {
  /** The wizard closes (true) or stays on the Google step unchanged (false). */
  closeWizard: boolean;
  /** Whether `setup.completedAt` is written. Never for the manual path: the
   *  wizard returns on the next boot and finds Google connected once the key
   *  file is in place. */
  recordCompletion: boolean;
  /** The auth dialog opens on its Advanced (service-account) tab. */
  openServiceAccountSteps: boolean;
}

/** The "Set up manually (self-hosting)" warning's two buttons (founder 2026-11-24). */
export function manualSetupOutcome(choice: ManualSetupChoice): ManualSetupOutcome {
  if (choice === "continue") return { closeWizard: true, recordCompletion: false, openServiceAccountSteps: true };
  return { closeWizard: false, recordCompletion: false, openServiceAccountSteps: false };
}

// --- Boot-time network condition ----------------------------------------------

/**
 * NetworkManager gets this long after the OS boots to bring a saved
 * connection up before the wizard opens on the Network step. A reconnect
 * after an access-point drop took 45–70 s on the reference kiosk.
 */
export const BOOT_NETWORK_GRACE_SECONDS = 90;

/**
 * A page loaded later than this after the OS booted is not a boot (a reload
 * after an update, someone pressing F5): a network drop then never opens the
 * wizard — the wifi-selfheal timer and the app's offline handling cover it.
 */
export const BOOT_WINDOW_SECONDS = 300;

/** How often the boot check re-asks while it waits out the grace period. */
export const BOOT_POLL_MS = 5_000;

export interface NetworkStatusLike {
  managed: boolean;
  connected: boolean;
  uptimeSeconds: number;
}

export type BootNetworkDecision = "wait" | "online" | "offline" | "not-applicable";

/**
 * @param status the latest /api/system/network/status, or null if it failed
 * @param firstUptimeSeconds the uptime in the first status this page saw
 */
export function bootNetworkDecision(status: NetworkStatusLike | null, firstUptimeSeconds: number | null): BootNetworkDecision {
  // A failed status read must never hold the dashboard hostage.
  if (!status || !status.managed) return "not-applicable";
  if (status.connected) return "online";
  if (firstUptimeSeconds === null || firstUptimeSeconds > BOOT_WINDOW_SECONDS) return "not-applicable";
  if (status.uptimeSeconds < BOOT_NETWORK_GRACE_SECONDS) return "wait";
  return "offline";
}

// --- Failure copy (decision 9: one plain sentence and a Retry) --------------------

export const FAILURE_COPY = {
  badPassword: "That password didn't work.",
  notFound: "Rootboard can't see that network from here.",
  noInternet: "Connected to Wi-Fi, but the internet isn't reachable yet.",
  timeout: "The network didn't answer in time.",
  failed: "Rootboard couldn't join that network.",
  scan: "Rootboard couldn't look for networks.",
  timezone: "Rootboard couldn't change the time zone.",
  server: "Rootboard's own server didn't answer.",
} as const;

export function connectFailureSentence(reason: string | undefined): string {
  switch (reason) {
    case "bad-password":
      return FAILURE_COPY.badPassword;
    case "not-found":
      return FAILURE_COPY.notFound;
    case "timeout":
      return FAILURE_COPY.timeout;
    default:
      return FAILURE_COPY.failed;
  }
}

// --- Time zone -----------------------------------------------------------------

/** The zone the step starts on: the browser's reported zone when the system
 *  knows it (decision 6), else the system's current zone, else the first. */
export function defaultTimezone(zones: readonly string[], browserZone: string | undefined, systemZone: string | null): string | null {
  if (browserZone && zones.includes(browserZone)) return browserZone;
  if (systemZone && zones.includes(systemZone)) return systemZone;
  return zones[0] ?? null;
}

/**
 * Case-insensitive search over zone names, where a space matches `_` or `/`
 * ("new york" → America/New_York). Capped so the list stays short on a
 * touchscreen.
 */
export function filterTimezones(zones: readonly string[], query: string, limit = 40): string[] {
  const terms = query.toLowerCase().split(/[\s_/]+/).filter(Boolean);
  if (terms.length === 0) return zones.slice(0, limit);
  const out: string[] = [];
  for (const zone of zones) {
    const name = zone.toLowerCase();
    if (terms.every((t) => name.includes(t))) {
      out.push(zone);
      if (out.length >= limit) break;
    }
  }
  return out;
}

/** "3:42 PM" in that zone — so a wrong zone is obvious at a glance. */
export function formatTimeIn(timeZone: string, date: Date, locale?: string): string {
  try {
    return date.toLocaleTimeString(locale, { timeZone, hour: "numeric", minute: "2-digit" });
  } catch {
    return date.toLocaleTimeString(locale, { hour: "numeric", minute: "2-digit" });
  }
}

/** 0–4 bars from nmcli's 0–100 signal. */
export function signalBars(signal: number): 0 | 1 | 2 | 3 | 4 {
  if (signal >= 75) return 4;
  if (signal >= 50) return 3;
  if (signal >= 25) return 2;
  if (signal > 0) return 1;
  return 0;
}
