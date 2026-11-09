# 06 — Agent-facing setup: AGENTS.md, provision script, discovery

**Status:** Not started.
**Type:** Scripts + docs + one small server feature. One session, plus kiosk verification.
**Depends on:** 05 (pairing is how an agent authenticates).
**Unblocks:** 07, 09.

---

## 1. Goal

Everything a new owner might need beyond the first-run wizard is written
so that **their own AI agent** can do it for them, reliably, over the
home network. That means scripts an agent can run and re-run, state it
can read as JSON, a name it can find the unit by, and one short document
that tells it where everything is. Prose for humans stays, but it is no
longer the primary interface for the long tail.

The planning assumption, recorded here deliberately: by the time this
ships, most owners will have access to a capable agent. Design for that,
while keeping the finger-only path (brief 03) complete on its own.

## 2. Decisions locked

| # | Decision | Choice |
|---|---|---|
| 1 | Entry document | `AGENTS.md` at repo root (the emerging cross-tool convention; `CLAUDE.md` stays for *this repo's development* and links to it). Under 200 lines. Sections: what the unit is, how to find it, how to pair, the API surface with one example per endpoint, how to read diagnostics, how to install a widget, how to update, what never to do (no `--force`, no editing `.env` by hand when a Settings path exists, never copy `node_modules` between machines). |
| 2 | Provision script | `scripts/provision.sh`: idempotent, runs on a fresh Raspberry Pi OS (64-bit, desktop) and produces a working kiosk — Node install, app clone or tarball, `npm install`, build, systemd unit for the app under a dedicated user, Firefox kiosk autostart under labwc with the touch and zoom settings from `INSTALLATION.md` step 4, the polkit rule from brief 03, persistent journald and Wi-Fi power-save settings from §12, mDNS. Every step checks before it changes and prints `ok` / `changed` / `failed: <reason>`. `--check` runs the checks only. This is also what brief 09 uses to build the golden image, so it is tested by that build. |
| 3 | Discovery | Advertise the unit as `rootboard.local` via Avahi (installed on Raspberry Pi OS by default; the script sets the hostname and enables the service). The server also prints its LAN URL on the Settings → System screen so a human can read it to an agent. |
| 4 | SSH | Enabled on shipped units with a per-unit password printed on the card in the box, **changed by the wizard?** — no: the wizard is finger-only and must not ask for a new password. Instead, the Settings → System screen shows whether the shipped password is still in use and offers nothing else; `provision.sh --rotate-ssh-password` exists for the agent to run on the owner's instruction. Record the trade-off in the decision record. |
| 5 | Agent writes | Agents interact through the paired API and SSH as the service user. `AGENTS.md` states plainly that running the provision script with `sudo` is the only root action it should ever need, and that the kiosk service is restarted with `systemctl restart`, never by killing Node. |
| 6 | Machine-readable state | `GET /api/system/diagnostics?view=full` (brief 05) is the agent's first read; `AGENTS.md` shows how to interpret the common failure signatures (service-account file missing, OAuth invalid_grant, weather stale, update failed with rollback). |

## 3. Work

1. Write `AGENTS.md`. Test it by giving it, and only it, to a fresh agent
   session with a paired token and asking it to (a) report the unit's
   health, (b) install the template widget, (c) check for updates. Note
   every place it stumbled and fix the document, not the agent.
2. Write `scripts/provision.sh` by executing `INSTALLATION.md` steps 3–12
   on a fresh image **by hand once**, converting each step to a checked
   command as you go. Where the guide and reality disagree (step 10 still
   says Chromium), the script follows reality and the guide is fixed in
   brief 09.
3. Add the LAN URL and mDNS name to Settings → System.
4. Add a `make`-free `scripts/dev-check.sh` that runs `npm run check`,
   `npm test` and the gitleaks hook, so an agent working *on the repo* has
   one command (CI already does the equivalent).

## 4. Acceptance

- Fresh Raspberry Pi OS image + `sudo bash scripts/provision.sh` → reboot →
  wizard appears. Second run prints all `ok`, changes nothing.
- `ping rootboard.local` resolves from a phone on the same Wi-Fi.
- The fresh-agent test in §3.1 completes all three tasks with no human
  hints beyond the pairing code.
- `provision.sh --check` on the reference kiosk reports its actual state
  (expect a few `changed` the first time; record them).

## 5. Docs

- `AGENTS.md` (new), linked from `README.md` and `CLAUDE.md`.
- `INSTALLATION.md` gains a one-paragraph "Fast path: run the provision
  script" at the top of the software section; the manual steps remain as
  the explanation of what the script does.
- `docs/decisions/0019-agent-first-long-tail.md`: why scripts and JSON
  over prose, the SSH-on-by-default trade-off, and why mDNS.

## 6. PR tier

**Safe zone (verified)**. No new outbound network calls. The provision
script changes system state on the Pi but is explicitly invoked.

## 7. Out of scope

Any cloud relay or remote-access tunnel; a phone app; Windows/macOS hosts.
