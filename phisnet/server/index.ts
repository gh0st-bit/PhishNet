import express, { type Request, Response, NextFunction } from "express";
import { registerRoutes } from "./routes";
import { setupVite, serveStatic, log } from "./vite";
import { isAuthenticated, isAdmin } from './auth';
import { pool } from './db';
import { startCampaignScheduler } from './services/campaign-scheduler';
import { threatFeedScheduler } from './services/threat-intelligence/threat-feed-scheduler';

const app = express();

// Add CORS middleware
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', 'http://localhost:5173');
  res.header('Access-Control-Allow-Credentials', 'true');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization, Cookie');
  
  if (req.method === 'OPTIONS') {
    res.sendStatus(200);
  } else {
    next();
  }
});

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

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

  if (app.get("env") === "development") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }

  const port = 5000;
  server.listen(port, "localhost", () => {
    log(`Server running at http://localhost:${port}`);
    
    // Start background scheduler to auto-send due campaigns
    const intervalMs = parseInt(process.env.CAMPAIGN_SCHEDULER_INTERVAL_MS || '60000', 10);
    startCampaignScheduler(intervalMs);
    
    // Start threat intelligence feed scheduler (runs every 2 hours)
    // TEMPORARILY DISABLED FOR TESTING - causing crashes
    // const threatIntervalHours = parseInt(process.env.THREAT_FEED_INTERVAL_HOURS || '2', 10);
    // threatFeedScheduler.start(threatIntervalHours);
    // log(`Threat intelligence scheduler started (every ${threatIntervalHours} hours)`);
  });
})();

// Debug endpoint
app.get("/api/debug/templates", isAuthenticated, isAdmin, async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM email_templates LIMIT 10');
    res.json(result.rows);
  } catch (error) {
    console.error('Debug query error:', error);
    res.status(500).json({ error: 'Database query failed' });
  }
});
