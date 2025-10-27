import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { setupAuth, isAuthenticated, isAdmin, hasOrganization, hashPassword, comparePasswords } from "./auth";
import { db } from "./db";
import { 
  campaigns, 
  campaignResults, 
  emailTemplates, 
  users, 
  rolesSchema,
  userRolesSchema,
  insertGroupSchema, 
  insertTargetSchema, 
  insertSmtpProfileSchema, 
  insertEmailTemplateSchema, 
  insertLandingPageSchema, 
  insertCampaignSchema,
  type User,
  DEFAULT_ROLES
} from "@shared/schema";
import { eq, and, sql, gte, lte } from "drizzle-orm";
import multer from "multer";
import Papa from "papaparse";
import { z } from "zod";
import { errorHandler, assertUser } from './error-handler';
import { NotificationService } from './services/notification-service';
import { exportReportToCsv } from './utils/report-exporter';
import path from 'path';
import fs from 'fs';
import { sendCampaignEmails } from './services/email-service';
import { ThreatIntelligenceService } from './services/threat-intelligence/threat-intelligence.service';
import { threatFeedScheduler } from './services/threat-intelligence/threat-feed-scheduler';
import reconnaissanceRoutes from './routes/reconnaissance';

const upload = multer();

export async function registerRoutes(app: Express): Promise<Server> {
  // Ensure role tables exist (auto-migration safety net)
  try {
    await db.execute(sql`CREATE TABLE IF NOT EXISTS roles (
      id SERIAL PRIMARY KEY,
      name VARCHAR(50) NOT NULL UNIQUE,
      description VARCHAR(200),
      permissions JSONB NOT NULL DEFAULT '{}' ,
      created_at TIMESTAMP DEFAULT NOW(),
      updated_at TIMESTAMP DEFAULT NOW()
    );`);
    await db.execute(sql`CREATE TABLE IF NOT EXISTS user_roles (
      id SERIAL PRIMARY KEY,
      user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
      role_id INTEGER REFERENCES roles(id) ON DELETE CASCADE,
      created_at TIMESTAMP DEFAULT NOW()
    );`);
    // Ensure default roles seeded
    await db.execute(sql`INSERT INTO roles (name, description, permissions)
      SELECT 'Admin', 'Full system access and user management', '["all"]'::jsonb
      WHERE NOT EXISTS (SELECT 1 FROM roles WHERE name='Admin');`);
    await db.execute(sql`INSERT INTO roles (name, description, permissions)
      SELECT 'Manager', 'Campaign management and reporting', '["campaigns","reports","users:read"]'::jsonb
      WHERE NOT EXISTS (SELECT 1 FROM roles WHERE name='Manager');`);
    await db.execute(sql`INSERT INTO roles (name, description, permissions)
      SELECT 'User', 'Basic user access', '["campaigns:read","reports:read"]'::jsonb
      WHERE NOT EXISTS (SELECT 1 FROM roles WHERE name='User');`);
    // Assign Admin role to any qualifying admin-style user lacking it
    await db.execute(sql`INSERT INTO user_roles (user_id, role_id)
      SELECT u.id, r.id
      FROM users u
      JOIN roles r ON r.name='Admin'
      LEFT JOIN user_roles ur ON ur.user_id = u.id AND ur.role_id = r.id
      WHERE (u.is_admin = true OR lower(u.email) = 'admin@phishnet.com')
        AND ur.id IS NULL;`);
  } catch (e) {
    console.error('Auto-migration (roles tables) failed:', e);
  }

  // Setup authentication
  setupAuth(app);

  // API Health Check
  app.get("/api/status", (_req, res) => {
    res.status(200).json({ status: "ok" });
  });
  
  // Session ping endpoint for refreshing user sessions
  app.post("/api/session-ping", isAuthenticated, (req, res) => {
    if (req.session) {
      // Reset session expiry
      req.session.touch();
      
      // Calculate time remaining in session
      const maxAge = req.session.cookie.maxAge || 0;
      const expiresIn = maxAge;
      
      console.log(`Session refreshed for user: ${req.user?.email}. Expires in ${Math.round(expiresIn/1000/60)} minutes`);
    }
    
    res.status(200).json({ 
      status: "ok", 
      sessionExpiresIn: req.session?.cookie?.maxAge || 0
    });
  });

  // Dashboard Stats - Real Data
  app.get("/api/dashboard/stats", isAuthenticated, hasOrganization, async (req, res) => {
    try {
      assertUser(req.user);
      const stats = await storage.getDashboardStats(req.user.organizationId);
      res.json(stats);
    } catch (error) {
      console.error("Error fetching dashboard stats:", error);
      res.status(500).json({ message: "Error fetching dashboard stats" });
    }
  });

  // Dashboard Metrics - Real Data
  app.get("/api/dashboard/metrics", isAuthenticated, hasOrganization, async (req, res) => {
    try {
      assertUser(req.user);
      const metrics = await storage.getPhishingMetrics(req.user.organizationId);
      res.json(metrics);
    } catch (error) {
      console.error("Error fetching dashboard metrics:", error);
      res.status(500).json({ message: "Error fetching dashboard metrics" });
    }
  });

  // At-Risk Users - Real Data
  app.get("/api/dashboard/risk-users", isAuthenticated, hasOrganization, async (req, res) => {
    try {
      assertUser(req.user);
      const riskUsers = await storage.getAtRiskUsers(req.user.organizationId);
      res.json(riskUsers);
    } catch (error) {
      console.error("Error fetching risk users:", error);
      res.status(500).json({ message: "Error fetching risk users" });
    }
  });

  // Threat Landscape - Real Data (Enhanced with Threat Intelligence)
  app.get("/api/dashboard/threats", isAuthenticated, hasOrganization, async (req, res) => {
    try {
      assertUser(req.user);
      
      // Get threat intelligence analysis
      const threatService = new ThreatIntelligenceService();
      const threatAnalysis = await threatService.getThreatAnalysis(req.user.organizationId);
      
      // Get recent threats from threat intelligence
      const recentThreats = await threatService.getRecentThreats(5);
      
      // Convert threat intelligence to dashboard format
      const threatData = recentThreats.map(threat => {
        let level: 'high' | 'medium' | 'low' = 'medium';
        let severity: 'High' | 'Medium' | 'Low' = 'Medium';
        
        // Determine threat level based on confidence and type
  if ((typeof threat.confidence === 'number' && threat.confidence >= 80) || threat.threatType === 'phishing') {
          level = 'high';
          severity = 'High';
        } else if (typeof threat.confidence === 'number' && threat.confidence >= 60) {
          level = 'medium';
          severity = 'Medium';
        } else {
          level = 'low';
          severity = 'Low';
        }
        
        return {
          id: threat.id,
          name: threat.malwareFamily || threat.threatType || 'Unknown Threat',
          description: threat.description || `${threat.threatType} detected from ${threat.source}`,
          level,
          severity,
          count: threat.confidence,
          trend: 'increasing',
          source: threat.source,
          firstSeen: threat.firstSeen
        };
      });
      
      // Add summary information
      const enhancedData = {
        threats: threatData,
        summary: {
          total: threatAnalysis.totalThreats,
          newToday: threatAnalysis.newThreatsToday,
          sources: threatAnalysis.activeSources,
          topTypes: threatAnalysis.topThreatTypes
        }
      };
      
      res.json(enhancedData);
    } catch (error) {
      console.error("Error fetching threat data:", error);
      res.status(500).json({ message: "Error fetching threat data" });
    }
  });

  // Dashboard Risk Users
  app.get("/api/dashboard/risk-users", isAuthenticated, (req, res) => {
    // Provide mock risk user data
    const users = [
      {
        id: 1,
        name: "Mike Miller",
        department: "Finance Department",
        riskLevel: "High Risk"
      },
      {
        id: 2,
        name: "Sarah Johnson",
        department: "Marketing Team",
        riskLevel: "Medium Risk"
      },
      {
        id: 3,
        name: "Tom Parker",
        department: "Executive Team",
        riskLevel: "Medium Risk"
      }
    ];
    res.json(users);
  });

  // Dashboard Training Data
  app.get("/api/dashboard/training", isAuthenticated, (req, res) => {
    // Provide mock training data
    const trainings = [
      {
        id: 1,
        name: "Phishing Awareness",
        progress: 65,
        icon: "shield"
      },
      {
        id: 2,
        name: "Password Security",
        progress: 82,
        icon: "lock"
      },
      {
        id: 3,
        name: "Mobile Device Security",
        progress: 43,
        icon: "smartphone"
      }
    ];
    res.json(trainings);
  });

  // Recent Campaigns
  app.get("/api/campaigns/recent", isAuthenticated, hasOrganization, async (req, res) => {
    try {
      assertUser(req.user);
      const campaigns = await storage.listCampaigns(req.user.organizationId);
      // Sort by created date and take the most recent 5
      const recentCampaigns = campaigns
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
        .slice(0, 5)
        .map(campaign => ({
          id: campaign.id,
          name: campaign.name,
          status: campaign.status,
          openRate: Math.floor(Math.random() * 100), // Mock data
          clickRate: Math.floor(Math.random() * 70), // Mock data
          createdAt: campaign.createdAt
        }));
      res.json(recentCampaigns);
    } catch (error) {
      res.status(500).json({ message: "Error fetching recent campaigns" });
    }
  });

  // Groups Endpoints
  app.get("/api/groups", isAuthenticated, hasOrganization, async (req, res) => {
    try {
      assertUser(req.user);
      const groups = await storage.listGroups(req.user.organizationId);
      res.json(groups);
    } catch (error) {
      res.status(500).json({ message: "Error fetching groups" });
    }
  });

  app.post("/api/groups", isAuthenticated, hasOrganization, async (req, res) => {
    try {
      assertUser(req.user);
      const validatedData = insertGroupSchema.parse(req.body);
      // Add organizationId to the validated data
      const groupData = {
        ...validatedData,
        organizationId: req.user.organizationId
      };
      const group = await storage.createGroup(req.user.organizationId, groupData);
      res.status(201).json(group);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Validation error", errors: error.errors });
      }
      res.status(500).json({ message: "Error creating group" });
    }
  });

  app.put("/api/groups/:id", isAuthenticated, async (req, res) => {
    try {
      assertUser(req.user);
      const groupId = parseInt(req.params.id);
      const group = await storage.getGroup(groupId);
      
      if (!group) {
        return res.status(404).json({ message: "Group not found" });
      }
      
      // Ensure user has access to this group
      if (group.organizationId !== req.user.organizationId) {
        return res.status(403).json({ message: "Access denied" });
      }
      
      const validatedData = insertGroupSchema.parse(req.body);
      const updatedGroup = await storage.updateGroup(groupId, validatedData);
      res.json(updatedGroup);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Validation error", errors: error.errors });
      }
      res.status(500).json({ message: "Error updating group" });
    }
  });

  app.delete("/api/groups/:id", isAuthenticated, async (req, res) => {
    try {
      assertUser(req.user);
      const groupId = parseInt(req.params.id);
      const group = await storage.getGroup(groupId);
      
      if (!group) {
        return res.status(404).json({ message: "Group not found" });
      }
      
      // Ensure user has access to this group
      if (group.organizationId !== req.user.organizationId) {
        return res.status(403).json({ message: "Access denied" });
      }
      
      await storage.deleteGroup(groupId);
      res.status(204).send();
    } catch (error) {
      res.status(500).json({ message: "Error deleting group" });
    }
  });

  // Targets Endpoints
  app.get("/api/groups/:id/targets", isAuthenticated, async (req, res) => {
    try {
      assertUser(req.user);
      const groupId = parseInt(req.params.id);
      const group = await storage.getGroup(groupId);
      
      if (!group) {
        return res.status(404).json({ message: "Group not found" });
      }
      
      // Ensure user has access to this group
      if (group.organizationId !== req.user.organizationId) {
        return res.status(403).json({ message: "Access denied" });
      }
      
      const targets = await storage.listTargets(groupId);
      res.json(targets);
    } catch (error) {
      res.status(500).json({ message: "Error fetching targets" });
    }
  });

  app.post("/api/groups/:id/targets", isAuthenticated, async (req, res) => {
    try {
      assertUser(req.user);
      const groupId = parseInt(req.params.id);
      const group = await storage.getGroup(groupId);
      
      if (!group) {
        return res.status(404).json({ message: "Group not found" });
      }
      
      // Ensure user has access to this group
      if (group.organizationId !== req.user.organizationId) {
        return res.status(403).json({ message: "Access denied" });
      }
      
      const validatedData = insertTargetSchema.parse(req.body);
      // Provide sensible defaults if names are missing
      const firstName = validatedData.firstName && validatedData.firstName.trim().length > 0 ? validatedData.firstName : 'Recipient';
      const lastName = validatedData.lastName && validatedData.lastName.trim().length > 0 ? validatedData.lastName : 'User';
      const targetData = {
        ...validatedData,
        firstName,
        lastName,
        organizationId: req.user.organizationId,
        groupId: groupId
      };
      const target = await storage.createTarget(req.user.organizationId, groupId, targetData);
      res.status(201).json(target);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Validation error", errors: error.errors });
      }
      res.status(500).json({ message: "Error creating target" });
    }
  });

  app.post("/api/groups/:id/import", isAuthenticated, upload.single('file'), async (req, res) => {
    try {
      assertUser(req.user);
      const groupId = parseInt(req.params.id);
      const group = await storage.getGroup(groupId);
      
      if (!group) {
        return res.status(404).json({ message: "Group not found" });
      }
      
      // Ensure user has access to this group
      if (group.organizationId !== req.user.organizationId) {
        return res.status(403).json({ message: "Access denied" });
      }
      
      if (!req.file) {
        return res.status(400).json({ message: "No file uploaded" });
      }
      
      const csvString = req.file.buffer.toString();
      const results = Papa.parse(csvString, { header: true, skipEmptyLines: true });
      
      if (results.errors.length > 0) {
        return res.status(400).json({ message: "CSV parsing error", errors: results.errors });
      }
      
      const importedTargets = [];
      const errors = [];
      
      for (let index = 0; index < results.data.length; index++) {
        const row = results.data[index];
        try {
          // Normalize field names
          const normalizedRow: any = {};
          for (const [key, value] of Object.entries(row as Record<string, unknown>)) {
            const lowercaseKey = key.toLowerCase();
            if (lowercaseKey === 'firstname' || lowercaseKey === 'first_name') {
              normalizedRow.firstName = value;
            } else if (lowercaseKey === 'lastname' || lowercaseKey === 'last_name') {
              normalizedRow.lastName = value;
            } else if (lowercaseKey === 'email') {
              normalizedRow.email = value;
            } else if (lowercaseKey === 'position' || lowercaseKey === 'title') {
              normalizedRow.position = value;
            }
          }
          
          // Validate the data
          const validatedData = insertTargetSchema.parse(normalizedRow);
          // Provide sensible defaults if names are missing
          const firstName = validatedData.firstName && (validatedData.firstName as string).toString().trim().length > 0 ? (validatedData.firstName as string) : 'Recipient';
          const lastName = validatedData.lastName && (validatedData.lastName as string).toString().trim().length > 0 ? (validatedData.lastName as string) : 'User';
          // Create the target with required properties
          const targetData = {
            ...validatedData,
            firstName,
            lastName,
            organizationId: req.user.organizationId,
            groupId: groupId
          };
          const target = await storage.createTarget(req.user.organizationId, groupId, targetData);
          importedTargets.push(target);
        } catch (error) {
          errors.push({
            row: index + 2, // +2 to account for 0-based index and header row
            error: error instanceof z.ZodError ? error.errors : "Unknown error"
          });
        }
      }
      
      res.status(200).json({
        imported: importedTargets.length,
        failed: errors.length,
        errors: errors.length > 0 ? errors : undefined
      });
    } catch (error) {
      res.status(500).json({ message: "Error importing targets" });
    }
  });

  // SMTP Profiles Endpoints
  app.get("/api/smtp-profiles", isAuthenticated, async (req, res) => {
    try {
      assertUser(req.user);
      const profiles = await storage.listSmtpProfiles(req.user.organizationId);
      res.json(profiles);
    } catch (error) {
      res.status(500).json({ message: "Error fetching SMTP profiles" });
    }
  });

  app.post("/api/smtp-profiles", isAuthenticated, async (req, res) => {
    try {
      assertUser(req.user);
      const validatedData = insertSmtpProfileSchema.parse(req.body);
      const profileData = {
        ...validatedData,
        organizationId: req.user.organizationId
      };
      const profile = await storage.createSmtpProfile(req.user.organizationId, profileData);
      res.status(201).json(profile);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Validation error", errors: error.errors });
      }
      res.status(500).json({ message: "Error creating SMTP profile" });
    }
  });

  // Email Templates Endpoints
  app.get("/api/email-templates", isAuthenticated, hasOrganization, async (req, res) => {
    try {
      assertUser(req.user);
      // Get templates directly from storage 
      const templates = await storage.listEmailTemplates(req.user.organizationId);
      
      // Return templates directly with snake_case field names as expected by frontend
      const mappedTemplates = templates.map(template => ({
        id: template.id,
        name: template.name,
        subject: template.subject,
        html_content: template.html_content || "",
        text_content: template.text_content || null,
        sender_name: template.sender_name || "PhishNet Team",
        sender_email: template.sender_email || "phishing@example.com",
        type: template.type || "phishing-business",
        complexity: template.complexity || "medium",
        description: template.description || null,
        category: template.category || null,
        organization_id: template.organization_id,
        created_at: template.created_at,
        updated_at: template.updated_at,
        created_by_id: template.created_by_id
      }));
      
      res.json(mappedTemplates);
    } catch (error) {
      console.error("Error fetching email templates:", error);
      res.status(500).json({ message: "Error fetching email templates" });
    }
  });

  app.post("/api/email-templates", isAuthenticated, hasOrganization, async (req, res) => {
    try {
      assertUser(req.user);
      console.log("Received template data:", req.body);
      const validatedData = insertEmailTemplateSchema.parse(req.body);
      console.log("Validated template data:", validatedData);
      
      // Create a template using existing storage method
      const template = await storage.createEmailTemplate(
        req.user.organizationId, 
        req.user.id, 
        {
          name: validatedData.name,
          subject: validatedData.subject,
          // Fix the field mapping to match Drizzle schema (snake_case):
          html_content: validatedData.htmlContent || validatedData.html_content || "<div>Default content</div>",
          text_content: validatedData.textContent || validatedData.text_content || null,
          sender_name: validatedData.senderName || validatedData.sender_name || "PhishNet Team",
          sender_email: validatedData.senderEmail || validatedData.sender_email || "phishing@example.com",
          type: validatedData.type,
          complexity: validatedData.complexity,
          description: validatedData.description,
          category: validatedData.category,
          // Satisfy InsertEmailTemplate type
          organization_id: req.user.organizationId,
        }
      );
      console.log("Created template:", template);
      
      res.status(201).json(template);
    } catch (error) {
      console.error("Error creating template:", error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Validation error", errors: error.errors });
      }
      res.status(500).json({ message: "Error creating email template" });
    }
  });

  app.put("/api/email-templates/:id", isAuthenticated, async (req, res) => {
    try {
      assertUser(req.user);
      const templateId = parseInt(req.params.id);
      const template = await storage.getEmailTemplate(templateId);
      
      if (!template) {
        return res.status(404).json({ message: "Email template not found" });
      }
      
      // Ensure user has access to this template
      if (template.organization_id !== req.user.organizationId) {
        return res.status(403).json({ message: "Access denied" });
      }
      
      const validatedData = insertEmailTemplateSchema.parse(req.body);
      const updatedTemplate = await storage.updateEmailTemplate(templateId, validatedData);
      res.json(updatedTemplate);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Validation error", errors: error.errors });
      }
      res.status(500).json({ message: "Error updating email template" });
    }
  });
  
  app.delete("/api/email-templates/:id", isAuthenticated, async (req, res) => {
    try {
      assertUser(req.user);
      const templateId = parseInt(req.params.id);
      const template = await storage.getEmailTemplate(templateId);
      
      if (!template) {
        return res.status(404).json({ message: "Email template not found" });
      }
      
      // Ensure user has access to this template
      if (template.organization_id !== req.user.organizationId) {
        return res.status(403).json({ message: "Access denied" });
      }
      
      const success = await storage.deleteEmailTemplate(templateId);
      if (success) {
        return res.status(200).json({ message: "Email template deleted successfully" });
      } else {
        return res.status(500).json({ message: "Failed to delete email template" });
      }
    } catch (error) {
      console.error("Error deleting template:", error);
      res.status(500).json({ message: "Error deleting email template" });
    }
  });

  // Landing Pages Endpoints
  app.get("/api/landing-pages", isAuthenticated, hasOrganization, async (req, res) => {
    try {
      assertUser(req.user);
  const pages = await storage.listLandingPages(req.user.organizationId);
      res.json(pages);
    } catch (error) {
      res.status(500).json({ message: "Error fetching landing pages" });
    }
  });

  app.post("/api/landing-pages", isAuthenticated, hasOrganization, async (req, res) => {
    try {
      assertUser(req.user);
      const validatedData = insertLandingPageSchema.parse(req.body);
      
      // Create the landing page with thumbnail
      const pageData = {
        ...validatedData,
        organizationId: req.user.organizationId
      };
      const page = await storage.createLandingPage(
        req.user.organizationId,
        req.user.id,
        pageData
      );
      
      res.status(201).json(page);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Validation error", errors: error.errors });
      }
      res.status(500).json({ message: "Error creating landing page" });
    }
  });

  app.put("/api/landing-pages/:id", isAuthenticated, hasOrganization, async (req, res) => {
    try {
  assertUser(req.user);
      const pageId = parseInt(req.params.id);
      const page = await storage.getLandingPage(pageId);
      
      if (!page) {
        return res.status(404).json({ message: "Landing page not found" });
      }
      
      // Ensure user has access to this page
  if (page.organizationId !== req.user.organizationId) {
        return res.status(403).json({ message: "Access denied" });
      }
      
      const validatedData = insertLandingPageSchema.parse(req.body);
      
      // Update the landing page with the thumbnail
      const updatedPage = await storage.updateLandingPage(
        pageId,
        validatedData
      );
      
      res.json(updatedPage);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Validation error", errors: error.errors });
      }
      res.status(500).json({ message: "Error updating landing page" });
    }
  });
  
  app.delete("/api/landing-pages/:id", isAuthenticated, hasOrganization, async (req, res) => {
    try {
  assertUser(req.user);
      const pageId = parseInt(req.params.id);
      const page = await storage.getLandingPage(pageId);
      
      if (!page) {
        return res.status(404).json({ message: "Landing page not found" });
      }
      
      // Ensure user has access to this page
  if (page.organizationId !== req.user.organizationId) {
        return res.status(403).json({ message: "Access denied" });
      }
      
      const success = await storage.deleteLandingPage(pageId);
      if (success) {
        return res.status(200).json({ message: "Landing page deleted successfully" });
      } else {
        return res.status(500).json({ message: "Failed to delete landing page" });
      }
    } catch (error) {
      console.error("Error deleting landing page:", error);
      res.status(500).json({ message: "Error deleting landing page" });
    }
  });

  // Landing Page preview (returns raw HTML)
  app.get("/api/landing-pages/:id/preview", isAuthenticated, hasOrganization, async (req, res) => {
    try {
      assertUser(req.user);
      const pageId = parseInt(req.params.id);
      const page = await storage.getLandingPage(pageId);
      if (!page) {
        return res.status(404).send("Not Found");
      }
      if (page.organizationId !== req.user.organizationId) {
        return res.status(403).send("Forbidden");
      }
      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      return res.status(200).send(page.htmlContent || '<!doctype html><html><body><p>No content</p></body></html>');
    } catch (error) {
      console.error('Error rendering landing page preview:', error);
      return res.status(500).send('Preview error');
    }
  });

  // New endpoint to clone landing pages from existing URLs
  app.post("/api/landing-pages/clone", isAuthenticated, hasOrganization, async (req, res) => {
    try {
      const { url } = req.body;
      
      if (!url || typeof url !== 'string') {
        return res.status(400).json({ message: "Valid URL is required" });
      }
      
      try {
        // Use fetch to get the HTML content
        const response = await fetch(url, {
          headers: {
            // Add a user agent to avoid being blocked
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
          }
        });
        
        if (!response.ok) {
          return res.status(400).json({ 
            message: `Failed to fetch webpage: ${response.status} ${response.statusText}` 
          });
        }
        
        // Get HTML content as text
        const htmlContent = await response.text();
        // Try to extract <title>
        let title: string | undefined;
        try {
          const m = htmlContent.match(/<title>([^<]*)<\/title>/i);
          title = m?.[1]?.trim();
        } catch {}
        // Return JSON used by the client editor
        return res.json({ 
          htmlContent,
          title: title || 'Cloned Website',
          message: "Website cloned successfully" 
        });
      } catch (error) {
        console.error("Error cloning website:", error);
        return res.status(400).json({ 
          message: `Error fetching URL: ${(error as Error)?.message || "Unknown error"}` 
        });
      }
    } catch (error) {
      console.error("Server error while cloning website:", error);
      return res.status(500).json({ message: "Error cloning webpage" });
    }
  });

  // Backward-compatible tracking route: redirect legacy /track?c=&t= to /l/:c/:t
  app.get('/track', async (req, res) => {
    const c = parseInt(String(req.query.c));
    const t = parseInt(String(req.query.t));
    if (!Number.isFinite(c) || !Number.isFinite(t)) {
      return res.status(400).send('Bad Request');
    }
    return res.redirect(302, `/l/${c}/${t}`);
  });

  // Open tracking pixel (1x1 transparent gif)
  app.get('/o/:campaignId/:targetId.gif', async (req, res) => {
    try {
      const campaignId = parseInt(req.params.campaignId, 10);
      const targetId = parseInt(req.params.targetId, 10);
      if (!Number.isFinite(campaignId) || !Number.isFinite(targetId)) {
        return res.status(400).end();
      }
      const campaign = await storage.getCampaign(campaignId);
      const target = await storage.getTarget(targetId);
      if (!campaign || !target || campaign.organizationId !== target.organizationId) {
        return res.status(404).end();
      }
      // Idempotent update: only set opened if not already opened and preserve higher precedence statuses
      try {
        // Fetch existing row (if any) by attempting update; if none updated, create later.
        const existing = await storage.updateCampaignResultByCampaignAndTarget(campaignId, targetId, {} as any);
        let wasOpened = false;
        
        if (existing) {
          const newData: any = {};
            if (!existing.opened) {
              newData.opened = true;
              newData.openedAt = new Date();
              wasOpened = true; // Track that this is a new open event
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
          wasOpened = true; // New record created with opened = true
        }
        
        // If this is a new open event, create a notification
        if (wasOpened) {
          try {
            // Get the target details
            const target = await storage.getTarget(targetId);
            
            // Get organization users with admin access to notify
            const users = await storage.listUsers(campaign.organizationId);
            
            if (users && users.length > 0) {
              for (const user of users) {
                // Only notify admins
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
      const campaignId = parseInt(req.params.campaignId, 10);
      const targetId = parseInt(req.params.targetId, 10);
      const encoded = String(req.query.u || '');
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
        // Basic allowlist: only http/https
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
            wasClicked = true; // Track that this is a new click event
          }
          // Do not downgrade submitted
          if (existing.status !== 'submitted') {
            // If status was pending or sent -> clicked. If opened -> clicked.
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
          wasClicked = true; // New record created with clicked = true
        }
        
        // If this is a new click event, create a notification
        if (wasClicked) {
          try {
            // Get the target details
            const target = await storage.getTarget(targetId);
            
            // Get organization users with admin access to notify
            const users = await storage.listUsers(campaign.organizationId);
            
            if (users && users.length > 0) {
              for (const user of users) {
                // Only notify admins
                if (user.isAdmin) {
                  await NotificationService.createNotification({
                    userId: user.id,
                    organizationId: campaign.organizationId,
                    type: 'campaign',
                    title: 'Link Clicked',
                    message: `${target?.firstName ?? ''} ${target?.lastName ?? ''} (${target?.email ?? ''}) clicked a link in the email from campaign "${campaign.name}".`,
                    priority: 'high', // Higher priority than just opening an email
                    actionUrl: `/campaigns/${campaignId}`,
                    metadata: {
                      campaignId,
                      targetId,
                      targetEmail: target?.email ?? '',
                      eventType: 'clicked',
                      url: url // Include the URL that was clicked
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
      const campaignId = parseInt(req.params.campaignId);
      const targetId = parseInt(req.params.targetId);
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

  // Public form submission capture (excludes password fields)
  app.post('/l/submit', async (req, res) => {
    try {
      const campaignId = parseInt(String(req.query.c));
      const targetId = parseInt(String(req.query.t));
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
      const captureData = page?.captureData !== false; // default true
      const capturePasswords = page?.capturePasswords === true; // default false

      // Prepare submitted data according to flags
      const body: Record<string, any> = req.body || {};
      let submittedData: Record<string, any> | null = null;
      if (captureData) {
        if (capturePasswords) {
          // Capture everything as-is
          submittedData = { ...body };
        } else {
          // Exclude password-like fields by heuristic
          const filtered: Record<string, any> = {};
          for (const [k, v] of Object.entries(body)) {
            if (/passw|pwd/i.test(k)) continue;
            filtered[k] = v;
          }
          submittedData = filtered;
        }
      } else {
        submittedData = null; // record the event but don't store data
      }

      // Update or create result row
      try {
        // Try updating existing result for this campaign+target
        let wasSubmitted = false;
        const existing = await storage.updateCampaignResultByCampaignAndTarget(campaignId, targetId, {} as any);
        
        if (existing && !existing.submitted) {
          wasSubmitted = true;
        } else if (!existing) {
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
        
        // If this is a new submission event, create a notification with urgent priority
        if (wasSubmitted) {
          try {
            // Get the target details
            const target = await storage.getTarget(targetId);
            
            // Get organization users with admin access to notify
            const users = await storage.listUsers(campaign.organizationId);
            
            if (users && users.length > 0) {
              for (const user of users) {
                // Only notify admins
                if (user.isAdmin) {
                  await NotificationService.createNotification({
                    userId: user.id,
                    organizationId: campaign.organizationId,
                    type: 'campaign',
                    title: 'Form Submitted',
                    message: `${target?.firstName ?? ''} ${target?.lastName ?? ''} (${target?.email ?? ''}) submitted information on the landing page from campaign "${campaign.name}".`,
                    priority: 'urgent', // Highest priority - user submitted form data
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
      return res.status(204).end();
    } catch (e) {
      console.error('Submission capture error:', e);
      return res.status(500).send('Server Error');
    }
  });
  // Clone an existing landing page by ID
  app.post("/api/landing-pages/:id/clone", isAuthenticated, hasOrganization, async (req, res) => {
    try {
      assertUser(req.user);
      const pageId = parseInt(req.params.id);
      const page = await storage.getLandingPage(pageId);
      if (!page) {
        return res.status(404).json({ message: "Landing page not found" });
      }
      if (page.organizationId !== req.user.organizationId) {
        return res.status(403).json({ message: "Access denied" });
      }
      const cloned = await storage.createLandingPage(req.user.organizationId, req.user.id, {
        name: `${page.name} (Copy)`,
        description: page.description || null,
        htmlContent: page.htmlContent,
        redirectUrl: page.redirectUrl || null,
        pageType: page.pageType,
        thumbnail: page.thumbnail || null,
  captureData: (page as any).captureData ?? true,
  capturePasswords: (page as any).capturePasswords ?? false,
      } as any);
      return res.status(201).json(cloned);
    } catch (error) {
      console.error('Error cloning landing page by id:', error);
      return res.status(500).json({ message: 'Error cloning landing page' });
    }
  });

  // Campaigns Endpoints
  app.get("/api/campaigns", isAuthenticated, async (req, res) => {
    try {
      assertUser(req.user);
      const campaignList = await storage.listCampaigns(req.user.organizationId);

      const mapped = [] as any[];
      for (const c of campaignList) {
        const group = await storage.getGroup(c.targetGroupId);
        const targets = await storage.listTargets(c.targetGroupId);
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
          // Convenience extras the UI might show later
          targetGroup: group?.name || 'Unknown',
        });
      }

      res.json({ campaigns: mapped });
    } catch (error) {
      console.error('Error fetching campaigns:', error);
      res.status(500).json({ message: "Error fetching campaigns" });
    }
  });

  app.post("/api/campaigns", isAuthenticated, hasOrganization, async (req, res) => {
    try {
      console.log("Campaign creation request body:", req.body);
  assertUser(req.user);
      
      // Attempt to validate the data
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
          // Ensure proper type conversion
          targetGroupId: Number(validatedData.targetGroupId),
          smtpProfileId: Number(validatedData.smtpProfileId),
          emailTemplateId: Number(validatedData.emailTemplateId),
          landingPageId: Number(validatedData.landingPageId),
          scheduledAt: validatedData.scheduledAt || null,
          endDate: validatedData.endDate || null,
        }
      );
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

  // Launch campaign now
  app.post("/api/campaigns/:id/launch", isAuthenticated, hasOrganization, async (req, res) => {
    try {
  assertUser(req.user);
      const campaignId = parseInt(req.params.id, 10);
      const campaign = await storage.getCampaign(campaignId);
      if (!campaign || campaign.organizationId !== req.user.organizationId) {
        return res.status(404).json({ message: "Campaign not found" });
      }

      await storage.updateCampaign(campaignId, { status: 'Active' });
      const result = await sendCampaignEmails(campaignId, req.user.organizationId);
      return res.json({ message: 'Campaign launched', result });
    } catch (error) {
      console.error('Error launching campaign:', error);
      return res.status(500).json({ message: 'Error launching campaign' });
    }
  });

  // Add or update these campaign routes

  // Get a specific campaign by ID
  app.get("/api/campaigns/:id", isAuthenticated, hasOrganization, async (req, res) => {
    try {
  assertUser(req.user);
      const campaignId = parseInt(req.params.id, 10);
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
      const campaignId = parseInt(req.params.id, 10);
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
      const campaignId = parseInt(req.params.id, 10);
      const campaign = await storage.getCampaign(campaignId);
      
      if (!campaign || campaign.organizationId !== req.user.organizationId) {
        return res.status(404).json({ message: "Campaign not found" });
      }
      
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
      const campaignId = parseInt(req.params.id, 10);
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

  // Users Endpoints
  // User profile endpoints
  app.put("/api/user/profile", isAuthenticated, async (req, res) => {
    try {
  assertUser(req.user);
      const allowedFields = ['firstName', 'lastName', 'position', 'bio'];
      const updateData: Partial<User> = {};
      
      // Only allow specific fields to be updated
      for (const field of allowedFields) {
        if (req.body[field] !== undefined) {
          updateData[field as keyof User] = req.body[field];
        }
      }
      
  const updatedUser = await storage.updateUser(req.user.id, updateData);
      
      if (!updatedUser) {
        return res.status(404).json({ message: "User not found" });
      }
      
      res.json(updatedUser);
    } catch (error) {
      console.error("Error updating user profile:", error);
      res.status(500).json({ message: "Failed to update user profile" });
    }
  });
  
  app.post("/api/user/change-password", isAuthenticated, async (req, res) => {
    try {
  assertUser(req.user);
      const { currentPassword, newPassword } = req.body;
      
      if (!currentPassword || !newPassword) {
        return res.status(400).json({ message: "Current password and new password are required" });
      }
      
      // Get the user with password (for verification)
  const user = await storage.getUser(req.user.id);
      
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }
      
      // Use imported password functions from auth.ts
      // They are already available since we imported them at the top
      
      // Verify current password
      const isPasswordValid = await comparePasswords(currentPassword, user.password);
      
      if (!isPasswordValid) {
        return res.status(401).json({ message: "Current password is incorrect" });
      }
      
      // Validate password strength
      const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/;
      if (!passwordRegex.test(newPassword)) {
        return res.status(400).json({ 
          message: "Password must be at least 8 characters with uppercase, lowercase, number, and special character" 
        });
      }
      
      // Hash the new password
      const hashedPassword = await hashPassword(newPassword);
      
      // Update the user's password
  const updatedUser = await storage.updateUser(req.user.id, { 
        password: hashedPassword,
        failedLoginAttempts: 0,
        accountLocked: false,
        accountLockedUntil: null
      });
      
      if (!updatedUser) {
        return res.status(500).json({ message: "Failed to update password" });
      }
      
      res.json({ message: "Password updated successfully" });
    } catch (error) {
      console.error("Error changing password:", error);
      res.status(500).json({ message: "Failed to change password" });
    }
  });
  
  app.post("/api/user/profile-picture", isAuthenticated, upload.single('profilePicture'), async (req, res) => {
    try {
  assertUser(req.user);
      if (!req.file) {
        return res.status(400).json({ message: "No file uploaded" });
      }
      
      // Convert image to base64 for storage
      // In a production app, you might want to store the file elsewhere and just save the URL
      const profilePicture = `data:${req.file.mimetype};base64,${req.file.buffer.toString('base64')}`;
      
  const updatedUser = await storage.updateUser(req.user.id, { profilePicture });
      
      if (!updatedUser) {
        return res.status(404).json({ message: "User not found" });
      }
      
      res.json(updatedUser);
    } catch (error) {
      console.error("Error updating profile picture:", error);
      res.status(500).json({ message: "Failed to update profile picture" });
    }
  });
  
  app.get("/api/users", isAuthenticated, hasOrganization, async (req, res) => {
    try {
      assertUser(req.user);
      // Ensure default roles are seeded (so users list always has roles available)
      try {
        const existingRole = await db.select({ id: rolesSchema.id }).from(rolesSchema).limit(1);
        if (existingRole.length === 0) {
          for (const r of DEFAULT_ROLES) {
            try {
              await db.insert(rolesSchema).values({
                name: r.name,
                description: r.description,
                // store permissions as raw array (schema default now array JSON)
                permissions: Array.isArray((r as any).permissions) ? (r as any).permissions : (r as any).permissions?.permissions || []
              } as any);
            } catch {}
          }
        }
      } catch (e) {
        console.error('Role seeding check failed:', e);
      }

      const userList = await db.select({
        id: users.id,
        firstName: users.firstName,
        lastName: users.lastName,
        email: users.email,
        isActive: users.isActive,
        lastLogin: users.lastLogin,
        profilePicture: users.profilePicture,
        createdAt: users.createdAt,
        isAdmin: users.isAdmin,
      })
      .from(users)
      .where(eq(users.organizationId, req.user.organizationId));
      
      // Get roles for each user, auto-assign Admin if needed
      const usersWithRoles = await Promise.all(
        userList.map(async (user) => {
          let userRoles = await db.select({
            id: rolesSchema.id,
            name: rolesSchema.name,
            description: rolesSchema.description,
            permissions: rolesSchema.permissions,
          })
          .from(userRolesSchema)
          .innerJoin(rolesSchema, eq(userRolesSchema.roleId, rolesSchema.id))
          .where(eq(userRolesSchema.userId, user.id));

          if (userRoles.length === 0 && (user.isAdmin || user.email.toLowerCase() === 'admin@phishnet.com')) {
            // Auto-assign Admin role if missing
            const [adminRole] = await db.select({ id: rolesSchema.id, name: rolesSchema.name, description: rolesSchema.description, permissions: rolesSchema.permissions })
              .from(rolesSchema)
              .where(eq(rolesSchema.name, 'Admin'));
            if (adminRole) {
              try {
                await db.insert(userRolesSchema).values({ userId: user.id, roleId: adminRole.id });
                userRoles.push(adminRole);
              } catch (e) {
                // Ignore duplicates racing
              }
            }
          }
          
          return {
            ...user,
            roles: userRoles,
          };
        })
      );
      
      res.json(usersWithRoles);
    } catch (error) {
      console.error("Error fetching users:", error);
      res.status(500).json({ message: "Error fetching users" });
    }
  });

  app.post("/api/users", isAuthenticated, hasOrganization, isAdmin, async (req, res) => {
    try {
  assertUser(req.user);
      const { firstName, lastName, email, password, roleId, isActive } = req.body;
      
      // Check if user already exists
      const existingUser = await db.select()
        .from(users)
        .where(eq(users.email, email))
        .limit(1);
      
      if (existingUser.length > 0) {
        return res.status(400).json({ message: "User with this email already exists" });
      }
      
      // Hash password
      const hashedPassword = await hashPassword(password);
      
      // Create user
      const [newUser] = await db.insert(users).values({
        firstName,
        lastName,
        email,
        password: hashedPassword,
        isActive: isActive ?? true,
        organizationId: req.user.organizationId,
      }).returning();
      
      // Assign roles
      if (roleId) {
        await db.insert(userRolesSchema).values({ userId: newUser.id, roleId: Number(roleId) });
      }
      
      res.status(201).json({ 
        message: "User created successfully", 
        user: { 
          id: newUser.id, 
          firstName: newUser.firstName, 
          lastName: newUser.lastName,
          email: newUser.email 
        } 
      });
    } catch (error) {
      console.error("Error creating user:", error);
      res.status(500).json({ message: "Error creating user" });
    }
  });

  app.put("/api/users/:id", isAuthenticated, hasOrganization, isAdmin, async (req, res) => {
    try {
  assertUser(req.user);
      const userId = parseInt(req.params.id);
      const { firstName, lastName, email, roleId, isActive } = req.body;
      
      // Update user
      const [updatedUser] = await db.update(users)
        .set({ 
          firstName, 
          lastName, 
          email, 
          isActive,
          updatedAt: new Date() 
        })
        .where(eq(users.id, userId))
        .returning();
      
      // Update roles
      if (roleId) {
        // Remove existing roles
        await db.delete(userRolesSchema).where(eq(userRolesSchema.userId, userId));
        
        // Add new roles
        await db.insert(userRolesSchema).values({ userId, roleId: Number(roleId) });
      }
      
      res.json({ message: "User updated successfully", user: updatedUser });
    } catch (error) {
      console.error("Error updating user:", error);
      res.status(500).json({ message: "Error updating user" });
    }
  });

  app.delete("/api/users/:id", isAuthenticated, hasOrganization, isAdmin, async (req, res) => {
    try {
  assertUser(req.user);
      const userId = parseInt(req.params.id);
      
      // Don't allow deleting self
      if (userId === req.user.id) {
        return res.status(400).json({ message: "Cannot delete your own account" });
      }
      
      // Delete user roles first
      await db.delete(userRolesSchema).where(eq(userRolesSchema.userId, userId));
      
      // Delete user
      await db.delete(users).where(eq(users.id, userId));
      
      res.json({ message: "User deleted successfully" });
    } catch (error) {
      console.error("Error deleting user:", error);
      res.status(500).json({ message: "Error deleting user" });
    }
  });

  // Reports Export Endpoints
  app.post("/api/reports/export", isAuthenticated, hasOrganization, async (req, res) => {
    try {
      assertUser(req.user);
      const { type, dateRange } = req.body;

      let reportData: any = {
        type,
        organizationName: req.user.organizationName,
        dateRange: dateRange ? {
          start: new Date(dateRange.start),
          end: new Date(dateRange.end)
        } : null
      };
      
      // Build date filter
      const dateFilter = dateRange ? 
        and(
          eq(campaigns.organizationId, req.user.organizationId),
          gte(campaigns.createdAt, new Date(dateRange.start)),
          lte(campaigns.createdAt, new Date(dateRange.end))
        ) : eq(campaigns.organizationId, req.user.organizationId);

      if (type === 'campaigns') {
        const campaignsData = await db.select().from(campaigns).where(dateFilter);
        reportData.campaigns = campaignsData;
      } else if (type === 'users') {
        const usersData = await db.select().from(users).where(eq(users.organizationId, req.user.organizationId));
        reportData.users = usersData;
      } else if (type === 'results') {
        const resultsData = await db.select().from(campaignResults)
          .innerJoin(campaigns, eq(campaignResults.campaignId, campaigns.id))
          .where(dateFilter);
        reportData.results = resultsData;
      } else if (type === 'comprehensive') {
        const compCampaigns = await db.select().from(campaigns).where(dateFilter);
        const compUsers = await db.select().from(users).where(eq(users.organizationId, req.user.organizationId));
        const compResults = await db.select().from(campaignResults)
          .innerJoin(campaigns, eq(campaignResults.campaignId, campaigns.id))
          .where(dateFilter);
        reportData.campaigns = compCampaigns;
        reportData.users = compUsers;
        reportData.results = compResults;
      }
      
  const filename = await exportReportToCsv(reportData);
      
      res.json({ 
        success: true,
        filename,
        downloadUrl: `/api/reports/download/${filename}`
      });
    } catch (error) {
      console.error("Error exporting report:", error);
      res.status(500).json({ message: "Error exporting report" });
    }
  });
  
  app.get("/api/reports/download/:filename", isAuthenticated, (req, res) => {
    try {
      const filename = req.params.filename;
      const filepath = path.join(process.cwd(), 'uploads', filename);
      
      if (!fs.existsSync(filepath)) {
        return res.status(404).json({ message: "File not found" });
      }
      
      res.download(filepath, filename, (err) => {
        if (err) {
          console.error("Error downloading file:", err);
          res.status(500).json({ message: "Error downloading file" });
        } else {
          // Clean up file after download
          setTimeout(() => {
            fs.unlink(filepath, (unlinkErr) => {
              if (unlinkErr) console.error("Error deleting file:", unlinkErr);
            });
          }, 5000);
        }
      });
    } catch (error) {
      console.error("Error serving download:", error);
      res.status(500).json({ message: "Error serving download" });
    }
  });

  // Notification Endpoints
  app.get("/api/notifications", isAuthenticated, async (req, res) => {
    try {
  assertUser(req.user);
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 20;
      const offset = (page - 1) * limit;
      
      const notifications = await NotificationService.getUserNotifications(
        req.user.id, 
        limit, 
        offset
      );
      
      const unreadCount = await NotificationService.getUnreadCount(req.user.id);
      
      res.json({
        notifications,
        unreadCount,
        pagination: {
          page,
          limit,
          hasMore: notifications.length === limit
        }
      });
    } catch (error) {
      console.error("Error fetching notifications:", error);
      res.status(500).json({ message: "Error fetching notifications" });
    }
  });

  app.get("/api/notifications/unread-count", isAuthenticated, async (req, res) => {
    try {
  assertUser(req.user);
      const count = await NotificationService.getUnreadCount(req.user.id);
      res.json({ count });
    } catch (error) {
      console.error("Error fetching unread count:", error);
      res.status(500).json({ message: "Error fetching unread count" });
    }
  });

  app.put("/api/notifications/:id/read", isAuthenticated, async (req, res) => {
    try {
  assertUser(req.user);
      const notificationId = parseInt(req.params.id);
  await NotificationService.markAsRead(notificationId, req.user.id);
  res.json({ success: true });
    } catch (error) {
      console.error("Error marking notification as read:", error);
      res.status(500).json({ message: "Error marking notification as read" });
    }
  });

  app.put("/api/notifications/mark-all-read", isAuthenticated, async (req, res) => {
    try {
  assertUser(req.user);
      const notifications = await NotificationService.markAllAsRead(req.user.id);
      res.json({ updated: notifications.length });
    } catch (error) {
      console.error("Error marking all notifications as read:", error);
      res.status(500).json({ message: "Error marking all notifications as read" });
    }
  });

  app.delete("/api/notifications/:id", isAuthenticated, async (req, res) => {
    try {
  assertUser(req.user);
      const notificationId = parseInt(req.params.id);
      await NotificationService.deleteNotification(notificationId, req.user.id);
      res.json({ message: "Notification deleted successfully" });
    } catch (error) {
      console.error("Error deleting notification:", error);
      res.status(500).json({ message: "Error deleting notification" });
    }
  });

  // Notification Preferences
  app.get("/api/notifications/preferences", isAuthenticated, async (req, res) => {
    try {
  assertUser(req.user);
      const preferences = await NotificationService.getPreferences(req.user.id);
      res.json(preferences);
    } catch (error) {
      console.error("Error fetching notification preferences:", error);
      res.status(500).json({ message: "Error fetching notification preferences" });
    }
  });

  app.put("/api/notifications/preferences", isAuthenticated, async (req, res) => {
    try {
  assertUser(req.user);
      const preferences = await NotificationService.updatePreferences(req.user.id, req.body);
      res.json(preferences);
    } catch (error) {
      console.error("Error updating notification preferences:", error);
      res.status(500).json({ message: "Error updating notification preferences" });
    }
  });

  // Admin endpoint to create notifications
  app.post("/api/notifications", isAuthenticated, isAdmin, async (req, res) => {
    try {
  assertUser(req.user);
      const { type, title, message, priority, actionUrl, userIds, broadcast } = req.body;
      
      if (broadcast) {
        // Send to all users in organization
        const notifications = await NotificationService.createOrganizationNotification({
          organizationId: req.user.organizationId,
          type,
          title,
          message,
          priority,
          actionUrl
        });
        res.json({ message: "Broadcast notification sent", count: notifications.length });
      } else if (userIds && userIds.length > 0) {
        // Send to specific users
        const notifications: any[] = [];
        for (const userId of userIds as number[]) {
          const notification = await NotificationService.createNotification({
            userId,
            organizationId: req.user.organizationId,
            type,
            title,
            message,
            priority,
            actionUrl
          });
          notifications.push(notification);
        }
        res.json({ message: "Notifications sent", count: notifications.length });
      } else {
        res.status(400).json({ message: "Must specify userIds or set broadcast to true" });
      }
    } catch (error) {
      console.error("Error creating notifications:", error);
      res.status(500).json({ message: "Error creating notifications" });
    }
  });

  // Error statistics endpoint
  app.get("/api/debug/errors", isAuthenticated, isAdmin, (req, res) => {
    try {
      const stats = errorHandler.getErrorStats();
      res.json(stats);
    } catch (error) {
      res.status(500).json({ message: "Error fetching error statistics" });
    }
  });

  // Clear error history endpoint
  app.delete("/api/debug/errors", isAuthenticated, isAdmin, (req, res) => {
    try {
      errorHandler.clearHistory();
      res.json({ message: "Error history cleared" });
    } catch (error) {
      res.status(500).json({ message: "Error clearing error history" });
    }
  });

  // Roles listing endpoint
  app.get("/api/roles", isAuthenticated, hasOrganization, async (req, res) => {
    try {
      assertUser(req.user);
      let roles = await db.select({
        id: rolesSchema.id,
        name: rolesSchema.name,
        description: rolesSchema.description,
        permissions: rolesSchema.permissions,
      }).from(rolesSchema);

      if (!roles || roles.length === 0) {
        // Seed default roles if table empty
        for (const r of DEFAULT_ROLES) {
          try {
            await db.insert(rolesSchema).values({
              name: r.name,
              description: r.description,
              permissions: Array.isArray((r as any).permissions) ? (r as any).permissions : (r as any).permissions?.permissions || []
            } as any);
          } catch (e) {
            // Ignore duplicates
          }
        }
        roles = await db.select({
          id: rolesSchema.id,
          name: rolesSchema.name,
          description: rolesSchema.description,
          permissions: rolesSchema.permissions,
        }).from(rolesSchema);
      }

      res.json(roles);
    } catch (error) {
      console.error("Error fetching roles:", error);
      res.status(500).json({ message: "Error fetching roles" });
    }
  });

  // ===============================================
  // THREAT INTELLIGENCE ROUTES
  // ===============================================

  const threatService = new ThreatIntelligenceService();

  // Get threat intelligence analysis for dashboard
  app.get("/api/threat-intelligence/analysis", isAuthenticated, async (req, res) => {
    try {
      assertUser(req.user);
      const analysis = await threatService.getThreatAnalysis(req.user.organizationId);
      res.json(analysis);
    } catch (error) {
      console.error("Error fetching threat analysis:", error);
      res.status(500).json({ message: "Error fetching threat analysis" });
    }
  });

  // Get recent threats for threat landscape page
  app.get("/api/threat-intelligence/threats", isAuthenticated, async (req, res) => {
    try {
      assertUser(req.user);
      const limit = parseInt(req.query.limit as string) || 50;
      const threats = await threatService.getRecentThreats(limit);
      res.json(threats);
    } catch (error) {
      console.error("Error fetching threats:", error);
      res.status(500).json({ message: "Error fetching threats" });
    }
  });

  // Search threats by domain or URL
  app.get("/api/threat-intelligence/search", isAuthenticated, async (req, res) => {
    try {
      assertUser(req.user);
      const query = req.query.q as string;
      if (!query || query.trim().length < 3) {
        return res.status(400).json({ message: "Search query must be at least 3 characters" });
      }
      
      const limit = parseInt(req.query.limit as string) || 20;
      const threats = await threatService.searchThreats(query.trim(), limit);
      res.json(threats);
    } catch (error) {
      console.error("Error searching threats:", error);
      res.status(500).json({ message: "Error searching threats" });
    }
  });

  // Manually trigger threat feed ingestion (admin only)
  app.post("/api/threat-intelligence/ingest", isAuthenticated, isAdmin, async (req, res) => {
    try {
      assertUser(req.user);
      // Run ingestion in background
      threatService.ingestAllFeeds().catch(error => {
        console.error("Background threat ingestion failed:", error);
      });
      
      res.json({ message: "Threat feed ingestion started in background" });
    } catch (error) {
      console.error("Error starting threat ingestion:", error);
      res.status(500).json({ message: "Error starting threat ingestion" });
    }
  });

  // Get threat feed scheduler status (admin only)
  app.get("/api/threat-intelligence/scheduler/status", isAuthenticated, isAdmin, async (req, res) => {
    try {
      assertUser(req.user);
      const status = threatFeedScheduler.getStatus();
      res.json(status);
    } catch (error) {
      console.error("Error getting scheduler status:", error);
      res.status(500).json({ message: "Error getting scheduler status" });
    }
  });

  // Start/stop threat feed scheduler (admin only)
  app.post("/api/threat-intelligence/scheduler/:action", isAuthenticated, isAdmin, async (req, res) => {
    try {
      assertUser(req.user);
      const action = req.params.action;
      
      if (action === 'start') {
        const intervalHours = parseInt(req.body.intervalHours) || 2;
        threatFeedScheduler.start(intervalHours);
        res.json({ message: `Threat feed scheduler started (every ${intervalHours} hours)` });
      } else if (action === 'stop') {
        threatFeedScheduler.stop();
        res.json({ message: "Threat feed scheduler stopped" });
      } else {
        res.status(400).json({ message: "Invalid action. Use 'start' or 'stop'" });
      }
    } catch (error) {
      console.error("Error controlling scheduler:", error);
      res.status(500).json({ message: "Error controlling scheduler" });
    }
  });

  // Manual trigger for threat feed ingestion (admin only, for testing)
  app.post("/api/threat-intelligence/ingest-now", isAuthenticated, isAdmin, async (req, res) => {
    try {
      assertUser(req.user);
      console.log('🔄 Manual threat feed ingestion triggered by admin...');
      await threatService.ingestAllFeeds();
      res.json({ message: "Threat feed ingestion completed successfully" });
    } catch (error) {
      console.error("Error triggering manual ingestion:", error);
      res.status(500).json({ message: "Error triggering threat feed ingestion" });
    }
  });

  // ===============================================
  // RECONNAISSANCE ROUTES
  // ===============================================

  // Register reconnaissance routes
  app.use('/api/reconnaissance', reconnaissanceRoutes);
  console.log('✅ Reconnaissance routes registered');

  // Initialize threat feed scheduler
  console.log('🔐 Starting threat intelligence feed scheduler...');
  threatFeedScheduler.start(2); // Run every 2 hours

  // Add error handling middleware (must be last)
  app.use(errorHandler.middleware);

  const httpServer = createServer(app);
  return httpServer;
}
