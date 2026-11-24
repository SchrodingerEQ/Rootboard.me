// Crucible feedback — reference client, plain JavaScript, zero dependencies.
//
// Implements the flow in docs/API.md and Crucible-HQ/departments/pm/
// feedback-contract.md §2 for any host (browser, Electron main process,
// Node, React Native via a wrapper): build the payload from product config
// plus what the user typed, render the plain-words "here's what will be
// sent" review, and — only after the user taps Send — POST /v1/ticket then
// POST /v1/feedback. Failures never retry on their own; the draft stays in
// the storage the host provides and the user taps Send again.
//
// What this file never does: add a key of its own to `context`, read or
// store any install, device or user identifier, send anything before the
// tap, or talk to any host but the configured base URL.

export const DEFAULT_BASE_URL = "https://feedback.cruciblecreations.net";
export const SCHEMA_VERSION = "1";

/** UI words the user picks → wire words the server stores (contract §2). */
export const KINDS = Object.freeze({ great: "praise", broken: "bug", idea: "idea" });

/** @typedef {keyof typeof KINDS} UiKind */

/**
 * What the product knows about itself. Every string is shown to the user in
 * the review step exactly as given.
 * @typedef {object} ProductConfig
 * @property {string} product  Registry slug (API.md "Products registry").
 * @property {string} version  The version string the app displays.
 * @property {"android" | "ios" | "web" | "electron" | "kiosk" | "desktop"} platform
 * @property {string} os       Free text, e.g. "Android 15".
 * @property {string} locale   e.g. "en-US".
 * @property {Record<string, unknown> | (() => Record<string, unknown>)} [context]
 *   Product-defined details (screen, level, route). Keys must pass the
 *   identifier rule — see `checkContext`. Defaults to `{}`.
 */

/**
 * What the user typed.
 * @typedef {object} UserInput
 * @property {UiKind} kind
 * @property {string} message
 * @property {string} [contact]        Only what the user typed; blank = not given.
 * @property {string} [turnstileToken] Web products whose registry entry needs one.
 */

/**
 * The v1 payload minus `ticket`, which is added at send time.
 * @typedef {object} Payload
 * @property {"1"} schema_version
 * @property {string} product
 * @property {string} version
 * @property {string} platform
 * @property {string} os
 * @property {string} locale
 * @property {"praise" | "bug" | "idea"} kind
 * @property {string} message
 * @property {Record<string, unknown>} context
 * @property {string} [contact]
 * @property {string} client_time
 * @property {string} [turnstile_token]
 */

/**
 * The draft the host keeps for the user between attempts.
 * @typedef {object} Draft
 * @property {UiKind} kind
 * @property {string} message
 * @property {string} contact
 * @property {string} saved_at
 */

/**
 * Storage the host provides. Values may be returned directly or as promises.
 * @typedef {object} DraftStore
 * @property {() => Draft | null | undefined | Promise<Draft | null | undefined>} get
 * @property {(draft: Draft) => void | Promise<void>} set
 * @property {() => void | Promise<void>} clear
 */

/**
 * `draftCleared` is false only when the report was stored but the host's
 * draft store refused to clear: show the ticket anyway, and expect the draft
 * to still be there on the next open.
 * @typedef {{ ok: true, ticket: string, draftCleared: boolean }} SendSuccess
 * @typedef {{ ok: false, code: string, message: string, status?: number, detail?: string }} SendFailure
 * @typedef {SendSuccess | SendFailure} SendResult
 */

// ---------------------------------------------------------------------------
// Context pre-check — a copy of worker/schema.ts so a product fails in
// development, not in front of a user. If the two ever disagree the server
// wins and this file has a bug.

export const CONTEXT_MAX_BYTES = 2048;
export const CONTEXT_MAX_DEPTH = 4;

const FORBIDDEN_WORDS = new Set([
  "id", "uid", "uuid", "guid", "user", "name", "email", "phone", "address",
  "device", "token", "session", "account", "ip", "mac", "imei", "serial",
  "fingerprint", "cookie", "auth", "password", "secret", "identifier",
]);

const FORBIDDEN_COMPOUND =
  /^(user|device|install|installation|session|account|client|machine|instance|visitor|player|customer|member|advertis(?:ing|er)?|tracking|anon(?:ymous)?|hardware|app|build|push|auth)(id|uid|uuid|guid|token|key|email|hash|secret)$/;

