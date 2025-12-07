import { Router, Request, Response } from 'express';
import { db } from '../db';
import {
  credentialCaptures,
  campaigns,
  emailTemplates,
  landingPages,
  targets,
  users as usersTable,
  campaignResults,
} from '../../shared/schema';
import { eq, and, desc } from 'drizzle-orm';
import { isAuthenticated, isAdmin, hasOrganization } from '../auth';

export function registerCredentialCaptureRoutes(app: Router) {
  // Public endpoint: capture credentials (no auth required)
  app.post('/c/submit', async (req: Request, res: Response) => {
    try {
      const { email, username, password, cid, tid, lid, targetId } = req.body;

      // Validate required fields
      if (!email || !username || !password || !cid || !tid || !lid) {
        return res.status(400).json({ message: 'Missing required credential capture fields' });
      }

      // Get IP and user agent
      const ip = req.ip || req.connection.remoteAddress || 'unknown';
      const userAgent = req.get('user-agent') || 'unknown';

      // Validate campaign, template, landing page, and target exist
      const [campaign] = await db.select().from(campaigns).where(eq(campaigns.id, parseInt(cid)));
      const [template] = await db.select().from(emailTemplates).where(eq(emailTemplates.id, parseInt(tid)));
      const [landing] = await db.select().from(landingPages).where(eq(landingPages.id, parseInt(lid)));
      const [target] = await db.select().from(targets).where(eq(targets.id, parseInt(targetId || 0)));

      if (!campaign || !template || !landing) {
        return res.status(400).json({ message: 'Invalid campaign, template, or landing page' });
      }

      // Insert credential capture
      const [capture] = await db.insert(credentialCaptures).values({
        campaignId: parseInt(cid),
        templateId: parseInt(tid),
        landingId: parseInt(lid),
        targetId: target?.id || 0,
        organizationId: campaign.organizationId,
        email,
        username,
        password,
        ip,
        userAgent,
      }).returning();

      // Update campaign result: mark as submitted
      if (target) {
        await db.update(campaignResults)
          .set({
            submitted: true,
            submittedAt: new Date(),
            status: 'submitted',
            submittedData: { credentialCaptureId: capture.id },
          })
          .where(
            and(
              eq(campaignResults.campaignId, parseInt(cid)),
              eq(campaignResults.targetId, target.id)
            )
          );
      }

      res.status(201).json({
        message: 'Credentials captured',
        captureId: capture.id,
      });
    } catch (error: any) {
      console.error('Credential capture error:', error);
      res.status(500).json({ message: error.message });
    }
  });

  // Admin endpoint: list credential captures for an organization/campaign
  app.get(
    '/api/admin/credential-captures',
    isAuthenticated,
    hasOrganization,
    async (req: Request, res: Response) => {
      try {
        const user = (req as any).user;
        const { campaignId, templateId, page = 1, limit = 20 } = req.query;
        const pageNum = parseInt(page as string) || 1;
        const limitNum = parseInt(limit as string) || 20;
        const offset = (pageNum - 1) * limitNum;

        let query = db
          .select({
            id: credentialCaptures.id,
            campaignId: credentialCaptures.campaignId,
            templateId: credentialCaptures.templateId,
            landingId: credentialCaptures.landingId,
            email: credentialCaptures.email,
            username: credentialCaptures.username,
            password: credentialCaptures.password,
            ip: credentialCaptures.ip,
            userAgent: credentialCaptures.userAgent,
            submittedAt: credentialCaptures.submittedAt,
            campaignName: campaigns.name,
            templateName: emailTemplates.name,
            targetEmail: targets.email,
          })
          .from(credentialCaptures)
          .innerJoin(campaigns, eq(credentialCaptures.campaignId, campaigns.id))
          .innerJoin(emailTemplates, eq(credentialCaptures.templateId, emailTemplates.id))
          .leftJoin(targets, eq(credentialCaptures.targetId, targets.id))
          .where(eq(credentialCaptures.organizationId, user.organizationId))
          .orderBy(desc(credentialCaptures.submittedAt));

        // Filter by campaign if provided
        if (campaignId) {
          query = query.where(eq(credentialCaptures.campaignId, parseInt(campaignId as string)));
        }

        // Filter by template if provided
        if (templateId) {
          query = query.where(eq(credentialCaptures.templateId, parseInt(templateId as string)));
        }

        const captures = await query.limit(limitNum).offset(offset);

        // Count total
        let countQuery = db
          .select()
          .from(credentialCaptures)
          .where(eq(credentialCaptures.organizationId, user.organizationId));

        if (campaignId) {
          countQuery = countQuery.where(eq(credentialCaptures.campaignId, parseInt(campaignId as string)));
        }
        if (templateId) {
          countQuery = countQuery.where(eq(credentialCaptures.templateId, parseInt(templateId as string)));
        }

        const [{ count }] = await db
          .select({ count: db.count() })
          .from(credentialCaptures)
          .where(eq(credentialCaptures.organizationId, user.organizationId));

        res.json({
          data: captures,
          pagination: {
            page: pageNum,
            limit: limitNum,
            total: count,
            pages: Math.ceil(count / limitNum),
          },
        });
      } catch (error: any) {
        console.error('Error fetching credential captures:', error);
        res.status(500).json({ message: error.message });
      }
    }
  );

  // Admin endpoint: get credential captures for a specific campaign
  app.get(
    '/api/admin/campaigns/:campaignId/captures',
    isAuthenticated,
    hasOrganization,
    async (req: Request, res: Response) => {
      try {
        const user = (req as any).user;
        const { campaignId } = req.params;

        const captures = await db
          .select()
          .from(credentialCaptures)
          .where(
            and(
              eq(credentialCaptures.campaignId, parseInt(campaignId)),
              eq(credentialCaptures.organizationId, user.organizationId)
            )
          )
          .orderBy(desc(credentialCaptures.submittedAt));

        res.json({ data: captures });
      } catch (error: any) {
        console.error('Error fetching campaign captures:', error);
        res.status(500).json({ message: error.message });
      }
    }
  );

  // Admin endpoint: get capture details
  app.get(
    '/api/admin/credential-captures/:captureId',
    isAuthenticated,
    hasOrganization,
    async (req: Request, res: Response) => {
      try {
        const user = (req as any).user;
        const { captureId } = req.params;

        const [capture] = await db
          .select()
          .from(credentialCaptures)
          .where(
            and(
              eq(credentialCaptures.id, parseInt(captureId)),
              eq(credentialCaptures.organizationId, user.organizationId)
            )
          );

        if (!capture) {
          return res.status(404).json({ message: 'Credential capture not found' });
        }

        res.json({ data: capture });
      } catch (error: any) {
        console.error('Error fetching credential capture:', error);
        res.status(500).json({ message: error.message });
      }
    }
  );
}
