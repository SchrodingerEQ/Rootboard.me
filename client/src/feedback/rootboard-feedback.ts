// Rootboard's configuration of the shared Crucible feedback client
// (feedback-client.js, copied from crucible-feedback; see
// FEEDBACK-CLIENT-VERSION). Everything here ends up on the review screen.

import { createFeedbackClient, type DraftStore, type FeedbackClient } from "./feedback-client.js";
import { APP_VERSION } from "@shared/version";
import { FEEDBACK_BASE_URL } from "@shared/feedback-endpoint";
import type { FeedbackContext } from "@/lib/feedback-context";

/** localStorage key of the one unsent draft. The kiosk always runs on
 *  http://localhost:5000, so the draft survives reloads and restarts. */
export const FEEDBACK_DRAFT_KEY = "rootboard-feedback-draft";

type KeyValueStorage = Pick<Storage, "getItem" | "setItem" | "removeItem">;

/** The client's draft store over localStorage. A value that is not valid
 *  JSON throws on `get`, which the dialog shows as "could not be read". */
export function localStorageDrafts(storage: KeyValueStorage): DraftStore {
  return {
    get: () => JSON.parse(storage.getItem(FEEDBACK_DRAFT_KEY) ?? "null"),
    set: (draft) => storage.setItem(FEEDBACK_DRAFT_KEY, JSON.stringify(draft)),
    clear: () => storage.removeItem(FEEDBACK_DRAFT_KEY),
  };
}

/** True when an unsent draft is waiting (the Settings marker). */
export function hasFeedbackDraft(storage: KeyValueStorage): boolean {
  return storage.getItem(FEEDBACK_DRAFT_KEY) !== null;
}

interface NavigatorLike {
  language?: string;
  platform?: string;
  userAgentData?: { platform?: string };
}

/** `os` comes from the browser, not a fixed "Raspberry Pi OS": the same
 *  build runs in a laptop's dev server. On the kiosk's Firefox this reads
 *  e.g. "Linux aarch64". */
export function osFromNavigator(nav: NavigatorLike): string {
  const value = nav.userAgentData?.platform || nav.platform || "unknown";
  return value.slice(0, 64);
}

export function localeFromNavigator(nav: NavigatorLike): string {
  return (nav.language || "en-US").slice(0, 16);
}

interface RootboardFeedbackOptions {
  context: FeedbackContext;
  drafts: DraftStore;
  nav: NavigatorLike;
  /** Tests only: production always uses FEEDBACK_BASE_URL and global fetch. */
  baseUrl?: string;
  fetch?: typeof fetch;
  now?: () => Date;
}

export function createRootboardFeedbackClient(options: RootboardFeedbackOptions): FeedbackClient {
  return createFeedbackClient({
    product: "rootboard",
    version: APP_VERSION,
    platform: "kiosk",
    os: osFromNavigator(options.nav),
    locale: localeFromNavigator(options.nav),
    context: () => ({ ...options.context }),
    drafts: options.drafts,
    baseUrl: options.baseUrl ?? FEEDBACK_BASE_URL,
    fetch: options.fetch,
    now: options.now,
  });
}
