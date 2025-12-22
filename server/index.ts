/**
 * =============================================================================
 * NEBULA CHAT - SERVER ENTRY POINT
 * =============================================================================
 * 
 * This is the main entry point for the Meowstik backend server.
 * It initializes and configures the Express.js application, sets up
 * middleware, registers API routes, and starts the HTTP server.
 * 
 * SERVER ARCHITECTURE:
 * --------------------
 * The server serves dual purposes:
 * 1. API Server: Handles all /api/* requests for chat operations
 * 2. Static Server: Serves the React frontend (in production mode)
 * 
 * REQUEST FLOW:
 * -------------
 *   Client Request
 *         │
 *         ▼
 *   ┌─────────────────────┐
 *   │   Express Server    │
 *   │   (Port 5000)       │
 *   └─────────────────────┘
 *         │
 *         ├──── /api/* ─────► API Routes (routes.ts)
 *         │                         │
 *         │                         ▼
 *         │                   Storage Layer
 *         │                   (PostgreSQL)
 *         │
 *         └──── /* ─────────► Static Files (React App)
 *                             or Vite Dev Server
 * 
 * ENVIRONMENT MODES:
 * ------------------
 * - Development: Uses Vite dev server with hot module replacement (HMR)
 * - Production: Serves pre-built static files from dist/public
 * 
 * MIDDLEWARE STACK:
 * -----------------
 * 1. JSON body parser (with raw body preservation for webhooks)
 * 2. URL-encoded body parser
 * 3. Request logging middleware (for API requests)
 * 4. API route handlers
 * 5. Error handler
 * 6. Static file server (production) or Vite middleware (development)
 * =============================================================================
 */

import express, { type Request, Response, NextFunction } from "express";
import { registerRoutes } from "./routes";
import { serveStatic } from "./static";
import { createServer } from "http";
import { initializeFromDatabase } from "./integrations/google-auth";
import { logBuffer } from "./services/log-buffer";

/**
 * CREATE EXPRESS APPLICATION
 * --------------------------
 * Initialize the Express application instance.
 * This is the core of our server, handling all HTTP requests.
 */
const app = express();

/**
 * CREATE HTTP SERVER
 * ------------------
 * Wrap the Express app in a Node.js HTTP server.
 * This allows for more flexibility (e.g., WebSocket upgrades in the future).
 */
const httpServer = createServer(app);

/**
 * TYPE AUGMENTATION FOR RAW BODY ACCESS
 * --------------------------------------
 * Extends the Node.js IncomingMessage type to include a rawBody property.
 * This is needed for certain integrations (like Stripe webhooks) that
 * require access to the raw, unparsed request body for signature verification.
 */
declare module "http" {
  interface IncomingMessage {
    /**
     * The raw, unparsed request body buffer
     * Useful for webhook signature verification
     */
    rawBody: unknown;
  }
}

/**
 * JSON BODY PARSER MIDDLEWARE
 * ---------------------------
 * Parses incoming JSON request bodies and makes them available on req.body.
 * 
 * The 'verify' callback saves the raw buffer before parsing, which is
 * necessary for webhook signature verification where the exact bytes matter.
 * 
 * SECURITY NOTE: This processes all JSON bodies; size limits are applied
 * by Express's default configuration (100kb limit).
 */
app.use(
  express.json({
    limit: "50mb",
    verify: (req, _res, buf) => {
      // Store the raw buffer for later use (e.g., webhook verification)
      req.rawBody = buf;
    },
  }),
);

/**
 * URL-ENCODED BODY PARSER
 * -----------------------
 * Parses URL-encoded form data (like HTML form submissions).
 * The 'extended: false' option uses the simpler querystring library
 * instead of the qs library, which is sufficient for simple forms.
 */
app.use(express.urlencoded({ extended: false }));

/**
 * LOGGING UTILITY FUNCTION
 * ------------------------
 * Provides consistent, formatted logging throughout the application.
 * Includes timestamp and source identification for easy debugging.
 * 
 * @param message - The message to log
 * @param source - The component generating the log (default: "express")
 * 
 * OUTPUT FORMAT:
 * HH:MM:SS AM/PM [source] message
 * 
 * @example
 * log("Server started");                    // "10:30:45 AM [express] Server started"
 * log("Query executed", "database");        // "10:30:45 AM [database] Query executed"
 */
export function log(message: string, source = "express", level: "info" | "warn" | "error" | "debug" = "info") {
  // Format the current time in 12-hour format with AM/PM
  const formattedTime = new Date().toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  });

  // Output with timestamp and source tag
  console.log(`${formattedTime} [${source}] ${message}`);
  
  // Capture to log buffer for debug page
  logBuffer.add(level, `[${source}] ${message}`);
}

