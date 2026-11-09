# 09 — Golden image, recipient card, install-guide fixes, dress rehearsal

**Status:** Not started.
**Type:** Process + docs, with one hardware build. Last brief before the unit ships.
**Depends on:** 03, 05, 06, 08 merged and released; 02 verified on the kiosk; 04 if the service is live.
**Unblocks:** shipping.

---

## 1. Goal

Produce the SD card that goes in the box, prove it works in a house we
have never seen, and leave behind the two documents the owner actually
reads. Nothing on the card may come from the reference kiosk's data.

## 2. Decisions locked

| # | Decision | Choice |
|---|---|---|
| 1 | Build method | Fresh Raspberry Pi OS (64-bit, desktop) flashed with Raspberry Pi Imager; **no** Wi-Fi prefilled (the wizard does it); hostname `rootboard`; SSH enabled with the per-unit password from the card; locale and keyboard set to the owner's country; time zone left for the wizard. Then `sudo bash scripts/provision.sh --channel <stable|beta>` from brief 06. Never clone the reference kiosk's card. |
| 2 | What must be absent | `service-account.json`, `.env` weather keys, `calendar.db*`, `data/` (except the default `dashboard.json` the app writes itself), `/widgets/`, `.update-backups/`, the reference kiosk's Firefox profile, any journal from the build session (`journalctl --rotate && --vacuum-time=1s` before the final shutdown). A `scripts/image-check.sh` asserts each of these and prints a signed-off list; brief 06's provision script gains this as `--final-check`. |
| 3 | What must be present | Current release on the chosen channel built and health-checked; polkit rule; wifi-selfheal timer; persistent journald; power-save off; Firefox zoom prefs and touch `mouseEmulation="no"`; Avahi; the wizard armed (`setup.completedAt` absent). |
| 4 | Install guide | Rewrite `INSTALLATION.md` step 10 for Firefox under labwc as actually deployed (the existing `TASKS.md` item), fold §12's Wi-Fi hardening into the provision script's description, and move the manual Google Cloud steps to an "Advanced" appendix per brief 02. `client/src/pages/setup.tsx` mirrors the result. |
| 5 | Recipient card | One page, printed, in the box. Front: what Rootboard does and does not do (no accounts, no tracking, calendar data stays between the unit and Google), the three things to do (plug in; follow the screen; connect Google), and "Send feedback is in Settings — please use it for everything". Back: the unit's SSH user and password, the name `rootboard.local`, "if the screen says no network…", "if the screen is black…", and the line "Your AI agent can read AGENTS.md at <project repo URL> to help with anything else." Source lives at `docs/recipient-card.md` with generic placeholders; the printed copy has the real password written in by hand, never typed into the repo. |
| 6 | Beta agreement | Plain words, half a page, in the box and shown once by the wizard's Welcome step as a "This is a beta" note with Continue: it is a beta; what feedback contains and that it is reviewed by the project; that nothing else leaves the unit; how to turn it off (unplug). No legalese. Text in `docs/beta-note.md`. |
| 7 | Dress rehearsal | Boot the finished card on a Pi in a different room on a different Wi-Fi network (a phone hotspot counts), with only the card in the box as help. Complete the wizard, connect a test Google account, send one feedback item, pair a laptop and read diagnostics, install the template widget from USB, trigger a beta release and watch it update. Time each step; write the times into §4. Any step that needed knowledge not on the card is a bug in this brief or an earlier one. |
| 8 | Spare | Build two cards. One ships, one stays as the fastest recovery path. Both pass `image-check`. |

## 3. Work

1. `scripts/image-check.sh` and the `--final-check` hook.
2. `INSTALLATION.md` rewrite per decision 4; `setup.tsx` sync; `README.md`
   features list updated for OAuth, wizard, feedback, channels.
3. `docs/recipient-card.md`, `docs/beta-note.md`.
4. Build, check, rehearse, fix, rebuild, check, rehearse again until the
   rehearsal needs nothing off-card.
5. Record the rehearsal in §4 and tick the `TASKS.md` item.

## 4. Rehearsal log (fill in)

| Step | Time | Needed help not on the card? |
|---|---|---|
| Wizard: Wi-Fi | | |
| Wizard: time zone | | |
| Wizard: Google | | |
| Wizard: weather | | |
| Send feedback | | |
| Pair + diagnostics | | |
| Widget from USB | | |
| Beta update | | |

## 5. Docs

Everything in §3.2–3.3, plus `docs/SPEC.md`'s "current as of" stamp and
`docs/decisions/0021-golden-image-from-provision-script.md` (why build
from script, never clone).

## 6. Security review (CLAUDE.md, mandatory)

This brief touches docs that are easy to get wrong: the recipient card
and beta note must contain **no** real names, passwords, hostnames beyond
`rootboard.local`, or network names. Grep the diff for `@`, `192.168.`,
`/home/`, and the owner's details before every push.

## 7. PR tier

**Soft flag** — privacy text (beta note, card) changes. Principle 3 (clear
purpose): the card says plainly what the product does and does not do.
