import type { Express } from 'express';
import { z } from 'zod';
import { isAuthenticated, hasOrganization, isAdmin } from '../auth';
import { db } from '../db';
import { organizations, users } from '@shared/schema';
import { eq } from 'drizzle-orm';
import { AuditService } from '../services/audit.service';

const updateOrgSchema = z.object({
  name: z.string().min(2).max(100),
});

export function registerOrganizationRoutes(app: Express) {
  // Get current organization basics
  app.get('/api/organization', isAuthenticated, hasOrganization, async (req: any, res) => {
    const orgId = req.user.organizationId as number;
    const rows = await db.select().from(organizations).where(eq(organizations.id, orgId));
    const org = rows[0];
    if (!org) return res.status(404).json({ message: 'Organization not found' });
    res.json({ id: org.id, name: org.name, dataRetentionDays: org.dataRetentionDays, twoFactorRequired: (org as any).twoFactorRequired });
  });

  // Update organization name (admin only)
  app.put('/api/organization/name', isAuthenticated, hasOrganization, isAdmin, async (req: any, res) => {
    const parsed = updateOrgSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ message: parsed.error.issues.map(i => i.message).join(', ') });
    }
    const orgId = req.user.organizationId as number;
    const rows = await db.select().from(organizations).where(eq(organizations.id, orgId));
    const org = rows[0];
    if (!org) return res.status(404).json({ message: 'Organization not found' });
    const oldName = org.name;
    const newName = parsed.data.name.trim();

    // Update organization table
    await db.update(organizations)
      .set({ name: newName, updatedAt: new Date() })
      .where(eq(organizations.id, orgId));

    // Propagate to user.organizationName for display consistency
    await db.update(users)
      .set({ organizationName: newName, updatedAt: new Date() })
      .where(eq(users.organizationId, orgId));

    // Audit log
    await AuditService.log({
      context: { userId: req.user.id, organizationId: orgId, ip: req.ip, userAgent: req.get('user-agent') },
      action: 'organization.rename',
      resource: 'organization',
      resourceId: orgId,
      metadata: { oldName, newName }
    }).catch(()=>{});

    res.json({ id: orgId, name: newName });
  });
}
