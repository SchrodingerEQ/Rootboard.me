# 03 — First-run setup wizard (Wi-Fi, time zone, Google, weather)

**Status:** Session 1 (wizard shell, Network, Time zone, Weather, Settings entries, polkit rule) merged 2026-11-16 as #35 (soft flag, founder-approved; adds "Continue without network" on the boot-time Network screen); not yet in a release. Session 2 (the Google step) not started; this line and the `TASKS.md` item stay open until it merges.
**Type:** Client wizard + server network control + Pi image policy. Two sessions.
**Depends on:** session 1: 01 (merged 2026-11-11), so it can run now.
Session 2: 02 (Google sign-in).
**Unblocks:** 09.
**Closes in `TASKS.md`:** the beta sub-item 03, after session 2 merges.

**Two sessions (split 2026-11-14 so most of this brief runs before 02):**

- **Session 1, runs now:** the wizard shell and run condition, the
  Welcome, Network, Time zone, Weather and Done steps, the polkit rule,
  and Settings → Run setup again. The Google step shows today's
  `AuthDialog` (the service-account instructions) as a placeholder, with
  Skip.
- **Session 2, after 02 merges:** the Google step embeds brief 02's
  connect dialog (decision 7), and the Google line of §4 is checked. The
  Status line and the `TASKS.md` item stay open until this merges.

---

## 1. Goal

A pre-flashed unit, plugged in for the first time in a house we have
never seen, walks its owner through everything it needs with fingers
only: join Wi-Fi, confirm the time zone, connect Google, set a weather
location. No `.env`, no SSH, no laptop. The same screens are reachable
later from Settings so any step can be redone.

This is the TV pattern (on-screen keyboard, scan and pick), not the
phone-hotspot pattern. Rootboard has a 21.5-inch touchscreen and an
on-screen keyboard already (`client/src/lib/osk.ts`,
`components/keyboard/`); use them.

## 2. Decisions locked

