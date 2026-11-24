// Crucible feedback — React (web) wrapper over clients/core/feedback-client.js.
//
// A dialog that walks the contract's six steps (Crucible-HQ/departments/pm/
// feedback-contract.md §2): pick a kind → write → review exactly what will be
// sent → Send → read the ticket code. The payload, the network and the draft
// store are the core client's job; this file renders state, forwards clicks,
// and, for products whose registry entry requires it, hosts the Cloudflare
// Turnstile widget and hands its token to core as `input.turnstileToken`.
//
// Plain React and plain HTML elements with `crc-feedback-*` class names; the
// default look is feedback-dialog.css, which a host may replace. No UI
// library, no CSS framework. Every sentence the user reads is in
// DEFAULT_STRINGS and can be overridden through the `strings` prop.
//
// Twin: clients/react-native/feedback-sheet.js carries the same steps,
// strings and state machine for React Native. Each wrapper is one file to
// copy into a product, so the flow is deliberately not shared; a change to
// a step or a sentence is made in both.
import { useEffect, useId, useMemo, useRef, useState } from "react";

/** @typedef {import("./feedback-client.js").FeedbackClient} FeedbackClient */
/** @typedef {import("./feedback-client.js").UiKind} UiKind */
/** @typedef {import("react").ReactNode} ReactNode */

/** Cloudflare's widget script, loaded once, only when a site key is given. */
export const TURNSTILE_SCRIPT_URL = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";

/** The server's cap on `contact` (schema/feedback.schema.json); the box stops there. */
export const CONTACT_MAX_LENGTH = 254;

/** The screens, in the contract's order. */
export const STEPS = Object.freeze(["kind", "message", "review", "done"]);

/** @typedef {typeof STEPS[number]} Step */

/**
 * The three kinds are peers (founder decision 2026-11-23): same size, same
 * weight, listed in the contract's order.
 */
export const KIND_OPTIONS = Object.freeze(
  /** @type {ReadonlyArray<{ kind: UiKind, label: "kindGreat" | "kindBroken" | "kindIdea", hint: "kindGreatHint" | "kindBrokenHint" | "kindIdeaHint" }>} */ ([
    { kind: "great", label: "kindGreat", hint: "kindGreatHint" },
    { kind: "broken", label: "kindBroken", hint: "kindBrokenHint" },
    { kind: "idea", label: "kindIdea", hint: "kindIdeaHint" },
  ]),
);

/** Every user-facing sentence. `{count}` in `charactersLeft` is replaced. */
export const DEFAULT_STRINGS = Object.freeze({
  title: "Feedback",
  closeLabel: "Close feedback",
  kindPrompt: "What would you like to tell us?",
  kindGreat: "Great",
  kindGreatHint: "Something you like",
  kindBroken: "Broken",
  kindBrokenHint: "Something broken",
  kindIdea: "Idea",
  kindIdeaHint: "An idea or suggestion",
  messageLabel: "Your message",
  messagePlaceholder: "Tell us what happened, or what you think.",
  charactersLeft: "{count} characters left",
  contactLabel: "Your email, if you'd like a reply",
  contactPlaceholder: "Optional",
  reviewTitle: "Here's what will be sent",
  reviewHint: "Nothing is sent until you press Send.",
  turnstileHint: "Complete the spam check, then press Send.",
  turnstileUnavailable: "The spam check could not be loaded. Check your connection and try again.",
  back: "Back",
  next: "Next",
  send: "Send",
  sending: "Sending…",
  done: "Done",
  doneTitle: "Thank you",
  ticketLabel: "Your ticket code",
  quoteCode: "Quote this code if you write again.",
  draftKept: "Your draft is still saved in this browser and will appear next time you open Feedback.",
  draftLoadFailed: "Your saved draft could not be read in this browser.",
});

/** @typedef {Partial<typeof DEFAULT_STRINGS>} Strings */

