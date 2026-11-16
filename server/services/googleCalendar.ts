import { google, type calendar_v3 } from 'googleapis';
import { GoogleAuth, type OAuth2Client } from 'google-auth-library';
import { existsSync, readFileSync } from 'fs';
import { storage } from '../storage';
import { normalizeGoogleEventTimes } from './googleEventTimes';
import { logPrivate } from './logRing';
import { googleOAuthService, isInvalidGrant, LOST_ACCESS_REASON, OAuthClientNotConfiguredError, type GoogleOAuthService } from './googleOAuth';
import type { OAuthClientStatus } from './googleOAuthClient';
import { calendarFallbackColor } from '@shared/calendar-color';
import type { CalendarEvent, InsertCalendarEvent } from '@shared/schema';

/**
 * Which identity reads the calendars (brief 02 decision 6). `oauth` whenever
 * data/google-oauth.json exists, including after Google refused it (then
 * `authenticated` is false and the connect screen shows why); otherwise the
 * service account when its key loaded; otherwise `none`.
 */
export type GoogleAuthMode = 'oauth' | 'service-account' | 'none';

export interface GoogleAuthStatus {
  mode: GoogleAuthMode;
  authenticated: boolean;
  /** Why the current mode is not connected, or null. */
  error: string | null;
  /** The signed-in account, OAuth only (display only). */
  email: string | null;
  /** data/google-oauth-client.json: whether Connect Google can work on this unit. */
  oauthClient: OAuthClientStatus;
}

export const SIGNED_IN_LIST_MESSAGE =
  'Signed in with Google: add or remove calendars in Google Calendar, and they appear here on their own.';

/** Ends a sync that started under the previous Google account. */
class AccountChangedError extends Error {
  constructor() {
    super('The Google account changed during the sync; it was stopped');
    this.name = 'AccountChangedError';
  }
}

/** Thrown in place of a Google call once the saved sign-in is lost. */
export class GoogleAccessLostError extends Error {
  constructor(message: string = LOST_ACCESS_REASON) {
    super(message);
    this.name = 'GoogleAccessLostError';
  }
}

// The parts of a googleapis (gaxios) error this file reads. Every field is
// optional because the status sits in different places across versions.
type GoogleApiError = {
  code?: number | string;
  status?: number;
  response?: { status?: number };
  errors?: { reason?: string }[];
  cause?: { errors?: { reason?: string }[] };
};

export class GoogleCalendarService {
  // The service-account client; see calendarClient() for the provider choice.
  private calendar: calendar_v3.Calendar | null;
  private oauthCalendar: { client: OAuth2Client; calendar: calendar_v3.Calendar } | null = null;
  private isInitialized: boolean = false;
  private initError: string | null = null;
  private initPromise: Promise<void>;
  private syncInFlight: Promise<CalendarEvent[]> | null = null;
  // Bumped when the Google account changes (sign-in, sign-out). A sync that
  // started under the old identity stops before its next write, so it can't
  // put the old account's events back after the cache is cleared.
  private accountGeneration = 0;
  private lastSyncAt: Date | null = null;
  private lastSyncError: string | null = null;

  constructor(
    private readonly oauth: GoogleOAuthService = googleOAuthService,
    /** Tests point the signed-in client at a mock Calendar API. */
    private readonly oauthApiRootUrl?: string,
  ) {
    this.calendar = null;
    this.initPromise = this.initialize();
  }

  /**
   * The auth-provider seam (brief 02 §3): the signed-in owner's OAuth client
   * when data/google-oauth.json exists, else the service account. Everything
   * that talks to Google goes through here, so sync and the event writes
   * work the same with either.
   */
  private async calendarClient(): Promise<calendar_v3.Calendar> {
    await this.initPromise;
    const oauth = this.oauth.status();
    if (oauth.present) {
      const client = oauth.connected ? this.oauth.getAuthClient() : null;
      if (!client) throw new GoogleAccessLostError(oauth.lostReason ?? undefined);
      if (this.oauthCalendar?.client !== client) {
        const rootUrl = this.oauthApiRootUrl ? { rootUrl: this.oauthApiRootUrl } : {};
        this.oauthCalendar = { client, calendar: google.calendar({ version: 'v3', auth: client, ...rootUrl }) };
      }
      return this.oauthCalendar.calendar;
    }
    if (!this.isInitialized || !this.calendar) {
      throw new Error(`Google Calendar service account not initialized: ${this.initError}`);
    }
    return this.calendar;
  }

