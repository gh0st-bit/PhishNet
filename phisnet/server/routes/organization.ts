import {sql} from 'drizzle-orm';
import type { Express } from 'express';
import { z } from 'zod';
import { isAuthenticated, hasOrganization, isAdmin, isAdminOrOrgAdmin } from '../auth';
import { db } from '../db';
import { organizations, users } from '@shared/schema';
import { eq } from 'drizzle-orm';
import { AuditService } from '../services/audit.service';

const updateOrgSchema = z.object({
  name: z.string().min(2).max(100),
});

export function registerOrganizationRoutes(app: Express) {
  const preferencesSchema=z.object({leaderboardEnabled:z.boolean().default(false),brandName:z.string().trim().min(1).max(100),locale:z.enum(['en-US','en-GB','fr-FR','es-ES','ur-PK']),timezone:z.string().max(64).refine(v=>{try{new Intl.DateTimeFormat('en',{timeZone:v});return true;}catch{return false;}},'Invalid timezone'),accentColor:z.string().regex(/^#[0-9a-fA-F]{6}$/),captureRetentionDays:z.number().int().min(1).max(30),dataRetentionDays:z.number().int().min(1).max(3650)});
  const view=(org:typeof organizations.$inferSelect)=>({brandName:org.name,locale:'en-US',timezone:'UTC',accentColor:'#ff8000',leaderboardEnabled:false,...org.preferences,captureRetentionDays:org.captureRetentionDays,dataRetentionDays:org.dataRetentionDays});
  app.get('/api/organization/preferences',isAuthenticated,hasOrganization,async(req,res)=>{
    const [org]=await db.select().from(organizations).where(eq(organizations.id,req.user!.organizationId));
    if(!org)return res.sendStatus(404);res.json(view(org));
  });
  app.put('/api/organization/preferences',isAuthenticated,hasOrganization,isAdminOrOrgAdmin,async(req,res)=>{
    const parsed=preferencesSchema.safeParse(req.body);if(!parsed.success)return res.status(400).json({message:parsed.error.issues.map(v=>v.message).join(', ')});
    const {captureRetentionDays,dataRetentionDays,...preferences}=parsed.data;
    const [org]=await db.update(organizations).set({preferences:sql`${organizations.preferences} || ${JSON.stringify(preferences)}::jsonb`,captureRetentionDays,dataRetentionDays,updatedAt:new Date()}).where(eq(organizations.id,req.user!.organizationId)).returning();
    await AuditService.log({context:{userId:req.user!.id,organizationId:req.user!.organizationId},action:'organization.preferences.update',resource:'organization',resourceId:org.id});res.json(view(org));
  });
  // Get current organization basics
  app.get('/api/organization', isAuthenticated, hasOrganization, async (req: any, res) => {
    const orgId = req.user.organizationId as number;
    const rows = await db.select().from(organizations).where(eq(organizations.id, orgId));
    const org = rows[0];
    if (!org) return res.status(404).json({ message: 'Organization not found' });
    res.json({ id: org.id, name: org.name, dataRetentionDays: org.dataRetentionDays, twoFactorRequired: (org as any).twoFactorRequired });
  });

  // Update organization name (admin only)
  app.put('/api/organization/name', isAuthenticated, hasOrganization, isAdmin, isAdminOrOrgAdmin, async (req: any, res) => {
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
