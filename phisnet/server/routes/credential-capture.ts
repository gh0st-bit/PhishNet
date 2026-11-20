import { pool } from '../db';
import {campaignLanding} from '../services/campaign-content';
import { queueRemediation } from '../services/training-automation';
import { analyzePassword } from '../services/password-analysis';
import type { Express } from 'express';
import { db } from '../db';
import { credentialCaptures, campaigns, emailTemplates, landingPages, targets, campaignResults } from '@shared/schema';
import { eq, and, desc, count, SQL } from 'drizzle-orm';
import { isAuthenticated, hasOrganization, isAdminOrOrgAdmin } from '../auth';
import { SecretsService } from '../services/secrets.service';
import { AuditService } from '../services/audit.service';
import { validTrackingToken } from '../services/tracking-token';
import { trackingLimiter } from '../middleware/rate-limit';
import { z } from 'zod';

const submission = z.object({
  email: z.string().email().max(254), username: z.string().min(1).max(254),
  password: z.string().min(1).max(1024), cid: z.coerce.number().int().positive(),
  tid: z.coerce.number().int().positive(), lid: z.coerce.number().int().positive(),
  targetId: z.coerce.number().int().positive(), token: z.string().min(1),
});
const filters = z.object({
  page: z.coerce.number().int().min(1).default(1), limit: z.coerce.number().int().min(1).max(100).default(20),
  campaignId: z.coerce.number().int().positive().optional(), templateId: z.coerce.number().int().positive().optional(),
});
const withoutPassword = ({ password: _password, ...capture }: typeof credentialCaptures.$inferSelect) => ({ ...capture, password: null });

