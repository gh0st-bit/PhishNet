import { saveTrackingEvent } from '../services/tracking-events';
import {campaignLanding,trainingFeedback} from '../services/campaign-content';
import { queueRemediation } from '../services/training-automation';
import type { Express, Request } from 'express';
import { pool } from '../db';
import { storage } from '../storage';
import { validTrackingToken } from '../services/tracking-token';
import { trackingLimiter } from '../middleware/rate-limit';
import sanitizeHtml from 'sanitize-html';
import { SecretsService } from '../services/secrets.service';

async function context(req: Request, fromBody = false) {
  const campaignId = Number(fromBody ? req.body.campaignId : req.params.campaignId);
  const targetId = Number(fromBody ? req.body.targetId : req.params.targetId);
  const token = fromBody ? req.body.token : req.query.token;
  if (!validTrackingToken(token, campaignId, targetId)) return null;
  const campaign = await storage.getCampaign(campaignId);
  const target = await storage.getTarget(targetId);
  if (!campaign || !target || campaign.organizationId !== target.organizationId ||
      campaign.status !== 'Active' || (campaign.endDate && campaign.endDate < new Date())) return null;
  const found = await pool.query('SELECT 1 FROM campaign_dispatch WHERE campaign_id=$1 AND target_id=$2 AND organization_id=$3', [campaignId,targetId,campaign.organizationId]);
  return found.rowCount ? { campaign, target, token: String(token) } : null;
}
async function record(req:Request,campaignId: number, targetId: number, event: 'opened' | 'clicked' | 'submitted') {
  if(await saveTrackingEvent(req,campaignId,targetId,event))return;
  if(event!=='opened') await queueRemediation(campaignId,targetId,event);
  // Column names come exclusively from this union, never request input.
  const column = event === 'opened' ? 'opened' : event === 'clicked' ? 'clicked' : 'submitted';
  await pool.query(`UPDATE campaign_results SET ${column}=true,${column}_at=COALESCE(${column}_at,now()),
    status=CASE WHEN submitted OR $3='submitted' THEN 'submitted' WHEN clicked OR $3='clicked' THEN 'clicked' ELSE 'opened' END,
    updated_at=now() WHERE campaign_id=$1 AND target_id=$2`, [campaignId,targetId,event]);
}
export function registerTrackingRoutes(app: Express) {
  app.get('/track', (_req,res) => res.status(410).send('Use the original simulation link'));
  app.get('/o/:campaignId/:targetId.gif', trackingLimiter, async (req,res) => {
    try {
      const ctx = await context(req);
      if (!ctx) return res.status(404).end();
      await record(req,ctx.campaign.id,ctx.target.id,'opened');
      res.setHeader('Cache-Control','no-store');
      res.type('gif').send(Buffer.from('R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7','base64'));
    } catch { res.status(500).end(); }
  });
  app.get('/c/:campaignId/:targetId', trackingLimiter, async (req,res) => {
    try {
      const ctx = await context(req);
      if (!ctx) return res.status(404).send('Simulation not found');
      await record(req,ctx.campaign.id,ctx.target.id,'clicked');
      // Always use the campaign's landing page; query parameters cannot redirect externally.
      res.redirect(`/l/${ctx.campaign.id}/${ctx.target.id}?token=${encodeURIComponent(ctx.token)}`);
    } catch { res.status(500).send('Unable to load simulation'); }
  });
  app.get('/l/:campaignId/:targetId', trackingLimiter, async (req,res) => {
    try {
      const ctx = await context(req);
      if (!ctx) return res.status(404).send('Simulation not found');
      const page = await campaignLanding(ctx.campaign);
      if (!page || page.organizationId !== ctx.campaign.organizationId) return res.status(404).send('Page not found');
      await record(req,ctx.campaign.id,ctx.target.id,'clicked');
      const hidden = `<input type="hidden" name="campaignId" value="${ctx.campaign.id}"><input type="hidden" name="targetId" value="${ctx.target.id}"><input type="hidden" name="token" value="${ctx.token}">`;
      let html = sanitizeHtml(page.htmlContent, {
        allowedTags: sanitizeHtml.defaults.allowedTags.concat(['html','head','body','style','form','input','button','label','img','meta']),
        allowedAttributes: { '*': ['class','style','id'], input: ['type','name','placeholder','required','value'], form: ['method'], img: ['src','alt','width','height'], a: ['href'] },
      });
      html = html.replace(/<form[^>]*>/gi, `<form method="post" action="/l/submit">${hidden}`);
      res.setHeader('Content-Security-Policy', "sandbox allow-forms allow-same-origin; default-src 'none'; img-src https: data:; style-src 'unsafe-inline'; form-action 'self'; base-uri 'none'");
      res.setHeader('Cache-Control','no-store');
      res.type('html').send(html);
    } catch { res.status(500).send('Unable to load simulation'); }
  });
  app.post('/l/submit', trackingLimiter, async (req,res) => {
    try {
      const ctx = await context(req,true);
      if (!ctx) return res.status(404).send('Simulation not found');
      const page = await campaignLanding(ctx.campaign);
      if (!page?.captureData || page.organizationId !== ctx.campaign.organizationId) return res.status(400).send('Capture disabled');
      const evidence: Record<string,unknown> = { submitted: true };
      if (page.capturePasswords) {
        const password = Object.entries(req.body).find(([key]) => /pass(word)?/i.test(key))?.[1];
        if (typeof password === 'string' && password.length <= 1024) evidence.encryptedPassword = await SecretsService.encrypt(ctx.campaign.organizationId,password);
      }
      await record(req,ctx.campaign.id,ctx.target.id,'submitted');
      await pool.query('UPDATE campaign_results SET submitted_data=$3 WHERE campaign_id=$1 AND target_id=$2', [ctx.campaign.id,ctx.target.id,JSON.stringify(evidence)]);
      res.type('html').send(trainingFeedback(page));
    } catch { res.status(500).send('Unable to record submission'); }
  });
}
