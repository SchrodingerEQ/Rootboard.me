# Calendar Application - Replit Configuration

## Overview
This full-stack calendar application, built with React and Express, is designed to emulate Google Calendar's interface and functionality. It is optimized for fullscreen kiosk mode on a 21.5-inch touchscreen, particularly for Raspberry Pi deployments. The application integrates with the Google Calendar API to display real-time events across day, week, and month views. Key capabilities include Google service account authentication (no browser sign-in required), real-time event synchronization, and a touch-optimized UI.

## User Preferences
Preferred communication style: Simple, everyday language.

## System Architecture

### UI/UX Decisions
The application features a Google Calendar-inspired design, utilizing Radix UI components with shadcn/ui styling and Tailwind CSS for a consistent look and feel. It is optimized for 21.5-inch touchscreens with touch-friendly navigation, disabled user selection and right-click for kiosk environments, and a custom ScreenSaver logo. A screensaver mode with a floating logo, dimming brightness, and time display activates after inactivity.

### Technical Implementations
-   **Frontend**: React 18 with TypeScript, Vite, Wouter for routing, TanStack Query for state management, React Hook Form with Zod for forms.
-   **Backend**: Node.js with Express.js, TypeScript, Drizzle ORM for PostgreSQL, SQLite for self-hosted deployments.
-   **Authentication**: Google Service Account with a JSON key file. The path is read from `GOOGLE_SERVICE_ACCOUNT_KEY_FILE` (defaults to `./service-account.json`). No browser sign-in, no OAuth consent screen, no session cookies — the server uses the key to mint Google API tokens directly. Each calendar to be displayed must be shared (in Google Calendar) with the service account's `client_email`.
-   **Data Synchronization**: Real-time Google Calendar event synchronization, fetching up to 3 months past and 12 months future, with `maxResults=2500` and `pageToken` handling for comprehensive event retrieval. Shared events are handled by a composite `googleEventId + calendarId` key. Stale/deleted events are automatically pruned during each sync cycle via `deleteCalendarEventsByCalendarNotIn`.
-   **Calendar Views**: Month, Week, and Day views with touch-optimized navigation. Overlapping events in the weekly view are displayed side-by-side in staggered columns with dynamic height. Month view shows up to 5 events per day before collapsing with a "Show more events" dialog for busy days.
-   **Settings**: A settings menu provides brightness adjustment, individual calendar toggles, check for updates, rollback, version display, and a logout option.
-   **Version System**: Version constant in `shared/version.ts` (currently v1.0.0), exposed via `/api/version` endpoint. GitHub releases API used for update checking.

### Feature Specifications
-   **Calendar Display**: Displays events with event colors, all-day event support, and location data. Includes chronological sorting in views and dialogs. Today's date is highlighted with an amber/gold background in month view. Event items in month view show compact time format (e.g., "4p" for on-hour, "4:30" for off-hour) followed by title for timed events; all-day events show title only. Day and Week views show 12 hours visible with scrolling (auto-scrolls to 7 AM), and all-day events appear in a dedicated section at the top of the view. Only the active view is rendered (conditional rendering, not CSS hiding) to reduce memory usage on Pi.
-   **Kiosk Optimization**: Fullscreen meta viewport, 44px minimum touch targets, disabled user selection/right-click, Google Sans font, responsive breakpoints for 21.5-inch displays.
-   **Power Saving Mode**: Activates automatically after 5 minutes of inactivity OR manually via SLEEP button in header. Shows black background with centered logo and very low brightness. Wakes on any key press, touch, or click. Auto-refresh is fully skipped while screensaver is active to save CPU and network on Pi.
-   **Auto-Update System**: Daily check at 8 AM via GitHub releases API. Shows notification with "Update Now", "Details", and "Dismiss" buttons. One-tap update: downloads release tarball, backs up current version, extracts, runs npm install, and restarts. Automatic rollback on failure. Manual rollback available in Settings. Update status shown with progress bar. Startup script (`scripts/start.sh`) handles process restart and health-check-based rollback for Pi deployments.
-   **Setup Guide**: Accessible at `/setup` route, provides comprehensive instructions for Raspberry Pi deployment including downloading, Google service account configuration (create account, generate JSON key, share calendars), kiosk mode setup, and updating.
-   **Environment Configuration**: Uses environment variables for database path and the service account key file location.

### System Design Choices
-   **Database**: PostgreSQL via Neon Database (Replit) or SQLite (self-hosted), with Drizzle ORM for type-safe operations. Auto-detects via DATABASE_URL environment variable.
-   **Schema**: `users` and `calendar_events` tables, with schema defined in `shared/schema.ts`. Google credentials are read from the service account JSON key file at runtime, not stored in the database.
-   **Development**: Vite for frontend, `tsx` for backend development, in-memory fallback storage.
-   **Production**: Vite builds optimized frontend, ESBuild bundles backend.

## External Dependencies
-   **Google APIs**: Google Calendar API v3 for event integration, authenticated via a Google service account JSON key.
-   **Neon Database**: Serverless PostgreSQL for data storage (Replit environment).
-   **better-sqlite3**: SQLite for self-hosted deployments on Raspberry Pi.
-   **Radix UI**: Accessible UI component primitives.
-   **TanStack Query**: Server state management library.
-   **Drizzle ORM**: Type-safe ORM for database interactions.
-   **Vite**: Frontend build tool.
-   **TypeScript**: Programming language.
-   **Tailwind CSS**: Utility-first CSS framework.
-   **ESBuild**: JavaScript bundler.
-   **connect-pg-simple**: PostgreSQL session store for Express.