import type { Express } from 'express';
import { z } from 'zod';
import { isAuthenticated, isAdmin } from '../auth';
import { db } from '../db';
import { organizations } from '@shared/schema';
import { eq } from 'drizzle-orm';
import { DataRetentionService } from '../services/data-retention.service';
import { dataRetentionScheduler } from '../services/data-retention-scheduler';

export function registerDataRetentionRoutes(app: Express) {
  // Get current org policy (days)
  app.get('/api/data-retention/policy', isAuthenticated, isAdmin, async (req: any, res) => {
    const orgId = req.user.organizationId as number;
    const rows = await db.select({ id: organizations.id, days: organizations.dataRetentionDays })
      .from(organizations)
      .where(eq(organizations.id, orgId));
    const row = rows[0];
    if (!row) return res.status(404).json({ message: 'Organization not found' });
    res.json({ organizationId: row.id, dataRetentionDays: row.days });
  });

  // Get scheduler status
  app.get('/api/data-retention/status', isAuthenticated, isAdmin, async (_req, res) => {
    res.json({
      scheduler: dataRetentionScheduler.status(),
      enabled: (process.env.DATA_RETENTION_ENABLED || 'true').toLowerCase() === 'true',
      intervalHours: Number.parseInt(process.env.DATA_RETENTION_INTERVAL_HOURS || '24', 10),
    });
  });

  // Manually run cleanup now
  app.post('/api/data-retention/run-now', isAuthenticated, isAdmin, async (_req, res) => {
    try {
      const summary = await DataRetentionService.runCleanup(false);
      res.json({ success: true, summary });
    } catch (err: any) {
      res.status(500).json({ success: false, message: err?.message || 'Cleanup failed' });
    }
  });

  // Update organization retention policy (days)
  app.put('/api/data-retention/policy', isAuthenticated, isAdmin, async (req: any, res) => {
    const schema = z.object({ days: z.number().int().min(0).max(3650) });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ message: parsed.error.issues.map(i => i.message).join(', ') });
    }

    const orgId = req.user.organizationId as number;
    await db.update(organizations)
      .set({ dataRetentionDays: parsed.data.days, updatedAt: new Date() })
      .where(eq(organizations.id, orgId));

    res.json({ success: true, organizationId: orgId, dataRetentionDays: parsed.data.days });
  });
}
