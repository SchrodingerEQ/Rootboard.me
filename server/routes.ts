import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { googleCalendarService } from "./services/googleCalendar";
import { checkForUpdate, applyUpdate, rollback, getUpdateStatus, getAvailableBackups } from "./services/updateService";
import { APP_VERSION } from "@shared/version";

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
