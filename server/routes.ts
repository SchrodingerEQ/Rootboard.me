import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { googleCalendarService } from "./services/googleCalendar";
import { checkForUpdate, applyUpdate, rollback, getUpdateStatus, getAvailableBackups } from "./services/updateService";
import { insertCalendarEventSchema } from "@shared/schema";
import { APP_VERSION } from "@shared/version";

export async function registerRoutes(app: Express): Promise<Server> {
  // Version endpoint for update checking
  app.get("/api/version", (req, res) => {
    res.json({ 
      version: APP_VERSION,
      timestamp: new Date().toISOString()
    });
  });

  // Google OAuth routes
  app.get("/api/auth/google", async (req, res) => {
    try {
      // Generate and store state for CSRF protection using crypto-secure random
      const crypto = await import('node:crypto');
      const state = crypto.randomBytes(16).toString('hex');
      
      if ((req as any).session) {
        (req as any).session.oauthState = state;
        
        // Explicitly save session to PostgreSQL before redirecting
        await new Promise<void>((resolve, reject) => {
          (req as any).session.save((err: any) => {
            if (err) {
              console.error('Failed to save session:', err);
              reject(err);
            } else {
              resolve();
            }
          });
        });
      }
      
      // Pass the request host to generate the correct redirect URI
      const host = req.get('host');
      const authUrl = googleCalendarService.getAuthUrl(state, host);
      console.log('Redirecting to OAuth URL');
      res.redirect(authUrl);
    } catch (error) {
      console.error('Failed to get Google auth URL:', error);
      res.status(500).json({ message: "Failed to initiate Google authentication" });
    }
  });

  app.get("/api/auth/google/callback", async (req, res) => {
    console.log('Google OAuth callback received');
    try {
      const { code, error: authError, state } = req.query;
      
      if (authError) {
        console.log('OAuth error received:', authError);
        return res.redirect("/?auth=error&reason=" + authError);
      }
      
      if (!code || typeof code !== 'string') {
        console.log('No authorization code provided');
        return res.status(400).send(`
          <html>
            <body>
              <h1>Authentication Error</h1>
              <p>No authorization code provided</p>
              <a href="/">Return to Calendar</a>
            </body>
          </html>
        `);
      }

      // Verify state parameter to prevent CSRF attacks
      const expectedState = (req as any).session?.oauthState;
      
      if (!expectedState || state !== expectedState) {
        console.error('OAuth state mismatch!');
        return res.status(400).send(`
          <html>
            <body>
              <h1>Security Error</h1>
              <p>Authentication request rejected for security reasons.</p>
              <p>This may be due to session expiry. Please try again.</p>
              <a href="/">Return to Calendar</a>
            </body>
          </html>
        `);
      }

      // Clear the stored state after successful verification
      if ((req as any).session) {
        delete (req as any).session.oauthState;
      }

      const callbackHost = req.get('host');
      await googleCalendarService.handleAuthCallback(code, callbackHost);
      console.log('Google authentication successful');
      
      // Check if authentication worked
      const credentials = await storage.getGoogleCredentials();
      console.log('Verification: credentials stored?', !!credentials);
      
      // Return success page with auto-redirect
      res.send(`
        <html>
          <body>
            <h1>Authentication Successful!</h1>
            <p>Redirecting to calendar...</p>
            <script>
              setTimeout(() => {
                window.location.href = '/?auth=success';
              }, 2000);
            </script>
          </body>
        </html>
      `);
    } catch (error) {
      console.error('Failed to handle Google auth callback:', error);
      res.send(`
        <html>
          <body>
            <h1>Authentication Error</h1>
            <p>Failed to complete authentication. Please try again.</p>
            <a href="/">Try Again</a>
          </body>
        </html>
      `);
    }
  });

  // Manual auth code processing route
  app.post("/api/auth/google/manual", async (req, res) => {
    try {
      const { code } = req.body;
      if (!code || typeof code !== 'string') {
        return res.status(400).json({ message: 'Authorization code required' });
      }

      const manualHost = req.get('host');
      await googleCalendarService.handleAuthCallback(code, manualHost);
      console.log('Manual Google authentication successful');
      
      res.json({ message: 'Authentication successful', authenticated: true });
    } catch (error) {
      console.error('Failed to handle manual auth:', error);
      res.status(500).json({ 
        message: 'Authentication failed', 
        error: error instanceof Error ? error.message : 'Unknown error' 
      });
    }
  });

  // Logout route
  app.post("/api/auth/logout", async (req, res) => {
    try {
      // Clear the stored Google credentials
      await storage.clearGoogleCredentials();
      
      // Reset the Google Calendar service
      googleCalendarService.clearCredentials();
      
      res.json({ message: 'Logged out successfully' });
    } catch (error) {
      console.error('Logout error:', error);
      res.status(500).json({ message: 'Failed to logout' });
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

  app.get("/api/calendar/auth-status", async (req, res) => {
    try {
      const credentials = await storage.getGoogleCredentials();
      
      let isAuthenticated = false;
      let authError = null;
      
      if (credentials) {
        try {
          isAuthenticated = await googleCalendarService.initializeCredentials();
        } catch (validationError) {
          authError = validationError instanceof Error ? validationError.message : 'Unknown validation error';
          // Credentials were invalid and have been automatically cleared
          isAuthenticated = false;
        }
      }
      
      const response: any = { 
        authenticated: isAuthenticated,
        needsAuth: !isAuthenticated 
      };
      
      // Include helpful error information for debugging (non-sensitive)
      if (authError && process.env.NODE_ENV === 'development') {
        response.debugInfo = {
          error: authError,
          hasCredentials: !!credentials,
          timestamp: new Date().toISOString()
        };
      }
      
      // Prevent caching to ensure real-time auth status
      res.set({
        'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0',
        'Surrogate-Control': 'no-store'
      });
      
      res.json(response);
    } catch (error) {
      console.error('Failed to check auth status:', error);
      res.status(500).json({ 
        message: "Failed to check authentication status",
        debugInfo: process.env.NODE_ENV === 'development' ? {
          error: error instanceof Error ? error.message : 'Unknown error'
        } : undefined
      });
    }
  });

  // OAuth configuration test endpoint (development only)
  if (process.env.NODE_ENV === 'development') {
    app.get("/api/test/oauth-config", async (req, res) => {
      res.json({
        hasClientId: !!process.env.GOOGLE_CLIENT_ID,
        hasClientSecret: !!process.env.GOOGLE_CLIENT_SECRET,
        hasRedirectUri: !!process.env.GOOGLE_REDIRECT_URI,
        hasCredentials: !!(await storage.getGoogleCredentials()),
        environment: process.env.NODE_ENV
      });
    });
  }

  // Endpoint to clear invalid credentials
  app.post("/api/auth/clear", async (req, res) => {
    try {
      await storage.clearGoogleCredentials();
      console.log('Manually cleared Google credentials');
      res.json({ 
        success: true, 
        message: "Credentials cleared successfully" 
      });
    } catch (error) {
      console.error('Failed to clear credentials:', error);
      res.status(500).json({ message: "Failed to clear credentials" });
    }
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
