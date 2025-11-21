import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { googleCalendarService } from "./services/googleCalendar";
import { insertCalendarEventSchema } from "@shared/schema";

export async function registerRoutes(app: Express): Promise<Server> {
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
              console.log('Session saved with state:', state);
              resolve();
            }
          });
        });
      }
      
      const authUrl = googleCalendarService.getAuthUrl(state);
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
      console.log('Callback session ID:', (req as any).session?.id);
      console.log('Callback session data:', (req as any).session);
      const expectedState = (req as any).session?.oauthState;
      console.log('State verification - expected:', expectedState, 'received:', state);
      
      if (!expectedState || state !== expectedState) {
        console.error('OAuth state mismatch!');
        return res.status(400).send(`
          <html>
            <body>
              <h1>Security Error</h1>
              <p>Authentication request rejected for security reasons</p>
              <p>This may be due to session expiry. Please try again.</p>
              <p style="font-size: 12px; color: gray;">Debug: Session ${(req as any).session ? 'exists' : 'missing'}, Expected state: ${expectedState ? 'present' : 'missing'}</p>
              <a href="/">Return to Calendar</a>
            </body>
          </html>
        `);
      }

      // Clear the stored state after successful verification
      if ((req as any).session) {
        delete (req as any).session.oauthState;
      }

      console.log('Processing authorization code...');
      await googleCalendarService.handleAuthCallback(code);
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
            <p>Failed to complete authentication: ${error}</p>
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

      console.log('Processing manual authorization code...', code.substring(0, 20) + '...');
      await googleCalendarService.handleAuthCallback(code);
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

  app.get("/api/calendar/auth-status", async (req, res) => {
    try {
      const credentials = await storage.getGoogleCredentials();
      console.log('Auth status check - credentials found:', !!credentials);
      
      // If we have credentials, try to initialize them to verify they're valid
      let isAuthenticated = false;
      let authError = null;
      
      if (credentials) {
        try {
          isAuthenticated = await googleCalendarService.initializeCredentials();
          console.log('Credential validation result:', isAuthenticated);
        } catch (validationError) {
          console.log('Credential validation failed:', validationError);
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

  const httpServer = createServer(app);
  return httpServer;
}
