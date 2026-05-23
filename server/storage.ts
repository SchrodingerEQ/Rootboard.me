import {
  users,
  calendarEvents,
  type User,
  type InsertUser,
  type CalendarEvent,
  type InsertCalendarEvent,
} from "@shared/schema";

export interface IStorage {
  getUser(id: number): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;

  getCalendarEvents(startDate: Date, endDate: Date): Promise<CalendarEvent[]>;
  getCalendarEvent(id: number): Promise<CalendarEvent | undefined>;
  createCalendarEvent(event: InsertCalendarEvent): Promise<CalendarEvent>;
  updateCalendarEvent(id: number, event: Partial<InsertCalendarEvent>): Promise<CalendarEvent | undefined>;
  deleteCalendarEvent(id: number): Promise<boolean>;
  getCalendarEventByGoogleIdAndCalendar(googleEventId: string, calendarId: string): Promise<CalendarEvent | undefined>;

  deleteCalendarEventsByCalendarNotIn(calendarId: string, googleEventIds: string[]): Promise<number>;
  deleteCalendarEventsEndedBefore(cutoff: Date): Promise<number>;
}

export class MemStorage implements IStorage {
  private users: Map<number, User>;
  private calendarEvents: Map<number, CalendarEvent>;
  private currentUserId: number;
  private currentEventId: number;

  constructor() {
    this.users = new Map();
    this.calendarEvents = new Map();
    this.currentUserId = 1;
    this.currentEventId = 1;
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
    // Use overlapping logic: event overlaps the window if it starts before the window ends AND ends after the window starts
    return Array.from(this.calendarEvents.values()).filter(
      (event) => event.startTime < endDate && event.endTime > startDate
    );
  }

  async getCalendarEvent(id: number): Promise<CalendarEvent | undefined> {
    return this.calendarEvents.get(id);
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

  async getCalendarEventByGoogleIdAndCalendar(googleEventId: string, calendarId: string): Promise<CalendarEvent | undefined> {
    return Array.from(this.calendarEvents.values()).find(
      (event) => event.googleEventId === googleEventId && event.calendarId === calendarId
    );
  }

  async deleteCalendarEventsByCalendarNotIn(calendarId: string, googleEventIds: string[]): Promise<number> {
    const idsSet = new Set(googleEventIds);
    let deleted = 0;
    for (const [id, event] of this.calendarEvents) {
      if (event.calendarId === calendarId && !idsSet.has(event.googleEventId)) {
        this.calendarEvents.delete(id);
        deleted++;
      }
    }
    return deleted;
  }

  async deleteCalendarEventsEndedBefore(cutoff: Date): Promise<number> {
    let deleted = 0;
    for (const [id, event] of this.calendarEvents) {
      if (event.endTime < cutoff) {
        this.calendarEvents.delete(id);
        deleted++;
      }
    }
    return deleted;
  }
}

async function createStorage(): Promise<IStorage> {
  if (process.env.DATABASE_URL) {
    console.log('Using MemStorage with PostgreSQL session store (Replit environment)');
    return new MemStorage();
  } else {
    console.log('Using SQLite storage (self-hosted environment)');
    const { SQLiteStorage } = await import('./sqlite-storage');
    return new SQLiteStorage('./calendar.db');
  }
}

export let storage: IStorage;

const storageReady = createStorage().then((s) => {
  storage = s;
});

export { storageReady };
