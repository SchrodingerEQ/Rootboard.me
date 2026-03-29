import express, { type Request, Response, NextFunction } from "express";
import session from "express-session";
import connectPgSimple from "connect-pg-simple";
import { neon } from "@neondatabase/serverless";
import { registerRoutes } from "./routes";
import { setupVite, serveStatic, log } from "./vite";

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

// Configure PostgreSQL-backed session store for reliable OAuth state management
const PgSession = connectPgSimple(session);

// Create PostgreSQL session store with error handling
let sessionStore: any = undefined;
if (process.env.DATABASE_URL) {
  try {
    sessionStore = new PgSession({
      conString: process.env.DATABASE_URL,
      createTableIfMissing: true,
      tableName: 'session'
    });
    console.log('PostgreSQL session store initialized successfully');
    
    // Handle store errors
    sessionStore.on('error', (err: Error) => {
      console.error('Session store error:', err);
    });
  } catch (error) {
    console.error('Failed to initialize PostgreSQL session store:', error);
    console.log('Falling back to memory session store');
  }
} else {
  console.log('No DATABASE_URL found, using memory session store');
}

// Configure session middleware for OAuth state management
app.use(session({
  store: sessionStore,
  secret: (() => {
    if (process.env.SESSION_SECRET) return process.env.SESSION_SECRET;
    console.warn('WARNING: No SESSION_SECRET set. Using random secret — sessions will not persist across restarts.');
    return require('crypto').randomBytes(32).toString('hex');
  })(),
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: !!process.env.DATABASE_URL && process.env.NODE_ENV === 'production',
    httpOnly: true,
    maxAge: 1000 * 60 * 15, // 15 minutes
    sameSite: 'lax'
  }
}));

app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;
  let capturedJsonResponse: Record<string, any> | undefined = undefined;

  const originalResJson = res.json;
  res.json = function (bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };

  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path.startsWith("/api")) {
      let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
      if (capturedJsonResponse) {
        logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
      }

      if (logLine.length > 80) {
        logLine = logLine.slice(0, 79) + "…";
      }

      log(logLine);
    }
  });

  next();
});

(async () => {
  const server = await registerRoutes(app);

  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";

    res.status(status).json({ message });
    throw err;
  });

  // importantly only setup vite in development and after
  // setting up all the other routes so the catch-all route
  // doesn't interfere with the other routes
  if (app.get("env") === "development") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }

  // ALWAYS serve the app on port 5000
  // this serves both the API and the client.
  // It is the only port that is not firewalled.
  const port = 5000;
  server.listen({
    port,
    host: "0.0.0.0",
    reusePort: true,
  }, () => {
    log(`serving on port ${port}`);
  });
})();
