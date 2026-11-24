# 0019 — In-product feedback through the shared Crucible client
Date: 2026-11-24
Status: proposed (beta-launch brief 04, run as WP-01; accepted when the
founder merges its pull request)

## Decision

1. Settings → **Send feedback** opens the shared Crucible feedback
   dialog: kind → message (optional contact box) → review of exactly
   what will be sent → Send → ticket code. It follows the Crucible
   feedback contract v1; where this repo and the contract disagree, the
   contract wins.
2. The kiosk's browser calls the feedback service directly
   (`shared/feedback-endpoint.ts`). There is **no kiosk-server proxy**.
3. The client is **copied** from crucible-feedback (`clients/core` and
   `clients/react`, commit in `client/src/feedback/FEEDBACK-CLIENT-VERSION`)
   and not edited here. Rootboard adds only its configuration
   (`rootboard-feedback.ts`), its `context` (`lib/feedback-context.ts`:
   enabled widgets as `id@version` strings, and the theme) and a stylesheet
   in its own theme tokens.
4. `os` comes from the browser, not a fixed "Raspberry Pi OS" as brief 04
   first said: the same build runs in a laptop's dev server, and a fixed
   value would be wrong there. This follows the `/add-feedback` skill.
5. Drafts live in the browser's localStorage. Nothing is ever sent in the
   background: with no connection the draft stays and the owner taps Send
   again.
6. **No live send during development (2026-11-23).** The six steps were
   proven against a local copy of the service. The first real report is
   one `TEST`-prefixed item the founder sends from the kiosk, because a
   test row lands in production.

## Context and alternatives

The 2026-11-08 version of brief 04 planned a kiosk-server proxy with an
outbox that re-sent drafts on its own, four kinds, a unit nickname and an
optional diagnostics attachment. A read of the contract on 2026-11-14
found it forbids a background send (a send without a tap), has three
kinds, a fixed `platform` list, and no attachments. The brief was aligned
that day.

- **A server proxy.** Rejected: its two reasons were CORS and holding the
  outbox. The service allow-lists the kiosk's origin
  (`http://localhost:5000`), and the contract rules out the outbox. A proxy
  would add a server route and a second place the payload is built.
- **Writing Rootboard's own dialog.** Rejected: every Crucible product
  uses the same steps and the same review text, which is how the privacy
  policy's "we tell you what's included" promise is kept. One client,
  tested in its own repo, is easier to keep honest than one per product.
- **Saving the draft on the kiosk server (SQLite).** Rejected: the
  client's draft store is enough; the browser profile survives restarts
  and updates, and the draft never has to leave the browser.

## Consequences

- A new network destination, used only on the owner's tap and shown in
  full before it is used. The README and the review screen say so.
- The crucible-feedback privacy-policy row must be live on the Crucible
  website before the first release that carries this.
- The kiosk must keep serving the app from `http://localhost:5000`; another
  origin is refused by the service until its registry lists it.
- A change to the dialog or the payload is made in crucible-feedback first
  and copied back, with `FEEDBACK-CLIENT-VERSION` updated.
