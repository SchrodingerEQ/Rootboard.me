# Touchscreen Calendar Kiosk

A 24/7 Google Calendar kiosk application designed for Raspberry Pi with a touchscreen display. Optimized for fullscreen kiosk mode on a 21.5-inch touchscreen.

## Features

- **Google Calendar Sync** — Real-time integration with the Google Calendar API
- **Touch-Optimized UI** — Day, week, and month views with touch-friendly navigation
- **Multi-Calendar Support** — Toggle individual calendars on or off
- **Power-Saving Mode** — Auto-dims after 5 minutes of inactivity, wakes on any touch
- **Auto-Updates** — Daily check for new GitHub releases with one-tap install
- **Safe Rollback** — Automatic backup before every update with manual rollback option
- **Brightness Control** — Adjustable from the in-app settings menu

## Tech Stack

- **Frontend**: React 18 + TypeScript + Vite, Tailwind CSS, Radix UI / shadcn
- **Backend**: Node.js + Express + TypeScript
- **Database**: SQLite (self-hosted) or PostgreSQL (hosted)
- **Auth**: Google Service Account (JSON key file)

## Quick Start

1. **Clone the repository**
   ```bash
   git clone https://github.com/YOUR_USERNAME/YOUR_REPO.git
   cd YOUR_REPO
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Configure the Google service account**

   Copy the example environment file and point it at your service-account JSON key:
   ```bash
   cp .env.example .env
   nano .env
   ```

   You will need a Google Cloud project with the Calendar API enabled and a **service account** with a JSON key file. Drop the key at `./service-account.json` (or set `GOOGLE_SERVICE_ACCOUNT_KEY_FILE` to its path), then share each calendar you want displayed with the service account's `client_email`. The app contains a complete step-by-step setup guide — start the app and visit `http://localhost:5000/setup`, or see **[INSTALLATION.md](INSTALLATION.md)** Step 7 for detailed instructions.

4. **Run in development mode**
   ```bash
   npm run dev
   ```

5. **Or build and run in production mode** (recommended for Raspberry Pi)
   ```bash
   rm -rf dist
   npm run build
   npm start
   ```

   Open `http://localhost:5000` in your browser.

## Full Setup Guide

For a complete, step-by-step Raspberry Pi + touchscreen install, see **[INSTALLATION.md](INSTALLATION.md)**. It covers everything from flashing the SD card to configuring kiosk auto-start.

The same guide is also available in-app at the `/setup` route once the server is running. Both cover:

- Flashing Raspberry Pi OS and first-boot config
- Connecting and calibrating the touchscreen
- Installing Node.js and dependencies
- Transferring the app to the Pi (USB, direct download, git clone, or SCP)
- Creating a Google service account and sharing calendars with it
- Setting up Chromium kiosk mode with auto-start on boot
- Updating to new versions and rolling back
- Common troubleshooting

## Updating

The app checks for new GitHub releases daily at 8 AM and shows a one-tap update notification. You can also check manually from **Settings → Check for Updates**.

For manual updates via terminal:
```bash
cd ~/calendar-app
git pull origin main
npm install
rm -rf dist
npm run build
npm start
```

Your `.env` file, `service-account.json`, and calendar data are preserved across updates.

## Before Your First Push to a Public GitHub Repo

If you are forking or republishing this project, complete these one-time security steps **before** running `git push`:

1. **Protect your service-account key.** The `service-account.json` key file is gitignored, but if it ever appeared in screenshots or was accidentally committed, treat it as compromised. In Google Cloud Console → IAM & Admin → Service Accounts, open the account, go to the **Keys** tab, and delete the exposed key. Then create a new JSON key and replace the file on your Pi.

2. **Untrack any debugging artifacts.** The `attached_assets/` folder contains personal screenshots (terminal captures, hostnames, IP addresses) that were used during development. The `.gitignore` excludes the entire folder **with one intentional exception** — `attached_assets/image_1753142842256.png`, which is the McMurry Hurricane logo imported by the app via Vite's `@assets` alias.

   If your local checkout has other files in `attached_assets/` that were tracked before `.gitignore` was tightened, remove them from the git index (the .gitignore alone does NOT untrack already-tracked files):
   ```bash
   git rm -r --cached attached_assets/
   git add attached_assets/image_1753142842256.png   # re-add the one logo the app uses
   git status                                         # verify only the logo is staged from that folder
   ```

3. **Verify nothing sensitive is staged for commit.** Run these two checks:
   ```bash
   # Check 1: no env files, service-account keys, or databases are tracked
   git ls-files | grep -E '(^|/)(\.env|service-account\.json|.*\.db)$'

   # Check 2: only the logo from attached_assets is tracked (should print exactly one filename)
   git ls-files attached_assets/
   ```
   Check 1 should print nothing. Check 2 should print only `attached_assets/image_1753142842256.png`.

4. **After pushing, on your Pi, point the auto-updater at YOUR repo** by setting these in `.env`:
   ```
   GITHUB_REPO_OWNER=your-github-username
   GITHUB_REPO_NAME=your-repo-name
   ```

## License

Add your preferred license here.
