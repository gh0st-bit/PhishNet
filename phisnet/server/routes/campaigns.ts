import ExcelJS from 'exceljs';
import {unknownTemplateVariables} from '../services/template-validation';
import { csvCell } from '../utils/report-exporter-enhanced';
import { domainReadiness } from '../services/delivery-preflight';
import { resolveAudience } from '../services/audience';
import { pool } from '../db';
import type { Express } from 'express';
import { isAuthenticated, hasOrganization,isAdminOrOrgAdmin } from '../auth';
import { storage } from '../storage';
import { insertCampaignSchema } from '@shared/schema';
import { sendCampaignEmails } from '../services/email-service';
import { AuditService } from '../services/audit.service';
import { NotificationService } from '../services/notification-service';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { z } from 'zod';

function assertUser(user: Express.User | undefined): asserts user is Express.User {
  if (!user) {
    throw new Error('User not authenticated');
  }
}

export function registerCampaignRoutes(app: Express) {
  // Get recent campaigns for dashboard
  app.get("/api/campaigns/recent", isAuthenticated, hasOrganization, async (req, res) => {
    try {
      assertUser(req.user);
      const campaigns = await storage.listCampaigns(req.user.organizationId);
      const recentCampaigns = campaigns.slice(0, 5);
      res.json({ campaigns: recentCampaigns });
    } catch (error) {
      console.error('Error fetching recent campaigns:', error);
      res.status(500).json({ message: "Error fetching recent campaigns" });
    }
  });

  app.get('/api/campaigns/summary',isAuthenticated,hasOrganization,async(req,res)=> {
    const {rows:[summary]}=await pool.query(`SELECT (SELECT count(*)::int FROM campaigns WHERE organization_id=$1 AND status='Active') AS active,
      count(*) FILTER(WHERE clicked)::int AS clicks,count(*) FILTER(WHERE opened)::int AS opens,count(*) FILTER(WHERE sent)::int AS sent
      FROM campaign_results WHERE organization_id=$1`,[req.user!.organizationId]);
    res.json({...summary,openRate:summary.sent?summary.opens/summary.sent*100:0});
  });
  app.post('/api/campaigns/preflight',isAuthenticated,hasOrganization,async(req,res)=> {
    const parsed=insertCampaignSchema.safeParse(req.body);if(!parsed.success)return res.status(400).json({message:'Invalid campaign details',errors:parsed.error.issues});
    const client=await pool.connect();
    try {
      await client.query('BEGIN');const org=req.user!.organizationId;
      const recipients=await resolveAudience(client,parsed.data.targetGroupId,org);
      const {rows:[profile]}=await client.query('SELECT id,from_email,delivery_mode FROM smtp_profiles WHERE id=$1 AND organization_id=$2',[parsed.data.smtpProfileId,org]);
      if(!profile)throw Object.assign(new Error('Sending profile not found'),{status:400});
      const template=(await client.query('SELECT html_content FROM email_templates WHERE id=$1 AND organization_id=$2',[parsed.data.emailTemplateId,org])).rows[0];
      const landing=(await client.query('SELECT id FROM landing_pages WHERE id=$1 AND organization_id=$2',[parsed.data.landingPageId,org])).rows[0];
      if(!template||!landing)throw Object.assign(new Error('Choose a template and landing page in this organization'),{status:400});
      const unknown=unknownTemplateVariables(template.html_content);
      const domains=await domainReadiness(client,org,profile.from_email,recipients);
      await client.query('COMMIT');res.json({recipients:recipients.length,domains,mode:profile.delivery_mode,unknownVariables:unknown,workerPaused:process.env.WORKER_DELIVERY_PAUSED==='true',checks:[{name:'Audience has recipients',passed:recipients.length>0},{name:'Verified domains',passed:domains.ready},{name:'Template variables are supported',passed:unknown.length===0},{name:'Delivery is enabled',passed:process.env.MAIL_TRANSPORT==='sink'||process.env.SIMULATION_EXTERNAL_DELIVERY_ENABLED==='true'}],testMode:process.env.MAIL_TRANSPORT==='sink'});
    }catch(error:any){await client.query('ROLLBACK');res.status(error.status||400).json({message:error.message||'Preflight failed'});}
    finally{client.release();}
  });
  // List all campaigns
  app.get("/api/campaigns", isAuthenticated, async (req, res) => {
    try {
      assertUser(req.user);
      const page=Math.max(1,Number(req.query.page)||1);const limit=Math.min(100,Math.max(1,Number(req.query.limit)||50));
      const {rows}=await pool.query(`SELECT c.id,c.name,lower(c.status) AS status,c.created_at,c.organization_id AS "organizationId",g.name AS "targetGroup",
        COALESCE((SELECT count(*)::int FROM campaign_dispatch d WHERE d.campaign_id=c.id),0) AS queued_targets,
        (SELECT count(DISTINCT lower(t.email))::int FROM targets t WHERE t.group_id=c.target_group_id AND t.organization_id=c.organization_id) AS audience_targets,
        COALESCE(metrics.opened,0)::int AS opened,COALESCE(metrics.clicked,0)::int AS clicked,count(*) OVER()::int AS total
        FROM campaigns c LEFT JOIN groups g ON g.id=c.target_group_id
        LEFT JOIN LATERAL(SELECT count(*) FILTER(WHERE opened) AS opened,count(*) FILTER(WHERE clicked) AS clicked FROM campaign_results r WHERE r.campaign_id=c.id) metrics ON true
        WHERE c.organization_id=$1 ORDER BY c.created_at DESC,c.id DESC LIMIT $2 OFFSET $3`,[req.user.organizationId,limit,(page-1)*limit]);
      res.json({campaigns:rows.map(({queued_targets,audience_targets,total,...row})=>({...row,targets:queued_targets||audience_targets})),pagination:{page,limit,total:rows[0]?.total||0}});
    } catch (error) {
      console.error('Error fetching campaigns:', error);
      res.status(500).json({ message: "Error fetching campaigns" });
    }
  });

  app.get('/api/campaigns/:id/events',isAuthenticated,hasOrganization,async(req,res)=> {
    const campaign=await storage.getCampaign(Number(req.params.id));
    if(!campaign||campaign.organizationId!==req.user!.organizationId)return res.status(404).json({message:'Campaign not found'});
    const {rows}=await pool.query('SELECT event_type,suspected_automated,target_id,created_at FROM campaign_events WHERE campaign_id=$1 AND organization_id=$2 ORDER BY created_at DESC LIMIT 200',[campaign.id,req.user!.organizationId]);res.json({events:rows});
  });

  // Create a new campaign
  app.post("/api/campaigns", isAuthenticated, hasOrganization, async (req, res) => {
    try {

      assertUser(req.user);
      
      // Validate the data
      let validatedData;
      try {
        validatedData = insertCampaignSchema.parse(req.body);
      } catch (validationError) {
        if (validationError instanceof z.ZodError) {
          console.error("Campaign validation errors:", validationError.issues);
          return res.status(400).json({ 
            message: "Validation error", 
            errors: validationError.issues 
          });
        }
        throw validationError;
      }
      
      // Validate that referenced objects exist and belong to user's organization
      const targetGroup = await storage.getGroup(Number(validatedData.targetGroupId));
      if (!targetGroup || targetGroup.organizationId !== req.user.organizationId) {
        return res.status(400).json({ message: "Invalid target group" });
      }
      
      const smtpProfile = await storage.getSmtpProfile(Number(validatedData.smtpProfileId));
      if (!smtpProfile || smtpProfile.organizationId !== req.user.organizationId) {
        return res.status(400).json({ message: "Invalid SMTP profile" });
      }
      
      const emailTemplate = await storage.getEmailTemplate(Number(validatedData.emailTemplateId));
      const emailTemplateOrgId = emailTemplate ? ((emailTemplate as any).organizationId ?? (emailTemplate as any).organization_id) : undefined;
      if (!emailTemplate || emailTemplateOrgId !== req.user.organizationId) {
        return res.status(400).json({ message: "Invalid email template" });
      }
      
      const landingPage = await storage.getLandingPage(Number(validatedData.landingPageId));
      if (!landingPage || landingPage.organizationId !== req.user.organizationId) {
        return res.status(400).json({ message: "Invalid landing page" });
      }
      
      // Create the campaign
      const campaign = await storage.createCampaign(
        req.user.organizationId, 
        req.user.id, 
        {
          ...validatedData,
          organizationId: req.user.organizationId,
          targetGroupId: Number(validatedData.targetGroupId),
          smtpProfileId: Number(validatedData.smtpProfileId),
          emailTemplateId: Number(validatedData.emailTemplateId),
          landingPageId: Number(validatedData.landingPageId),
          scheduledAt: validatedData.scheduledAt || null,
          endDate: validatedData.endDate || null,
          status: "Draft",
        }
      );
      
      // Audit log campaign creation
      AuditService.log({
        context: {
          userId: req.user.id,
          organizationId: req.user.organizationId,
          ip: req.ip || req.socket.remoteAddress,
          userAgent: req.get("user-agent"),
        },
        action: "campaign.create",
        resource: "campaign",
        resourceId: campaign.id,
        metadata: { name: campaign.name },
      }).catch((err) => console.error("[Audit] Failed to log campaign creation:", err));
      
      // Create organization-wide notification that a campaign was created
      try {
        await NotificationService.createOrganizationNotification({
          organizationId: req.user.organizationId,
          type: "campaign_created",
          title: "Campaign created",
          message: `Campaign "${campaign.name}" has been created.`,
          priority: "medium",
          actionUrl: `/campaigns/${campaign.id}`,
          metadata: {campaignId:campaign.id},
        });
      } catch (notifyErr) {
        console.error("Failed to create campaign created notification:", notifyErr);
      }
      
      res.status(201).json(campaign);
    } catch (error) {
      console.error("Campaign creation error:", error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ 
          message: "Validation error", 
          errors: error.issues 
        });
      }
      res.status(500).json({ message: "Error creating campaign" });
    }
  });

  // Launch campaign immediately
  app.post("/api/campaigns/:id/launch", isAuthenticated, hasOrganization, async (req, res) => {
    try {
      assertUser(req.user);
      const campaignId = Number.parseInt(req.params.id, 10);
      const campaign = await storage.getCampaign(campaignId);
      if (!campaign || campaign.organizationId !== req.user.organizationId) {
        return res.status(404).json({ message: "Campaign not found" });
      }

      const result = await sendCampaignEmails(campaignId, req.user.organizationId);
      
      // Audit log campaign launch
      AuditService.log({
        context: {
          userId: req.user.id,
          organizationId: req.user.organizationId,
          ip: req.ip || req.socket.remoteAddress,
          userAgent: req.get("user-agent"),
        },
        action: "campaign.launch",
        resource: "campaign",
        resourceId: campaignId,
        metadata: { name: campaign.name },
      }).catch((err) => console.error("[Audit] Failed to log campaign launch:", err));
      
      return res.status(202).json({ message: 'Campaign queued', result });
    } catch (error: any) {
      return res.status(error.status || 500).json({ message: error.status ? error.message : 'Error launching campaign' });
    }
  });

  for (const action of ['pause', 'resume', 'cancel'] as const) {
    app.post(`/api/campaigns/:id/${action}`, isAuthenticated, hasOrganization, async (req, res) => {
      const expected = action === 'resume' ? ['Paused'] : action === 'pause' ? ['Active'] : ['Draft', 'Scheduled', 'Active', 'Paused'];
      const status = action === 'pause' ? 'Paused' : action === 'resume' ? 'Active' : 'Cancelled';
      try {
        const result = await pool.query('UPDATE campaigns SET status=$3,updated_at=now() WHERE id=$1 AND organization_id=$2 AND status=ANY($4::text[]) RETURNING id,status', [Number(req.params.id),req.user!.organizationId,status,expected]);
        if (!result.rowCount) return res.status(409).json({ message: 'Campaign missing or action unavailable in its current state' });
        res.json(result.rows[0]);
      } catch { res.status(500).json({ message: 'Unable to change campaign state' }); }
    });
  }
  app.post('/api/campaigns/:id/recipients/:targetId/reconcile',isAuthenticated,hasOrganization,isAdminOrOrgAdmin,async(req,res)=> {
    const parsed=z.object({decision:z.enum(['mark_accepted','mark_failed','retry']),acknowledgeDuplicateRisk:z.boolean().optional()}).safeParse(req.body);
    if(!parsed.success || parsed.data.decision==='retry'&&!parsed.data.acknowledgeDuplicateRisk)return res.status(400).json({message:'Choose a resolution and acknowledge duplicate-delivery risk before retrying'});
    const client=await pool.connect();
    try {
      await client.query('BEGIN');
      const {rows:[job]}=await client.query("SELECT id FROM campaign_dispatch WHERE campaign_id=$1 AND target_id=$2 AND organization_id=$3 AND state='ambiguous' FOR UPDATE",[Number(req.params.id),Number(req.params.targetId),req.user!.organizationId]);
      if(!job)throw Object.assign(new Error('Ambiguous delivery not found'),{status:404});
      const state=parsed.data.decision==='mark_accepted'?'accepted':parsed.data.decision==='mark_failed'?'failed':'queued';
      await client.query('UPDATE campaign_dispatch SET state=$2,available_at=now(),updated_at=now() WHERE id=$1',[job.id,state]);
      if(state==='accepted')await client.query("UPDATE campaign_results SET sent=true,sent_at=COALESCE(sent_at,now()),status=CASE WHEN submitted THEN 'submitted' WHEN clicked THEN 'clicked' WHEN opened THEN 'opened' ELSE 'sent' END WHERE campaign_id=$1 AND target_id=$2",[Number(req.params.id),Number(req.params.targetId)]);
      else await client.query('UPDATE campaign_results SET status=$3 WHERE campaign_id=$1 AND target_id=$2 AND sent=false',[Number(req.params.id),Number(req.params.targetId),state]);
      await client.query("INSERT INTO audit_logs(organization_id,user_id,action,resource,resource_id,metadata) VALUES($1,$2,'delivery.reconcile','campaign_dispatch',$3,$4)",[req.user!.organizationId,req.user!.id,job.id,JSON.stringify({decision:parsed.data.decision})]);
      await client.query('COMMIT');res.json({state});
    }catch(error:any){await client.query('ROLLBACK');res.status(error.status||500).json({message:error.status?error.message:'Unable to reconcile delivery'});}
    finally{client.release();}
  });
  app.get('/api/campaigns/:id/delivery', isAuthenticated, hasOrganization, async (req,res) => {
    try {
      const campaign = await storage.getCampaign(Number(req.params.id));
      if (!campaign || campaign.organizationId !== req.user!.organizationId) return res.status(404).json({ message: 'Campaign not found' });
      const { rows } = await pool.query('SELECT state,provider_state,count(*)::int AS count FROM campaign_dispatch WHERE campaign_id=$1 AND organization_id=$2 GROUP BY state,provider_state',[campaign.id,req.user!.organizationId]);
      const ambiguous=(await pool.query("SELECT target_id,snapshot->>'to' AS email,error_code FROM campaign_dispatch WHERE campaign_id=$1 AND organization_id=$2 AND state='ambiguous' ORDER BY id LIMIT 50",[campaign.id,req.user!.organizationId])).rows;
      res.json({ status:campaign.status,ambiguous,states: rows, note: 'Accepted means the sending transport accepted the message; it does not confirm inbox delivery.' });
    } catch { res.status(500).json({ message: 'Unable to fetch delivery state' }); }
  });

  // Get a specific campaign by ID
  app.get("/api/campaigns/:id", isAuthenticated, hasOrganization, async (req, res) => {
    try {
      assertUser(req.user);
      const campaignId = Number.parseInt(req.params.id, 10);
      const campaign = await storage.getCampaign(campaignId);
      
      if (!campaign || campaign.organizationId !== req.user.organizationId) {
        return res.status(404).json({ message: "Campaign not found" });
      }
      
      // Get related data
      const group = await storage.getGroup(campaign.targetGroupId);
      const template = await storage.getEmailTemplate(campaign.emailTemplateId);
      const landingPage = await storage.getLandingPage(campaign.landingPageId);
      const smtpProfile = await storage.getSmtpProfile(campaign.smtpProfileId);
      const targets = await storage.listTargets(campaign.targetGroupId);
      
      // Get campaign results
      const results = await storage.listCampaignResults(campaignId);
      
      // Calculate metrics
      const sentCount = results.filter(r => r.sent).length;
      const openedCount = results.filter(r => r.opened).length;
      const clickedCount = results.filter(r => r.clicked).length;
      
      const enrichedCampaign = {
        ...campaign,
        targetGroup: group?.name,
        emailTemplate: template ? { id: (template as any).id, name: (template as any).name } : null,
        landingPage: landingPage ? { id: landingPage.id, name: landingPage.name } : null,
        smtpProfile: smtpProfile ? { id: smtpProfile.id, name: smtpProfile.name } : null,
        totalTargets: targets.length,
        sentCount,
        openRate: sentCount > 0 ? Math.round((openedCount / sentCount) * 100) : 0,
        clickRate: sentCount > 0 ? Math.round((clickedCount / sentCount) * 100) : 0,
      };
      
      res.json(enrichedCampaign);
    } catch (error) {
      console.error("Error fetching campaign:", error);
      res.status(500).json({ message: "Error fetching campaign" });
    }
  });

  // Update a campaign
  app.put("/api/campaigns/:id", isAuthenticated, hasOrganization, async (req, res) => {
    try {
      assertUser(req.user);
      const campaignId = Number.parseInt(req.params.id, 10);
      const campaign = await storage.getCampaign(campaignId);
      
      if (!campaign || campaign.organizationId !== req.user.organizationId) {
        return res.status(404).json({ message: "Campaign not found" });
      }
      
      if (campaign.status !== "Draft") return res.status(409).json({ message: "Launched campaigns cannot be edited" });
      const validatedData = insertCampaignSchema.parse({...campaign, ...req.body});
      
      // Validate that referenced objects exist and belong to user's organization
      const targetGroup = await storage.getGroup(Number(validatedData.targetGroupId));
      if (!targetGroup || targetGroup.organizationId !== req.user.organizationId) {
        return res.status(400).json({ message: "Invalid target group" });
      }
      
      const smtpProfile = await storage.getSmtpProfile(Number(validatedData.smtpProfileId));
      if (!smtpProfile || smtpProfile.organizationId !== req.user.organizationId) {
        return res.status(400).json({ message: "Invalid SMTP profile" });
      }
      
      const emailTemplate = await storage.getEmailTemplate(Number(validatedData.emailTemplateId));
      const emailTemplateOrgId2 = emailTemplate ? ((emailTemplate as any).organizationId ?? (emailTemplate as any).organization_id) : undefined;
      if (!emailTemplate || emailTemplateOrgId2 !== req.user.organizationId) {
        return res.status(400).json({ message: "Invalid email template" });
      }
      
      const landingPage = await storage.getLandingPage(Number(validatedData.landingPageId));
      if (!landingPage || landingPage.organizationId !== req.user.organizationId) {
        return res.status(400).json({ message: "Invalid landing page" });
      }
      
      const updatedCampaign = await storage.updateCampaign(campaignId, {
        ...validatedData,
        name: validatedData.name,
        targetGroupId: Number(validatedData.targetGroupId),
        smtpProfileId: Number(validatedData.smtpProfileId),
        emailTemplateId: Number(validatedData.emailTemplateId),
        landingPageId: Number(validatedData.landingPageId),
        scheduledAt: validatedData.scheduledAt ? new Date(validatedData.scheduledAt) : null,
        endDate: validatedData.endDate ? new Date(validatedData.endDate) : null,
      });
      
      // Audit log campaign update
      AuditService.log({
        context: {
          userId: req.user.id,
          organizationId: req.user.organizationId,
          ip: req.ip || req.socket.remoteAddress,
          userAgent: req.get("user-agent"),
        },
        action: "campaign.update",
        resource: "campaign",
        resourceId: campaignId,
        metadata: { name: validatedData.name },
      }).catch((err) => console.error("[Audit] Failed to log campaign update:", err));
      
      res.json(updatedCampaign);
    } catch (error) {
      console.error("Error updating campaign:", error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ 
          message: "Validation error", 
          errors: error.issues 
        });
      }
      res.status(500).json({ message: "Error updating campaign" });
    }
  });

  // Delete a campaign
  app.delete("/api/campaigns/:id", isAuthenticated, hasOrganization, async (req, res) => {
    try {
      assertUser(req.user);
      const campaignId = Number.parseInt(req.params.id, 10);
      const campaign = await storage.getCampaign(campaignId);
      
      if (!campaign || campaign.organizationId !== req.user.organizationId) {
        return res.status(404).json({ message: "Campaign not found" });
      }
      
      // Audit log campaign deletion
      AuditService.log({
        context: {
          userId: req.user.id,
          organizationId: req.user.organizationId,
          ip: req.ip || req.socket.remoteAddress,
          userAgent: req.get("user-agent"),
        },
        action: "campaign.delete",
        resource: "campaign",
        resourceId: campaignId,
        metadata: { name: campaign.name },
      }).catch((err) => console.error("[Audit] Failed to log campaign deletion:", err));
      
      await storage.deleteCampaign(campaignId);
      res.json({ success: true });
    } catch (error) {
      console.error("Error deleting campaign:", error);
      res.status(500).json({ message: "Error deleting campaign" });
    }
  });

  // Get campaign results
  app.get("/api/campaigns/:id/results", isAuthenticated, hasOrganization, async (req, res) => {
    try {
      assertUser(req.user);
      const campaignId = Number.parseInt(req.params.id, 10);
      const campaign = await storage.getCampaign(campaignId);
      
      if (!campaign || campaign.organizationId !== req.user.organizationId) {
        return res.status(404).json({ message: "Campaign not found" });
      }
      
      const results = await storage.listCampaignResults(campaignId);
      
      // Enrich results with target data
      const enrichedResults = [];
      for (const result of results) {
        const target = await storage.getTarget(result.targetId);
        enrichedResults.push({
          ...result,
          target: target ? {
            id: target.id,
            firstName: target.firstName,
            lastName: target.lastName,
            email: target.email,
            position: target.position
          } : null
        });
      }
      
      res.json(enrichedResults);
    } catch (error) {
      console.error("Error fetching campaign results:", error);
      res.status(500).json({ message: "Error fetching campaign results" });
    }
  });

  // Export campaign results
  app.post("/api/campaigns/:id/export", isAuthenticated, hasOrganization, async (req, res) => {
    try {
      assertUser(req.user);
      const campaignId = Number.parseInt(req.params.id, 10);
      const { format = 'csv' } = req.body; // Get format from request body
      const campaign = await storage.getCampaign(campaignId);
      
      if (!campaign || campaign.organizationId !== req.user.organizationId) {
        return res.status(404).json({ message: "Campaign not found" });
      }
      
      const results = await storage.listCampaignResults(campaignId);
      const targets = await storage.listTargets(campaign.targetGroupId);
      
      // Map results with target data
      const exportData = results.map(r => {
        const target = targets.find(t => t.id === r.targetId);
        return {
          'Target Email': target?.email || '',
          'Target Name': target ? `${target.firstName} ${target.lastName}` : '',
          'Position': target?.position || '',
          'Status': r.status,
          'Sent': r.sent ? 'Yes' : 'No',
          'Sent At': r.sentAt ? new Date(r.sentAt).toLocaleString() : '',
          'Opened': r.opened ? 'Yes' : 'No',
          'Opened At': r.openedAt ? new Date(r.openedAt).toLocaleString() : '',
          'Clicked': r.clicked ? 'Yes' : 'No',
          'Clicked At': r.clickedAt ? new Date(r.clickedAt).toLocaleString() : '',
          'Submitted Data': r.submitted ? 'Yes' : 'No',
          'Submitted At': r.submittedAt ? new Date(r.submittedAt).toLocaleString() : ''
        };
      });
      
      // Handle different export formats
      const formatLower = format.toLowerCase();
      
      if (formatLower === 'json') {
        // JSON format
        res.setHeader('Content-Type', 'application/json');
        res.setHeader('Content-Disposition', `attachment; filename="campaign-${campaignId}-results.json"`);
        return res.json({
          campaign: {
            id: campaign.id,
            name: campaign.name,
            status: campaign.status,
            createdAt: campaign.createdAt
          },
          results: exportData,
          exportedAt: new Date().toISOString()
        });
      } else if (formatLower === 'csv') {
        // CSV format
        if (exportData.length === 0) {
          return res.status(400).json({ message: "No data to export" });
        }
        let csv = Object.keys(exportData[0]).join(',') + '\n';
        for (const row of exportData) {
          csv += Object.values(row).map(csvCell).join(',') + '\n';
        }
        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', `attachment; filename="campaign-${campaignId}-results.csv"`);
        return res.send(csv);
      } else if (formatLower === 'excel' || formatLower === 'xlsx') {
        const workbook=new ExcelJS.Workbook();const sheet=workbook.addWorksheet('Campaign results');
        if(exportData.length){sheet.addRow(Object.keys(exportData[0]));for(const row of exportData)sheet.addRow(Object.values(row));}
        res.setHeader('Content-Type','application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition',`attachment; filename="campaign-${campaignId}-results.xlsx"`);
        return res.send(Buffer.from(await workbook.xlsx.writeBuffer()));
      } else if (formatLower === 'pdf') {
        // PDF format - build a structured document via jsPDF
        const doc = new jsPDF({ orientation: 'portrait', unit: 'pt', format: 'a4' });
        const pageWidth = doc.internal.pageSize.getWidth();
        const margin = 48;

        // Header
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(20);
        doc.text('PhishNet Campaign Report', pageWidth / 2, margin, { align: 'center' });

        doc.setFontSize(12);
        doc.setFont('helvetica', 'normal');
        doc.text(`Campaign: ${campaign.name}`, margin, margin + 30);
        doc.text(`Campaign ID: ${campaign.id}`, margin, margin + 46);
        doc.text(`Status: ${(campaign.status || 'Unknown').toString()}`, margin, margin + 62);
        doc.text(`Generated: ${new Date().toLocaleString()}`, margin, margin + 78);

        const sentCount = results.filter(r => r.sent).length;
        const openedCount = results.filter(r => r.opened).length;
        const clickedCount = results.filter(r => r.clicked).length;
        const submittedCount = results.filter(r => r.submitted).length;

        doc.text(`Total Targets: ${targets.length}`, margin, margin + 110);
        doc.text(`Emails Sent: ${sentCount}`, margin, margin + 126);
        doc.text(`Opened: ${openedCount}`, margin, margin + 142);
        doc.text(`Clicked: ${clickedCount}`, margin, margin + 158);
        doc.text(`Submitted Data: ${submittedCount}`, margin, margin + 174);

        const tableStartY = margin + 200;
        const tableBody = exportData.map(row => ([
          row['Target Name'] || '',
          row['Target Email'] || '',
          row['Status'] || '',
          row['Sent At'] || '',
          row['Opened At'] || '',
          row['Clicked At'] || '',
          row['Submitted At'] || ''
        ]));

        if (tableBody.length > 0) {
          autoTable(doc, {
            startY: tableStartY,
            head: [[
              'Target Name',
              'Email',
              'Status',
              'Sent At',
              'Opened At',
              'Clicked At',
              'Submitted At'
            ]],
            body: tableBody,
            styles: { fontSize: 9 },
            headStyles: {
              fillColor: [255, 140, 0],
              textColor: [255, 255, 255],
              fontStyle: 'bold'
            },
            alternateRowStyles: { fillColor: [248, 248, 248] },
            margin: { left: margin, right: margin }
          });
        } else {
          doc.setFont('helvetica', 'italic');
          doc.setFontSize(11);
          doc.text('No campaign activity has been recorded yet for this campaign.', margin, tableStartY);
        }

        const pdfBuffer = Buffer.from(doc.output('arraybuffer'));
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename="campaign-${campaignId}-results.pdf"`);
        return res.send(pdfBuffer);
      } else {
        return res.status(400).json({ message: "Invalid format. Supported formats: pdf, excel, json, csv" });
      }
    } catch (error) {
      console.error("Error exporting campaign results:", error);
      res.status(500).json({ message: "Error exporting campaign results" });
    }
  });
}
