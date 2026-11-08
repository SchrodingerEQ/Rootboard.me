# 04 — In-product feedback

**Status:** Not started. **Blocked** until the Crucible feedback service
is deployed (private planning records track that). Build against its
documented API as soon as a staging endpoint exists.
**Type:** Client dialog + one server proxy. One session.
**Depends on:** external service; 05 for the optional diagnostics attachment (can ship without it and add later).
**Unblocks:** the beta itself — without this, feedback arrives by text message.

---

## 1. Goal

From the Settings popover, the owner can tap **Send feedback**, choose a
kind, type a message on the on-screen keyboard, **see exactly what will
be sent**, and send it with one tap. They get a short ticket code back.
Nothing is sent without that tap. This is the only channel the beta
relies on, so it must work on the kiosk's lossy Wi-Fi and never lose a
draft.

The flow was already specified in `TASKS.md` (item "Add in-product
feedback"); this brief is that item made executable.

## 2. Decisions locked

| # | Decision | Choice |
|---|---|---|
| 1 | Entry point | Settings popover → **Send feedback** row, visible in every auth state (a tester who cannot sign in to Google needs it most). |
| 2 | Steps | Kind (Bug · Idea · Question · Praise) → Message (OSK, multiline, 2000 chars) → Review → Sent (ticket code, Copy, Done). |
| 3 | What is sent | `kind`, `message`, `appVersion` (`shared/version.ts`), `widgets` (enabled ids and versions from `dashboard.json`), `theme` id, `platform` ("rootboard-kiosk"), and — only if the owner ticks it — the diagnostics bundle from brief 05. **No** account email, **no** calendar content, **no** coordinates. The Review step renders the exact JSON in a readable list; nothing not shown is sent. |
| 4 | Transport | Client → kiosk server → feedback service. The server proxy adds nothing the client did not show, exists only so the feedback host is one allow-listed destination in server code and so the client never needs CORS. Service URL in `shared/feedback-endpoint.ts`, overridable by `FEEDBACK_URL` env for staging. HTTPS only. |
| 5 | Protocol | Per the feedback service's API docs: create a ticket, then post the feedback body against it; show the ticket code the service returns. If the two-call shape changes, follow the service docs and update this table. |
| 6 | Offline | On any network failure keep the draft in `data/feedback-outbox.json` (server-side so it survives a browser reload), tell the owner "Saved. Rootboard will send this when it is back online.", and retry from the server every 5 minutes with backoff up to 24 h. Show pending count in Settings. |
| 7 | Identity | None. No user id, no device id. The ticket code is the only correlation handle, and the owner keeps it. If the beta needs to tell units apart, the owner types a nickname once into Settings and it travels in `platform`; it is shown in Review like everything else. |
| 8 | Rate | One send per 30 s per kiosk, enforced server-side, with a friendly message. |

## 3. Where the code goes

- `client/src/components/feedback/feedback-dialog.tsx` using the shared
  Dialog, OSK-lifted via the existing `data-osk-open` mechanism (SPEC
  §3.3). Theme tokens only; 48 px+ targets per SPEC §3.8.
- `server/services/feedbackService.ts`: build payload from config +
  version, send, outbox persistence and retry loop (timer only when the
  outbox is non-empty).
- Routes: `POST /api/feedback` (same-origin kiosk UI; not localhost-only,
  since brief 05's pairing covers LAN callers), `GET /api/feedback/outbox`.
- `settings-menu.tsx`: the row and the pending badge.
- `.gitleaks.toml`: nothing new; the endpoint URL is public.

## 4. Acceptance

- Happy path yields a ticket code visible on screen and in the service.
- Pull Wi-Fi mid-send: draft lands in the outbox, message shown, restores
  and sends after reconnect without user action; ticket code appears in
  Settings → Feedback → Sent.
- Review step shows every field that is on the wire (verify by diffing the
  proxied body against the rendered list in a test).
- Diagnostics unticked: body has no `diagnostics` key at all.
- `npm test`: payload builder, outbox round-trip, backoff schedule.

## 5. Docs

- `docs/SPEC.md` §3.7 and a new §3.12 "Feedback".
- Privacy text in the app and `README.md`: "Feedback you choose to send
  goes to the project's feedback service; it contains what the review
  screen shows and nothing else."
- `docs/decisions/0017-feedback-via-server-proxy.md`.

## 6. PR tier

**Soft flag** — new network destination and privacy text (PR-POLICY
privacy trigger). Principle 1: user-initiated, fully previewed,
identity-free. Principle 6: no prompts, no nags, no "rate us".

## 7. Out of scope

Screenshots (kiosk has no screenshot permission path yet), two-way
replies inside the app, any analytics.