/**
 * What a host's own text control receives when it replaces the defaults
 * (a kiosk with an on-screen keyboard, for instance). Keep `id` on the
 * element so the visible label stays attached to it.
 * @typedef {object} TextInputRenderProps
 * @property {"message" | "contact"} kind
 * @property {string} id
 * @property {string} value
 * @property {(value: string) => void} onChange
 * @property {number} maxLength
 * @property {string} placeholder
 * @property {string} label
 */

/**
 * @typedef {object} FeedbackDialogProps
 * @property {FeedbackClient} client  A `createFeedbackClient(...)` instance from core/.
 * @property {boolean} contact        Show the optional "Your email, if you'd like a reply" box. Never required, never pre-filled.
 * @property {() => void} onClose     Called from the close control, Escape, and the Done button.
 * @property {string} [turnstileSiteKey]  Public site key for products whose registry entry requires Turnstile. Loads the widget on the review step; unset means no script and no token.
 * @property {(props: TextInputRenderProps) => ReactNode} [renderTextInput]  Replace the message `<textarea>` and contact `<input>`.
 * @property {Strings} [strings]      Overrides for any sentence in DEFAULT_STRINGS.
 * @property {number} [messageMaxLength]  Default 4000 (the server's cap). Cap lower for two-byte scripts: core rule 8.
 * @property {boolean} [visible]      Default true. Renders nothing when false.
 */

// ---------------------------------------------------------------------------
// The flow — a small state machine over the core client.

/**
 * @param {FeedbackClient} client
 * @param {{ strings?: Strings, turnstile?: boolean }} [options]  `turnstile: true` makes Send wait for a token.
 */
export function useFeedbackFlow(client, options = {}) {
  const strings = useMemo(() => ({ ...DEFAULT_STRINGS, ...options.strings }), [options.strings]);
  const needsTurnstile = options.turnstile === true;
  const [step, setStep] = useState(/** @type {Step} */ ("kind"));
  const [kind, setKind] = useState(/** @type {UiKind | null} */ (null));
  const [message, setMessage] = useState("");
  const [contact, setContact] = useState("");
  const [turnstileToken, setTurnstileToken] = useState(/** @type {string | null} */ (null));
  // Bumped when the server refuses a token: the widget only issues one token
  // per render, so the dialog remounts it (via `key`) for a fresh check.
  const [turnstileAttempt, setTurnstileAttempt] = useState(0);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState(/** @type {string | null} */ (null));
  const [success, setSuccess] = useState(/** @type {{ ticket: string, draftCleared: boolean } | null} */ (null));
  const stringsRef = useRef(strings);
  stringsRef.current = strings;

  // On open: prefill from the draft the host kept (core rule 4). A store that
  // cannot be read is shown, not swallowed.
  useEffect(() => {
    let cancelled = false;
    client.loadDraft().then(
      (draft) => {
        if (cancelled || !draft) return;
        setKind(draft.kind);
        setMessage(draft.message);
        setContact(draft.contact ?? "");
      },
      () => {
        if (!cancelled) setError(stringsRef.current.draftLoadFailed);
      },
    );
    return () => {
      cancelled = true;
    };
  }, [client]);

  /** @returns {import("./feedback-client.js").UserInput} */
  function currentInput() {
    return { kind: /** @type {UiKind} */ (kind), message, contact, ...(turnstileToken !== null ? { turnstileToken } : {}) };
  }

  // The review text comes from core, verbatim (rule 2). Computed only on the
  // review step; `preview` is pure and throws only for developer errors.
  const previewText = useMemo(
    () => (step === "review" && kind !== null ? client.preview(currentInput()).text : null),
    [client, step, kind, message, contact, turnstileToken],
  );

  /** @param {UiKind} chosen */
  function chooseKind(chosen) {
    setKind(chosen);
    setError(null);
    setStep("message");
  }

  function goBack() {
    if (sending) return;
    setError(null);
    if (step === "message") setStep("kind");
    else if (step === "review") {
      setTurnstileToken(null);
      setStep("message");
    }
  }

  function goNext() {
    if (step === "message" && message.trim().length > 0) setStep("review");
  }

  const canSend = step === "review" && !sending && (!needsTurnstile || turnstileToken !== null);

  /** The only network call. Disabled while in flight; never retries. */
  async function send() {
    if (!canSend || kind === null) return;
    setSending(true);
    setError(null);
    /** @type {import("./feedback-client.js").SendResult} */
    let result;
    try {
      result = await client.send(currentInput());
    } finally {
      // core throws only for developer errors (bad config or context); let
      // that surface, but never leave Send stuck disabled.
      setSending(false);
    }
    if (result.ok) {
      setSuccess({ ticket: result.ticket, draftCleared: result.draftCleared });
      setKind(null);
      setMessage("");
      setContact("");
      setTurnstileToken(null);
      setStep("done");
    } else {
      // Keep the form as it is; the draft is already in the host's store. A
      // used or failed Turnstile token must not be sent twice.
      if (result.code.startsWith("turnstile_")) {
        setTurnstileToken(null);
        setTurnstileAttempt((n) => n + 1);
      }
      setError(result.message);
    }
  }

  const canGoNext = step === "message" && message.trim().length > 0;

  return { strings, step, kind, message, contact, turnstileToken, turnstileAttempt, sending, error, success, previewText, canSend, canGoNext, chooseKind, setMessage, setContact, setTurnstileToken, setError, goBack, goNext, send };
}

