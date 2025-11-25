import Database from 'better-sqlite3';
import type { 
  User, 
  InsertUser,
  CalendarEvent,
  InsertCalendarEvent,
  GoogleCredentials,
  InsertGoogleCredentials
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

      CREATE TABLE IF NOT EXISTS google_credentials (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        access_token TEXT NOT NULL,
        refresh_token TEXT NOT NULL,
        scope TEXT,
        token_type TEXT,
        expiry_date TEXT NOT NULL,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT DEFAULT CURRENT_TIMESTAMP
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

  async getGoogleCredentials(): Promise<GoogleCredentials | undefined> {
    const row = this.db.prepare('SELECT * FROM google_credentials ORDER BY id DESC LIMIT 1').get() as any;
    if (!row) return undefined;

    return {
      id: row.id,
      accessToken: row.access_token,
      refreshToken: row.refresh_token,
      scope: row.scope,
      tokenType: row.token_type,
      expiryDate: new Date(row.expiry_date),
      createdAt: row.created_at ? new Date(row.created_at) : null,
      updatedAt: row.updated_at ? new Date(row.updated_at) : null
    };
  }

  async createGoogleCredentials(credentials: InsertGoogleCredentials): Promise<GoogleCredentials> {
    const now = new Date().toISOString();
    const result = this.db.prepare(`
      INSERT INTO google_credentials (access_token, refresh_token, scope, token_type, expiry_date, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(
      credentials.accessToken,
      credentials.refreshToken,
      credentials.scope || 'https://www.googleapis.com/auth/calendar.readonly',
      credentials.tokenType || 'Bearer',
      credentials.expiryDate.toISOString(),
      now,
      now
    );

    return {
      id: Number(result.lastInsertRowid),
      accessToken: credentials.accessToken,
      refreshToken: credentials.refreshToken,
      scope: credentials.scope || null,
      tokenType: credentials.tokenType || null,
      expiryDate: credentials.expiryDate,
      createdAt: new Date(now),
      updatedAt: new Date(now)
    };
  }

  async updateGoogleCredentials(credentials: Partial<InsertGoogleCredentials>): Promise<GoogleCredentials | undefined> {
    const existing = await this.getGoogleCredentials();
    if (!existing) return undefined;

    const now = new Date().toISOString();
    const updates: string[] = ['updated_at = ?'];
    const values: any[] = [now];

    if (credentials.accessToken !== undefined) { updates.push('access_token = ?'); values.push(credentials.accessToken); }
    if (credentials.refreshToken !== undefined) { updates.push('refresh_token = ?'); values.push(credentials.refreshToken); }
    if (credentials.scope !== undefined) { updates.push('scope = ?'); values.push(credentials.scope); }
    if (credentials.tokenType !== undefined) { updates.push('token_type = ?'); values.push(credentials.tokenType); }
    if (credentials.expiryDate !== undefined) { updates.push('expiry_date = ?'); values.push(credentials.expiryDate.toISOString()); }

    values.push(existing.id);
    this.db.prepare(`UPDATE google_credentials SET ${updates.join(', ')} WHERE id = ?`).run(...values);

    return this.getGoogleCredentials();
  }

  async clearGoogleCredentials(): Promise<void> {
    this.db.prepare('DELETE FROM google_credentials').run();
    console.log('Cleared all Google credentials from SQLite');
  }

  async saveGoogleCredentials(credentials: any): Promise<void> {
    const insertCredentials: InsertGoogleCredentials = {
      accessToken: credentials.access_token,
      refreshToken: credentials.refresh_token,
      scope: credentials.scope || 'https://www.googleapis.com/auth/calendar.readonly',
      tokenType: credentials.token_type || 'Bearer',
      expiryDate: credentials.expiry_date ? new Date(credentials.expiry_date) : new Date(Date.now() + 3600000)
    };
    
    const existing = await this.getGoogleCredentials();
    if (existing) {
      await this.updateGoogleCredentials(insertCredentials);
    } else {
      await this.createGoogleCredentials(insertCredentials);
    }
  }

  close(): void {
    this.db.close();
  }
}
