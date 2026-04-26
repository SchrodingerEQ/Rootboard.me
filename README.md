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
- **Auth**: Google OAuth 2.0

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

3. **Configure Google OAuth**

   Copy the example environment file and fill in your Google OAuth credentials:
   ```bash
   cp .env.example .env
   nano .env
   ```

   You will need a Google Cloud project with the Calendar API enabled and an OAuth 2.0 Client ID. The app contains a complete step-by-step setup guide — start the app and visit `http://localhost:5000/setup` for detailed instructions.

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

The app includes a comprehensive setup guide accessible at the `/setup` route once it's running. The guide covers:

- Transferring the app to your Raspberry Pi (USB, direct download, git clone, or SCP)
- Installing Node.js and dependencies
- Configuring Google OAuth credentials (with screenshots-style walkthrough)
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

Your `.env` file and calendar data are preserved across updates.

## Before Your First Push to a Public GitHub Repo

If you are forking or republishing this project, complete these one-time security steps **before** running `git push`:

1. **Revoke any live OAuth tokens.** The runtime token cache (`google_credentials.json`) is gitignored, but if it ever appeared in screenshots, treat the tokens as compromised. Visit <https://myaccount.google.com/permissions>, find your "Calendar Kiosk" app, and click **Remove Access**. The app will simply re-prompt for login.

2. **Consider rotating the OAuth Client Secret.** If your Google Cloud Client ID has been visible in screenshots or shared docs, rotate the secret: Google Cloud Console → APIs & Services → Credentials → click your OAuth client → **Reset Secret**. Update the new value in your Pi's `.env`.

3. **Untrack any debugging artifacts.** The `attached_assets/` folder contains personal screenshots (OAuth screens, terminal captures, hostnames, IP addresses) that were used during development. The `.gitignore` excludes the entire folder **with one intentional exception** — `attached_assets/image_1753142842256.png`, which is the McMurry Hurricane logo imported by the app via Vite's `@assets` alias.

   If your local checkout has other files in `attached_assets/` that were tracked before `.gitignore` was tightened, remove them from the git index (the .gitignore alone does NOT untrack already-tracked files):
   ```bash
   git rm -r --cached attached_assets/
   git add attached_assets/image_1753142842256.png   # re-add the one logo the app uses
   git status                                         # verify only the logo is staged from that folder
   ```

4. **Verify nothing sensitive is staged for commit.** Run these two checks:
   ```bash
   # Check 1: no env files, credential files, or databases are tracked
   git ls-files | grep -E '(^|/)(\.env|google_credentials\.json|.*\.db)$'

   # Check 2: only the logo from attached_assets is tracked (should print exactly one filename)
   git ls-files attached_assets/
   ```
   Check 1 should print nothing. Check 2 should print only `attached_assets/image_1753142842256.png`.

5. **After pushing, on your Pi, point the auto-updater at YOUR repo** by setting these in `.env`:
   ```
   GITHUB_REPO_OWNER=your-github-username
   GITHUB_REPO_NAME=your-repo-name
   ```

## License

Add your preferred license here.