/** @param {string} key */
function keyWords(key) {
  return key
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replace(/([A-Z]+)([A-Z][a-z])/g, "$1 $2")
    .split(/[^A-Za-z0-9]+/)
    .filter(Boolean)
    .map((w) => w.toLowerCase());
}

/**
 * True when the server would reject this context key as identifier-shaped.
 * @param {string} key
 */
export function isForbiddenKey(key) {
  if (keyWords(key).some((w) => FORBIDDEN_WORDS.has(w))) return true;
  const compact = key.toLowerCase().replace(/[^a-z0-9]/g, "");
  return FORBIDDEN_COMPOUND.test(compact);
}

/**
 * The server's three context rules: size, depth, forbidden keys. Returns
 * `null` when the context would be accepted, else the error code and the
 * detail the server would send (it names the key path, never a value).
 * @param {Record<string, unknown>} context
 * @returns {{ code: "context_too_large" | "context_too_deep" | "context_forbidden_key", detail: string } | null}
 */
export function checkContext(context) {
  const bytes = utf8ByteLength(JSON.stringify(context));
  if (bytes > CONTEXT_MAX_BYTES) {
    return { code: "context_too_large", detail: `context must serialize to at most ${CONTEXT_MAX_BYTES} bytes` };
  }
  return walk(context, 1, "context");
}

/**
 * @param {unknown} value
 * @param {number} depth
 * @param {string} path
 * @returns {{ code: "context_too_deep" | "context_forbidden_key", detail: string } | null}
 */
function walk(value, depth, path) {
  if (Array.isArray(value)) {
    for (let i = 0; i < value.length; i++) {
      const v = walk(value[i], depth, `${path}[${i}]`);
      if (v) return v;
    }
    return null;
  }
  if (!isPlainObject(value)) return null;
  if (depth > CONTEXT_MAX_DEPTH) {
    return { code: "context_too_deep", detail: `context may nest at most ${CONTEXT_MAX_DEPTH} levels` };
  }
  for (const key of Object.keys(value)) {
    if (isForbiddenKey(key)) {
      return { code: "context_forbidden_key", detail: `${path}.${key} looks like an identifier; rename or drop it` };
    }
    const v = walk(value[key], depth + 1, `${path}.${key}`);
    if (v) return v;
  }
  return null;
}

/**
 * UTF-8 length the way the server measures it. TextEncoder is used where it
 * exists; some React Native runtimes lack it, so the fallback counts code
 * points by hand (1–4 bytes each) rather than crashing at the tap.
 * @param {string} text
 */
function utf8ByteLength(text) {
  if (typeof TextEncoder === "function") return new TextEncoder().encode(text).byteLength;
  let bytes = 0;
  for (const ch of text) {
    const cp = /** @type {number} */ (ch.codePointAt(0));
    bytes += cp < 0x80 ? 1 : cp < 0x800 ? 2 : cp < 0x10000 ? 3 : 4;
  }
  return bytes;
}

/**
 * @param {unknown} value
 * @returns {value is Record<string, unknown>}
 */
