# Calendar Application - Replit Configuration

## Overview

This is a full-stack calendar application built with React and Express, designed to mimic Google Calendar's interface and functionality. The application is optimized for fullscreen kiosk mode on a 23-inch touchscreen, particularly for Raspberry Pi deployments. It integrates with Google Calendar API to display real-time calendar events with day, week, and month views.

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
- Fullscreen meta viewport configuration
- Touch-optimized interactions
- Disabled user selection and right-click
- Google Sans font loading for authentic appearance
- Responsive breakpoints for various screen sizes

## Changelog

```
Changelog:
- July 01, 2025. Initial setup
```

## User Preferences

```
Preferred communication style: Simple, everyday language.
```