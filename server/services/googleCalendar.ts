import { google } from 'googleapis';
import { storage } from '../storage';
import type { CalendarEvent, InsertCalendarEvent } from '@shared/schema';

export class GoogleCalendarService {
  private oauth2Client: any;
  private calendar: any;
  private isInitialized: boolean = false;

  constructor() {
    this.oauth2Client = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID || process.env.GOOGLE_CLIENT_ID_ENV_VAR || "default_client_id",
      process.env.GOOGLE_CLIENT_SECRET || process.env.GOOGLE_CLIENT_SECRET_ENV_VAR || "default_client_secret",
      process.env.GOOGLE_REDIRECT_URI || process.env.GOOGLE_REDIRECT_URI_ENV_VAR || "http://localhost:5000/api/auth/google/callback"
    );
    
    this.calendar = google.calendar({ version: 'v3', auth: this.oauth2Client });
  }

  async initializeCredentials(): Promise<boolean> {
    try {
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

  getAuthUrl(state?: string): string {
    // Validate OAuth configuration before generating URL
    const clientId = process.env.GOOGLE_CLIENT_ID;
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
    const redirectUri = process.env.GOOGLE_REDIRECT_URI;
    
    if (!clientId || clientId === 'default_client_id') {
      throw new Error('Google Client ID not configured. Please set GOOGLE_CLIENT_ID environment variable.');
    }
    if (!clientSecret || clientSecret === 'default_client_secret') {
      throw new Error('Google Client Secret not configured. Please set GOOGLE_CLIENT_SECRET environment variable.');
    }
    if (!redirectUri) {
      throw new Error('Google Redirect URI not configured. Please set GOOGLE_REDIRECT_URI environment variable.');
    }
    
    const scopes = ['https://www.googleapis.com/auth/calendar.readonly'];
    const authUrl = this.oauth2Client.generateAuthUrl({
      access_type: 'offline', // Required for refresh tokens
      scope: scopes,
      prompt: 'consent', // Forces consent to get refresh token
      include_granted_scopes: true, // Incremental authorization
      state: state || Date.now().toString() // CSRF protection - use provided state or generate one
    });
    
    if (process.env.NODE_ENV === 'development') {
      console.log('OAuth Client Configuration:');
      console.log('Client ID:', clientId.substring(0, 20) + '...');
      console.log('Redirect URI:', redirectUri);
      console.log('Auth URL generated successfully');
    }
    return authUrl;
  }

  async handleAuthCallback(code: string): Promise<void> {
    try {
      console.log('Processing OAuth callback (code received)');
      
      // Properly decode the authorization code to prevent encoding issues
      const decodedCode = decodeURIComponent(code.trim());
      console.log('Using decoded authorization code');
      
      // Validate the authorization code format
      if (!decodedCode || decodedCode.length < 10) {
        throw new Error('Invalid authorization code format');
      }
      
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
          const response = await this.calendar.events.list({
            calendarId: calendar.id,
            timeMin: startDate.toISOString(),
            timeMax: endDate.toISOString(),
            singleEvents: true,
            orderBy: 'startTime',
          });

          const googleEvents = response.data.items || [];

          for (const googleEvent of googleEvents) {
            const existingEvent = await storage.getCalendarEventByGoogleId(googleEvent.id!);
            
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
        } catch (calendarError) {
          console.warn(`Failed to sync events from calendar ${calendar.summary}:`, calendarError);
          // Continue with other calendars even if one fails
        }
      }

      return syncedEvents;
    } catch (error) {
      console.error('Failed to sync calendar events:', error);
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