/**
 * REQUEST LOGGING MIDDLEWARE
 * --------------------------
 * Logs all API requests with method, path, status code, and timing information.
 * Also captures and logs the JSON response body for debugging purposes.
 * 
 * This middleware:
 * 1. Records the request start time
 * 2. Intercepts the res.json() method to capture response data
 * 3. On response finish, logs the complete request details
 * 
 * LOG FORMAT:
 * METHOD /path STATUS in Xms :: {response_body}
 * 
 * EXAMPLE OUTPUT:
 * GET /api/chats 200 in 15ms :: [{"id":"...","title":"..."}]
 * 
 * NOTE: Only logs requests to /api/* paths to avoid cluttering logs
 * with static file requests.
 */
app.use((req, res, next) => {
  // Record when the request started for duration calculation
  const start = Date.now();
  const path = req.path;
  
  // Variable to store captured JSON response
  let capturedJsonResponse: Record<string, any> | undefined = undefined;

  // Intercept res.json() to capture the response body
  // This technique allows us to log responses without modifying route handlers
  const originalResJson = res.json;
  res.json = function (bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };

  // When the response is complete, log the request details
  res.on("finish", () => {
    const duration = Date.now() - start;
    
    // Only log API requests (not static file requests)
    if (path.startsWith("/api")) {
      let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
      
      // Append response body if available (for debugging)
      // Skip for debug endpoints to avoid nested JSON escaping
      if (capturedJsonResponse && !path.startsWith("/api/debug")) {
        logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
      }

      log(logLine);
    }
  });

  // Continue to the next middleware
  next();
});

/**
 * SERVER INITIALIZATION
 * ---------------------
 * Async IIFE (Immediately Invoked Function Expression) that:
 * 1. Registers all API routes
 * 2. Sets up error handling
 * 3. Configures static file serving (based on environment)
 * 4. Starts the HTTP server on the configured port
 * 
 * Using an async IIFE allows us to use await at the top level
 * while keeping the server startup code organized.
 */
(async () => {
  /**
   * REGISTER API ROUTES
   * -------------------
   * All API endpoints (/api/chats, /api/messages, etc.) are defined in routes.ts.
   * This separation keeps the main entry point clean and focused on configuration.
   */
  await registerRoutes(httpServer, app);

  /**
   * SETUP LIVE VOICE WEBSOCKET
   * --------------------------
   * Initialize WebSocket server for real-time voice conversations.
   * Handles bidirectional audio streaming with Gemini Live API.
   */
  const { setupLiveWebSocket } = await import("./websocket-live");
  setupLiveWebSocket(httpServer);

  /**
   * INITIALIZE GOOGLE OAUTH TOKENS (NON-BLOCKING)
   * ----------------------------------------------
   * Load any persisted Google OAuth tokens from the database.
   * This is non-blocking to prevent server crash if database is temporarily unavailable.
   * Tokens will be loaded lazily on first authenticated request if startup load fails.
   */
  initializeFromDatabase().catch((error) => {
    console.warn('Non-blocking: Failed to initialize Google OAuth on startup:', error instanceof Error ? error.message : error);
  });

  /**
   * GLOBAL ERROR HANDLER
   * --------------------
   * Catches any unhandled errors from route handlers and middleware.
   * Returns a consistent JSON error response to the client.
   * 
   * NOTE: This must be registered AFTER all routes to catch their errors.
   * 
   * @param err - The error object (may have status/statusCode and message)
   * @param _req - The request object (unused but required by Express)
   * @param res - The response object
   * @param _next - The next function (unused but required by Express)
   */
  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    // Extract status code from error, defaulting to 500 (Internal Server Error)
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";

    // Send JSON error response
    res.status(status).json({ message });
    
    // Re-throw to ensure error is logged/tracked
    throw err;
  });

  /**
   * ENVIRONMENT-SPECIFIC STATIC FILE SERVING
   * -----------------------------------------
   * In production: Serve pre-built static files from dist/public
   * In development: Use Vite's dev server with hot module replacement
   * 
   * IMPORTANT: This must be set up AFTER API routes so that /api/* requests
   * don't get caught by the catch-all static file handler.
   */
  if (process.env.NODE_ENV === "production") {
    // Production: Serve static files from the build output directory
    serveStatic(app);
  } else {
    // Development: Use Vite dev server for hot reloading
    const { setupVite } = await import("./vite");
    await setupVite(httpServer, app);
  }

  /**
   * START THE HTTP SERVER
   * ---------------------
   * Binds the server to the specified port and starts listening for requests.
   * 
   * PORT CONFIGURATION:
   * - Uses PORT environment variable if set
   * - Falls back to port 5000 (Replit's default)
   * 
   * HOST CONFIGURATION:
   * - Binds to 0.0.0.0 to accept connections from any interface
   * - This is required for the app to be accessible externally
   * 
   * REUSE PORT:
   * - Enables multiple processes to bind to the same port
   * - Useful for zero-downtime deployments
   */
  const port = parseInt(process.env.PORT || "5000", 10);
  
  httpServer.listen(
    {
      port,
      host: "0.0.0.0",      // Accept connections from any interface
      reusePort: true,       // Allow port reuse for zero-downtime restarts
    },
    () => {
      log(`serving on port ${port}`);
    },
  );
})();
