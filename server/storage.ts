import { 
  users, 
  calendarEvents, 
  googleCredentials,
  type User, 
  type InsertUser,
  type CalendarEvent,
  type InsertCalendarEvent,
  type GoogleCredentials,
  type InsertGoogleCredentials
} from "@shared/schema";
import { writeFileSync, readFileSync, existsSync } from 'fs';

export interface IStorage {
  getUser(id: number): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  
  getCalendarEvents(startDate: Date, endDate: Date): Promise<CalendarEvent[]>;
  createCalendarEvent(event: InsertCalendarEvent): Promise<CalendarEvent>;
  updateCalendarEvent(id: number, event: Partial<InsertCalendarEvent>): Promise<CalendarEvent | undefined>;
  deleteCalendarEvent(id: number): Promise<boolean>;
  getCalendarEventByGoogleId(googleEventId: string): Promise<CalendarEvent | undefined>;
  
  getGoogleCredentials(): Promise<GoogleCredentials | undefined>;
  createGoogleCredentials(credentials: InsertGoogleCredentials): Promise<GoogleCredentials>;
  updateGoogleCredentials(credentials: Partial<InsertGoogleCredentials>): Promise<GoogleCredentials | undefined>;
  clearGoogleCredentials(): Promise<void>;
}

export class MemStorage implements IStorage {
  private users: Map<number, User>;
  private calendarEvents: Map<number, CalendarEvent>;
  private googleCredentials: GoogleCredentials | undefined;
  private currentUserId: number;
  private currentEventId: number;
  private currentCredentialsId: number;
  private credentialsFile = './google_credentials.json';

  constructor() {
    this.users = new Map();
    this.calendarEvents = new Map();
    this.currentUserId = 1;
    this.currentEventId = 1;
    this.currentCredentialsId = 1;
    this.loadCredentialsFromFile();
  }

  private loadCredentialsFromFile(): void {
    try {
      if (existsSync(this.credentialsFile)) {
        const data = readFileSync(this.credentialsFile, 'utf8');
        const parsed = JSON.parse(data);
        // Convert date strings back to Date objects
        this.googleCredentials = {
          ...parsed,
          createdAt: new Date(parsed.createdAt),
          updatedAt: new Date(parsed.updatedAt),
          expiryDate: new Date(parsed.expiryDate)
        };
        console.log('Loaded Google credentials from file');
      }
    } catch (error) {
      console.log('No existing credentials file found, starting fresh');
    }
  }

  private saveCredentialsToFile(): void {
    try {
      if (this.googleCredentials) {
        writeFileSync(this.credentialsFile, JSON.stringify(this.googleCredentials, null, 2));
        console.log('Saved Google credentials to file');
      }
    } catch (error) {
      console.error('Failed to save credentials to file:', error);
    }
  }

  async getUser(id: number): Promise<User | undefined> {
    return this.users.get(id);
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    return Array.from(this.users.values()).find(
      (user) => user.username === username,
    );
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const id = this.currentUserId++;
    const user: User = { ...insertUser, id };
    this.users.set(id, user);
    return user;
  }

  async getCalendarEvents(startDate: Date, endDate: Date): Promise<CalendarEvent[]> {
    return Array.from(this.calendarEvents.values()).filter(
      (event) => event.startTime >= startDate && event.endTime <= endDate
    );
  }

  async createCalendarEvent(insertEvent: InsertCalendarEvent): Promise<CalendarEvent> {
    const id = this.currentEventId++;
    const now = new Date();
    const event: CalendarEvent = { 
      id,
      googleEventId: insertEvent.googleEventId,
      calendarId: insertEvent.calendarId || 'primary',
      calendarName: insertEvent.calendarName || 'Primary',
      title: insertEvent.title,
      description: insertEvent.description || null,
      startTime: insertEvent.startTime,
      endTime: insertEvent.endTime,
      location: insertEvent.location || null,
      color: insertEvent.color || '#1a73e8',
      isAllDay: insertEvent.isAllDay || null,
      createdAt: now,
      updatedAt: now
    };
    this.calendarEvents.set(id, event);
    return event;
  }

  async updateCalendarEvent(id: number, updateEvent: Partial<InsertCalendarEvent>): Promise<CalendarEvent | undefined> {
    const existing = this.calendarEvents.get(id);
    if (!existing) return undefined;
    
    const updated: CalendarEvent = { 
      ...existing, 
      ...updateEvent,
      updatedAt: new Date()
    };
    this.calendarEvents.set(id, updated);
    return updated;
  }

  async deleteCalendarEvent(id: number): Promise<boolean> {
    return this.calendarEvents.delete(id);
  }

  async getCalendarEventByGoogleId(googleEventId: string): Promise<CalendarEvent | undefined> {
    return Array.from(this.calendarEvents.values()).find(
      (event) => event.googleEventId === googleEventId
    );
  }

  async getGoogleCredentials(): Promise<GoogleCredentials | undefined> {
    return this.googleCredentials;
  }

  async createGoogleCredentials(insertCredentials: InsertGoogleCredentials): Promise<GoogleCredentials> {
    const id = this.currentCredentialsId++;
    const now = new Date();
    const credentials: GoogleCredentials = { 
      ...insertCredentials, 
      id,
      createdAt: now,
      updatedAt: now
    };
    this.googleCredentials = credentials;
    this.saveCredentialsToFile();
    return credentials;
  }

  async updateGoogleCredentials(updateCredentials: Partial<InsertGoogleCredentials>): Promise<GoogleCredentials | undefined> {
    if (!this.googleCredentials) return undefined;
    
    const updated: GoogleCredentials = { 
      ...this.googleCredentials, 
      ...updateCredentials,
      updatedAt: new Date()
    };
    this.googleCredentials = updated;
    this.saveCredentialsToFile();
    return updated;
  }

  async clearGoogleCredentials(): Promise<void> {
    this.googleCredentials = undefined;
    try {
      const fs = require('fs');
      if (fs.existsSync(this.credentialsFile)) {
        fs.unlinkSync(this.credentialsFile);
        console.log('Deleted Google credentials file');
      }
    } catch (error) {
      console.error('Failed to delete credentials file:', error);
    }
  }

  async saveGoogleCredentials(credentials: any): Promise<void> {
    const insertCredentials: InsertGoogleCredentials = {
      accessToken: credentials.access_token,
      refreshToken: credentials.refresh_token,
      scope: credentials.scope || 'https://www.googleapis.com/auth/calendar.readonly',
      tokenType: credentials.token_type || 'Bearer',
      expiryDate: credentials.expiry_date ? new Date(credentials.expiry_date) : new Date(Date.now() + 3600000) // 1 hour default
    };
    
    if (this.googleCredentials) {
      await this.updateGoogleCredentials(insertCredentials);
    } else {
      await this.createGoogleCredentials(insertCredentials);
    }
  }
}

export const storage = new MemStorage();