// ---------------------------------------------------------------------------
// Turnstile — the widget script is loaded once, on demand, and only when the
// host gives a site key. The token is an opaque spam-check value that core
// names (not prints) in the review text and sends as `turnstile_token`.

/**
 * Resolves with the Turnstile API once Cloudflare's script has loaded,
 * adding the script tag on first use. No module state: a second call while
 * the first is loading attaches to the same tag.
 * @returns {Promise<TurnstileApi>}
 */
export function loadTurnstile() {
  if (window.turnstile) return Promise.resolve(window.turnstile);
  /** @type {HTMLScriptElement | null} */
  let script = document.querySelector(`script[src="${TURNSTILE_SCRIPT_URL}"]`);
  if (!script) {
    script = document.createElement("script");
    script.src = TURNSTILE_SCRIPT_URL;
    script.async = true;
    script.defer = true;
    document.head.appendChild(script);
  }
  const tag = script;
  return new Promise((resolve, reject) => {
    tag.addEventListener("load", () => (window.turnstile ? resolve(window.turnstile) : reject(new Error("turnstile script loaded without window.turnstile"))), { once: true });
    tag.addEventListener("error", () => reject(new Error("turnstile script failed to load")), { once: true });
  });
}

/**
 * @param {{ siteKey: string, onToken: (token: string | null) => void, onError: (message: string) => void, unavailableMessage: string }} props
 */
function TurnstileWidget({ siteKey, onToken, onError, unavailableMessage }) {
  const container = useRef(/** @type {HTMLDivElement | null} */ (null));
  const callbacks = useRef({ onToken, onError });
  callbacks.current = { onToken, onError };

  useEffect(() => {
    let cancelled = false;
    /** @type {TurnstileApi | null} */
    let api = null;
    /** @type {string | undefined} */
    let widgetId;
    loadTurnstile().then(
      (turnstile) => {
        if (cancelled || !container.current) return;
        api = turnstile;
        widgetId = turnstile.render(container.current, {
          sitekey: siteKey,
          callback: (token) => callbacks.current.onToken(token),
          "expired-callback": () => callbacks.current.onToken(null),
          "error-callback": () => {
            callbacks.current.onToken(null);
            callbacks.current.onError(unavailableMessage);
          },
        });
      },
      () => {
        if (!cancelled) callbacks.current.onError(unavailableMessage);
      },
    );
    return () => {
      cancelled = true;
      if (api && widgetId !== undefined) api.remove(widgetId);
    };
  }, [siteKey, unavailableMessage]);

  return <div className="crc-feedback-turnstile" ref={container} />;
}

