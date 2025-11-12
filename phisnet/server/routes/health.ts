import { Router } from 'express';
import type { Express } from 'express';
import { isAuthenticated } from '../auth';

export function registerHealthRoutes(app: Express) {
  // Health check endpoint
  app.get("/api/status", (_req, res) => {
    res.json({ status: "ok" });
  });

  // Session ping endpoint
  app.post("/api/session-ping", isAuthenticated, (req, res) => {
    res.json({ alive: true });
  });
}