| # | Decision | Choice |
|---|---|---|
| 1 | When it runs | On boot when `data/config/dashboard.json` has no `setup.completedAt`, **or** when the Pi has no active network connection (so a moved unit re-enters Wi-Fi setup by itself). Otherwise never, unless opened from Settings. The network condition is **checked once, at boot**, after NetworkManager has had time to bring a saved connection up (allow about 90 s: a reconnect after an access-point drop took 45–70 s on the reference kiosk). A drop while the dashboard is running never opens the wizard; the `wifi-selfheal` timer (`INSTALLATION.md` §12.3) reconnects, and the app's offline handling covers the gap. |
| 2 | Steps and order | Welcome → Network → Time zone → Google → Weather → Done. Each step has Skip except Network. Ethernet detected = Network step auto-passes with a one-line confirmation. While the Network step is showing, it also passes on its own the moment any saved connection comes up, so a router that is slow to return after a power cut never strands the unit on the wizard. Founder 2026-11-16: the boot-time Network screen (decision 1's no-network case) offers Continue without network; first-run Network still has no Skip. |
| 3 | Network control | NetworkManager via `nmcli`, which the Pi image already uses and which `INSTALLATION.md` §12 already depends on. The server runs nmcli as the app's own user; a **polkit rule** on the image grants that user `org.freedesktop.NetworkManager.settings.modify.system`, `.network-control` and `.wifi.scan` — no sudo, no root. The rule file is shipped in `scripts/` and installed by brief 06's provision script: whichever of 03 and 06 merges second adds the install step to `scripts/provision.sh`. |
| 4 | Where Wi-Fi secrets go | NetworkManager's own store (system connection profile), never our files or logs. The API accepts the password in a POST body over the loopback interface only and discards it after `nmcli` returns. |
| 5 | Localhost-only | Every wizard endpoint that changes system state is guarded by `isLocalRequest` (as update/rollback are today). A phone on the LAN must not be able to re-point the kiosk's Wi-Fi. |
| 6 | Time zone | Set with `timedatectl set-timezone` through the same polkit mechanism (`org.freedesktop.timedate1.set-timezone`). Offer a searchable list; default to the browser's reported zone. Also display the current time so a wrong zone is obvious. |
| 7 | Google | Embeds brief 02's connect dialog as a step. |
| 8 | Weather | Embeds brief 01's lookup as a step. |
| 9 | Failure copy | Every failure is one plain sentence and a Retry button: "That password didn't work.", "Rootboard can't see that network from here.", "Connected to Wi-Fi, but the internet isn't reachable yet." The internet check is a HEAD request to Google's API host, since that is what the app needs anyway. |
| 10 | Dev/CI behaviour | When nmcli or timedatectl are absent (laptop, CI), the Network and Time-zone steps show "managed outside Rootboard" and pass. The wizard must be fully testable in `npm run dev`. |

## 3. Where the code goes

- New `server/services/networkService.ts`: `status()` (interfaces,
  connected SSID, IP, internet reachability), `scan()`, `connect(ssid,
  psk)`, `forget(ssid)`, `setTimezone(tz)`, `listTimezones()`. Thin
  wrappers over `nmcli -t` output with a 30 s timeout and parsing tests
  against captured fixtures. Detects "tool missing" and reports it as a
  capability, not an error.
- Routes under `/api/system/network/*` and `/api/system/timezone`,
  localhost-only for mutations, read-only status open to the LAN (brief 05
  decides whether even that needs pairing).
- Client: `client/src/pages/setup-wizard.tsx` mounted by `app-shell.tsx`
  *before* the widget host when the run condition holds; the widget host
  must not mount until Done so no widget fetches on a dead network. Reuse
  the Settings popover's field components and the OSK. Theme tokens only.
- `shared/dashboard-config.ts`: optional `setup: { completedAt, version }`
  with the lenient `.catch` posture.
- Settings → System: "Run setup again" and direct entries for Network and
  Time zone. Brief 05 makes Settings open before Google is connected; if
  05 has not merged yet, the wizard's own run condition is the only way
  in before sign-in.
- `scripts/polkit/50-rootboard-network.rules` (shipped) and the kiosk
  systemd unit's user documented in `INSTALLATION.md`.

## 4. Acceptance

- Image with no saved Wi-Fi, no token, no weather: boot → wizard appears
  → scan lists nearby networks (hidden SSID has a "type it" option) →
  wrong password shows the failure sentence → correct password connects
  → time zone step shows the right local time after confirm → Google
  connects (brief 02) → weather set (brief 01) → Done → dashboard.
- Pull the Ethernet cable on a wired unit, reboot: wizard shows Network
  step only; plug back in: auto-passes.
- From Settings, "Run setup again" replays all steps with current values
  pre-filled and nothing reset until confirmed.
- `curl` from another LAN host against a mutation endpoint: 403.
- `npm run dev` on a laptop: wizard renders, system steps show "managed
  outside Rootboard", Google and Weather steps work.

## 5. Docs

- `docs/SPEC.md`: new §3.11 "First-run wizard", §2.2 endpoints, data
  invariants §5 for the `setup` key.
- `INSTALLATION.md`: steps 2 (Imager Wi-Fi prefill becomes optional), 3,
  8 and 9 shrink; new step "First boot" describing the wizard; polkit rule
  install documented; note the required service user.
- `docs/decisions/0018-on-device-setup-via-networkmanager.md`: why nmcli +
  polkit over a hotspot/captive portal and over sudo.

## 6. PR tier

**Soft flag** — the app gains permission to change system network and
time settings (PR-POLICY permissions trigger). Principle 1: Wi-Fi
credentials go only to the OS's own store. The internet-reachability
check is a new network call on a tap/boot; disclose it in the privacy
text, and check the Rootboard section of the Crucible privacy policy
covers it before the release (as with brief 01).

## 7. Out of scope

Hotspot/captive-portal mode; Bluetooth; enterprise (802.1X) Wi-Fi;
language selection beyond what the browser already does; a phone
companion app.
