# Raspberry Pi Installation Guide

A complete, step-by-step guide for setting up Rootboard on a Raspberry Pi with a touchscreen, intended to run 24/7 in kiosk mode.

> **Tip:** The app also ships an in-browser version of this guide at `/setup` once it's running. Open `http://localhost:5000/setup` from the Pi.

---

## Table of Contents

1. [What you need](#1-what-you-need)
2. [Flash and boot the Pi](#2-flash-and-boot-the-pi)
3. [First-boot configuration](#3-first-boot-configuration)
4. [Connect and calibrate the touchscreen](#4-connect-and-calibrate-the-touchscreen)
5. [Install Node.js and system dependencies](#5-install-nodejs-and-system-dependencies)
6. [Get the calendar app onto the Pi](#6-get-the-calendar-app-onto-the-pi)
7. [Create a Google service account](#7-create-a-google-service-account)
8. [Configure the `.env` file](#8-configure-the-env-file)
9. [Build and first run](#9-build-and-first-run)
10. [Set up auto-start kiosk mode](#10-set-up-auto-start-kiosk-mode)
11. [Make the app survive crashes and updates](#11-make-the-app-survive-crashes-and-updates)
12. [Wi-Fi reliability on a headless Pi](#12-wi-fi-reliability-on-a-headless-pi)
13. [Updating the app](#13-updating-the-app)
14. [Troubleshooting](#14-troubleshooting)
15. [Use the API from a laptop on your network (pairing)](#15-use-the-api-from-a-laptop-on-your-network-pairing)

---

## 1. What you need

### Hardware

| Item | Recommended | Notes |
|------|-------------|-------|
| Raspberry Pi | Pi 4 (4 GB) or Pi 5 | A Pi 3B+ works but feels sluggish during sync. |
| microSD card | 32 GB+ Class 10 / A1 | A2-rated cards extend life on a 24/7 device. |
| Power supply | Official 5V/3A (Pi 4) or 5V/5A (Pi 5) USB-C | Underpowered supplies cause random reboots. |
| Touchscreen | 21.5" HDMI touchscreen (any USB-HID touch model) | The UI is tuned for ~1920×1080 at 21.5". Smaller screens still work. |
| HDMI cable | Standard HDMI or micro-HDMI (Pi 4/5) | Use the cable shipped with the touchscreen if provided. |
| USB cable | USB-A to USB-B (or USB-C) for touch | The touch panel sends events as a USB HID device. |
| Network | Wi-Fi or Ethernet | Required for Google sync and auto-updates. |
| Optional | Wired keyboard + mouse | Only needed during setup; can be removed afterward. |

### Accounts and credentials

- A Google account that owns the calendars you want to display.
- A Google Cloud project with the **Google Calendar API** enabled and a **service account** key file (we'll create both in Step 7 — it's free).

---

## 2. Flash and boot the Pi

1. On a regular computer, install **Raspberry Pi Imager** from <https://www.raspberrypi.com/software/>.
2. Insert your microSD card.
3. In Imager:
   - **Device** → your Pi model.
   - **Operating System** → *Raspberry Pi OS (64-bit)*. The full version with desktop is required (not Lite) because the kiosk uses Chromium.
   - **Storage** → your microSD card.
4. Click the gear icon (or **EDIT SETTINGS**) and pre-configure:
   - **Hostname:** `calendar-pi` (or anything memorable).
   - **Username/password:** `pi` / a strong password. (The instructions below assume the username `pi`. If you pick something else, replace `/home/pi` with `/home/yourname` everywhere.)
   - **Wi-Fi:** SSID + password. *Optional* — Rootboard's first-run wizard ([step 9](#first-boot-the-setup-wizard)) can join Wi-Fi from the touchscreen. You still need a connection for the terminal steps below (apt, npm), so prefill it here or plug in Ethernet.
   - **Locale:** your keyboard layout, and optionally your timezone (the wizard asks for the time zone too).
     > **US users:** Raspberry Pi OS defaults to the UK locale (`en_GB`), which makes the browser's date fields display **day-first** (`02/07/2026` for July 2). If your dates look "wrong" in the event form, that's why. Set the locale here in Imager, or fix it later with `sudo raspi-config nonint do_change_locale en_US.UTF-8` and reboot.
   - **Enable SSH** (optional but recommended — makes remote setup much easier).
5. Click **Write**, wait for it to finish, then move the card to the Pi.
6. Plug in HDMI, USB touch, power, and let it boot. First boot takes 1–2 minutes.

---

## 3. First-boot configuration

Once you see the desktop:

1. Make sure the Pi is online (Wi-Fi from Imager, the desktop's network menu, or Ethernet) — the next steps download packages.
2. Open **Terminal** and run a full update — this is the single most important step for a 24/7 device:
   ```bash
   sudo apt update
   sudo apt full-upgrade -y
   sudo reboot
   ```
3. After reboot, find your Pi's IP address (you'll need it to SSH in or copy files to the Pi):
   ```bash
   hostname -I
   ```
   Note the first address (e.g. `192.168.1.42`).

### Recommended power-management tweaks

For a wall-mounted kiosk you want the screen to stay awake forever and Wi-Fi power-saving disabled.

```bash
# Disable Wi-Fi power saving (prevents intermittent disconnects after hours of idle)
sudo iw dev wlan0 set power_save off

# Make it permanent
echo -e "[connection]\nwifi.powersave = 2" | sudo tee /etc/NetworkManager/conf.d/wifi-powersave-off.conf
sudo systemctl restart NetworkManager
```

If the kiosk will sit on a mesh or multi-access-point network, also work through [Wi-Fi reliability on a headless Pi](#12-wi-fi-reliability-on-a-headless-pi) once the app is running.

---

## 4. Connect and calibrate the touchscreen

Most modern HDMI + USB touchscreens are plug-and-play on Raspberry Pi OS Bookworm — touch should work the moment the desktop appears.

### Verify touch is detected
```bash
xinput list
```
You should see an entry like `WaveShare WS170120` or `ILITEK Multi-Touch`. If your touch device is missing, check the USB cable and try a different port (use the Pi's USB-2 ports, not USB-3, for older touch panels).

### If touch is offset (Pi 5 / Bookworm)

On Wayland (the default on Bookworm), touch is bound to whichever output is `HDMI-1` by default. If you have multiple displays or rotation, edit `~/.config/labwc/rc.xml` (or `wayfire.ini` depending on your compositor) to map the touch device to the correct output. For most single-screen setups this is unnecessary.

### Turn off touch mouse emulation (required)

By default the labwc compositor (Raspberry Pi OS on the Pi 5) converts touch into **emulated mouse** events, so the browser never receives real touch. Rootboard is built for real touch — the brightness slider, drag gestures and the on-screen keyboard behave best with it. Set `mouseEmulation="no"` on your touch device in `~/.config/labwc/rc.xml`.

1. Find your touch device's exact name:
   ```bash
   grep -A1 'I: Bus=0003' /proc/bus/input/devices | grep Name
   ```
   You'll see something like `N: Name="ILITEK ILITEK-TP"`. Use the name *without* the `Mouse` suffix if two entries appear.
2. Back up the file, then set the `<touch>` element (create it inside `<openbox_config>` if it is missing):
   ```bash
   cp ~/.config/labwc/rc.xml ~/.config/labwc/rc.xml.bak
   nano ~/.config/labwc/rc.xml
   ```
   ```xml
   <touch deviceName="ILITEK ILITEK-TP" mapToOutput="HDMI-A-1" mouseEmulation="no"/>
   ```
   Replace the device name with yours, and `HDMI-A-1` with your output (`wlr-randr` lists outputs).
3. Apply it without rebooting:
   ```bash
   kill -HUP "$(pgrep -x labwc)"
   ```
4. Check: tap and drag on the desktop still work. To undo, restore `rc.xml.bak` and run step 3 again.

### Turn off browser zoom (Firefox)

Rootboard's layout is sized to the screen, so any zoom leaves it panning instead of fitting. The app itself blocks pinch and double-tap zoom with CSS (`touch-action: pan-x pan-y`), but Firefox can still zoom from a keyboard or a trackpad gesture, so pin it off at the browser too. Add these lines to `user.js` in the kiosk's Firefox profile (on Raspberry Pi OS the profile lives under `~/.config/mozilla/firefox/<id>.default-release/`, not `~/.mozilla`; create `user.js` if it does not exist):

```js
// Rootboard kiosk: no zoom of any kind
user_pref("apz.allow_zooming", false);            // touch pinch zoom
user_pref("apz.allow_double_tap_zooming", false); // double-tap zoom
user_pref("zoom.minPercent", 100);                // clamp Ctrl +/- and Ctrl+wheel
user_pref("zoom.maxPercent", 100);
user_pref("browser.gesture.pinch.in", "");        // trackpad pinch commands
user_pref("browser.gesture.pinch.out", "");
user_pref("browser.gesture.pinch.in.shift", "");
user_pref("browser.gesture.pinch.out.shift", "");
```

`user.js` is read at every Firefox start, so restart Firefox (or reboot) for it to apply. Check: a two-finger pinch on the dashboard does nothing; scrolling the week view still works.

### Set the monitor's own brightness now

Rootboard's Brightness slider can only **dim** the picture (30–100 %); it cannot make the screen brighter than the monitor itself. Rootboard also never uses a page-wide CSS brightness filter — on a Pi that costs roughly 115 ms per frame and makes the whole kiosk sluggish — so there is deliberately no "above 100 %" setting.

Before mounting the screen, use the **monitor's own buttons / on-screen menu** to set its hardware brightness to the brightest level you'll ever want (daytime). Everything dimmer — evenings, night, the idle power-saving dim — is handled by the app.

### Set screen rotation (if needed)
Open **Preferences → Screen Configuration**, right-click the display, and choose your orientation. The change persists across reboots.

### Hide the mouse cursor
We'll do this automatically in Step 10 via `unclutter`.

---

## 5. Install Node.js and system dependencies

The app requires **Node.js 18+** (Node 20 LTS recommended).

```bash
# Install Node 20 from NodeSource (official binaries — much newer than apt's default)
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs

# Verify
node -v   # should print v20.x.x
npm -v
```

Install the kiosk helpers we'll need later:

```bash
sudo apt-get install -y chromium-browser unclutter xdotool git
```

---

## 6. Get the calendar app onto the Pi

Pick **one** of the following methods. Files end up at `/home/pi/calendar-app`.

### Option A — Git clone (recommended)

This makes future manual updates trivial.

```bash
cd /home/pi
git clone https://github.com/YOUR_GITHUB_USERNAME/YOUR_REPO.git calendar-app
cd calendar-app
npm install
```

### Option B — USB drive (no command line)

1. On a regular computer, download the project as a zip.
2. Copy the zip to a USB stick → plug it into the Pi.
3. In the Pi's File Manager, copy the zip to `/home/pi`, right-click → **Extract Here**.
4. Rename the extracted folder to `calendar-app`.
5. Open Terminal and run:
   ```bash
   cd /home/pi/calendar-app
   npm install
   ```

### Option C — Direct download on the Pi

Open Chromium on the Pi → download the project zip from your repo → extract it to `/home/pi/calendar-app` → run `npm install` from Terminal.

### Option D — SCP from another computer

```bash
# From your laptop:
scp -r ./calendar-app pi@<PI_IP>:/home/pi/

# Then on the Pi:
cd /home/pi/calendar-app
npm install
```

---

## 7. Create a Google service account

The kiosk talks to Google Calendar using a **service account** — a Google identity that belongs to the app itself. The Pi authenticates with a JSON key file, so there's no browser sign-in, no consent screen, and the kiosk never gets logged out. This takes about 5 minutes.

### Part A — Create the Cloud project
1. Go to <https://console.cloud.google.com/>.
2. Click the project dropdown → **New Project**.
3. Name it `Calendar Kiosk` and click **Create**.
4. Make sure the new project is selected at the top of the page.

### Part B — Enable the Calendar API
1. Go to <https://console.cloud.google.com/apis/library/calendar-json.googleapis.com>.
2. Click **Enable**.

### Part C — Create the service account
1. Go to <https://console.cloud.google.com/iam-admin/serviceaccounts>.
2. Click **+ Create Service Account** at the top.
3. **Service account name:** `calendar-kiosk` (the ID auto-fills — leave it).
4. Click **Create and Continue**.
5. Skip the optional "Grant this service account access to project" step — click **Continue**, then **Done**.

### Part D — Generate a JSON key
1. In the service account list, click the account you just created.
2. Open the **Keys** tab at the top.
3. Click **Add Key → Create new key**.
4. Choose **JSON** and click **Create**. A JSON file downloads.
5. Open the file in a text editor and note the **`client_email`** value — it looks like `calendar-kiosk@your-project-id.iam.gserviceaccount.com`. You'll need it in Part F.

> **Treat the JSON file like a password.** Anyone with it can read every calendar shared with the service account. Don't commit it to git or post it anywhere — the project's `.gitignore` already excludes `service-account.json`.

### Part E — Copy the JSON key onto the Pi
Place the file inside the app folder and rename it to `service-account.json`.

```bash
# From your laptop:
scp ~/Downloads/your-key-file.json pi@<PI_IP>:/home/pi/calendar-app/service-account.json

# Verify on the Pi:
ls -la /home/pi/calendar-app/service-account.json
```

USB-drive equivalent: copy the JSON onto a USB stick → plug it into the Pi → drag it into `/home/pi/calendar-app` and rename it to `service-account.json`.

### Part F — Share each calendar with the service account
A new service account has zero access. You have to explicitly share every calendar you want the kiosk to display.

1. Open <https://calendar.google.com/> on a regular computer.
2. In the left sidebar under **My calendars**, hover a calendar → three-dot menu → **Settings and sharing**.
3. Under **Share with specific people or groups**, click **Add people and groups**.
4. Paste the service account's `client_email` from the JSON file.
5. Set permission to **Make changes to events** (lets the kiosk create events later) and click **Send**. No email is sent — service accounts don't receive notifications.
6. Repeat for every calendar you want displayed.

---

## 8. Configure the `.env` file

```bash
cd /home/pi/calendar-app
cp .env.example .env
nano .env
```

The only required key tells the app where to find your service-account JSON:

```bash
GOOGLE_SERVICE_ACCOUNT_KEY_FILE=./service-account.json
```

**Optional keys** — point the auto-updater at your fork:

```bash
GITHUB_REPO_OWNER=your-github-username
GITHUB_REPO_NAME=your-repo-name
```

Save with `Ctrl+O`, `Enter`, then `Ctrl+X`.

> **Weather and time zone are not set here.** The first-run wizard asks for both on the touchscreen ([step 9](#first-boot-the-setup-wizard)); later, use **Settings → System**. The older `WEATHER_*` keys in `.env.example` still work as a fallback but are no longer needed on a kiosk.

> **Database:** nothing to set. The app stores its data in SQLite (`calendar.db` in the project folder).

> **`NODE_ENV=production` is required.** Without it, Express defaults to development mode and tries to start the Vite dev server, causing a "Failed to load url /src/main.tsx" error.

> **No session secret needed.** Service-account auth doesn't use browser sessions, so `SESSION_SECRET` is irrelevant on a self-hosted Pi.

---

## 9. Build and first run

```bash
cd /home/pi/calendar-app
rm -rf dist          # always delete the old build before building
npm run build
npm start
```

You should see something like:
```
serving on port 5000
```

On the Pi's desktop, open Chromium and go to <http://localhost:5000>:
1. The [setup wizard](#first-boot-the-setup-wizard) opens first. Work through it (or skip what you've already done here); after **Done** the calendar loads and immediately starts its first sync of the calendars you shared with the service account.
2. If you instead see a "Service account key file could not be loaded" message, jump to [Troubleshooting](#14-troubleshooting) — usually the file isn't at the path in `GOOGLE_SERVICE_ACCOUNT_KEY_FILE`.
3. If the calendars look empty but no error appears, you probably haven't shared them with the service account's `client_email` yet — revisit Step 7 Part F.

If everything looks right, stop the server with `Ctrl+C` — we're about to make it auto-start.

### First boot: the setup wizard

The first time the app starts on a unit (no `setup` record in `data/config/dashboard.json`), it opens a full-screen setup wizard instead of the dashboard. Everything is done by touch with the on-screen keyboard:

1. **Welcome.**
2. **Network** — lists nearby Wi-Fi networks (strongest first); tap one, type the password, **Connect**. A hidden network has a "Network not listed? Type its name" option. With Ethernet plugged in, or a saved network that comes up on its own, the step confirms in one line and moves on. Network cannot be skipped.
3. **Time zone** — a searchable list, starting on the zone the browser reports, with the current time shown so a wrong zone is obvious.
4. **Google Calendar** — for now this shows the service-account instructions from [step 7](#7-create-a-google-service-account) (an on-screen sign-in replaces it in a later release). Skip it if you have already set the key up.
5. **Weather** — the same postal-code lookup as **Settings → System → Weather**.
6. **Done** — the dashboard appears.

Every step but Network has **Skip this step**, and the whole wizard can be replayed later from **Settings → System → Run setup again** (or open **Wi-Fi** / **Time zone** there directly). Nothing changes until you confirm it in a step.

The wizard also opens — on the Network step only — if the unit **boots** with no network at all (for example after moving house): it waits about 90 seconds for NetworkManager to bring a saved connection up first, and moves on by itself the moment one does. If the router is simply off, tap **Continue without network**: chores, dinner and the calendar you already have keep working, and the calendar and weather update again once the network is back. That screen does not come back while the dashboard runs, and a network drop while the dashboard is running never opens it.

The Network and Time zone steps need NetworkManager (`nmcli`), `timedatectl` and the polkit rule in [step 11](#let-the-app-change-wi-fi-and-the-time-zone-polkit). On a computer without them (a laptop running `npm run dev`) those two steps say "managed outside Rootboard" and pass.

---

## 10. Set up auto-start kiosk mode

The goal: when the Pi boots, it logs straight into the desktop, opens Chromium fullscreen pointing at the calendar, hides the cursor, and never sleeps.

> **Note:** the reference kiosk (Raspberry Pi 5, Raspberry Pi OS / labwc) now runs **Firefox** in kiosk mode (`firefox --kiosk http://localhost:5000`) rather than Chromium, and this section has not yet been rewritten for it. Whichever browser you use, complete [step 4's touch setup](#turn-off-touch-mouse-emulation-required) first.

### 10.1 Disable screen blanking permanently

Run `sudo raspi-config` → **Display Options → Screen Blanking → No**.

### 10.2 Create the kiosk launch script

```bash
nano /home/pi/kiosk.sh
```

Paste:

```bash
#!/bin/bash
# Wait for the desktop and network to settle
sleep 10

# Start the calendar server using the included supervisor script.
# scripts/start.sh handles auto-restart on crash and rollback on failed updates.
cd /home/pi/calendar-app
bash scripts/start.sh > /home/pi/calendar-app.log 2>&1 &

# Wait for server to be ready
for i in $(seq 1 30); do
  curl -s http://localhost:5000/api/version > /dev/null && break
  sleep 1
done

# Kill any prior chromium and disable screen power management
pkill -f chromium-browser 2>/dev/null
xset s off       2>/dev/null
xset -dpms       2>/dev/null
xset s noblank   2>/dev/null

# Hide the mouse cursor when idle
unclutter -idle 0.1 -root &

# Launch Chromium in kiosk mode
chromium-browser \
  --noerrdialogs --disable-infobars --disable-translate \
  --disable-features=TranslateUI \
  --check-for-update-interval=31536000 \
  --kiosk --incognito \
  --touch-events=enabled \
  --overscroll-history-navigation=0 \
  http://localhost:5000
```

Make it executable:
```bash
chmod +x /home/pi/kiosk.sh
```

### 10.3 Auto-launch on desktop login

Create the autostart entry:
```bash
mkdir -p /home/pi/.config/autostart
nano /home/pi/.config/autostart/calendar-kiosk.desktop
```

Paste:
```
[Desktop Entry]
Type=Application
Name=Calendar Kiosk
Exec=/home/pi/kiosk.sh
X-GNOME-Autostart-enabled=true
```

### 10.4 Make the Pi auto-login to the desktop

`sudo raspi-config` → **System Options → Boot / Auto Login → Desktop Autologin**.

Reboot:
```bash
sudo reboot
```

About 30–45 seconds after power-on, the calendar should be on screen, fullscreen, with the cursor hidden.

---

## 11. Make the app survive crashes and updates

The included `scripts/start.sh` is a supervisor:
- Runs the app
- Performs a health check on `http://localhost:5000/api/version`
- Restarts on crash
- Rolls back to the previous version if a fresh install fails its health check

It's already invoked from `kiosk.sh` above, so you get this for free.

The supervisor advertises itself to the app via the `MANAGED_BY_SUPERVISOR=1` env var. The auto-update flow only calls `process.exit(0)` when this var is set, so it won't ever leave the kiosk dead waiting for a manual restart.

> **Optional:** if you'd rather use systemd than the desktop autostart, see `scripts/start.sh` — it's drop-in compatible. Run it from a `systemd --user` service or a system unit, whichever suits your setup.

### Let the app change Wi-Fi and the time zone (polkit)

The setup wizard joins Wi-Fi and sets the time zone by running `nmcli` and `timedatectl` as the **same ordinary user the app runs as** — the user that starts `kiosk.sh` or `scripts/start.sh` (on a systemd install, the unit's `User=`). It never uses `sudo` or root. A polkit rule shipped in `scripts/polkit/` lets that user do exactly four things without a password prompt: change system connection profiles, activate connections, scan for Wi-Fi, and set the time zone.

The rule grants these to a group, not a named user, so install it like this (replace `<kiosk-user>` with that user):

```bash
cd /home/pi/calendar-app
sudo groupadd --system rootboard-system
sudo usermod -aG rootboard-system <kiosk-user>
sudo install -m 0644 -o root -g root scripts/polkit/50-rootboard-network.rules /etc/polkit-1/rules.d/
```

polkit reads the new file straight away; no reboot needed. To check it took, run as that user: `timedatectl --no-ask-password set-timezone "$(timedatectl show -p Timezone --value)"` — no output means it worked; "Interactive authentication required" means the rule or the group membership is missing.

Without the rule the wizard still works, but its Wi-Fi and Time zone steps report that they couldn't make the change. Wi-Fi passwords entered in the wizard are stored by NetworkManager in its own system connection profile, never in the app's files or logs.

---

## 12. Wi-Fi reliability on a headless Pi

A kiosk that lives on Wi-Fi for months will eventually hit a bad patch: a mesh system shuffles clients between its radios, a neighbour's network changes channel, the signal dips for an hour. Most of the time the Pi reconnects on its own and you never notice. One failure mode does **not** heal itself, and it looks like an app bug (weather stops updating, calendars go stale) when the app is fine:

When the access point forces a reconnect and the 4-way handshake fails on the live connection, NetworkManager treats it the way it treats a wrong password: it asks a "secret agent" for new credentials. On a headless kiosk there is no desktop session to answer, so the activation fails with `no-secrets` and NetworkManager **blocks autoconnect for that profile until the next reboot**. The link itself is fine; nothing will retry.

The steps below make the problem visible (persistent logs), remove a common trigger (power saving), and add a watchdog that retries the connection. The last two steps are for mesh and multi-access-point networks, where the forced reconnects come from.

Throughout, `<connection-name>` is the name of the NetworkManager connection profile. It is often the network name, but an image configured with Raspberry Pi Imager calls it `preconfigured`, so check with:

```bash
nmcli -t -f NAME,DEVICE con show
```

### 12.1 Keep logs across reboots

Raspberry Pi OS keeps the system journal in RAM, so after an outage that ends in a power-cycle the evidence is gone. The OS ships `/usr/lib/systemd/journald.conf.d/40-rpi-volatile-storage.conf`, which forces `Storage=volatile`. Drop-ins apply in filename order, so the override has to sort after that file:

```bash
sudo mkdir -p /etc/systemd/journald.conf.d
sudo tee /etc/systemd/journald.conf.d/zz-persistent.conf >/dev/null <<'EOF'
[Journal]
Storage=persistent
SystemMaxUse=200M
SystemKeepFree=1G
EOF
sudo systemctl restart systemd-journald && sudo journalctl --flush
```

Verify — the current boot is listed now, and earlier boots stay listed after the next reboot:

```bash
journalctl --list-boots
```

### 12.2 Turn off Wi-Fi power saving on the connection profile

Step 3 set the global default in `/etc/NetworkManager/conf.d/`. Set it on the connection profile as well, so it survives the profile being re-created and shows up in `nmcli con show <connection-name>`:

```bash
sudo nmcli con modify <connection-name> 802-11-wireless.powersave 2
```

The setting takes effect when the connection is re-activated. Re-activating over SSH drops your session halfway through, so detach the command before running it (`sudo` runs in the foreground, so it can still ask for your password; only `nmcli` is detached):

```bash
sudo sh -c 'nohup nmcli con up <connection-name> >/dev/null 2>&1 &'
```

Reconnect after about 30 seconds and verify:

```bash
iw dev wlan0 get power_save
# expect: Power save: off
```

### 12.3 Add a `wifi-selfheal` watchdog timer

This timer exists because of the `no-secrets` failure described above: once NetworkManager has blocked autoconnect on a headless box, the kiosk sits offline until someone power-cycles it. An explicit `nmcli con up` clears that block, so every minute the timer checks the Wi-Fi interface and asks NetworkManager to bring the profile back up whenever it is neither connected nor in the middle of connecting.

The script — **edit `<connection-name>` on the `CON=` line before pasting**; the heredoc is quoted, so nothing is substituted for you:

```bash
sudo tee /usr/local/sbin/wifi-selfheal >/dev/null <<'EOF'
#!/bin/sh
# Re-activate the Wi-Fi connection when NetworkManager has given up on it.
CON="<connection-name>"
STATE=$(nmcli -t -f DEVICE,STATE dev status | awk -F: '$1 == "wlan0" { print $2 }')
case "$STATE" in
  connected*|connecting*) exit 0 ;;
esac
logger -t wifi-selfheal "wlan0 is '${STATE:-missing}', bringing up $CON"
if nmcli -w 40 con up "$CON"; then
  logger -t wifi-selfheal "reconnected"
else
  logger -t wifi-selfheal "nmcli con up failed"
fi
EOF
sudo chmod 755 /usr/local/sbin/wifi-selfheal
```

The service and timer:

```bash
sudo tee /etc/systemd/system/wifi-selfheal.service >/dev/null <<'EOF'
[Unit]
Description=Re-activate Wi-Fi when NetworkManager has given up on it
After=NetworkManager.service
Wants=NetworkManager.service

[Service]
Type=oneshot
ExecStart=/usr/local/sbin/wifi-selfheal
EOF

sudo tee /etc/systemd/system/wifi-selfheal.timer >/dev/null <<'EOF'
[Unit]
Description=Check the Wi-Fi link every minute

[Timer]
OnBootSec=90s
OnUnitActiveSec=60s
AccuracySec=5s

[Install]
WantedBy=timers.target
EOF

sudo systemctl daemon-reload
sudo systemctl enable --now wifi-selfheal.timer
```

Check it:

```bash
systemctl list-timers wifi-selfheal.timer   # next and last run
journalctl -t wifi-selfheal                 # every time it had to act
```

While the link is healthy the script exits without logging, so an empty `journalctl -t wifi-selfheal` is the good outcome. Entries there tell you when, and how often, the connection needed help.

### 12.4 Optional: pin the connection to the nearest radio

On a mesh system, or any network with several access points sharing one name, the Pi's Wi-Fi supplicant roams on its own: it background-scans and hops to whichever radio looks marginally better, and every hop is a reconnect. A wall-mounted kiosk never moves, so pin it to the radio it should always use. Find that radio's BSSID (its MAC address) — the `IN-USE` column marks the current one:

```bash
nmcli -f IN-USE,BSSID,SIGNAL,CHAN,SSID dev wifi list
```

Then pin and re-activate (detached, as in 12.2):

```bash
sudo nmcli con modify <connection-name> 802-11-wireless.bssid <bssid-of-nearest-radio>
sudo sh -c 'nohup nmcli con up <connection-name> >/dev/null 2>&1 &'
```

**Trade-off:** if that radio disappears (the mesh node is rebooted, moved or replaced) the Pi waits for it instead of joining another. Undo with:

```bash
sudo nmcli con modify <connection-name> 802-11-wireless.bssid ""
```

### 12.5 On a mesh router: exclude the kiosk from client steering

Mesh systems also move clients from the router side. Features called "roaming assistance", "client steering" or "band steering" send the client an 802.11v transition request and, when the client doesn't move, disconnect it to force the hop. The Pi's onboard Wi-Fi firmware does not act on those requests (observed on the Pi models Rootboard has run on), so it gets kicked repeatedly — exactly the forced reconnect that leads to the `no-secrets` block above. Most mesh routers let you exempt a device from steering (often a "roaming block list" or "steering exclusion", keyed by the device's Wi-Fi MAC address). Find the Pi's:

```bash
cat /sys/class/net/wlan0/address
```

Add that address to the exclusion list in the router's admin interface. Afterwards, `journalctl -u NetworkManager` should stop showing unexplained reconnects every few minutes.

---

## 13. Updating the app

### Built-in auto-update (recommended)
- The app checks GitHub releases daily at 8 AM.
- When a new version is available, you'll see a notification banner.
- Tap **Update Now**, and the app downloads, installs, builds, and restarts itself. Your `.env`, calendar data, and Google login are preserved.
- A backup of the previous version is taken before every update. **Settings → Roll Back** restores it.

### Manual check
**Settings → System → Check for Updates** anytime.

### Stable or beta
**Settings → System → Updates → Release channel** picks which releases this kiosk gets:
- **Stable** (default): normal releases only.
- **Beta**: also gets pre-releases, a few days before stable. They may have rough edges.

The choice is saved in `data/config/dashboard.json`, so it survives updates. To preset it on a new install, put `UPDATE_CHANNEL=beta` in `.env` (the Settings choice wins once made).

Switching from Beta back to Stable does not downgrade: a kiosk running a beta keeps it until a newer stable release comes out. To go back sooner, use **Roll Back** (it restores the version from before the last update).

### Manual update from the terminal (Git clone option)
```bash
cd /home/pi/calendar-app
git pull origin main
npm install
rm -rf dist
npm run build
# kiosk.sh will respawn the app on next boot, or restart now:
pkill -f "node.*calendar-app" ; bash scripts/start.sh
```

---

## 14. Troubleshooting

### Read the diagnostics screen first
Before opening a terminal, tap **Settings → System → Diagnostics** on the kiosk. It works even when Google Calendar isn't connected (if a "Google Calendar Not Connected" box is covering the screen, tap **Close** first). Rows that probably need fixing have a warning mark:

| Row | What it tells you |
|---|---|
| Google Calendar | Whether the key file is there and loaded, and the error if not |
| Calendar sync | When events last synced, and the last sync error |
| Weather | When the forecast last updated, and why it failed |
| Network / Internet | Whether the Pi has a network address, and whether its last weather or calendar request reached the internet |
| Wi-Fi self-heal (24 h) | How many times the [`wifi-selfheal` timer](#123-add-a-wifi-selfheal-watchdog-timer) had to reconnect. "Not available" means the timer isn't installed, or the app's user can't read the system journal (fix: `sudo usermod -aG systemd-journal <service-user>`, then restart the service) |
| Updates / Supervisor | The last update check, and whether the app can restart itself after an update |
| Disk free, Widgets, Config | Low disk, widget folders that failed to load, a damaged `data/config/dashboard.json` |

**Show details** shows the app's last log lines. **Copy** copies the whole screen as text you can paste to whoever is helping you, or to your own AI assistant: it never contains your Wi-Fi name, the kiosk's name or IPv4 address, email addresses or tokens.

The entries below are the terminal steps for when the diagnostics screen points at a problem.

### "Service account key file could not be loaded"
Diagnostics shows **Google Calendar: Not set up (no key file)** or **Not connected** with the reason. The app can't find or parse the JSON key file. Check, in order:
```bash
# 1. Does the file actually exist where .env says it does?
grep GOOGLE_SERVICE_ACCOUNT_KEY_FILE /home/pi/calendar-app/.env
ls -la /home/pi/calendar-app/service-account.json

# 2. Is it valid JSON?
node -e "JSON.parse(require('fs').readFileSync('/home/pi/calendar-app/service-account.json'))"
```
If the path in `.env` is relative (like `./service-account.json`), it's resolved against the app folder — the file must live at `/home/pi/calendar-app/service-account.json`.

### Calendars load but show no events
If Diagnostics shows a **Calendar sync** error, that error says why. Otherwise the service account doesn't have access to those calendars yet. Re-do Step 7 Part F: share each calendar in Google Calendar with the `client_email` from the JSON key file. After sharing, refresh the calendar in the kiosk (the header refresh button).

### `EADDRINUSE: address already in use :::5000`
A previous instance is still running:
```bash
kill -9 $(lsof -t -i:5000) 2>/dev/null
```

### Stale build after an update
Always run:
```bash
rm -rf dist && npm run build && npm start
```

### Touchscreen taps register at the wrong location
Most likely the touch device is mapped to the wrong display output. Run:
```bash
xinput list                                  # find the touch device name
xinput map-to-output "<TOUCH_DEVICE_NAME>" HDMI-1
```
Persist that with the Wayland or X11 mapping config for your desktop environment.

### Cursor still visible
Make sure `unclutter` is running:
```bash
pgrep -a unclutter
```
If not, the line in `kiosk.sh` didn't run — check `/home/pi/calendar-app.log` for errors.

### Screen still goes black after ~10 minutes
You disabled blanking only for the current session. Verify with:
```bash
grep -i blank /etc/lightdm/lightdm.conf
```
And run `sudo raspi-config` → Display Options → Screen Blanking → **No** to make it permanent.

### Wi-Fi disconnects after hours of idle
Diagnostics shows **Wi-Fi self-heal (24 h)**: a few reconnects a day means the timer from Step 12 is doing its job; many means the link itself needs attention. Re-apply the power-save fix from Step 3:
```bash
sudo iw dev wlan0 set power_save off
```
And confirm `/etc/NetworkManager/conf.d/wifi-powersave-off.conf` exists.

If the Pi stays offline until it is rebooted — `journalctl -u NetworkManager` shows an activation failing with `no-secrets` — NetworkManager has blocked autoconnect on the profile. Step 12 explains why and sets up a `wifi-selfheal` timer that clears it: see [Wi-Fi reliability on a headless Pi](#12-wi-fi-reliability-on-a-headless-pi).

### App is unreadable / wrong size on a non-21.5" screen
The UI scales fine, but you can adjust browser zoom in `kiosk.sh`:
```bash
chromium-browser --force-device-scale-factor=1.25 ...
```

### Event form dates look swapped (e.g. 02/07/2026 for July 2)
The Pi's system locale is `en_GB` (the Raspberry Pi OS default), so the browser renders date fields day-first. The stored dates are correct — only the display order differs. Fix:
```bash
sudo raspi-config nonint do_change_locale en_US.UTF-8
sudo reboot
```

### Need to access the Pi remotely
To read the app's state or call its API from a laptop, [pair the laptop](#15-use-the-api-from-a-laptop-on-your-network-pairing); no SSH needed. For the operating system itself, with SSH enabled (Step 2):
```bash
ssh pi@<PI_IP>
# logs:
tail -f /home/pi/calendar-app.log
```

---

## 15. Use the API from a laptop on your network (pairing)

The kiosk's own screen can always use the app. Any other device on your Wi-Fi has to be paired first, so nothing else on the network can read or change your calendar.

1. On the kiosk, tap **Settings → System → Pair a device**. It shows a 6-digit code for 5 minutes and the address to send it to.
2. On the laptop (or tell your AI assistant to do this):
   ```bash
   curl -X POST http://<KIOSK_IP>:5000/api/pair \
     -H 'Content-Type: application/json' \
     -d '{"code": "123456", "name": "my-laptop"}'
   ```
   The reply contains a `token` that starts with `rbp_`. Keep it private: whoever has it can read and change the kiosk's calendar and settings.
3. Send the token on every call:
   ```bash
   curl http://<KIOSK_IP>:5000/api/system/diagnostics?view=full \
     -H 'Authorization: Bearer rbp_...'
   ```
4. To remove a device, tap **Revoke** next to it on the same screen. To remove every device at once over SSH, delete `data/paired-devices.json`.

Without pairing, a device on the network can only read the app version and the redacted diagnostics (the same text the **Copy** button gives). A wrong code 5 times cancels the code; show a new one on the kiosk. Updates and roll-backs can only be started from the kiosk screen, paired or not.

For a hosted or development install with no touchscreen, `LAN_API_OPEN=true` in `.env` turns pairing off (the app logs a warning at startup). Don't set it on a kiosk on a shared Wi-Fi.

---

## Quick reference

| Path | What it is |
|------|-----------|
| `/home/pi/calendar-app` | The application |
| `/home/pi/calendar-app/.env` | Your secrets and config |
| `/home/pi/calendar-app/calendar.db` | SQLite database (events) |
| `/home/pi/calendar-app/service-account.json` | Google service account JSON key (gitignored, never leaves the Pi) |
| `/home/pi/calendar-app/.update-backups/` | Auto-update rollback snapshots |
| `/home/pi/calendar-app/data/paired-devices.json` | Paired laptops/agents (token hashes only; delete to revoke all) |
| `/home/pi/kiosk.sh` | Launches server + Chromium |
| `/home/pi/.config/autostart/calendar-kiosk.desktop` | Boot autostart entry |
| `/home/pi/calendar-app.log` | Server stdout/stderr |
