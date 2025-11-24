# Calendar Application - Replit Configuration

## Overview

This is a full-stack calendar application built with React and Express, designed to mimic Google Calendar's interface and functionality. The application is optimized for fullscreen kiosk mode on a 21.5-inch touchscreen, particularly for Raspberry Pi deployments. It integrates with Google Calendar API to display real-time calendar events with day, week, and month views.

## System Architecture

### Frontend Architecture
- **Framework**: React 18 with TypeScript
- **Build Tool**: Vite for fast development and optimized builds
- **UI Framework**: Radix UI components with shadcn/ui styling system
- **Styling**: Tailwind CSS with custom Google Calendar-inspired design tokens
- **State Management**: TanStack Query (React Query) for server state management
- **Routing**: Wouter for lightweight client-side routing
- **Forms**: React Hook Form with Zod validation

### Backend Architecture
- **Runtime**: Node.js with Express.js server
- **Language**: TypeScript with ES modules
- **Database ORM**: Drizzle ORM with PostgreSQL dialect
- **Database Provider**: Neon Database (serverless PostgreSQL)
- **Authentication**: Google OAuth 2.0 integration
- **Session Management**: Express sessions with PostgreSQL store

### Data Storage Solutions
- **Primary Database**: PostgreSQL (configured for Neon Database)
- **ORM**: Drizzle ORM for type-safe database operations
- **Schema Location**: `shared/schema.ts` for shared types between frontend and backend
- **Migrations**: Stored in `./migrations` directory
- **Fallback Storage**: In-memory storage implementation for development

## Key Components

### Database Schema
The application uses three main tables:
- **users**: User authentication and profile data
- **calendar_events**: Calendar event storage with Google Calendar integration
- **google_credentials**: OAuth tokens and refresh tokens for Google Calendar API

### Google Calendar Integration
- OAuth 2.0 flow for Google Calendar access
- Real-time event synchronization
- Support for event colors, all-day events, and locations
- Automatic token refresh handling

### Calendar Views
- **Month View**: Full monthly calendar grid with event previews
- **Week View**: 7-day view with hourly time slots
- **Day View**: Single day detailed view with time slots
- Touch-optimized navigation for kiosk environments

### UI Components
- Custom calendar components built on Radix UI primitives
- Google Calendar-inspired color scheme and styling
- Responsive design with mobile considerations
- Loading states and error handling

## Data Flow

1. **Authentication Flow**:
   - User initiates Google OAuth via `/api/auth/google`
   - Callback handled at `/api/auth/google/callback`
   - Credentials stored securely in database
   - Automatic token refresh when expired

2. **Event Fetching**:
   - Frontend requests events for date range via `/api/calendar/events`
   - Backend fetches from Google Calendar API using stored credentials
   - Events cached and synchronized with local database
   - Real-time updates through periodic refresh

3. **Calendar Display**:
   - React Query manages server state and caching
   - Calendar views calculate date ranges based on current view
   - Events filtered and displayed according to view type
   - Touch interactions optimized for kiosk mode

## External Dependencies

### Core Dependencies
- **Google APIs**: Google Calendar API v3 integration
- **Neon Database**: Serverless PostgreSQL hosting
- **Radix UI**: Accessible component primitives
- **TanStack Query**: Server state management
- **Drizzle ORM**: Type-safe database operations

### Development Tools
- **Vite**: Build tool with HMR support
- **TypeScript**: Type safety across the stack
- **Tailwind CSS**: Utility-first styling
- **ESBuild**: Fast JavaScript bundling for production

### Replit Integration
- Replit-specific Vite plugins for development
- Runtime error overlay for debugging
- Cartographer plugin for enhanced development experience

## Deployment Strategy

### Development Mode
- Vite dev server with HMR for frontend
- tsx for TypeScript execution in development
- Concurrent frontend and backend development
- In-memory storage fallback for rapid prototyping

### Production Build
- Vite builds optimized frontend bundle to `dist/public`
- ESBuild bundles backend server to `dist/index.js`
- Static file serving through Express
- Environment-based configuration

