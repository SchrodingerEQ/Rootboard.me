# 04 — In-product feedback

**Status:** Not started. **Blocked** until (1) the Crucible feedback
service is live and (2) its shared React client (`clients/react/` in the
crucible-feedback repo) exists; private planning records track both.
Rewritten 2026-11-14 to follow the Crucible feedback contract v1 (see the
note under §2).
**Type:** Client dialog built on the shared reference client. One session.
**Depends on:** the two external items above, and 05 (merged), which
makes the Settings entry point open before Google is connected.
**Unblocks:** the beta itself — without this, feedback arrives by text message.
**Closes in `TASKS.md`:** the beta sub-item 04 and "Add in-product feedback".

---

## 1. Goal

From the Settings popover, the owner can tap **Send feedback**, choose a
kind, type a message on the on-screen keyboard, **see exactly what will
be sent**, and send it with one tap. They get a short ticket code back.
Nothing is sent without that tap. This is the only channel the beta
relies on, so a draft must never be lost on the kiosk's lossy Wi-Fi.

The flow is the one every Crucible product uses, fixed by the Crucible
feedback contract (v1, founder-ratified 2026-10-15). Its machine-readable
copy is `schema/feedback.schema.json` in the crucible-feedback repo, and
the client rules are in that repo's `clients/README.md`. Where this brief
and the contract disagree, the contract wins. Changing the contract is
the founder's decision, never this brief's.

## 2. Decisions locked

| # | Decision | Choice |
|---|---|---|
| 1 | Entry point | Settings popover → **Send feedback** row, visible in every auth state (a tester who cannot sign in to Google needs it most). Brief 05 makes the popover open before sign-in. |
| 2 | Steps | Kind (**great** · **broken** · **idea**, sent as `praise` / `bug` / `idea`) → Message (OSK, multiline, up to 4000 characters) with an optional contact address → Review → Sent (ticket code, Copy, Done). These are the contract's words and limits. |
| 3 | What is sent | Exactly the contract's v1 payload: `schema_version: "1"`, `ticket` (issued by the service when Send is tapped, so the Review step shows it as "issued when you tap Send"), `product: "rootboard"`, `version` (`shared/version.ts`), `platform: "kiosk"`, `os` ("Raspberry Pi OS"), `locale`, `kind`, `message`, `client_time`, `contact` only if the owner typed one, and a `context` object holding `widgets` (the enabled widgets as `"<widget>@<version>"` strings: which ones are enabled comes from `dashboard.json`, their versions from the widget manifests via `GET /api/widgets`), `theme` (the active theme as a value) and, optionally, one word each for `calendar_sync`, `weather` and `update` (`ok` / `failing` / `off`). `context` stays under 2 KB, and its **keys** must pass the contract's identifier rule: no key may be or contain `id`, `name`, `user`, `device`, `token` or the rest of that list. That is why widgets go in as plain strings, not as objects with an `id` key. **No** account email, **no** calendar content, **no** coordinates, no network name or address. The Review step lists every field; nothing that is not shown is sent. |
| 4 | Transport | The kiosk's browser calls the feedback service directly, through the shared React client. The service already lists the kiosk's origin (`http://localhost:5000`) and needs no Turnstile check for Rootboard. If the `/add-feedback` skill exists when this runs, use it to install the client. HTTPS only. |
| 5 | Protocol | `POST /v1/ticket`, then `POST /v1/feedback` with the issued ticket; show the ticket code the service returns. If the service's API docs change, follow them. |
| 6 | No connection | Keep the draft on the kiosk (the client's own draft storage; it must survive a page reload) and say plainly that sending needs a connection. **Never send later in the background:** the owner comes back and taps Send again. The contract is explicit that a background send is a send without a tap. |
| 7 | Identity | None: no user id, device id or unit nickname. The ticket code is the only correlation handle, and the owner keeps it. The optional contact field is the only thing that can identify a sender, and only when they type it. Telling units apart would be a contract change for the founder, not a field to add here. |
| 8 | Diagnostics | Not attached. Contract v1 has no attachments, and brief 05's bundle would not fit the 2 KB `context` cap anyway. The owner can open Settings → System → Diagnostics (brief 05) and copy what is asked for into a message. Attaching it would need a contract change ratified by the founder. |
| 9 | Rate | The service enforces its own limits. Show its answer through the shared client's error-code messages rather than adding a second limit here. |

**What changed on 2026-11-14.** The 2026-11-08 version of this brief
predated a careful read of the contract and disagreed with it in five
places. They are fixed above: four kinds (now the contract's three); a
server-side outbox that re-sent drafts on its own (the contract forbids
background sends); a nickname carried in `platform`, which is a fixed
list of values; an optional diagnostics attachment (none in v1); and a
kiosk-server proxy. The proxy existed to avoid CORS and to hold that
outbox. The service's origin allowlist removes the first reason and the
contract removes the second, so the brief now uses the shared client
that every Crucible product is built on.

## 3. Where the code goes

- The shared React client, installed per crucible-feedback
  `clients/README.md` (or by `/add-feedback`), opened from a dialog that
  uses Rootboard's touch keyboard: OSK-lifted through the existing
  `data-osk-open` mechanism (SPEC §3.3), theme tokens only, touch targets
  of 48 px or more (SPEC §3.8).
- `client/src/lib/feedback-context.ts`: builds `context` from the
  dashboard config, the widget manifests, the active theme and the
  existing status queries.
  Unit-tested against the identifier-key rule and the 2 KB cap.
- The service's base URL in one constant, `shared/feedback-endpoint.ts`.
- `settings-menu.tsx`: the **Send feedback** row, and a small marker
  when a draft is waiting.
- `.gitleaks.toml`: nothing new; the endpoint URL is public and there is
  no client secret.

## 4. Acceptance

- Happy path: a ticket code on screen. Confirming that the row arrived
  in the service needs the founder, because a test row lands in
  production; ask before sending one.
- Wi-Fi off before Send: the "needs a connection" message shows, the
  draft survives a page reload, and nothing is sent until Send is tapped
  again after the connection returns.
- The Review step lists every field on the wire. A test diffs the request
  body the client builds against the rendered list; `ticket` is the one
  field filled in after the tap, so the test checks it is the only
  difference.
- `context`: a test feeds it a community widget whose name contains a
  forbidden word (for example `user-notes`) and shows the payload still
  passes the key rule, because widget names are values, never keys.
  Another test keeps it under 2 KB with every widget enabled.
- Signed out of Google: Send feedback is still reachable and works.
- `npm test`: context builder, key rule, size cap.

## 5. Docs

- `docs/SPEC.md` §3.7 and a new §3.12 "Feedback".
- Privacy text in the app and `README.md`: "Feedback you choose to send
  goes to the Crucible feedback service. It contains what the review
  screen shows and nothing else."
- The Crucible privacy policy's change-history row for in-product
  feedback must be live before the first release that carries it (a
  CrucibleWebsite PR, which is a hard stop as published legal text;
  private planning records track it). If another Crucible product ships
  feedback first, the row will exist; check that Rootboard's own section
  mentions feedback too.
- `docs/decisions/0019-in-product-feedback.md`: why the shared client
  rather than a server proxy, and the 2026-11-14 alignment with the
  contract.

## 6. PR tier

**Soft flag** — new network destination and privacy text (PR-POLICY
privacy trigger). Principle 1: user-initiated, fully previewed,
identity-free unless the owner types a contact address. Principle 6: no
prompts, no nags, no "rate us".

## 7. Out of scope

Screenshots and attachments (contract v1 has none), the diagnostics
bundle, a unit nickname, two-way replies inside the app, any analytics.