  /**
   * One Google call. An `invalid_grant` (the owner revoked access, or a
   * Testing-status token expired) drops the saved tokens once and becomes a
   * GoogleAccessLostError; later calls fail fast without contacting Google
   * until the owner connects again (brief 02 decision 8: no retry loops).
   */
  private async withCalendar<T>(call: (calendar: calendar_v3.Calendar) => Promise<T>): Promise<T> {
    const calendar = await this.calendarClient();
    try {
      return await call(calendar);
    } catch (error) {
      const oauthCalendar = this.oauthCalendar;
      if (oauthCalendar?.calendar === calendar && isInvalidGrant(error)) {
        // Only the sign-in that failed: a newer one may have replaced it meanwhile.
        this.oauth.markLost(oauthCalendar.client.credentials.refresh_token ?? null);
        if (this.oauthCalendar === oauthCalendar) this.oauthCalendar = null;
        throw new GoogleAccessLostError();
      }
      throw error;
    }
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
        scopes: ['https://www.googleapis.com/auth/calendar'],
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
      if (this.oauth.status().present) {
        console.log('A Google sign-in (data/google-oauth.json) also exists; it is used instead of the service account');
      }
    } catch (error) {
      this.calendar = null;
      this.isInitialized = false;
      this.initError = error instanceof Error ? error.message : 'Failed to initialize service account';
      console.error('Failed to initialize service account auth:', this.initError);
    }
  }

  getInitError(): string | null {
    return this.initError;
  }

  /**
   * Call before the Google account changes and before clearing the event
   * cache: stops a running sync at its next write and waits for it to end.
   */
  async beginAccountChange(): Promise<void> {
    this.accountGeneration++;
    this.oauthCalendar = null;
    await this.syncInFlight?.catch(() => undefined);
  }

  /**
   * Adding or removing a calendar changes the identity's calendar list. A
   * service account's list is the kiosk's own; a signed-in owner's list is
   * their Google account's, and the sign-in's scopes don't allow it anyway.
   */
  private refuseCalendarListChangeWhenSignedIn(): void {
    if (this.oauth.status().present) throw new Error(SIGNED_IN_LIST_MESSAGE);
  }

  getAuthStatus(): GoogleAuthStatus {
    const oauth = this.oauth.status();
    const oauthClient = this.oauth.clientStatus().status;
    if (oauth.present) {
      // Signed in, but the client file has since gone: nothing can refresh.
      if (oauth.connected && oauthClient !== 'configured') {
        const error = new OAuthClientNotConfiguredError(oauthClient).message;
        return { mode: 'oauth', authenticated: false, error, email: oauth.email, oauthClient };
      }
      return {
        mode: 'oauth',
        authenticated: oauth.connected,
        error: oauth.connected ? null : (oauth.lostReason ?? LOST_ACCESS_REASON),
        email: oauth.email,
        oauthClient,
      };
    }
    if (this.isInitialized) {
      return { mode: 'service-account', authenticated: true, error: null, email: null, oauthClient };
    }
    return { mode: 'none', authenticated: false, error: this.initError, email: null, oauthClient };
  }

  getServiceAccountEmail(): string | null {
    const keyFile = process.env.GOOGLE_SERVICE_ACCOUNT_KEY_FILE || './service-account.json';
    try {
      if (!existsSync(keyFile)) return null;
      const key = JSON.parse(readFileSync(keyFile, 'utf-8'));
      return typeof key.client_email === 'string' ? key.client_email : null;
    } catch {
      return null;
    }
  }

  getSyncStatus(): { lastSyncAt: string | null; lastSyncError: string | null; syncing: boolean } {
    return {
      lastSyncAt: this.lastSyncAt ? this.lastSyncAt.toISOString() : null,
      lastSyncError: this.lastSyncError,
      syncing: this.syncInFlight !== null,
    };
  }

  async getCalendarList(): Promise<calendar_v3.Schema$CalendarListEntry[]> {
    try {
      const response = await this.withCalendar((calendar) => calendar.calendarList.list());
      return response.data.items || [];
    } catch (error) {
      console.error('Failed to fetch calendar list:', error);
      throw error;
    }
  }

  async subscribeToCalendar(calendarId: string): Promise<calendar_v3.Schema$CalendarListEntry> {
    this.refuseCalendarListChangeWhenSignedIn();
    try {
      const response = await this.withCalendar((calendar) => calendar.calendarList.insert({
        requestBody: { id: calendarId.trim() },
      }));
      return response.data;
    } catch (caught) {
      const error = caught as GoogleApiError | undefined;
      const status = error?.code ?? error?.status ?? error?.response?.status;
      const reason = error?.errors?.[0]?.reason ?? error?.cause?.errors?.[0]?.reason ?? '';
      if (status === 409) {
        throw new Error('Already subscribed to this calendar.');
      }
      if (status === 404 || reason === 'notFound') {
        throw new Error('Calendar not found. Share it with the service account email first, then try again.');
      }
      if (status === 403) {
        throw new Error("The service account doesn't have permission. In Google Calendar, share this calendar with the service account email (Settings → Share with specific people).");
      }
      throw error;
    }
  }

  async unsubscribeFromCalendar(calendarId: string): Promise<void> {
    this.refuseCalendarListChangeWhenSignedIn();
    try {
      await this.withCalendar((calendar) => calendar.calendarList.delete({ calendarId }));
    } catch (caught) {
      const error = caught as GoogleApiError | undefined;
      const status = error?.code ?? error?.status ?? error?.response?.status;
      if (status === 404) {
        return;
      }
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
    const generation = this.accountGeneration;
    const stopIfAccountChanged = () => {
      if (generation !== this.accountGeneration) throw new AccountChangedError();
    };
    try {
      // Get all calendars first
      const calendars = await this.getCalendarList();
      const syncedEvents: CalendarEvent[] = [];

      // Fetch events from each calendar
      for (const calendar of calendars) {
        const calendarId = calendar.id!;
        try {
          let pageToken: string | undefined = undefined;
          let totalEventsForCalendar = 0;
          const syncedGoogleIds: string[] = [];

          // Paginate through all events for this calendar
          do {
            const response: { data: calendar_v3.Schema$Events } = await this.withCalendar((client) => client.events.list({
              calendarId,
              timeMin: startDate.toISOString(),
              timeMax: endDate.toISOString(),
              singleEvents: true,
              orderBy: 'startTime',
              maxResults: 2500,
              pageToken: pageToken,
            }));

            stopIfAccountChanged();
            const googleEvents = response.data.items || [];
            totalEventsForCalendar += googleEvents.length;

            for (const googleEvent of googleEvents) {
              const existingEvent = await storage.getCalendarEventByGoogleIdAndCalendar(googleEvent.id!, calendarId);
              syncedGoogleIds.push(googleEvent.id!);

              const eventData: InsertCalendarEvent = {
                googleEventId: googleEvent.id!,
                calendarId,
                calendarName: calendar.summary || 'Unknown Calendar',
                title: googleEvent.summary || 'Untitled Event',
                description: googleEvent.description || '',
                ...normalizeGoogleEventTimes(googleEvent.start, googleEvent.end),
                location: googleEvent.location || '',
                color: calendar.backgroundColor || this.getCalendarColorById(calendarId),
              };

              let event: CalendarEvent;
              stopIfAccountChanged();
              if (existingEvent) {
                event = await storage.updateCalendarEvent(existingEvent.id, eventData) || existingEvent;
              } else {
                event = await storage.createCalendarEvent(eventData);
              }

              syncedEvents.push(event);
            }

            pageToken = response.data.nextPageToken ?? undefined;
          } while (pageToken);

          // Clean up events that were deleted/cancelled in Google Calendar
          stopIfAccountChanged();
          const removedCount = await storage.deleteCalendarEventsByCalendarNotIn(calendarId, syncedGoogleIds);
          if (removedCount > 0) {
            console.log(`Removed ${removedCount} stale events from calendar: ${logPrivate(calendar.summary)}`);
          }

          console.log(`Synced ${totalEventsForCalendar} events from calendar: ${logPrivate(calendar.summary)}`);
        } catch (calendarError) {
          // Losing the sign-in, or a new account, ends the whole sync; it is
          // not one calendar's problem.
          if (calendarError instanceof GoogleAccessLostError || calendarError instanceof AccountChangedError) throw calendarError;
          console.warn(`Failed to sync events from calendar ${logPrivate(calendar.summary)}:`, calendarError);
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

  // --- Write operations -------------------------------------------------

  // Input shape used by both create and update. Times are ISO strings; for
  // all-day events the caller passes a YYYY-MM-DD date string for start and
  // the day AFTER the last day for end (per Google Calendar API semantics —
  // end.date is exclusive).
  private buildGoogleEventBody(input: {
    title: string;
    description?: string | null;
    location?: string | null;
    startTime: Date;
    endTime: Date;
    isAllDay: boolean;
  }): calendar_v3.Schema$Event {
    const body: calendar_v3.Schema$Event = {
      summary: input.title,
      description: input.description || undefined,
      location: input.location || undefined,
    };

    if (input.isAllDay) {
      // Google all-day events use date (YYYY-MM-DD) with end exclusive.
      const toDateStr = (d: Date) => {
        const y = d.getFullYear();
        const m = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        return `${y}-${m}-${day}`;
      };
      body.start = { date: toDateStr(input.startTime) };
      body.end = { date: toDateStr(input.endTime) };
    } else {
      const tz = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
      body.start = { dateTime: input.startTime.toISOString(), timeZone: tz };
      body.end = { dateTime: input.endTime.toISOString(), timeZone: tz };
    }

    return body;
  }

  private async getCalendarMeta(calendarId: string): Promise<{ summary: string; color: string }> {
    try {
      const list = await this.getCalendarList();
      const found = list.find((c) => c.id === calendarId);
      if (found) {
        return {
          summary: found.summary || 'Unknown Calendar',
          color: found.backgroundColor || this.getCalendarColorById(calendarId),
        };
      }
    } catch {
      // fall through
    }
    return { summary: 'Unknown Calendar', color: this.getCalendarColorById(calendarId) };
  }

  private parseGoogleEventTimes(googleEvent: calendar_v3.Schema$Event): { startTime: Date; endTime: Date; isAllDay: boolean } {
    return normalizeGoogleEventTimes(googleEvent.start, googleEvent.end);
  }

  async createEvent(input: {
    calendarId: string;
    title: string;
    description?: string | null;
    location?: string | null;
    startTime: Date;
    endTime: Date;
    isAllDay: boolean;
  }): Promise<CalendarEvent> {
    const body = this.buildGoogleEventBody(input);
    const response = await this.withCalendar((calendar) => calendar.events.insert({
      calendarId: input.calendarId,
      requestBody: body,
    }));
    const googleEvent = response.data;
    const meta = await this.getCalendarMeta(input.calendarId);
    const times = this.parseGoogleEventTimes(googleEvent);

    const eventData: InsertCalendarEvent = {
      googleEventId: googleEvent.id!,
      calendarId: input.calendarId,
      calendarName: meta.summary,
      title: googleEvent.summary || input.title,
      description: googleEvent.description || '',
      startTime: times.startTime,
      endTime: times.endTime,
      location: googleEvent.location || '',
      color: meta.color,
      isAllDay: times.isAllDay,
    };

    return await storage.createCalendarEvent(eventData);
  }

  async updateEvent(
    localId: number,
    input: {
      title: string;
      description?: string | null;
      location?: string | null;
      startTime: Date;
      endTime: Date;
      isAllDay: boolean;
    }
  ): Promise<CalendarEvent> {
    await this.calendarClient();
    const existing = await storage.getCalendarEvent(localId);
    if (!existing) {
      throw new Error(`Event not found: ${localId}`);
    }

    const body = this.buildGoogleEventBody(input);
    const response = await this.withCalendar((calendar) => calendar.events.patch({
      calendarId: existing.calendarId,
      eventId: existing.googleEventId,
      requestBody: body,
    }));
    const googleEvent = response.data;
    const times = this.parseGoogleEventTimes(googleEvent);

    const updated = await storage.updateCalendarEvent(localId, {
      title: googleEvent.summary || input.title,
      description: googleEvent.description || '',
      location: googleEvent.location || '',
      startTime: times.startTime,
      endTime: times.endTime,
      isAllDay: times.isAllDay,
    });
    if (!updated) {
      throw new Error(`Local update failed for event ${localId}`);
    }
    return updated;
  }

  async deleteEvent(localId: number): Promise<void> {
    await this.calendarClient();
    const existing = await storage.getCalendarEvent(localId);
    if (!existing) {
      throw new Error(`Event not found: ${localId}`);
    }

    try {
      await this.withCalendar((calendar) => calendar.events.delete({
        calendarId: existing.calendarId,
        eventId: existing.googleEventId,
      }));
    } catch (caught) {
      // 410 Gone = already deleted upstream; still prune locally.
      const err = caught as GoogleApiError | undefined;
      const code = err?.code || err?.response?.status;
      if (code !== 410 && code !== 404) {
        throw err;
      }
    }
    await storage.deleteCalendarEvent(localId);
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
    return calendarFallbackColor(calendarId);
  }
}

export const googleCalendarService = new GoogleCalendarService();
