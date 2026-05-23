import { google } from 'googleapis';
import { GoogleAuth } from 'google-auth-library';
import { existsSync } from 'fs';
import { storage } from '../storage';
import type { CalendarEvent, InsertCalendarEvent } from '@shared/schema';

export class GoogleCalendarService {
  private calendar: any;
  private isInitialized: boolean = false;
  private initError: string | null = null;
  private initPromise: Promise<void>;
  private syncInFlight: Promise<CalendarEvent[]> | null = null;
  private lastSyncAt: Date | null = null;
  private lastSyncError: string | null = null;

  constructor() {
    this.calendar = null;
    this.initPromise = this.initialize();
  }

  private async initialize(): Promise<void> {
    const keyFile = process.env.GOOGLE_SERVICE_ACCOUNT_KEY_FILE || './service-account.json';
    try {
      // Pre-flight: surface a clear error before google-auth-library tries to
      // read the file. GoogleAuth defers file IO until first API call, so
      // without this check a missing key silently looks "connected" until
      // the first sync fails.
      if (!existsSync(keyFile)) {
        throw new Error(
          `Service account key file not found at "${keyFile}". ` +
          `Place your JSON key at this path or set GOOGLE_SERVICE_ACCOUNT_KEY_FILE in .env.`
        );
      }

      const auth = new GoogleAuth({
        keyFile,
        scopes: ['https://www.googleapis.com/auth/calendar.events'],
      });

      // Force GoogleAuth to actually read+parse the key file and mint a
      // client. If the file is unreadable, malformed JSON, or missing the
      // required fields, this throws here at startup instead of pretending
      // the service is connected until the first user-visible sync fails.
      await auth.getClient();

      this.calendar = google.calendar({ version: 'v3', auth });
      this.isInitialized = true;
      this.initError = null;
      console.log(`Service account auth initialized from: ${keyFile}`);
    } catch (error) {
      this.calendar = null;
      this.isInitialized = false;
      this.initError = error instanceof Error ? error.message : 'Failed to initialize service account';
      console.error('Failed to initialize service account auth:', this.initError);
    }
  }

  isConnected(): boolean {
    return this.isInitialized;
  }

  getInitError(): string | null {
    return this.initError;
  }

  getSyncStatus(): { lastSyncAt: string | null; lastSyncError: string | null; syncing: boolean } {
    return {
      lastSyncAt: this.lastSyncAt ? this.lastSyncAt.toISOString() : null,
      lastSyncError: this.lastSyncError,
      syncing: this.syncInFlight !== null,
    };
  }

  async getCalendarList(): Promise<any[]> {
    await this.initPromise;
    if (!this.isInitialized) {
      throw new Error(`Google Calendar service account not initialized: ${this.initError}`);
    }
    try {
      const response = await this.calendar.calendarList.list();
      return response.data.items || [];
    } catch (error) {
      console.error('Failed to fetch calendar list:', error);
      throw error;
    }
  }

  async syncCalendarEvents(startDate: Date, endDate: Date): Promise<CalendarEvent[]> {
    // Coalesce concurrent sync requests so the heavy network/DB work runs only once.
    // Any caller that arrives while a sync is already running shares the same promise
    // and gets the same result, instead of triggering a duplicate fan-out.
    if (this.syncInFlight) {
      console.log('Sync already in progress — joining existing run');
      return this.syncInFlight;
    }

    this.syncInFlight = this.runSync(startDate, endDate).finally(() => {
      this.syncInFlight = null;
    });
    return this.syncInFlight;
  }

