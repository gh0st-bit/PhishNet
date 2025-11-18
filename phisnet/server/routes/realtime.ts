import type { Express } from 'express';
import { isAuthenticated } from '../auth';
import { getIO } from '../services/realtime';

export function registerRealtimeRoutes(app: Express) {
  app.get('/api/realtime/health', isAuthenticated, (_req, res) => {
    res.json({ ok: true, connected: !!getIO() });
  });
}

export default { registerRealtimeRoutes };