### Environment Variables
Required environment variables:
- `DATABASE_URL`: PostgreSQL connection string
- `GOOGLE_CLIENT_ID`: Google OAuth client ID
- `GOOGLE_CLIENT_SECRET`: Google OAuth client secret
- `GOOGLE_REDIRECT_URI`: OAuth callback URL

### Kiosk Optimization
- Fullscreen meta viewport configuration optimized for 21.5-inch displays
- Touch-optimized interactions with proper touch targets (44px minimum)
- Disabled user selection and right-click for kiosk environment
- Google Sans font loading for authentic appearance
- Responsive breakpoints specifically tuned for 21.5-inch touchscreens
- Media queries for both standard and high-DPI 21.5-inch displays

## Changelog

```
Changelog:
- July 01, 2025: Initial setup and complete implementation
  - Built fullscreen Google Calendar display application
  - Implemented month, week, and day views
  - Added Google Calendar API integration with OAuth
  - Created touch-optimized interface for 23-inch kiosk displays
  - Added keyboard shortcuts and auto-refresh functionality
  - Resolved Connect Google button display issue using Tailwind colors
  - Successfully completed Google OAuth authentication flow
  - Resolved OAuth callback DNS issues with enhanced error handling
  - Verified real Google Calendar data synchronization
  - Application now displays authentic calendar events from user's Google Calendar
  - FIXED: Implemented persistent credential storage to survive server restarts
  - FIXED: High contrast fonts for better touchscreen readability (black text on white)
  - FIXED: Day view now properly displays calendar events
  - FIXED: Auto-loading of events after authentication (no manual refresh needed)
  - FIXED: Manual authentication endpoint for easier OAuth completion
  - VERIFIED: Auto-loading functionality confirmed working - events load on page refresh
  - ADDED: Calendar filter buttons across top of interface
  - ADDED: Individual calendar toggle functionality (show/hide specific calendars)
  - ADDED: Color-coded events matching their source calendar colors
  - FIXED: Calendar filtering logic to allow completely empty selection
  - ADDED: Settings menu with gear icon access containing:
    - Brightness adjustment slider (30-150% range) applying to entire application
    - Calendar selection toggles for show/hide specific calendars
    - Logout button with confirmation dialog clearing credentials
  - ADDED: Dynamic header calendar filters that sync with settings menu selections
  - RESOLVED: Google OAuth authentication using custom user credentials
  - VERIFIED: Settings menu fully functional with real-time header synchronization
  - COMPLETED: Two-level calendar control system implementation:
    - Settings menu toggles control both header button visibility AND calendar event display
    - Header button clicks provide fine-grained control for enabled calendars only
    - Calendar events disappear from monthly grid when toggled off in settings
    - Immediate visual updates for both header and calendar grid when toggling
  - ADDED: "Show more events" functionality for busy calendar days:
    - Down arrow appears when days have more than 3 events (prevents 4th event cutoff)
    - Arrow positioned at bottom-right of calendar cells with "+X more" text
    - Clicking arrow opens dialog showing all events for that specific day
    - Dialog maintains full event selection functionality for viewing event details
    - Optimized dialog sizing to prevent bottom event cutoff issues
  - COMPLETED: Advanced overlapping events functionality in weekly view:
    - Events with overlapping times display side-by-side in staggered columns
    - Equal width distribution for all overlapping events within time slots
    - Dynamic event height based on duration (events span multiple time slots vertically)
    - Real-time layout updates when calendar views are toggled on/off
    - Simplified overlap detection algorithm for consistent positioning
    - Events maintain proper alignment within day columns while overlapping horizontally
  - OPTIMIZED: UI spacing to prevent "+x more" element cutoff in bottom calendar row:
    - Reduced header padding from py-2 to py-1 and px-4 to px-3
    - Made logo smaller (8x8 instead of 10x10) with compact navigation buttons
    - Reduced day-of-week header spacing and removed border for visual compactness
    - Optimized calendar grid gap from 0.5px to 0.25px for less white space
    - Made day numbers and "+x more" elements smaller with tighter spacing
    - Reduced calendar filters padding for maximum vertical space utilization
    - VERIFIED: "+x more" elements now fully visible in pop-out view without cutoff
  - REPOSITIONED: Settings button moved to the right of the refresh button:
    - Modified CalendarHeader component to accept settingsButton as prop
    - Positioned settings gear icon directly adjacent to refresh button in header row
    - Simplified calendar filters layout by removing settings from second row
    - Maintained consistent spacing and alignment with other header elements
  - CUSTOMIZED: Replaced default calendar logo with McMurry Hurricane custom logo:
    - Removed default calendar icon and "Calendar" text from header
    - Added custom McMurry Hurricane logo with blue hurricane spiral design
    - Set logo size to h-16 for optimal visibility without changing header height
    - Imported logo using proper assets system for build optimization
  - OPTIMIZED: Hardware upgrade for 21.5-inch touchscreen display:
    - Updated meta description and documentation for 21.5-inch screen size
    - Reduced calendar cell height from 110px to 100px for better space utilization
    - Added responsive breakpoints and media queries for 21.5-inch displays
    - Optimized touch targets to minimum 44px for touchscreen interaction
    - Added high-DPI display support for crisp text and UI elements
    - Adjusted font sizes and spacing for optimal visibility on smaller display
  - VERIFIED: 21.5-inch touchscreen optimization confirmed working properly
  - ADDED: Energy-saving screensaver mode with comprehensive power management:
    - Automatic activation after 2 minutes of inactivity detection
    - Screen brightness automatically dims to 20% during screensaver mode
    - Floating McMurry Hurricane logo with gentle animation and blue glow effect
    - Current time and date display during screensaver for reference
    - Instant wake-up on any touch, click, or keyboard interaction
    - Automatic return to monthly calendar view of current month on wake-up
    - Integrated brightness control between settings menu and screensaver system
    - Persistent brightness settings stored in localStorage across sessions
    - Smooth CSS transitions for brightness changes and screensaver overlay
  - ENHANCED: Monthly view day number styling for improved visual clarity:
    - Days from previous/next months now appear in light gray (text-gray-300) with reduced opacity
    - Current month days remain bold black for clear distinction from adjacent months
    - Today's date maintains blue highlighting for easy identification
    - Fixed month comparison logic to handle year boundaries correctly
  - FIXED: Resolved recurring Google OAuth authentication issues causing flashing sync dialogs:
    - Invalid stored credentials were causing continuous "invalid_grant" errors
    - Improved authentication status checking to properly detect invalid tokens
    - Added proper authentication dialog that appears when login is needed
    - Created endpoint to clear credentials when they become invalid
    - Fixed authentication loop that prevented proper login flow
    - Authentication dialog now shows instead of flashing "Syncing calendar" message
  - IMPLEMENTED: PostgreSQL-backed session storage for reliable OAuth state management:
    - Replaced in-memory sessions with connect-pg-simple PostgreSQL session store
    - Sessions now persist across server instances and deployments
    - Added explicit session.save() before OAuth redirect to ensure state is persisted
    - Enhanced OAuth callback logging for debugging session state verification
    - Maintains CSRF protection via state parameter while supporting multi-instance deployments
  - FIXED: Calendar event pagination to fetch all events from Google Calendar API:
    - Added maxResults=2500 (Google's maximum per page) to events.list calls
    - Implemented pageToken handling to fetch all pages of results
    - Now syncing 3,500+ events across all calendars vs previous ~560
  - FIXED: Event date range filtering using overlapping logic:
    - Changed from "fully contained" to "overlapping" date range filter
    - Events that span across date boundaries now display correctly
    - Multi-day events and cross-boundary events properly visible
  - EXPANDED: Sync date range to 3 months past + 12 months future:
    - Ensures all relevant events are captured regardless of current view
    - Prevents missing events due to narrow sync windows
  - FIXED: Shared calendar events now appear on all associated calendars:
    - Changed event storage key from googleEventId to composite (googleEventId + calendarId)
    - Events shared across multiple calendars now display on each calendar correctly
    - Previously, shared events would only appear on one calendar due to ID collision
  - STATUS: Application fully functional and production-ready for 21.5-inch kiosk deployment
```

## User Preferences

```
Preferred communication style: Simple, everyday language.
```