function isPlainObject(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

// ---------------------------------------------------------------------------
// Payload

const REQUIRED_CONFIG = /** @type {const} */ (["product", "version", "platform", "os", "locale"]);

/**
 * Throws a TypeError naming the first missing or blank config field. These
 * are developer errors: the product is misconfigured, not the user.
 * @param {ProductConfig} config
 */
function requireConfig(config) {
  if (!isPlainObject(config)) throw new TypeError("feedback-client: config must be an object");
  for (const key of REQUIRED_CONFIG) {
    const value = config[key];
    if (typeof value !== "string" || value.length === 0) {
      throw new TypeError(`feedback-client: config.${key} must be a non-empty string`);
    }
  }
}

/**
 * The context as JSON will carry it (undefined values and functions dropped,
 * Dates as strings), checked against the server's rules. Throws on a
 * violation so the mistake shows up in development.
 * @param {ProductConfig["context"]} source
 * @returns {Record<string, unknown>}
 */
function resolveContext(source) {
  const raw = typeof source === "function" ? source() : source ?? {};
  if (!isPlainObject(raw)) throw new TypeError("feedback-client: context must be a plain object");
  const context = /** @type {Record<string, unknown>} */ (JSON.parse(JSON.stringify(raw)));
  const violation = checkContext(context);
  if (violation) throw new TypeError(`feedback-client: ${violation.code}: ${violation.detail}`);
  return context;
}

/**
 * Builds the v1 payload (without `ticket`) from the product's config and
 * the user's input. Pure: no network, no storage.
 * @param {ProductConfig} config
 * @param {UserInput} input
 * @param {{ now?: () => Date }} [options]
 * @returns {Payload}
 */
export function buildPayload(config, input, options = {}) {
  requireConfig(config);
  const kind = KINDS[input.kind];
  if (kind === undefined) {
    throw new TypeError(`feedback-client: kind must be one of ${Object.keys(KINDS).join(", ")}`);
  }
  if (typeof input.message !== "string") throw new TypeError("feedback-client: input.message must be a string");
  const now = options.now ?? (() => new Date());

  /** @type {Payload} */
  const payload = {
    schema_version: SCHEMA_VERSION,
    product: config.product,
    version: config.version,
    platform: config.platform,
    os: config.os,
    locale: config.locale,
    kind,
    message: input.message,
    context: resolveContext(config.context),
    client_time: now().toISOString(),
  };
  const contact = (input.contact ?? "").trim();
  if (contact.length > 0) payload.contact = contact;
  if (typeof input.turnstileToken === "string" && input.turnstileToken.length > 0) {
    payload.turnstile_token = input.turnstileToken;
  }
  return payload;
}

// ---------------------------------------------------------------------------
// Review text — the "here's what gets sent" panel (contract §2 step 4).
// Every field, in plain words. This is how the product keeps the privacy
// policy's "we tell you what's included" promise, so a host shows it
// verbatim (or renders the same facts) and never trims it.

const UI_WORD = Object.fromEntries(Object.entries(KINDS).map(([ui, wire]) => [wire, ui]));

/**
 * @param {Payload} payload
 * @returns {string}
 */
export function reviewText(payload) {
  const lines = ["Here's what will be sent to Crucible Creations:", ""];
  lines.push(`Kind: ${UI_WORD[payload.kind]} (sent as "${payload.kind}")`);
  lines.push("Message:", indent(payload.message));
  lines.push(`Contact: ${payload.contact ?? "not given"}`);
  lines.push(`Product: ${payload.product}`);
  lines.push(`Version: ${payload.version}`);
  lines.push(`Platform: ${payload.platform}`);
  lines.push(`System: ${payload.os}`);
  lines.push(`Language: ${payload.locale}`);
  const details = flattenContext(payload.context);
  if (details.length === 0) {
    lines.push("Details the app adds: none");
  } else {
    lines.push("Details the app adds:", ...details.map((d) => `  ${d}`));
  }
  lines.push(`Time on your device: ${payload.client_time}`);
  lines.push(`Format version: ${payload.schema_version}`);
  if (payload.turnstile_token !== undefined) {
    // The token is an opaque spam-check value, not information about the
    // user; naming it is the honest disclosure, printing 2 KB of it is not.
    lines.push(`Spam check: a Cloudflare Turnstile token (${payload.turnstile_token.length} characters)`);
  }
  lines.push("Ticket code: assigned when you tap Send");
  lines.push("", "Nothing else is sent. No account, device or install identifier is included.");
  return lines.join("\n");
}

/** @param {string} text */
function indent(text) {
  return text
    .split("\n")
    .map((line) => `  ${line}`)
    .join("\n");
}

/**
 * `{ game: { board: "hex" }, widgets: ["a"] }` → `["game.board: hex", 'widgets: ["a"]']`.
 * Nested objects are flattened so every leaf is visible; arrays are shown
 * whole as JSON, which is what the wire carries.
 * @param {Record<string, unknown>} context
 * @param {string} [prefix]
 * @returns {string[]}
 */
function flattenContext(context, prefix = "") {
  /** @type {string[]} */
  const out = [];
  for (const [key, value] of Object.entries(context)) {
    const path = prefix ? `${prefix}.${key}` : key;
    if (isPlainObject(value)) {
      const inner = flattenContext(value, path);
      out.push(...(inner.length === 0 ? [`${path}: {}`] : inner));
    } else {
      out.push(`${path}: ${typeof value === "string" ? value : JSON.stringify(value)}`);
    }
  }
  return out;
}

// ---------------------------------------------------------------------------
// Error codes → what the user reads. Every code in docs/API.md, plus the
// client's own. `detail` from the server names a field or a rule, never a
// submitted value, so it is safe to show.

const CONNECTION_NEEDED =
  "Feedback needs a connection. Your draft is saved on this device; tap Send again when you're online.";
const DRAFT_KEPT = "Your draft is kept on this device.";
const TRY_LATER = `Please try again in a little while. ${DRAFT_KEPT}`;
const SEND_AGAIN = `Tap Send again. ${DRAFT_KEPT}`;
const APP_BUG = `This looks like a problem in the app, not with what you wrote. ${DRAFT_KEPT}`;

/** @type {Record<string, string>} */
const SERVER_MESSAGES = {
  https_required: `The feedback service refused an insecure connection. ${APP_BUG}`,
  not_found: `The feedback service did not recognise the request. ${APP_BUG}`,
  invalid_request: `The feedback service could not accept the request. ${APP_BUG}`,
  invalid_json: `The feedback service could not read the request. ${APP_BUG}`,
  invalid_payload: `Something in the report was not accepted. ${DRAFT_KEPT}`,
  unknown_product: `The feedback service does not know this app yet. ${APP_BUG}`,
  origin_not_allowed: `The feedback service does not accept reports from this site yet. ${APP_BUG}`,
  body_too_large: `The report is too long to send. Please shorten your message. ${DRAFT_KEPT}`,
  rate_limited: `Too many reports from this connection in a short time. ${TRY_LATER}`,
  context_too_large: `The details the app adds are too large to send. ${APP_BUG}`,
  context_too_deep: `The details the app adds are nested too deeply to send. ${APP_BUG}`,
  context_forbidden_key: `The details the app adds include a field that looks like an identifier, which the service refuses. ${APP_BUG}`,
  turnstile_required: `The spam check did not complete. Please complete it and tap Send again. ${DRAFT_KEPT}`,
  turnstile_not_expected: `This app sent a spam-check token it should not have. ${APP_BUG}`,
  turnstile_failed: `The spam check failed. Please complete it again and tap Send. ${DRAFT_KEPT}`,
  turnstile_unconfigured: `The feedback service's spam check is not set up right now. ${TRY_LATER}`,
  turnstile_unavailable: `The spam check could not be reached. ${TRY_LATER}`,
  ticket_unknown: `The send took too long or was interrupted. ${SEND_AGAIN}`,
  ticket_expired: `The send took too long. ${SEND_AGAIN}`,
  ticket_used: `This report was already sent. If you meant to send a new one, edit it and tap Send again.`,
  ticket_product_mismatch: `The feedback service mixed up which app this is. ${SEND_AGAIN}`,
  internal_error: `The feedback service hit a problem on its side. ${TRY_LATER}`,
};

/** @type {Record<string, string>} */
const CLIENT_MESSAGES = {
  no_connection: CONNECTION_NEEDED,
  bad_response: `The feedback service gave an unexpected answer. ${TRY_LATER}`,
  draft_not_saved:
    "Your draft could not be saved on this device, so nothing was sent. Copy your message somewhere safe and try again.",
};

/** Every error code the Worker can answer on the two client routes: the
 *  tables in docs/API.md plus `https_required` and `not_found` from
 *  worker/app.ts. For tests and for hosts that map codes themselves. */
export const SERVER_ERROR_CODES = Object.freeze(Object.keys(SERVER_MESSAGES));

/** Codes where the server's `detail` names something the user can act on. */
const SHOW_DETAIL = new Set(["invalid_payload", "body_too_large", "context_forbidden_key", "context_too_large", "context_too_deep"]);

/**
 * A user-facing sentence for an error code, server or client. Unknown codes
 * get a generic sentence; nothing throws.
 * @param {string} code
 * @param {string} [detail]
 * @returns {string}
 */
export function errorMessage(code, detail) {
  const base = SERVER_MESSAGES[code] ?? CLIENT_MESSAGES[code] ?? `Your feedback could not be sent (${code}). ${TRY_LATER}`;
  return detail && SHOW_DETAIL.has(code) ? `${base} (${detail})` : base;
}

// ---------------------------------------------------------------------------
// The client

/**
 * @typedef {ProductConfig & {
 *   drafts: DraftStore,
 *   baseUrl?: string,
 *   fetch?: typeof fetch,
 *   now?: () => Date,
 * }} ClientConfig
 */

/**
 * @typedef {object} FeedbackClient
 * @property {(input: UserInput) => { payload: Payload, text: string }} preview
 *   The payload as it would be sent and its review text. Pure.
 * @property {(input: UserInput) => Promise<SendResult>} send
 *   Call only when the user taps Send. Keeps the draft first, then
 *   POST /v1/ticket, then POST /v1/feedback. Clears the draft on success.
 *   Never retries; never throws for network or server failures (those come
 *   back as `{ ok: false }`), only for developer errors.
 * @property {(input: Pick<UserInput, "kind" | "message" | "contact">) => Promise<void>} saveDraft
 * @property {() => Promise<Draft | null>} loadDraft
 * @property {() => Promise<void>} clearDraft
 */

/**
 * @param {ClientConfig} config
 * @returns {FeedbackClient}
 */
export function createFeedbackClient(config) {
  requireConfig(config);
  const { drafts } = config;
  if (!drafts || typeof drafts.get !== "function" || typeof drafts.set !== "function" || typeof drafts.clear !== "function") {
    throw new TypeError("feedback-client: config.drafts must provide get, set and clear");
  }
  const baseUrl = (config.baseUrl ?? DEFAULT_BASE_URL).replace(/\/+$/, "");
  if (config.fetch === undefined && typeof fetch !== "function") {
    throw new TypeError("feedback-client: this runtime has no global fetch; pass config.fetch");
  }
  const fetchImpl = config.fetch ?? ((input, init) => fetch(input, init));
  const now = config.now ?? (() => new Date());

  /** @param {Pick<UserInput, "kind" | "message" | "contact">} input */
  async function saveDraft(input) {
    await drafts.set({ kind: input.kind, message: input.message, contact: input.contact ?? "", saved_at: now().toISOString() });
  }

  return {
    preview(input) {
      const payload = buildPayload(config, input, { now });
      return { payload, text: reviewText(payload) };
    },

    async send(input) {
      // Build first: a developer error (bad context, bad kind) should throw
      // before anything is stored or sent.
      const payload = buildPayload(config, input, { now });
      // Keep the draft before the first request so an interrupted send,
      // a crash or a closed app loses nothing the user wrote. A store that
      // refuses is a failure to show, not to throw: nothing has been sent.
      try {
        await saveDraft(input);
      } catch {
        return fail("draft_not_saved");
      }

      const ticket = await post(fetchImpl, `${baseUrl}/v1/ticket`, {
        product: payload.product,
        version: payload.version,
        platform: payload.platform,
      });
      if (!ticket.ok) return ticket;
      const issued = ticket.body.ticket;
      if (typeof issued !== "string") return fail("bad_response", ticket.status);

      const sent = await post(fetchImpl, `${baseUrl}/v1/feedback`, { ...payload, ticket: issued });
      if (!sent.ok) return sent;

      // The report is stored and the ticket consumed. A store that now
      // refuses to clear must not hide the ticket code — a retap would send
      // a duplicate — so the success stands and the result says the draft
      // is still there.
      let draftCleared = true;
      try {
        await drafts.clear();
      } catch {
        draftCleared = false;
      }
      return { ok: true, ticket: issued, draftCleared };
    },

    saveDraft,
    async loadDraft() {
      return (await drafts.get()) ?? null;
    },
    async clearDraft() {
      await drafts.clear();
    },
  };
}

/**
 * One JSON POST. A thrown fetch (offline, DNS, refused) is `no_connection`;
 * a non-JSON or shapeless body is `bad_response`; an `{ error }` body is
 * mapped through `errorMessage`. Nothing here retries.
 * @param {typeof fetch} fetchImpl
 * @param {string} url
 * @param {unknown} body
 * @returns {Promise<{ ok: true, status: number, body: Record<string, unknown> } | SendFailure>}
 */
async function post(fetchImpl, url, body) {
  /** @type {Response} */
  let response;
  try {
    response = await fetchImpl(url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
  } catch {
    return fail("no_connection");
  }

  /** @type {unknown} */
  let parsed;
  try {
    parsed = await response.json();
  } catch {
    return fail("bad_response", response.status);
  }
  if (!isPlainObject(parsed)) return fail("bad_response", response.status);
  if (response.ok) return { ok: true, status: response.status, body: parsed };

  const code = typeof parsed.error === "string" ? parsed.error : null;
  if (code === null) return fail("bad_response", response.status);
  return fail(code, response.status, typeof parsed.detail === "string" ? parsed.detail : undefined);
}

/**
 * @param {string} code
 * @param {number} [status]
 * @param {string} [detail]
 * @returns {SendFailure}
 */
function fail(code, status, detail) {
  /** @type {SendFailure} */
  const failure = { ok: false, code, message: errorMessage(code, detail) };
  if (status !== undefined) failure.status = status;
  if (detail !== undefined) failure.detail = detail;
  return failure;
}
