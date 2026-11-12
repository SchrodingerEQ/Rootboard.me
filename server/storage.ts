import type {
  User,
  InsertUser,
  CalendarEvent,
  InsertCalendarEvent,
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

  getAppState(key: string): Promise<string | null>;
  setAppState(key: string, value: string): Promise<void>;
}

// DATABASE_URL path (in-memory MemStorage) removed 2026-11-11; see decision 0002.
async function createStorage(): Promise<IStorage> {
  if (process.env.DATABASE_URL) {
    console.warn('DATABASE_URL is set but no longer used: storage is always SQLite (calendar.db)');
  }
  console.log('Using SQLite storage (self-hosted environment)');
  const { SQLiteStorage } = await import('./sqlite-storage');
  return new SQLiteStorage('./calendar.db');
}

export let storage: IStorage;

const storageReady = createStorage().then((s) => {
  storage = s;
});

export { storageReady };
