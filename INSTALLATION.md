# Raspberry Pi Installation Guide

A complete, step-by-step guide for setting up the McMurry Hurricane Calendar on a Raspberry Pi with a touchscreen, intended to run 24/7 in kiosk mode.

> **Tip:** The app also ships an in-browser version of this guide at `/setup` once it's running. Open `http://localhost:5000/setup` from the Pi.

---

## Table of Contents

1. [What you need](#1-what-you-need)
2. [Flash and boot the Pi](#2-flash-and-boot-the-pi)
3. [First-boot configuration](#3-first-boot-configuration)
4. [Connect and calibrate the touchscreen](#4-connect-and-calibrate-the-touchscreen)
5. [Install Node.js and system dependencies](#5-install-nodejs-and-system-dependencies)
6. [Get the calendar app onto the Pi](#6-get-the-calendar-app-onto-the-pi)
7. [Configure Google OAuth](#7-configure-google-oauth)
8. [Configure the `.env` file](#8-configure-the-env-file)
9. [Build and first run](#9-build-and-first-run)
10. [Set up auto-start kiosk mode](#10-set-up-auto-start-kiosk-mode)
11. [Make the app survive crashes and updates](#11-make-the-app-survive-crashes-and-updates)
12. [Updating the app](#12-updating-the-app)
13. [Troubleshooting](#13-troubleshooting)

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
- A Google Cloud project with the **Google Calendar API** enabled (we'll create this in Step 7 — it's free).

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
   - **Wi-Fi:** SSID + password.
   - **Locale:** your timezone and keyboard layout.
   - **Enable SSH** (optional but recommended — makes remote setup much easier).
5. Click **Write**, wait for it to finish, then move the card to the Pi.
6. Plug in HDMI, USB touch, power, and let it boot. First boot takes 1–2 minutes.

---

## 3. First-boot configuration

Once you see the desktop:

1. Connect to your Wi-Fi if you didn't pre-configure it.
2. Open **Terminal** and run a full update — this is the single most important step for a 24/7 device:
   ```bash
   sudo apt update
   sudo apt full-upgrade -y
   sudo reboot
   ```
3. After reboot, find your Pi's IP address (you'll need it to SSH in or configure OAuth):
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

## 7. Configure Google OAuth

The app talks to your calendars using your **own** Google Cloud OAuth credentials. This takes about 5 minutes.

### Part A — Create the Cloud project
1. Go to <https://console.cloud.google.com/>.
2. Click the project dropdown → **New Project**.
3. Name it `Calendar Kiosk` and click **Create**.
4. Make sure the new project is selected at the top of the page.

### Part B — Enable the Calendar API
1. Go to <https://console.cloud.google.com/apis/library/calendar-json.googleapis.com>.
2. Click **Enable**.

### Part C — Configure the OAuth consent screen
1. Go to <https://console.cloud.google.com/apis/credentials/consent>.
2. Choose **External** → **Create**.
3. Fill in:
   - **App name:** Calendar Kiosk
   - **User support email:** your email
   - **Developer contact email:** your email
4. Click **Save and Continue** through the Scopes step.
5. On **Test users**, click **Add Users** and add the Google account whose calendars you want to display. **The app must stay in *Testing* mode** — you don't need to publish it.

### Part D — Create OAuth Client ID credentials
1. Go to <https://console.cloud.google.com/apis/credentials>.
2. Click **Create Credentials → OAuth client ID**.
3. **Application type:** Web application.
4. **Name:** Calendar Kiosk.
5. Under **Authorized redirect URIs**, add **all** of the following so it works locally on the Pi and via your hostname:
   - `http://localhost:5000/api/auth/google/callback`
   - `http://<PI_IP>:5000/api/auth/google/callback` *(replace `<PI_IP>` with the address from Step 3)*
   - `http://calendar-pi.local:5000/api/auth/google/callback` *(if your hostname is `calendar-pi`)*
6. Click **Create**. A modal shows your **Client ID** and **Client Secret** — keep this open, you need both in the next step.

> **Why three redirect URIs?** Chromium on the Pi will use whichever address you typed in the address bar, and any of those three can hit the same server. Adding all three avoids the dreaded `redirect_uri_mismatch` error.

---

## 8. Configure the `.env` file

```bash
cd /home/pi/calendar-app
cp .env.example .env
nano .env
```

Fill in the **required** keys with the values from Step 7 Part D:

```bash
GOOGLE_CLIENT_ID=123456-abcdef.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=your_client_secret_here
GOOGLE_REDIRECT_URI=http://localhost:5000/api/auth/google/callback
```

**Highly recommended optional keys:**

```bash
# Persists your Google login across restarts — without this you re-auth every reboot.
SESSION_SECRET=$(openssl rand -hex 32)   # paste the output of this command, not the command itself

# Point the auto-updater at YOUR repo
GITHUB_REPO_OWNER=your-github-username
GITHUB_REPO_NAME=your-repo-name
```

To generate a session secret in one step:
```bash
echo "SESSION_SECRET=$(openssl rand -hex 32)" >> .env
```

Save with `Ctrl+O`, `Enter`, then `Ctrl+X`.

> **Database:** leave `DATABASE_URL` commented out. With it unset, the app automatically uses SQLite (`calendar.db` in the project folder), which is the right choice for self-hosted Pi installs.

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
1. The app shows a "Connect Google Calendar" prompt.
2. Click it → sign in with the Google account you added as a test user.
3. Grant calendar access. The app stores its credentials in `google_credentials.json` (gitignored, never leaves the Pi) and starts the first sync.

If everything looks right, stop the server with `Ctrl+C` — we're about to make it auto-start.

---

## 10. Set up auto-start kiosk mode

The goal: when the Pi boots, it logs straight into the desktop, opens Chromium fullscreen pointing at the calendar, hides the cursor, and never sleeps.

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

---

## 12. Updating the app

### Built-in auto-update (recommended)
- The app checks GitHub releases daily at 8 AM.
- When a new version is available, you'll see a notification banner.
- Tap **Update Now**, and the app downloads, installs, builds, and restarts itself. Your `.env`, calendar data, and Google login are preserved.
- A backup of the previous version is taken before every update. **Settings → Roll Back** restores it.

### Manual check
**Settings → Check for Updates** anytime.

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

## 13. Troubleshooting

### Calendar shows nothing / "Connect Google Calendar" loops back
- Re-check your three redirect URIs in Google Cloud Console match exactly (no trailing slash, correct port).
- Confirm your Google account is listed as a **Test user** on the OAuth consent screen.
- See [`GOOGLE_OAUTH_TROUBLESHOOTING.md`](GOOGLE_OAUTH_TROUBLESHOOTING.md) for the full matrix.

### `EADDRINUSE: address already in use :::5000`
A previous instance is still running:
```bash
kill -9 $(lsof -t -i:5000) 2>/dev/null
```

### `invalid_client` / `unauthorized_client` after a fresh build
Stale build artefacts. Always run:
```bash
rm -rf dist && npm run build && npm start
```
If it persists, rotate the Client Secret in Google Cloud Console (**Credentials → your OAuth client → Reset Secret**) and update `.env`.

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
Re-apply the power-save fix from Step 3:
```bash
sudo iw dev wlan0 set power_save off
```
And confirm `/etc/NetworkManager/conf.d/wifi-powersave-off.conf` exists.

### App is unreadable / wrong size on a non-21.5" screen
The UI scales fine, but you can adjust browser zoom in `kiosk.sh`:
```bash
chromium-browser --force-device-scale-factor=1.25 ...
```

### Need to access the Pi remotely
With SSH enabled (Step 2):
```bash
ssh pi@<PI_IP>
# logs:
tail -f /home/pi/calendar-app.log
```

---

## Quick reference

| Path | What it is |
|------|-----------|
| `/home/pi/calendar-app` | The application |
| `/home/pi/calendar-app/.env` | Your secrets and config |
| `/home/pi/calendar-app/calendar.db` | SQLite database (events) |
| `/home/pi/calendar-app/google_credentials.json` | Cached OAuth tokens |
| `/home/pi/calendar-app/.update-backups/` | Auto-update rollback snapshots |
| `/home/pi/kiosk.sh` | Launches server + Chromium |
| `/home/pi/.config/autostart/calendar-kiosk.desktop` | Boot autostart entry |
| `/home/pi/calendar-app.log` | Server stdout/stderr |
