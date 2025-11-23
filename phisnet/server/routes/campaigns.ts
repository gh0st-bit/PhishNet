import type { Express } from 'express';
import { isAuthenticated, hasOrganization } from '../auth';
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

  // List all campaigns
  app.get("/api/campaigns", isAuthenticated, async (req, res) => {
    try {
      assertUser(req.user);
      const campaigns = await storage.listCampaigns(req.user.organizationId);
      
      const mapped = [];
      for (const c of campaigns) {
        const group = await storage.getGroup(c.targetGroupId);
        const targets = group ? await storage.listTargets(c.targetGroupId) : [];
        const results = await storage.listCampaignResults(c.id);
        const opened = results.filter(r => r.opened).length;
        const clicked = results.filter(r => r.clicked).length;
        
        mapped.push({
          id: c.id,
          name: c.name,
          status: (c.status || 'Draft').toString().toLowerCase(),
          created_at: c.createdAt instanceof Date ? c.createdAt.toISOString() : c.createdAt,
          targets: targets.length,
          opened,
          clicked,
          organizationId: c.organizationId,
          targetGroup: group?.name || 'Unknown',
        });
      }

      res.json({ campaigns: mapped });
    } catch (error) {
      console.error('Error fetching campaigns:', error);
      res.status(500).json({ message: "Error fetching campaigns" });
    }
  });

  // Create a new campaign
  app.post("/api/campaigns", isAuthenticated, hasOrganization, async (req, res) => {
    try {
      console.log("Campaign creation request body:", req.body);
      assertUser(req.user);
      
      // Validate the data
      let validatedData;
      try {
        validatedData = insertCampaignSchema.parse(req.body);
      } catch (validationError) {
        if (validationError instanceof z.ZodError) {
          console.error("Campaign validation errors:", validationError.errors);
          return res.status(400).json({ 
            message: "Validation error", 
            errors: validationError.errors 
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
        });
      } catch (notifyErr) {
        console.error("Failed to create campaign created notification:", notifyErr);
      }
      
      // If no schedule provided, send immediately in background
      if (!validatedData.scheduledAt) {
        const orgIdImmediate = req.user.organizationId;
        (async () => {
          try {
            await storage.updateCampaign(campaign.id, { status: 'Active' });
            const result = await sendCampaignEmails(campaign.id, orgIdImmediate);
            console.log(`Campaign ${campaign.id} sent:`, result);
          } catch (e) {
            console.error('Immediate campaign send failed:', e);
          }
        })();
      }

      res.status(201).json(campaign);
    } catch (error) {
      console.error("Campaign creation error:", error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ 
          message: "Validation error", 
          errors: error.errors 
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

      await storage.updateCampaign(campaignId, { status: 'Active' });
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
      
      return res.json({ message: 'Campaign launched', result });
    } catch (error) {
      console.error('Error launching campaign:', error);
      return res.status(500).json({ message: 'Error launching campaign' });
    }
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
        clickRate: openedCount > 0 ? Math.round((clickedCount / openedCount) * 100) : 0,
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
      
      const validatedData = insertCampaignSchema.parse(req.body);
      
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
          errors: error.errors 
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
          csv += Object.values(row).map(v => `"${String(v).replaceAll('"', '""')}"`).join(',') + '\n';
        }
        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', `attachment; filename="campaign-${campaignId}-results.csv"`);
        return res.send(csv);
      } else if (formatLower === 'excel' || formatLower === 'xlsx') {
        // Excel format (simplified - returns CSV with Excel MIME type for now)
        if (exportData.length === 0) {
          return res.status(400).json({ message: "No data to export" });
        }
        let csv = Object.keys(exportData[0]).join(',') + '\n';
        for (const row of exportData) {
          csv += Object.values(row).map(v => `"${String(v).replaceAll('"', '""')}"`).join(',') + '\n';
        }
        res.setHeader('Content-Type', 'application/vnd.ms-excel');
        res.setHeader('Content-Disposition', `attachment; filename="campaign-${campaignId}-results.xls"`);
        return res.send(csv);
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
