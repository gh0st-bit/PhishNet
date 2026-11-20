import { pool } from '../db';
import { Router } from 'express';
import type { Express } from 'express';
import { isAuthenticated } from '../auth';

export function registerHealthRoutes(app: Express) {
  // Health check endpoint
  app.get("/api/status", (_req, res) => {
    res.json({ status: "ok" });
  });

  app.get('/health/live', (_req, res) => res.json({ status: 'ok' }));
  app.get('/health/ready', async (_req, res) => {
    try { await pool.query('SELECT 1'); res.json({ status: 'ready' }); }
    catch { res.status(503).json({ status: 'unavailable' }); }
  });

  // Session ping endpoint
  app.post("/api/session-ping", isAuthenticated, (req, res) => {
    res.json({ alive: true });
  });
}
