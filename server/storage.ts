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
}

export class MemStorage implements IStorage {
  private users: Map<number, User>;
  private calendarEvents: Map<number, CalendarEvent>;
  private googleCredentials: GoogleCredentials | undefined;
  private currentUserId: number;
  private currentEventId: number;
  private currentCredentialsId: number;

  constructor() {
    this.users = new Map();
    this.calendarEvents = new Map();
    this.currentUserId = 1;
    this.currentEventId = 1;
    this.currentCredentialsId = 1;
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
      ...insertEvent,
      id,
      color: insertEvent.color || '#1a73e8',
      description: insertEvent.description || null,
      location: insertEvent.location || null,
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
    return updated;
  }
}

export const storage = new MemStorage();