export function registerCredentialCaptureRoutes(app: Express) {
  app.post('/c/submit', trackingLimiter, async (req, res) => {
    const parsed = submission.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: 'Invalid submission' });
    const data = parsed.data;
    if (!validTrackingToken(data.token, data.cid, data.targetId)) return res.status(403).json({ message: 'Invalid tracking token' });
    try {
      const [campaign] = await db.select().from(campaigns).where(eq(campaigns.id, data.cid));
      const [template] = await db.select().from(emailTemplates).where(eq(emailTemplates.id, data.tid));
      const landing = campaign?await campaignLanding(campaign):undefined;
      const [target] = await db.select().from(targets).where(eq(targets.id, data.targetId));
      const {rows:[dispatch]}=await pool.query('SELECT snapshot FROM campaign_dispatch WHERE campaign_id=$1 AND target_id=$2',[data.cid,data.targetId]);
      if (!dispatch || !campaign || !template || !landing || !target || campaign.status !== 'Active' ||
          (dispatch.snapshot.templateId || campaign.emailTemplateId) !== template.id || campaign.landingPageId !== landing.id ||
          campaign.organizationId !== target.organizationId ||
          campaign.organizationId !== template.organization_id || campaign.organizationId !== landing.organizationId ||
          (campaign.endDate && campaign.endDate < new Date())) return res.status(400).json({ message: 'Invalid campaign submission' });
      if(!landing.captureData)return res.status(400).json({message:'Capture disabled'});
      if(!landing.capturePasswords){
        await db.update(campaignResults).set({submitted:true,submittedAt:new Date(),status:'submitted',submittedData:{submitted:true}}).where(and(eq(campaignResults.campaignId,campaign.id),eq(campaignResults.targetId,target.id)));
        await queueRemediation(campaign.id,target.id,'submitted');
        return res.status(201).json({message:'Submission recorded. Password storage is disabled.'});
      }
      const encrypted = await SecretsService.encrypt(campaign.organizationId, data.password);
      const passwordAnalysis = await analyzePassword(data.password);
      const [capture] = await db.insert(credentialCaptures).values({
        campaignId: campaign.id, templateId: template.id, landingId: landing.id, targetId: target.id,
        organizationId: campaign.organizationId, email: data.email, username: data.username,
        password: encrypted, passwordAnalysis, ip: req.ip, userAgent: req.get('user-agent')?.slice(0, 512),
      }).returning({ id: credentialCaptures.id });
      await db.update(campaignResults).set({ submitted: true, submittedAt: new Date(), status: 'submitted', submittedData: { credentialCaptureId: capture.id } })
        .where(and(eq(campaignResults.campaignId, campaign.id), eq(campaignResults.targetId, target.id), eq(campaignResults.organizationId, campaign.organizationId)));
      await queueRemediation(campaign.id,target.id,(passwordAnalysis.common || passwordAnalysis.short || passwordAnalysis.breached) ? 'weak_password' : 'submitted');
      return res.status(201).json({ message: 'Submission recorded', captureId: capture.id });
    } catch { return res.status(500).json({ message: 'Unable to record submission' }); }
  });

  const guard = [isAuthenticated, hasOrganization, isAdminOrOrgAdmin];
  app.get('/api/admin/credential-captures', ...guard, async (req, res) => {
    const parsed = filters.safeParse(req.query);
    if (!parsed.success) return res.status(400).json({ message: 'Invalid filters' });
    const { page, limit, campaignId, templateId } = parsed.data;
    const conditions: SQL[] = [eq(credentialCaptures.organizationId, req.user!.organizationId)];
    if (campaignId) conditions.push(eq(credentialCaptures.campaignId, campaignId));
    if (templateId) conditions.push(eq(credentialCaptures.templateId, templateId));
    try {
      const data = await db.select().from(credentialCaptures).where(and(...conditions)).orderBy(desc(credentialCaptures.submittedAt)).limit(limit).offset((page - 1) * limit);
      const [total] = await db.select({ count: count() }).from(credentialCaptures).where(and(...conditions));
      res.json({ data: data.map(withoutPassword), pagination: { page, limit, total: total.count, pages: Math.ceil(total.count / limit) } });
    } catch { res.status(500).json({ message: 'Unable to fetch captures' }); }
  });
  app.get('/api/admin/campaigns/:campaignId/captures', ...guard, async (req, res) => {
    const id = z.coerce.number().int().positive().safeParse(req.params.campaignId);
    if (!id.success) return res.status(400).json({ message: 'Invalid campaign' });
    try {
      const data = await db.select().from(credentialCaptures).where(and(eq(credentialCaptures.organizationId, req.user!.organizationId), eq(credentialCaptures.campaignId, id.data))).orderBy(desc(credentialCaptures.submittedAt)).limit(100);
      res.json({ data: data.map(withoutPassword) });
    } catch { res.status(500).json({ message: 'Unable to fetch captures' }); }
  });
  app.get('/api/admin/credential-captures/:captureId', ...guard, async (req, res) => {
    const id = z.coerce.number().int().positive().safeParse(req.params.captureId);
    if (!id.success) return res.status(400).json({ message: 'Invalid capture' });
    const [capture] = await db.select().from(credentialCaptures).where(and(eq(credentialCaptures.id, id.data), eq(credentialCaptures.organizationId, req.user!.organizationId)));
    if (!capture) return res.status(404).json({ message: 'Capture not found' });
    res.json({ data: withoutPassword(capture) });
  });
  app.post('/api/admin/credential-captures/:captureId/reveal', ...guard, async (req, res) => {
    const id = z.coerce.number().int().positive().safeParse(req.params.captureId);
    if (!id.success) return res.status(400).json({ message: 'Invalid capture' });
    try {
      const [capture] = await db.select().from(credentialCaptures).where(and(eq(credentialCaptures.id, id.data), eq(credentialCaptures.organizationId, req.user!.organizationId)));
      if (!capture) return res.status(404).json({ message: 'Capture not found' });
      const retention = Number(process.env.CAPTURE_RETENTION_DAYS || 7);
      if (!Number.isFinite(retention) || retention < 1 || Date.now() - capture.submittedAt.getTime() > retention * 86400000) return res.status(410).json({ message: 'Password retention period expired' });
      if (!SecretsService.isEncrypted(capture.password)) return res.status(409).json({ message: 'Capture requires encryption migration' });
      // Fail closed if the access audit cannot be saved.
      await AuditService.log({ context: { userId: req.user!.id, organizationId: req.user!.organizationId, ip: req.ip, userAgent: req.get('user-agent') }, action: 'capture.reveal', resource: 'credential_capture', resourceId: capture.id });
      res.setHeader('Cache-Control', 'no-store');
      res.json({ password: await SecretsService.decrypt(capture.organizationId, capture.password) });
    } catch { res.status(500).json({ message: 'Unable to reveal capture' }); }
  });
}
