# Calendar Application - Replit Configuration

## Overview
This full-stack calendar application, built with React and Express, is designed to emulate Google Calendar's interface and functionality. It is optimized for fullscreen kiosk mode on a 21.5-inch touchscreen, particularly for Raspberry Pi deployments. The application integrates with the Google Calendar API to display real-time events across day, week, and month views. Key capabilities include Google OAuth integration, real-time event synchronization, and a touch-optimized UI.

## User Preferences
Preferred communication style: Simple, everyday language.

## System Architecture

### UI/UX Decisions
The application features a Google Calendar-inspired design, utilizing Radix UI components with shadcn/ui styling and Tailwind CSS for a consistent look and feel. It is optimized for 21.5-inch touchscreens with touch-friendly navigation, disabled user selection and right-click for kiosk environments, and a custom McMurry Hurricane logo. A screensaver mode with a floating logo, dimming brightness, and time display activates after inactivity.

### Technical Implementations
-   **Frontend**: React 18 with TypeScript, Vite, Wouter for routing, TanStack Query for state management, React Hook Form with Zod for forms.
-   **Backend**: Node.js with Express.js, TypeScript, Drizzle ORM for PostgreSQL.
-   **Authentication**: Google OAuth 2.0 with persistent session management using `connect-pg-simple`.
-   **Data Synchronization**: Real-time Google Calendar event synchronization, fetching up to 3 months past and 12 months future, with `maxResults=2500` and `pageToken` handling for comprehensive event retrieval. Shared events are handled by a composite `googleEventId + calendarId` key.
-   **Calendar Views**: Month, Week, and Day views with touch-optimized navigation. Overlapping events in the weekly view are displayed side-by-side in staggered columns with dynamic height. Month view shows up to 5 events per day before collapsing with a "Show more events" dialog for busy days.
-   **Settings**: A settings menu provides brightness adjustment, individual calendar toggles, and a logout option.

### Feature Specifications
-   **Calendar Display**: Displays events with event colors, all-day event support, and location data. Includes chronological sorting in views and dialogs. Today's date is highlighted with an amber/gold background in month view. Event items in month view show compact time format (e.g., "4p" for on-hour, "4:30" for off-hour) followed by title for timed events; all-day events show title only.
-   **Kiosk Optimization**: Fullscreen meta viewport, 44px minimum touch targets, disabled user selection/right-click, Google Sans font, responsive breakpoints for 21.5-inch displays.
-   **Power Saving Mode**: Activates automatically after 2 minutes of inactivity OR manually via SLEEP button in header. Shows black background with centered logo and very low brightness. Wakes on any key press, touch, or click. Automatic calendar refreshes do not count as user activity.
-   **Environment Configuration**: Uses environment variables for database and Google OAuth credentials.

### System Design Choices
-   **Database**: PostgreSQL via Neon Database, with Drizzle ORM for type-safe operations.
-   **Schema**: `users`, `calendar_events`, and `google_credentials` tables, with schema defined in `shared/schema.ts`.
-   **Development**: Vite for frontend, `tsx` for backend development, in-memory fallback storage.
-   **Production**: Vite builds optimized frontend, ESBuild bundles backend.

## External Dependencies
-   **Google APIs**: Google Calendar API v3 for event integration and Google OAuth 2.0 for authentication.
-   **Neon Database**: Serverless PostgreSQL for data storage.
-   **Radix UI**: Accessible UI component primitives.
-   **TanStack Query**: Server state management library.
-   **Drizzle ORM**: Type-safe ORM for database interactions.
-   **Vite**: Frontend build tool.
-   **TypeScript**: Programming language.
-   **Tailwind CSS**: Utility-first CSS framework.
-   **ESBuild**: JavaScript bundler.
-   **connect-pg-simple**: PostgreSQL session store for Express.