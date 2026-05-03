import { google } from 'googleapis';
import { storage } from '../storage';
import type { CalendarEvent, InsertCalendarEvent } from '@shared/schema';

export class GoogleCalendarService {
  private oauth2Client: any;
  private calendar: any;
  private isInitialized: boolean = false;
  private clientReady: boolean = false;
  private syncInFlight: Promise<CalendarEvent[]> | null = null;
  private lastSyncAt: Date | null = null;
  private lastSyncError: string | null = null;

  getSyncStatus(): { lastSyncAt: string | null; lastSyncError: string | null; syncing: boolean } {
    return {
      lastSyncAt: this.lastSyncAt ? this.lastSyncAt.toISOString() : null,
      lastSyncError: this.lastSyncError,
      syncing: this.syncInFlight !== null,
    };
  }

  constructor() {
    this.oauth2Client = null;
    this.calendar = null;
  }

  private ensureClient(): void {
    if (this.clientReady) return;
    this.oauth2Client = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID || "default_client_id",
      process.env.GOOGLE_CLIENT_SECRET || "default_client_secret"
    );
    this.calendar = google.calendar({ version: 'v3', auth: this.oauth2Client });
    this.clientReady = true;
  }
  
  private getRedirectUri(host?: string): string {
    if (host) {
      const isLocalhost = host.startsWith('localhost') || host.startsWith('127.0.0.1');
      const protocol = isLocalhost ? 'http' : 'https';
      const autoUri = `${protocol}://${host}/api/auth/google/callback`;
      if (process.env.GOOGLE_REDIRECT_URI) {
        try {
          const envHost = new URL(process.env.GOOGLE_REDIRECT_URI).host;
          if (envHost !== host) {
            console.log(`Using auto-detected redirect URI (host ${host} differs from GOOGLE_REDIRECT_URI host ${envHost})`);
            return autoUri;
          }
        } catch {}
      }
      return autoUri;
    }
    if (process.env.GOOGLE_REDIRECT_URI) {
      return process.env.GOOGLE_REDIRECT_URI;
    }
    return "http://localhost:5000/api/auth/google/callback";
  }

  async initializeCredentials(): Promise<boolean> {
    try {
      this.ensureClient();
      const credentials = await storage.getGoogleCredentials();
      if (!credentials) {
        this.isInitialized = false;
        return false;
      }

      this.oauth2Client.setCredentials({
        access_token: credentials.accessToken,
        refresh_token: credentials.refreshToken,
        expiry_date: credentials.expiryDate.getTime(),
      });

      // Validate credentials by making a test API call
      try {
        await this.oauth2Client.getAccessToken();
        this.isInitialized = true;
      } catch (testError) {
        console.log('Credentials validation failed, attempting refresh');
        // Check if token is expired and refresh if needed
        if (credentials.expiryDate < new Date()) {
          await this.refreshAccessToken();
          this.isInitialized = true;
        } else {
          throw testError;
        }
      }

      return true;
    } catch (error) {
      console.error('Failed to initialize Google credentials:', error);
      this.isInitialized = false;
      
      // Enhanced error handling for different invalid_grant scenarios
      if (error instanceof Error) {
        if (error.message.includes('invalid_grant')) {
          console.log('Invalid grant detected, clearing stored credentials');
          await storage.clearGoogleCredentials();
        } else if (error.message.includes('invalid_request')) {
          console.log('Invalid request detected, may need OAuth reconfiguration');
          await storage.clearGoogleCredentials();
        }
      }
      
      return false;
    }
  }

  async refreshAccessToken(): Promise<void> {
    const maxRetries = 2;
    let lastError: Error | null = null;
    
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        console.log(`Token refresh attempt ${attempt}/${maxRetries}`);
        const { credentials } = await this.oauth2Client.refreshAccessToken();
        
        if (!credentials.access_token) {
          throw new Error('No access token received from refresh');
        }
        
        await storage.updateGoogleCredentials({
          accessToken: credentials.access_token,
          expiryDate: new Date(credentials.expiry_date),
        });

        this.oauth2Client.setCredentials(credentials);
        this.isInitialized = true;
        console.log('Token refresh successful');
        return; // Success - exit retry loop
      } catch (error) {
        lastError = error as Error;
        console.error(`Token refresh attempt ${attempt} failed:`, error);
        
        // Handle specific error types
        if (error instanceof Error) {
          if (error.message.includes('invalid_grant')) {
            console.log('Refresh token is invalid, clearing stored credentials');
            await storage.clearGoogleCredentials();
            this.isInitialized = false;
            throw new Error('Authentication required: refresh token expired or revoked');
          } else if (error.message.includes('invalid_request')) {
            console.log('Invalid OAuth request configuration');
            await storage.clearGoogleCredentials();
            this.isInitialized = false;
            throw new Error('OAuth configuration error: please check client credentials');
          }
        }
        
        // Wait before retry (except on last attempt)
        if (attempt < maxRetries) {
          await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
        }
      }
    }
    
    this.isInitialized = false;
    throw lastError || new Error('Token refresh failed after all retries');
  }

  getAuthUrl(state?: string, host?: string): string {
    this.ensureClient();
    const clientId = process.env.GOOGLE_CLIENT_ID;
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
    const redirectUri = this.getRedirectUri(host);
    
    if (!clientId || clientId === 'default_client_id') {
      throw new Error('Google Client ID not configured. Please set GOOGLE_CLIENT_ID environment variable.');
    }
    if (!clientSecret || clientSecret === 'default_client_secret') {
      throw new Error('Google Client Secret not configured. Please set GOOGLE_CLIENT_SECRET environment variable.');
    }
    
    // Temporarily set the redirect URI for this auth request
    this.oauth2Client.redirectUri = redirectUri;
    
    const scopes = ['https://www.googleapis.com/auth/calendar.readonly'];
    const authUrl = this.oauth2Client.generateAuthUrl({
      access_type: 'offline', // Required for refresh tokens
      scope: scopes,
      prompt: 'consent', // Forces consent to get refresh token
      include_granted_scopes: true, // Incremental authorization
      state: state || Date.now().toString(), // CSRF protection - use provided state or generate one
      redirect_uri: redirectUri // Explicitly set redirect URI for this request
    });
    
    console.log('OAuth Client Configuration:');
    console.log('Client ID:', clientId.substring(0, 20) + '...');
    console.log('Redirect URI:', redirectUri);
    console.log('Auth URL generated successfully');
    return authUrl;
  }

  async handleAuthCallback(code: string, host?: string): Promise<void> {
    try {
      this.ensureClient();
      console.log('Processing OAuth callback (code received)');
      
      const decodedCode = decodeURIComponent(code.trim());
      
      if (!decodedCode || decodedCode.length < 10) {
        throw new Error('Invalid authorization code format');
      }

      const redirectUri = this.getRedirectUri(host);
      this.oauth2Client.redirectUri = redirectUri;
      console.log('Token exchange redirect URI:', redirectUri);
      
      const { tokens } = await this.oauth2Client.getToken(decodedCode);
      console.log('Received tokens:', { 
        hasAccessToken: !!tokens.access_token,
        hasRefreshToken: !!tokens.refresh_token,
        expiryDate: tokens.expiry_date 
      });
      
      // Validate required tokens
      if (!tokens.access_token) {
        throw new Error('No access token received from OAuth callback');
      }
      if (!tokens.refresh_token) {
        throw new Error('No refresh token received - ensure access_type=offline and prompt=consent');
      }
      
      const credentials = await storage.createGoogleCredentials({
        accessToken: tokens.access_token,
        refreshToken: tokens.refresh_token,
        expiryDate: new Date(tokens.expiry_date || Date.now() + 3600000), // Default 1 hour if not provided
      });
      console.log('Stored credentials:', { id: credentials.id, hasTokens: !!credentials.accessToken });

      this.oauth2Client.setCredentials(tokens);
      this.isInitialized = true;
      console.log('OAuth client credentials set successfully');
    } catch (error) {
      console.error('Failed to handle auth callback:', error);
      this.isInitialized = false;
      
      // Enhanced error reporting for callback failures
      if (error instanceof Error) {
        if (error.message.includes('invalid_grant')) {
          throw new Error('Authorization code invalid or expired. Please try signing in again.');
        } else if (error.message.includes('redirect_uri_mismatch')) {
          throw new Error('OAuth redirect URI mismatch. Check your Google Cloud Console configuration.');
        } else if (error.message.includes('invalid_client')) {
          throw new Error('Invalid OAuth client configuration. Check your client ID and secret.');
        }
      }
      
      throw error;
    }
  }

  async getCalendarList(): Promise<any[]> {
    try {
      const initialized = await this.initializeCredentials();
      if (!initialized) {
        throw new Error('Google Calendar credentials not initialized');
      }

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
      const initialized = await this.initializeCredentials();
      if (!initialized) {
        throw new Error('Google Calendar credentials not initialized');
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

  clearCredentials(): void {
    this.ensureClient();
    this.oauth2Client.setCredentials({});
    this.isInitialized = false;
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
