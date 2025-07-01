import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { googleCalendarService } from "./services/googleCalendar";
import { insertCalendarEventSchema } from "@shared/schema";

export async function registerRoutes(app: Express): Promise<Server> {
  // Google OAuth routes
  app.get("/api/auth/google", async (req, res) => {
    try {
      const authUrl = googleCalendarService.getAuthUrl();
      console.log('Generated OAuth URL:', authUrl);
      res.redirect(authUrl);
    } catch (error) {
      console.error('Failed to get Google auth URL:', error);
      res.status(500).json({ message: "Failed to initiate Google authentication" });
    }
  });

  app.get("/api/auth/google/callback", async (req, res) => {
    console.log('Google OAuth callback received:', req.query);
    try {
      const { code } = req.query;
      if (!code || typeof code !== 'string') {
        console.log('No authorization code provided');
        return res.status(400).json({ message: "Authorization code is required" });
      }

      console.log('Processing authorization code...');
      await googleCalendarService.handleAuthCallback(code);
      console.log('Google authentication successful');
      res.redirect("/?auth=success");
    } catch (error) {
      console.error('Failed to handle Google auth callback:', error);
      res.redirect("/?auth=error");
    }
  });

  // Calendar events routes
  app.get("/api/calendar/events", async (req, res) => {
    try {
      const { startDate, endDate } = req.query;
      
      if (!startDate || !endDate) {
        return res.status(400).json({ 
          message: "startDate and endDate parameters are required" 
        });
      }

      const start = new Date(startDate as string);
      const end = new Date(endDate as string);

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

  app.get("/api/calendar/auth-status", async (req, res) => {
    try {
      const credentials = await storage.getGoogleCredentials();
      console.log('Auth status check - credentials found:', !!credentials);
      res.json({ 
        authenticated: !!credentials,
        needsAuth: !credentials 
      });
    } catch (error) {
      console.error('Failed to check auth status:', error);
      res.status(500).json({ message: "Failed to check authentication status" });
    }
  });

  // Test endpoint to check OAuth configuration
  app.get("/api/test/oauth-config", async (req, res) => {
    res.json({
      clientId: process.env.GOOGLE_CLIENT_ID?.substring(0, 20) + '...',
      redirectUri: process.env.GOOGLE_REDIRECT_URI,
      hasCredentials: !!(await storage.getGoogleCredentials())
    });
  });

  const httpServer = createServer(app);
  return httpServer;
}