// ---------------------------------------------------------------------------
// The dialog

const FOCUSABLE = 'button:not([disabled]), [href], input:not([disabled]), textarea:not([disabled]), select:not([disabled]), iframe, [tabindex]:not([tabindex="-1"])';

/** @param {HTMLElement} root */
function focusables(root) {
  return /** @type {HTMLElement[]} */ ([...root.querySelectorAll(FOCUSABLE)]);
}

/** @param {TextInputRenderProps} props */
function defaultRenderTextInput({ kind, id, value, onChange, maxLength, placeholder }) {
  const common = {
    id,
    value,
    maxLength,
    placeholder,
    onChange: (/** @type {{ target: { value: string } }} */ e) => onChange(e.target.value),
  };
  return kind === "message" ? (
    <textarea className="crc-feedback-textarea" rows={6} autoFocus {...common} />
  ) : (
    <input className="crc-feedback-input" type="email" autoCapitalize="off" autoCorrect="off" spellCheck={false} {...common} />
  );
}

/**
 * The six steps in a modal dialog: `role="dialog"`, focus trapped while open,
 * Escape closes. Mount it when the user opens Feedback and unmount it on
 * close; the flow's state lives for the mount.
 * @param {FeedbackDialogProps} props
 */
export function FeedbackDialog({ client, contact: contactEnabled, onClose, turnstileSiteKey, renderTextInput = defaultRenderTextInput, strings: stringOverrides, messageMaxLength = 4000, visible = true }) {
  const flow = useFeedbackFlow(client, { strings: stringOverrides, turnstile: typeof turnstileSiteKey === "string" && turnstileSiteKey.length > 0 });
  const { strings } = flow;
  const dialog = useRef(/** @type {HTMLDivElement | null} */ (null));
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;
  const titleId = useId();
  const messageId = useId();
  const contactId = useId();

  // Focus management: focus moves into the dialog on open and on every step,
  // Tab cycles inside it, Escape closes, and focus returns to where it was.
  useEffect(() => {
    const root = dialog.current;
    if (!root || !visible) return;
    const previous = document.activeElement;
    /** @param {KeyboardEvent} e */
    function onKeyDown(e) {
      if (e.key === "Escape") {
        e.preventDefault();
        onCloseRef.current();
        return;
      }
      if (e.key !== "Tab" || !root) return;
      const items = focusables(root);
      const first = items[0];
      const last = items[items.length - 1];
      if (!first || !last) return;
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    }
    /** @param {FocusEvent} e */
    function onFocusIn(e) {
      if (root && e.target instanceof Node && !root.contains(e.target)) focusables(root)[0]?.focus();
    }
    root.addEventListener("keydown", onKeyDown);
    document.addEventListener("focusin", onFocusIn);
    return () => {
      root.removeEventListener("keydown", onKeyDown);
      document.removeEventListener("focusin", onFocusIn);
      if (previous instanceof HTMLElement) previous.focus();
    };
  }, [visible]);

  // On each step, focus the first control in the body (not the × button),
  // unless something in the dialog already has focus (a field's autoFocus).
  useEffect(() => {
    const root = dialog.current;
    if (!root || !visible) return;
    if (root.contains(document.activeElement)) return;
    const body = root.querySelector(".crc-feedback-body");
    (focusables(body instanceof HTMLElement ? body : root)[0] ?? focusables(root)[0])?.focus();
  }, [flow.step, visible]);

  if (!visible) return null;

  const errorLine = flow.error !== null && (
    <p className="crc-feedback-error" role="alert">
      {flow.error}
    </p>
  );

  return (
    <div className="crc-feedback-backdrop">
      <div className="crc-feedback-dialog" role="dialog" aria-modal="true" aria-labelledby={titleId} ref={dialog}>
        <div className="crc-feedback-header">
          <h2 className="crc-feedback-title" id={titleId}>
            {flow.step === "done" ? strings.doneTitle : strings.title}
          </h2>
          <button type="button" className="crc-feedback-close" aria-label={strings.closeLabel} onClick={onClose}>
            ×
          </button>
        </div>

        {flow.step === "kind" && (
          <div className="crc-feedback-body">
            <p className="crc-feedback-prompt">{strings.kindPrompt}</p>
            <div className="crc-feedback-options">
              {KIND_OPTIONS.map((option) => (
                <button
                  key={option.kind}
                  type="button"
                  className={`crc-feedback-option${flow.kind === option.kind ? " crc-feedback-option--selected" : ""}`}
                  aria-label={strings[option.label]}
                  aria-description={strings[option.hint]}
                  aria-pressed={flow.kind === option.kind}
                  onClick={() => flow.chooseKind(option.kind)}
                >
                  <span className="crc-feedback-option-label">{strings[option.label]}</span>
                  <span className="crc-feedback-option-hint">{strings[option.hint]}</span>
                </button>
              ))}
            </div>
            {errorLine}
          </div>
        )}

        {flow.step === "message" && (
          <div className="crc-feedback-body">
            <label className="crc-feedback-label" htmlFor={messageId}>
              {strings.messageLabel}
            </label>
            {renderTextInput({ kind: "message", id: messageId, value: flow.message, onChange: flow.setMessage, maxLength: messageMaxLength, placeholder: strings.messagePlaceholder, label: strings.messageLabel })}
            <p className="crc-feedback-hint">{strings.charactersLeft.replace("{count}", String(Math.max(0, messageMaxLength - flow.message.length)))}</p>
            {contactEnabled && (
              <>
                <label className="crc-feedback-label" htmlFor={contactId}>
                  {strings.contactLabel}
                </label>
                {renderTextInput({ kind: "contact", id: contactId, value: flow.contact, onChange: flow.setContact, maxLength: CONTACT_MAX_LENGTH, placeholder: strings.contactPlaceholder, label: strings.contactLabel })}
              </>
            )}
            {errorLine}
            <div className="crc-feedback-row">
              <button type="button" className="crc-feedback-button" onClick={flow.goBack}>
                {strings.back}
              </button>
              <button type="button" className="crc-feedback-button crc-feedback-button--primary" onClick={flow.goNext} disabled={!flow.canGoNext}>
                {strings.next}
              </button>
            </div>
          </div>
        )}

        {flow.step === "review" && (
          <div className="crc-feedback-body">
            <p className="crc-feedback-label">{strings.reviewTitle}</p>
            <p className="crc-feedback-hint">{strings.reviewHint}</p>
            <pre className="crc-feedback-review">{flow.previewText}</pre>
            {turnstileSiteKey && (
              <>
                <p className="crc-feedback-hint">{strings.turnstileHint}</p>
                <TurnstileWidget key={flow.turnstileAttempt} siteKey={turnstileSiteKey} onToken={flow.setTurnstileToken} onError={flow.setError} unavailableMessage={strings.turnstileUnavailable} />
              </>
            )}
            {errorLine}
            <div className="crc-feedback-row">
              <button type="button" className="crc-feedback-button" onClick={flow.goBack} disabled={flow.sending}>
                {strings.back}
              </button>
              <button type="button" className="crc-feedback-button crc-feedback-button--primary" onClick={flow.send} disabled={!flow.canSend}>
                {flow.sending ? strings.sending : strings.send}
              </button>
            </div>
          </div>
        )}

        {flow.step === "done" && flow.success !== null && (
          <div className="crc-feedback-body">
            <p className="crc-feedback-label">{strings.ticketLabel}</p>
            <output className="crc-feedback-code" aria-label={`${strings.ticketLabel}: ${flow.success.ticket}`}>
              {flow.success.ticket}
            </output>
            <p className="crc-feedback-prompt">{strings.quoteCode}</p>
            {!flow.success.draftCleared && <p className="crc-feedback-hint">{strings.draftKept}</p>}
            <div className="crc-feedback-row">
              <button type="button" className="crc-feedback-button crc-feedback-button--primary" onClick={onClose}>
                {strings.done}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
