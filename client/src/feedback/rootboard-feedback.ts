// Rootboard's configuration of the shared Crucible feedback client
// (feedback-client.js, copied from crucible-feedback; see
// FEEDBACK-CLIENT-VERSION). Everything here ends up on the review screen.

import { createFeedbackClient, type Draft, type DraftStore, type FeedbackClient } from "./feedback-client.js";
import { APP_VERSION } from "@shared/version";
import { FEEDBACK_BASE_URL } from "@shared/feedback-endpoint";
import type { FeedbackContext } from "@/lib/feedback-context";

/** localStorage key of the one unsent draft. The kiosk always runs on
 *  http://localhost:5000, so the draft survives reloads and restarts. */
export const FEEDBACK_DRAFT_KEY = "rootboard-feedback-draft";

type KeyValueStorage = Pick<Storage, "getItem" | "setItem" | "removeItem">;

const DRAFT_KINDS: readonly string[] = ["great", "broken", "idea"];

/** The stored draft, or null when there is none or it is not one the dialog
 *  can show. A draft with an unknown kind would make the shared client throw
 *  while rendering the review, so it is treated as absent (and logged); the
 *  next Send overwrites it. */
export function readFeedbackDraft(storage: KeyValueStorage): Draft | null {
  const raw = storage.getItem(FEEDBACK_DRAFT_KEY);
  if (raw === null) return null;
  let value: unknown;
  try {
    value = JSON.parse(raw);
  } catch {
    console.warn("feedback: the saved draft is not valid JSON; ignoring it");
    return null;
  }
  const draft = value as Partial<Draft> | null;
  if (
    !draft ||
    typeof draft !== "object" ||
    !DRAFT_KINDS.includes(draft.kind as string) ||
    typeof draft.message !== "string" ||
    (draft.contact !== undefined && typeof draft.contact !== "string")
  ) {
    console.warn("feedback: the saved draft has an unexpected shape; ignoring it");
    return null;
  }
  return { kind: draft.kind as Draft["kind"], message: draft.message, contact: draft.contact ?? "", saved_at: String(draft.saved_at ?? "") };
}

/** The client's draft store over localStorage. */
export function localStorageDrafts(storage: KeyValueStorage): DraftStore {
  return {
    get: () => readFeedbackDraft(storage),
    set: (draft) => storage.setItem(FEEDBACK_DRAFT_KEY, JSON.stringify(draft)),
    clear: () => storage.removeItem(FEEDBACK_DRAFT_KEY),
  };
}

/** True when an unsent draft is waiting (the Settings marker). */
export function hasFeedbackDraft(storage: KeyValueStorage): boolean {
  return readFeedbackDraft(storage) !== null;
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
