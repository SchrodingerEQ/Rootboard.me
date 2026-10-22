# 0014 — Weather resilience on a lossy link: patient timeouts, poll-while-failing, persisted last-good
Date: 2026-10-21
Status: accepted

## Decision

1. The server gives Open-Meteo 20 s per attempt (was 10 s), and the What
   to Wear widget's own fetch timeout is 30 s so the browser never
   abandons a host-path request the server is about to answer.
2. Clients keep driving upstream refreshes (no server-side timer), but
   poll faster only while the last answer was a failure: every minute
   with nothing to show, every 5 minutes while a stale forecast is being
   re-served, 30 minutes otherwise (`client/src/lib/weather-poll.ts`).
   What to Wear retries 1, 2 and 5 minutes after consecutive failures
   from its existing one-minute clock, then waits for the host.
3. The last good forecast is persisted to `data/weather-cache.json`
   (atomic write; `data/` is already preserved across updates) and
   loaded at startup as the stale fallback only. It is never served as
   fresh.

## Context and alternatives

Weather on the reference kiosk failed intermittently and a reboot
"fixed" it. On-device measurement showed the Wi-Fi link dropping about a
quarter of its packets in multi-second bursts, with the same loss to the
home router and to Open-Meteo — a link problem, not an app one. The app
amplified each burst: one stall past 10 s failed the fetch, clients only
asked again 30 minutes later, and a restart began with an empty cache,
so the header chip vanished and What to Wear showed "Can't reach the
weather".

Alternatives considered:

- **A server-side background refresh loop.** Keeps the cache warm
  regardless of clients, but it is off-device traffic no request asked
  for, which the privacy principle rules out ("never in the
  background"). Client-driven polling stays.
- **Retrying inside one request** (several attempts with backoff before
  answering). Holds a request open for 40 s or more and still leaves the
  30-minute gap if every attempt stalls. Shorter client polling while
  failing bounds the gap without long requests.
- **A shorter cache TTL.** More upstream calls when healthy for no gain.
- **Fixing the link** (disable Wi-Fi power save, or use Ethernet). The
  real fix, but device setup, not app code; the app should still cope
  with a lossy link.

## Consequences

- During an outage a kiosk asks Open-Meteo up to about once a minute
  (cold cache) or once per 5 minutes (stale); healthy traffic is
  unchanged at two calls per hour.
- `data/weather-cache.json` is a new file under the kiosk's data dir;
  it holds only the derived forecast (no coordinates) and is covered by
  the existing `data/` gitignore and preserve rules.
- What to Wear gains its first retry logic; the manifest cadence and
  the contract's host-driven refresh are unchanged.
