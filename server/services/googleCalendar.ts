import { google } from 'googleapis';
import { storage } from '../storage';
import type { CalendarEvent, InsertCalendarEvent } from '@shared/schema';

export class GoogleCalendarService {
  private oauth2Client: any;
  private calendar: any;

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
      if (!credentials) return false;

      this.oauth2Client.setCredentials({
        access_token: credentials.accessToken,
        refresh_token: credentials.refreshToken,
        expiry_date: credentials.expiryDate.getTime(),
      });

      // Check if token is expired and refresh if needed
      if (credentials.expiryDate < new Date()) {
        await this.refreshAccessToken();
      }

      return true;
    } catch (error) {
      console.error('Failed to initialize Google credentials:', error);
      return false;
    }
  }

  async refreshAccessToken(): Promise<void> {
    try {
      const { credentials } = await this.oauth2Client.refreshAccessToken();
      
      await storage.updateGoogleCredentials({
        accessToken: credentials.access_token,
        expiryDate: new Date(credentials.expiry_date),
      });

      this.oauth2Client.setCredentials(credentials);
    } catch (error) {
      console.error('Failed to refresh access token:', error);
      throw error;
    }
  }

  getAuthUrl(): string {
    const scopes = ['https://www.googleapis.com/auth/calendar.readonly'];
    return this.oauth2Client.generateAuthUrl({
      access_type: 'offline',
      scope: scopes,
    });
  }

  async handleAuthCallback(code: string): Promise<void> {
    try {
      const { tokens } = await this.oauth2Client.getToken(code);
      
      await storage.createGoogleCredentials({
        accessToken: tokens.access_token!,
        refreshToken: tokens.refresh_token!,
        expiryDate: new Date(tokens.expiry_date!),
      });

      this.oauth2Client.setCredentials(tokens);
    } catch (error) {
      console.error('Failed to handle auth callback:', error);
      throw error;
    }
  }

  async syncCalendarEvents(startDate: Date, endDate: Date): Promise<CalendarEvent[]> {
    try {
      const initialized = await this.initializeCredentials();
      if (!initialized) {
        throw new Error('Google Calendar credentials not initialized');
      }

      const response = await this.calendar.events.list({
        calendarId: 'primary',
        timeMin: startDate.toISOString(),
        timeMax: endDate.toISOString(),
        singleEvents: true,
        orderBy: 'startTime',
      });

      const googleEvents = response.data.items || [];
      const syncedEvents: CalendarEvent[] = [];

      for (const googleEvent of googleEvents) {
        const existingEvent = await storage.getCalendarEventByGoogleId(googleEvent.id!);
        
        const eventData: InsertCalendarEvent = {
          googleEventId: googleEvent.id!,
          title: googleEvent.summary || 'Untitled Event',
          description: googleEvent.description || '',
          startTime: new Date(googleEvent.start?.dateTime || googleEvent.start?.date!),
          endTime: new Date(googleEvent.end?.dateTime || googleEvent.end?.date!),
          location: googleEvent.location || '',
          color: this.getEventColor(googleEvent.colorId),
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
}

export const googleCalendarService = new GoogleCalendarService();
