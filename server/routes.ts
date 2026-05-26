import type { Express } from "express";
import { createServer, type Server } from "http";
import { z } from "zod";
import { storage } from "./storage";
import { googleCalendarService } from "./services/googleCalendar";
import { checkForUpdate, applyUpdate, rollback, getUpdateStatus, getAvailableBackups } from "./services/updateService";
import { APP_VERSION } from "@shared/version";

// Shared request body schema for create/update event endpoints. Times come
// over the wire as ISO strings; coerce to Date so downstream code works
// with proper Date instances. Title is required and trimmed; everything
// else is optional / nullable.
const eventWriteBodySchema = z.object({
  title: z.string().trim().min(1, "Title is required"),
  description: z.string().optional().nullable(),
  location: z.string().optional().nullable(),
  startTime: z.coerce.date(),
  endTime: z.coerce.date(),
  isAllDay: z.boolean().optional().default(false),
}).refine((v) => v.endTime > v.startTime, {
  message: "endTime must be after startTime",
  path: ["endTime"],
});

const createEventBodySchema = eventWriteBodySchema.and(
  z.object({ calendarId: z.string().min(1, "calendarId is required") })
);

export async function registerRoutes(app: Express): Promise<Server> {
  // Version endpoint for update checking
  app.get("/api/version", (req, res) => {
    res.json({
      version: APP_VERSION,
      timestamp: new Date().toISOString()
    });
  });

  // Calendar events routes
  app.get("/api/calendar/events", async (req, res) => {
    try {
      // Accept either ?from&to (preferred, matches task wording) or the
      // legacy ?startDate&endDate. The client must pass a window so the
      // payload is trimmed to the visible date range instead of returning
      // every stored event.
      const fromParam = (req.query.from ?? req.query.startDate) as string | undefined;
      const toParam = (req.query.to ?? req.query.endDate) as string | undefined;

      if (!fromParam || !toParam) {
        return res.status(400).json({
          message: "from and to (or startDate and endDate) parameters are required"
        });
      }

      const start = new Date(fromParam);
      const end = new Date(toParam);

      if (isNaN(start.getTime()) || isNaN(end.getTime())) {
        return res.status(400).json({
          message: "Invalid date format"
        });
      }

      const events = await storage.getCalendarEvents(start, end);
      res.json(events);
    } catch (error) {
      console.error('Failed to get calendar events:', error);
      res.status(500).json({ message: "Failed to fetch calendar events" });
    }
  });

  // Get list of available calendars
  app.get("/api/calendar/calendars", async (req, res) => {
    try {
      const calendars = await googleCalendarService.getCalendarList();
      const calendarInfo = calendars.map(calendar => ({
        id: calendar.id,
        summary: calendar.summary,
        primary: calendar.primary,
        backgroundColor: calendar.backgroundColor,
        foregroundColor: calendar.foregroundColor,
        selected: calendar.selected !== false, // Default to true unless explicitly false
        accessRole: calendar.accessRole
      }));
      res.json(calendarInfo);
    } catch (error) {
      console.error('Failed to get calendar list:', error);
      res.status(500).json({ message: "Failed to fetch calendar list" });
    }
  });

  // Create a new event on Google Calendar (and mirror it locally so the UI
  // reflects the change immediately, without waiting for the next sync).
  app.post("/api/calendar/events", async (req, res) => {
    try {
      const parsed = createEventBodySchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({
          message: "Invalid event payload",
          errors: parsed.error.flatten(),
        });
      }
      const created = await googleCalendarService.createEvent(parsed.data);
      res.status(201).json(created);
    } catch (error) {
      console.error('Failed to create calendar event:', error);
      res.status(500).json({
        message: error instanceof Error ? error.message : "Failed to create event"
      });
    }
  });

  app.patch("/api/calendar/events/:id", async (req, res) => {
    try {
      const id = Number(req.params.id);
      if (!Number.isFinite(id)) {
        return res.status(400).json({ message: "Invalid event id" });
      }
      const parsed = eventWriteBodySchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({
          message: "Invalid event payload",
          errors: parsed.error.flatten(),
        });
      }
      const updated = await googleCalendarService.updateEvent(id, parsed.data);
      res.json(updated);
    } catch (error) {
      console.error('Failed to update calendar event:', error);
      const msg = error instanceof Error ? error.message : "Failed to update event";
      const status = msg.startsWith('Event not found') ? 404 : 500;
      res.status(status).json({ message: msg });
    }
  });

  app.delete("/api/calendar/events/:id", async (req, res) => {
    try {
      const id = Number(req.params.id);
      if (!Number.isFinite(id)) {
        return res.status(400).json({ message: "Invalid event id" });
      }
      await googleCalendarService.deleteEvent(id);
      res.status(204).send();
    } catch (error) {
      console.error('Failed to delete calendar event:', error);
      const msg = error instanceof Error ? error.message : "Failed to delete event";
      const status = msg.startsWith('Event not found') ? 404 : 500;
      res.status(status).json({ message: msg });
    }
  });

  app.post("/api/calendar/subscribe", async (req, res) => {
    const parsed = z.object({ calendarId: z.string().trim().min(1, "calendarId is required") }).safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ message: parsed.error.errors[0]?.message ?? "calendarId is required" });
    }
    try {
      const entry = await googleCalendarService.subscribeToCalendar(parsed.data.calendarId);
      res.status(201).json(entry);
    } catch (error) {
      const msg = error instanceof Error ? error.message : "Failed to subscribe to calendar";
      const status = msg.startsWith('Already subscribed') ? 409
        : (msg.startsWith('Calendar not found') || msg.includes("doesn't have permission")) ? 400
        : 500;
      res.status(status).json({ message: msg });
    }
  });

  app.post("/api/calendar/sync", async (req, res) => {
    try {
      const { startDate, endDate } = req.body;

      if (!startDate || !endDate) {
        return res.status(400).json({
          message: "startDate and endDate are required"
        });
      }

      const start = new Date(startDate);
      const end = new Date(endDate);

      if (isNaN(start.getTime()) || isNaN(end.getTime())) {
        return res.status(400).json({
          message: "Invalid date format"
        });
      }

      const syncedEvents = await googleCalendarService.syncCalendarEvents(start, end);
      res.json({
        message: "Calendar events synced successfully",
        events: syncedEvents
      });
    } catch (error) {
      console.error('Failed to sync calendar events:', error);
      res.status(500).json({
        message: error instanceof Error ? error.message : "Failed to sync calendar events"
      });
    }
  });

  app.get("/api/calendar/sync-status", (req, res) => {
    res.set({
      'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
      'Pragma': 'no-cache',
      'Expires': '0',
    });
    res.json(googleCalendarService.getSyncStatus());
  });

  app.get("/api/calendar/auth-status", (req, res) => {
    res.set({
      'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
      'Pragma': 'no-cache',
      'Expires': '0',
    });
    const connected = googleCalendarService.isConnected();
    res.json({
      authenticated: connected,
      needsAuth: !connected,
      error: connected ? null : googleCalendarService.getInitError(),
    });
  });

  const isLocalRequest = (req: any): boolean => {
    const ip = req.ip || req.connection?.remoteAddress || '';
    return ip === '127.0.0.1' || ip === '::1' || ip === '::ffff:127.0.0.1' || ip === 'localhost';
  };

  app.get("/api/update/check", async (req, res) => {
    try {
      const result = await checkForUpdate();
      res.json(result);
    } catch (error) {
      console.error('Update check failed:', error);
      res.status(500).json({ message: "Failed to check for updates" });
    }
  });

  app.get("/api/update/status", (req, res) => {
    res.json(getUpdateStatus());
  });

  app.post("/api/update/apply", async (req, res) => {
    if (!isLocalRequest(req)) {
      return res.status(403).json({ message: "Updates can only be applied from localhost" });
    }
    try {
      res.json({ message: "Update started", status: "in-progress" });
      applyUpdate().catch(err => {
        console.error('Update failed:', err);
      });
    } catch (error) {
      console.error('Failed to start update:', error);
      res.status(500).json({ message: "Failed to start update" });
    }
  });

  app.post("/api/update/rollback", async (req, res) => {
    if (!isLocalRequest(req)) {
      return res.status(403).json({ message: "Rollback can only be triggered from localhost" });
    }
    try {
      res.json({ message: "Rollback started", status: "in-progress" });
      rollback().catch(err => {
        console.error('Rollback failed:', err);
      });
    } catch (error) {
      console.error('Failed to start rollback:', error);
      res.status(500).json({ message: "Failed to start rollback" });
    }
  });

  app.get("/api/update/backups", (req, res) => {
    try {
      const backups = getAvailableBackups();
      res.json({ backups });
    } catch (error) {
      console.error('Failed to get backups:', error);
      res.status(500).json({ message: "Failed to get backups list" });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}
