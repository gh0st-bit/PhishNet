import type { Express } from 'express';
import { storage } from '../storage';
import { NotificationService } from '../services/notification-service';

export function registerTrackingRoutes(app: Express) {
  // Legacy tracking route redirect
  app.get('/track', async (req, res) => {
    const cParam = req.query.c;
    const tParam = req.query.t;
    let cStr = '';
    let tStr = '';
    if (typeof cParam === 'string') cStr = cParam;
    else if (Array.isArray(cParam) && typeof cParam[0] === 'string') cStr = cParam[0];
    if (typeof tParam === 'string') tStr = tParam;
    else if (Array.isArray(tParam) && typeof tParam[0] === 'string') tStr = tParam[0];
    const c = Number.parseInt(cStr, 10);
    const t = Number.parseInt(tStr, 10);
    if (!Number.isFinite(c) || !Number.isFinite(t)) {
      return res.status(400).send('Bad Request');
    }
    return res.redirect(302, `/l/${c}/${t}`);
  });

  // Open tracking pixel (1x1 transparent gif)
  app.get('/o/:campaignId/:targetId.gif', async (req, res) => {
    try {
      const campaignId = Number.parseInt(req.params.campaignId, 10);
      const targetId = Number.parseInt(req.params.targetId, 10);
      if (!Number.isFinite(campaignId) || !Number.isFinite(targetId)) {
        return res.status(400).end();
      }
      const campaign = await storage.getCampaign(campaignId);
      const target = await storage.getTarget(targetId);
      if (!campaign || !target || campaign.organizationId !== target.organizationId) {
        return res.status(404).end();
      }
      
      // Idempotent update: only set opened if not already opened
      try {
        const existing = await storage.updateCampaignResultByCampaignAndTarget(campaignId, targetId, {} as any);
        let wasOpened = false;
        
        if (existing) {
          const newData: any = {};
          if (!existing.opened) {
            newData.opened = true;
            newData.openedAt = new Date();
            wasOpened = true;
          }
          // Only set status to opened if current status is pending or sent
          if (['pending', 'sent'].includes(existing.status)) {
            newData.status = 'opened';
          }
          if (Object.keys(newData).length > 0) {
            await storage.updateCampaignResultByCampaignAndTarget(campaignId, targetId, newData);
          }
        } else {
          await storage.createCampaignResult({
            campaignId, targetId, organizationId: campaign.organizationId,
            sent: false, opened: true, openedAt: new Date(), clicked: false, submitted: false,
            status: 'opened'
          } as any);
          wasOpened = true;
        }
        
        // If this is a new open event, create a notification
        if (wasOpened) {
          try {
            const target = await storage.getTarget(targetId);
            const users = await storage.listUsers(campaign.organizationId);
            
            if (users && users.length > 0) {
              for (const user of users) {
                if (user.isAdmin) {
                  await NotificationService.createNotification({
                    userId: user.id,
                    organizationId: campaign.organizationId,
                    type: 'campaign',
                    title: 'Email Opened',
                    message: `${target?.firstName ?? ''} ${target?.lastName ?? ''} (${target?.email ?? ''}) opened the email from campaign "${campaign.name}".`,
                    priority: 'medium',
                    actionUrl: `/campaigns/${campaignId}`,
                    metadata: {
                      campaignId,
                      targetId,
                      targetEmail: target?.email ?? '',
                      eventType: 'opened'
                    }
                  });
                }
              }
            }
          } catch (notifError) {
            console.error('Error creating open notification:', notifError);
          }
        }
      } catch (e) {
        console.error('Open pixel record error:', e);
      }

      // 1x1 transparent GIF bytes
      const gif = Buffer.from('R0lGODlhAQABAIAAAP///////yH5BAEAAAAALAAAAAABAAEAAAIBRAA7', 'base64');
      res.setHeader('Content-Type', 'image/gif');
      res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
      res.setHeader('Pragma', 'no-cache');
      res.setHeader('Expires', '0');
      return res.status(200).end(gif);
    } catch (e) {
      console.error('Open pixel error:', e);
      return res.status(500).end();
    }
  });

  // Click tracking redirect
  app.get('/c/:campaignId/:targetId', async (req, res) => {
    try {
      const campaignId = Number.parseInt(req.params.campaignId, 10);
      const targetId = Number.parseInt(req.params.targetId, 10);
      const encoded = String((req.query.u as string) ?? '');
      if (!Number.isFinite(campaignId) || !Number.isFinite(targetId) || !encoded) {
        return res.status(400).send('Bad Request');
      }
      const campaign = await storage.getCampaign(campaignId);
      const target = await storage.getTarget(targetId);
      if (!campaign || !target || campaign.organizationId !== target.organizationId) {
        return res.status(404).send('Not Found');
      }
      
      let url: string | undefined;
      try {
        const decoded = Buffer.from(decodeURIComponent(encoded), 'base64').toString('utf8');
        if (/^https?:\/\//i.test(decoded)) url = decoded;
      } catch {}
      if (!url) return res.status(400).send('Invalid URL');
      
      try {
        const existing = await storage.updateCampaignResultByCampaignAndTarget(campaignId, targetId, {} as any);
        let wasClicked = false;
        
        if (existing) {
          const newData: any = {};
          if (!existing.clicked) {
            newData.clicked = true;
            newData.clickedAt = new Date();
            wasClicked = true;
          }
          // Do not downgrade submitted
          if (existing.status !== 'submitted') {
            if (['pending', 'sent', 'opened'].includes(existing.status)) {
              newData.status = 'clicked';
            }
          }
          if (Object.keys(newData).length > 0) {
            await storage.updateCampaignResultByCampaignAndTarget(campaignId, targetId, newData);
          }
        } else {
          await storage.createCampaignResult({
            campaignId, targetId, organizationId: campaign.organizationId,
            sent: false, opened: false, clicked: true, clickedAt: new Date(), submitted: false,
            status: 'clicked'
          } as any);
          wasClicked = true;
        }
        
        // If this is a new click event, create a notification
        if (wasClicked) {
          try {
            const target = await storage.getTarget(targetId);
            const users = await storage.listUsers(campaign.organizationId);
            
            if (users && users.length > 0) {
              for (const user of users) {
                if (user.isAdmin) {
                  await NotificationService.createNotification({
                    userId: user.id,
                    organizationId: campaign.organizationId,
                    type: 'campaign',
                    title: 'Link Clicked',
                    message: `${target?.firstName ?? ''} ${target?.lastName ?? ''} (${target?.email ?? ''}) clicked a link in the email from campaign "${campaign.name}".`,
                    priority: 'high',
                    actionUrl: `/campaigns/${campaignId}`,
                    metadata: {
                      campaignId,
                      targetId,
                      targetEmail: target?.email ?? '',
                      eventType: 'clicked',
                      url: url
                    }
                  });
                }
              }
            }
          } catch (notifError) {
            console.error('Error creating click notification:', notifError);
          }
        }
      } catch (e) {
        console.error('Click record error:', e);
      }
      return res.redirect(302, url);
    } catch (e) {
      console.error('Click redirect error:', e);
      return res.status(500).send('Server Error');
    }
  });

  // Public Landing Page rendering with form capture injection
  app.get('/l/:campaignId/:targetId', async (req, res) => {
    try {
      const campaignId = Number.parseInt(req.params.campaignId, 10);
      const targetId = Number.parseInt(req.params.targetId, 10);
      if (!Number.isFinite(campaignId) || !Number.isFinite(targetId)) {
        return res.status(400).send('Bad Request');
      }
      const campaign = await storage.getCampaign(campaignId);
      if (!campaign) return res.status(404).send('Not Found');
      const target = await storage.getTarget(targetId);
      if (!target) return res.status(404).send('Not Found');
      if (target.organizationId !== campaign.organizationId) return res.status(403).send('Forbidden');
      const page = await storage.getLandingPage(campaign.landingPageId);
      if (!page) return res.status(404).send('Not Found');
      
      const injection = `\n<script>(function(){try{var cid=${campaignId},tid=${targetId};document.querySelectorAll('form').forEach(function(f){try{f.method='POST';f.action='/l/submit?c='+cid+'&t='+tid;}catch(e){}});}catch(e){}})();</script>`;
      const html = (page.htmlContent || '<!doctype html><html><body></body></html>');
      const out = /<\/body\s*>/i.test(html) ? html.replace(/<\/body\s*>/i, injection + '</body>') : html + injection;
      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      return res.status(200).send(out);
    } catch (e) {
      console.error('Landing page render error:', e);
      return res.status(500).send('Server Error');
    }
  });

  // Public form submission capture
  app.post('/l/submit', async (req, res) => {
    try {
      const cParam = req.query.c;
      const tParam = req.query.t;
      let cStr = '';
      let tStr = '';
      if (typeof cParam === 'string') cStr = cParam;
      else if (Array.isArray(cParam) && typeof cParam[0] === 'string') cStr = cParam[0];
      if (typeof tParam === 'string') tStr = tParam;
      else if (Array.isArray(tParam) && typeof tParam[0] === 'string') tStr = tParam[0];
      const campaignId = Number.parseInt(cStr, 10);
      const targetId = Number.parseInt(tStr, 10);
      if (!Number.isFinite(campaignId) || !Number.isFinite(targetId)) {
        return res.status(400).send('Bad Request');
      }
      const campaign = await storage.getCampaign(campaignId);
      if (!campaign) return res.status(404).send('Not Found');
      const target = await storage.getTarget(targetId);
      if (!target) return res.status(404).send('Not Found');
      if (target.organizationId !== campaign.organizationId) return res.status(403).send('Forbidden');
      
      // Load landing page to honor capture flags
      const page = await storage.getLandingPage(campaign.landingPageId);
      const captureData = page?.captureData !== false;
      const capturePasswords = page?.capturePasswords === true;

      // Prepare submitted data according to flags
      const body: Record<string, any> = req.body || {};
      let submittedData: Record<string, any> | null = null;
      if (captureData) {
        if (capturePasswords) {
          submittedData = { ...body };
        } else {
          const filtered: Record<string, any> = {};
          for (const [k, v] of Object.entries(body)) {
            if (/passw|pwd/i.test(k)) continue;
            filtered[k] = v;
          }
          submittedData = filtered;
        }
      }

      // Update or create result row
      try {
        let wasSubmitted = false;
        const existing = await storage.updateCampaignResultByCampaignAndTarget(campaignId, targetId, {} as any);
        
        if ((existing && !existing.submitted) || !existing) {
          wasSubmitted = true;
        }
        
        const updated = await storage.updateCampaignResultByCampaignAndTarget(campaignId, targetId, {
          submitted: true,
          submittedAt: new Date(),
          submittedData: submittedData as any,
          status: 'submitted',
        } as any);
        
        if (!updated) {
          await storage.createCampaignResult({
            campaignId,
            targetId,
            organizationId: campaign.organizationId,
            sent: false,
            opened: false,
            clicked: false,
            submitted: true,
            submittedAt: new Date(),
            submittedData: submittedData as any,
            status: 'submitted',
          } as any);
        }
        
        // If this is a new submission event, create a notification
        if (wasSubmitted) {
          try {
            const target = await storage.getTarget(targetId);
            const users = await storage.listUsers(campaign.organizationId);
            
            if (users && users.length > 0) {
              for (const user of users) {
                if (user.isAdmin) {
                  await NotificationService.createNotification({
                    userId: user.id,
                    organizationId: campaign.organizationId,
                    type: 'campaign',
                    title: 'Form Submitted',
                    message: `${target?.firstName ?? ''} ${target?.lastName ?? ''} (${target?.email ?? ''}) submitted information on the landing page from campaign "${campaign.name}".`,
                    priority: 'urgent',
                    actionUrl: `/campaigns/${campaignId}`,
                    metadata: {
                      campaignId,
                      targetId,
                      targetEmail: target?.email ?? '',
                      eventType: 'submitted'
                    }
                  });
                }
              }
            }
          } catch (notifError) {
            console.error('Error creating form submission notification:', notifError);
          }
        }
      } catch (err) {
        console.error('Error recording submission:', err);
      }

      // Redirect if landing page has redirectUrl
      const page2 = page || (await storage.getLandingPage(campaign.landingPageId));
      if (page2?.redirectUrl) {
        return res.redirect(302, page2.redirectUrl);
      }
      
      return res.status(200).send('Thank you for your submission.');
    } catch (e) {
      console.error('Form submission error:', e);
      return res.status(500).send('Server Error');
    }
  });
}
