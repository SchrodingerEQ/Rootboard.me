# 0018 — On-device setup through NetworkManager and polkit
Date: 2026-11-14
Status: accepted (beta-launch brief 03, decisions locked 2026-11-08); session 1 in review, not yet merged

## Decision

1. A new unit is set up on its own touchscreen: a first-run wizard joins
   Wi-Fi, sets the time zone and the weather location, using the
   on-screen keyboard. It opens at boot when `dashboard.json` has no
   `setup` record, or when the OS booted with no network (after a 90 s
   grace for NetworkManager). Settings → System replays it.
2. Wi-Fi goes through **NetworkManager's `nmcli`**, the time zone through
   **`timedatectl`**, both run by the app as its own ordinary user. A
   **polkit rule** (`scripts/polkit/50-rootboard-network.rules`) grants
   exactly four actions — modify system connections, network control,
   Wi-Fi scan, set time zone — to a `rootboard-system` group that the
   service user joins. No sudo, no root, no setuid helper.
3. Every endpoint that changes the system or drives the radio is
   localhost-only (`isLocalRequest`, like update/rollback). Read-only
   status stays open to the LAN until brief 05 decides on pairing.
4. Wi-Fi passwords travel only from the touchscreen to the local server
   in a POST body, to `nmcli`, and into NetworkManager's system profile.
   The app never writes, logs or returns them.
5. The one new outside call is a HEAD request to `www.googleapis.com`
   after a join (and when Retry is tapped) — the host the app needs anyway.

## Context and alternatives

A tester's unit arrives in a house we have never seen. Before this,
Wi-Fi and the time zone were Raspberry Pi Imager prefills or SSH work.

- **Hotspot + captive portal** (the phone-app pattern: the unit becomes
  an access point, a phone joins it and fills a web form). Rejected: it
  needs a second device, a radio-mode switch that drops the kiosk off any
  network while it runs, and it is the fragile path on the Pi's Broadcom
  firmware. The kiosk already has a 21.5-inch touchscreen and an
  on-screen keyboard, so the TV pattern (scan, pick, type) is simpler.
- **sudo rules for `nmcli` / `timedatectl`.** Rejected: a sudoers entry
  for nmcli grants all of nmcli (any connection, any device, radio off)
  as root; polkit grants named actions only, which NetworkManager and
  systemd already check for every caller.
- **Talking to NetworkManager over D-Bus from Node.** Rejected for now: a
  new native/binding dependency for what four `nmcli` commands do;
  `INSTALLATION.md` §12 already depends on nmcli.
- **Grant the rule to a named user.** Rejected: the repo is public and the
  service user differs between installs; a group keeps the file generic
  and the install step one `usermod`.
- **Passing the password on stdin / a passwd-file** instead of nmcli's
  `password` argument. Not done: `nmcli device wifi connect` has no
  stdin option, and a passwd-file means writing the secret to disk, which
  decision 4 forbids. The cost is that the password is in nmcli's argv
  for the seconds the command runs, visible to other processes of the
  same machine — on a single-purpose kiosk, accepted.

## Consequences

- The connection profile nmcli creates is a system profile with the key
  stored by NetworkManager, like an Imager prefill. It is just as exposed
  to the `no-secrets` lockout in `INSTALLATION.md` §12, so the
  `wifi-selfheal` timer is still needed on every image.
- An existing kiosk has no `setup` record, so it sees the wizard once at
  the first boot after the update that ships it (every step skippable,
  Network auto-passes when connected).
- Changing the time zone updates the server at once (`process.env.TZ`),
  but Firefox keeps the zone it started with until it restarts; the step
  says so.
- The polkit rule must be installed on the image: by hand per
  `INSTALLATION.md` step 11 today, by brief 06's `scripts/provision.sh`
  once both have merged (whichever merges second wires it in).
- Without NetworkManager or systemd (a laptop, CI) the two system steps
  report "managed outside Rootboard" and pass, so the wizard runs in
  `npm run dev`.
