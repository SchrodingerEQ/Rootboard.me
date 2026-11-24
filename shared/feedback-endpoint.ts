/** The Crucible feedback service (crucible-feedback, contract v1). The
 *  kiosk's browser calls it directly, and only when the owner taps Send in
 *  Settings → Send feedback (docs/decisions/0019). Public: no key or token
 *  goes with it. Point it at a local Worker (e.g. http://localhost:8787) only in
 *  an uncommitted copy, for a test walk. */
export const FEEDBACK_BASE_URL = "https://feedback.cruciblecreations.net";
