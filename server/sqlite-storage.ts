import Database from 'better-sqlite3';
import type {
  User,
  InsertUser,
  CalendarEvent,
  InsertCalendarEvent,
} from "@shared/schema";
import type { IStorage } from "./storage";

export class SQLiteStorage implements IStorage {
  private db: Database.Database;

  constructor(dbPath: string = './calendar.db') {
    this.db = new Database(dbPath);
    this.db.pragma('journal_mode = WAL');
    this.initializeTables();
  }

  private initializeTables(): void {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT NOT NULL UNIQUE,
        password TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS calendar_events (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        google_event_id TEXT NOT NULL,
        calendar_id TEXT NOT NULL DEFAULT 'primary',
        calendar_name TEXT NOT NULL DEFAULT 'Primary',
        title TEXT NOT NULL,
        description TEXT,
        start_time TEXT NOT NULL,
        end_time TEXT NOT NULL,
        location TEXT,
        color TEXT DEFAULT '#1a73e8',
        is_all_day INTEGER DEFAULT 0,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(google_event_id, calendar_id)
      );

      CREATE INDEX IF NOT EXISTS idx_events_time ON calendar_events(start_time, end_time);
      CREATE INDEX IF NOT EXISTS idx_events_google_id ON calendar_events(google_event_id, calendar_id);
    `);
    console.log('SQLite database initialized');
  }

  async getUser(id: number): Promise<User | undefined> {
    const row = this.db.prepare('SELECT * FROM users WHERE id = ?').get(id) as any;
    return row ? { id: row.id, username: row.username, password: row.password } : undefined;
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    const row = this.db.prepare('SELECT * FROM users WHERE username = ?').get(username) as any;
    return row ? { id: row.id, username: row.username, password: row.password } : undefined;
  }

  async createUser(user: InsertUser): Promise<User> {
    const result = this.db.prepare('INSERT INTO users (username, password) VALUES (?, ?)').run(user.username, user.password);
    return { id: Number(result.lastInsertRowid), username: user.username, password: user.password };
  }

  async getCalendarEvents(startDate: Date, endDate: Date): Promise<CalendarEvent[]> {
    const rows = this.db.prepare(`
      SELECT * FROM calendar_events 
      WHERE start_time < ? AND end_time > ?
      ORDER BY start_time ASC
    `).all(endDate.toISOString(), startDate.toISOString()) as any[];

    return rows.map(row => this.rowToCalendarEvent(row));
  }

  private rowToCalendarEvent(row: any): CalendarEvent {
    return {
      id: row.id,
      googleEventId: row.google_event_id,
      calendarId: row.calendar_id,
      calendarName: row.calendar_name,
      title: row.title,
      description: row.description,
      startTime: new Date(row.start_time),
      endTime: new Date(row.end_time),
      location: row.location,
      color: row.color,
      isAllDay: Boolean(row.is_all_day),
      createdAt: row.created_at ? new Date(row.created_at) : null,
      updatedAt: row.updated_at ? new Date(row.updated_at) : null
    };
  }

  async createCalendarEvent(event: InsertCalendarEvent): Promise<CalendarEvent> {
    const now = new Date().toISOString();
    const result = this.db.prepare(`
      INSERT INTO calendar_events (google_event_id, calendar_id, calendar_name, title, description, start_time, end_time, location, color, is_all_day, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      event.googleEventId,
      event.calendarId || 'primary',
      event.calendarName || 'Primary',
      event.title,
      event.description || null,
      event.startTime.toISOString(),
      event.endTime.toISOString(),
      event.location || null,
      event.color || '#1a73e8',
      event.isAllDay ? 1 : 0,
      now,
      now
    );

    return {
      id: Number(result.lastInsertRowid),
      googleEventId: event.googleEventId,
      calendarId: event.calendarId || 'primary',
      calendarName: event.calendarName || 'Primary',
      title: event.title,
      description: event.description || null,
      startTime: event.startTime,
      endTime: event.endTime,
      location: event.location || null,
      color: event.color || '#1a73e8',
      isAllDay: event.isAllDay || null,
      createdAt: new Date(now),
      updatedAt: new Date(now)
    };
  }

  async updateCalendarEvent(id: number, event: Partial<InsertCalendarEvent>): Promise<CalendarEvent | undefined> {
    const existing = this.db.prepare('SELECT * FROM calendar_events WHERE id = ?').get(id) as any;
    if (!existing) return undefined;

    const now = new Date().toISOString();
    const updates: string[] = ['updated_at = ?'];
    const values: any[] = [now];

    if (event.title !== undefined) { updates.push('title = ?'); values.push(event.title); }
    if (event.description !== undefined) { updates.push('description = ?'); values.push(event.description); }
    if (event.startTime !== undefined) { updates.push('start_time = ?'); values.push(event.startTime.toISOString()); }
    if (event.endTime !== undefined) { updates.push('end_time = ?'); values.push(event.endTime.toISOString()); }
    if (event.location !== undefined) { updates.push('location = ?'); values.push(event.location); }
    if (event.color !== undefined) { updates.push('color = ?'); values.push(event.color); }
    if (event.isAllDay !== undefined) { updates.push('is_all_day = ?'); values.push(event.isAllDay ? 1 : 0); }
    if (event.calendarId !== undefined) { updates.push('calendar_id = ?'); values.push(event.calendarId); }
    if (event.calendarName !== undefined) { updates.push('calendar_name = ?'); values.push(event.calendarName); }

    values.push(id);
    this.db.prepare(`UPDATE calendar_events SET ${updates.join(', ')} WHERE id = ?`).run(...values);

    const updated = this.db.prepare('SELECT * FROM calendar_events WHERE id = ?').get(id) as any;
    return this.rowToCalendarEvent(updated);
  }

  async deleteCalendarEvent(id: number): Promise<boolean> {
    const result = this.db.prepare('DELETE FROM calendar_events WHERE id = ?').run(id);
    return result.changes > 0;
  }

  async getCalendarEventByGoogleIdAndCalendar(googleEventId: string, calendarId: string): Promise<CalendarEvent | undefined> {
    const row = this.db.prepare('SELECT * FROM calendar_events WHERE google_event_id = ? AND calendar_id = ?').get(googleEventId, calendarId) as any;
    return row ? this.rowToCalendarEvent(row) : undefined;
  }

  async deleteCalendarEventsByCalendarNotIn(calendarId: string, googleEventIds: string[]): Promise<number> {
    if (googleEventIds.length === 0) {
      const result = this.db.prepare('DELETE FROM calendar_events WHERE calendar_id = ?').run(calendarId);
      return result.changes;
    }
    const placeholders = googleEventIds.map(() => '?').join(',');
    const result = this.db.prepare(`DELETE FROM calendar_events WHERE calendar_id = ? AND google_event_id NOT IN (${placeholders})`).run(calendarId, ...googleEventIds);
    return result.changes;
  }

  async deleteCalendarEventsEndedBefore(cutoff: Date): Promise<number> {
    const result = this.db.prepare('DELETE FROM calendar_events WHERE end_time < ?').run(cutoff.toISOString());
    return result.changes;
  }

  close(): void {
    this.db.close();
  }
}