  private async runSync(startDate: Date, endDate: Date): Promise<CalendarEvent[]> {
    try {
      await this.initPromise;
      if (!this.isInitialized) {
        throw new Error(`Google Calendar service account not initialized: ${this.initError}`);
      }

      // Get all calendars first
      const calendars = await this.getCalendarList();
      const syncedEvents: CalendarEvent[] = [];

      // Fetch events from each calendar
      for (const calendar of calendars) {
        try {
          let pageToken: string | undefined = undefined;
          let totalEventsForCalendar = 0;
          let response: any;
          const syncedGoogleIds: string[] = [];

          // Paginate through all events for this calendar
          do {
            response = await this.calendar.events.list({
              calendarId: calendar.id,
              timeMin: startDate.toISOString(),
              timeMax: endDate.toISOString(),
              singleEvents: true,
              orderBy: 'startTime',
              maxResults: 2500,
              pageToken: pageToken,
            });

            const googleEvents = response.data.items || [];
            totalEventsForCalendar += googleEvents.length;

            for (const googleEvent of googleEvents) {
              const existingEvent = await storage.getCalendarEventByGoogleIdAndCalendar(googleEvent.id!, calendar.id);
              syncedGoogleIds.push(googleEvent.id!);

              const eventData: InsertCalendarEvent = {
                googleEventId: googleEvent.id!,
                calendarId: calendar.id,
                calendarName: calendar.summary || 'Unknown Calendar',
                title: googleEvent.summary || 'Untitled Event',
                description: googleEvent.description || '',
                startTime: new Date(googleEvent.start?.dateTime || googleEvent.start?.date!),
                endTime: new Date(googleEvent.end?.dateTime || googleEvent.end?.date!),
                location: googleEvent.location || '',
                color: calendar.backgroundColor || this.getCalendarColorById(calendar.id),
                isAllDay: !!googleEvent.start?.date,
              };

              let event: CalendarEvent;
              if (existingEvent) {
                event = await storage.updateCalendarEvent(existingEvent.id, eventData) || existingEvent;
              } else {
                event = await storage.createCalendarEvent(eventData);
              }

              syncedEvents.push(event);
            }

            pageToken = response.data.nextPageToken;
          } while (pageToken);

          // Clean up events that were deleted/cancelled in Google Calendar
          const removedCount = await storage.deleteCalendarEventsByCalendarNotIn(calendar.id, syncedGoogleIds);
          if (removedCount > 0) {
            console.log(`Removed ${removedCount} stale events from calendar: ${calendar.summary}`);
          }

          console.log(`Synced ${totalEventsForCalendar} events from calendar: ${calendar.summary}`);
        } catch (calendarError) {
          console.warn(`Failed to sync events from calendar ${calendar.summary}:`, calendarError);
        }
      }

      console.log(`Total events synced across all calendars: ${syncedEvents.length}`);

      // Retention sweep: drop events that ended before the rolling 3-month past window.
      // This keeps storage bounded on long-running kiosks where the sync window slides
      // forward over time but old events would otherwise pile up indefinitely.
      try {
        const retentionCutoff = new Date();
        retentionCutoff.setMonth(retentionCutoff.getMonth() - 3);
        const prunedCount = await storage.deleteCalendarEventsEndedBefore(retentionCutoff);
        console.log(`Retention sweep: pruned ${prunedCount} events ended before ${retentionCutoff.toISOString()}`);
      } catch (pruneError) {
        console.warn('Retention sweep failed:', pruneError);
      }

      this.lastSyncAt = new Date();
      this.lastSyncError = null;
      return syncedEvents;
    } catch (error) {
      console.error('Failed to sync calendar events:', error);
      this.lastSyncError = error instanceof Error ? error.message : 'Unknown sync error';
      // Intentionally do NOT update lastSyncAt on failure — it tracks the
      // most recent *successful* sync so the UI can keep showing how stale
      // the on-screen data is while flagging the error separately.
      throw error;
    }
  }

  private getEventColor(colorId?: string): string {
    const colorMap: Record<string, string> = {
      '1': '#1a73e8', // Blue
      '2': '#34a853', // Green
      '3': '#9c27b0', // Purple
      '4': '#ea4335', // Red
      '5': '#ff9800', // Orange
      '6': '#ffeb3b', // Yellow
      '7': '#795548', // Brown
      '8': '#607d8b', // Blue Grey
      '9': '#3f51b5', // Indigo
      '10': '#ff5722', // Deep Orange
      '11': '#e91e63', // Pink
    };

    return colorMap[colorId || '1'] || '#1a73e8';
  }

  private getCalendarColorById(calendarId: string): string {
    // Generate a consistent color based on calendar ID
    const colors = [
      '#1a73e8', // Blue
      '#34a853', // Green
      '#ea4335', // Red
      '#ff9800', // Orange
      '#9c27b0', // Purple
      '#795548', // Brown
      '#607d8b', // Blue Grey
      '#e91e63', // Pink
      '#4caf50', // Light Green
      '#ff5722', // Deep Orange
      '#3f51b5', // Indigo
      '#009688', // Teal
    ];

    // Create a simple hash from the calendar ID to get consistent colors
    let hash = 0;
    for (let i = 0; i < calendarId.length; i++) {
      hash = ((hash << 5) - hash + calendarId.charCodeAt(i)) & 0xffffffff;
    }
    const index = Math.abs(hash) % colors.length;
    return colors[index];
  }
}

export const googleCalendarService = new GoogleCalendarService();
