import { tenantAccess } from './middleware/tenant-access';
import type { Express } from "express";
import { createServer, type Server } from "node:http";
import { storage } from "./storage";
import { setupAuth, isAuthenticated, isAdmin, hasOrganization, hashPassword, comparePasswords } from "./auth";
import { trackingLimiter } from "./middleware/rate-limit";
import { db } from "./db";
import { 
  campaigns, 
  campaignResults, 
  users, 
  insertGroupSchema, 
  insertTargetSchema, 
  insertSmtpProfileSchema, 
  insertEmailTemplateSchema, 
  insertLandingPageSchema, 
  insertCampaignSchema,
  reportSchedules,
  insertReportScheduleSchema,
  targets,
  type User
} from "@shared/schema";
import { eq, and, sql, gte, lte, inArray } from "drizzle-orm";
import multer from "multer";
import Papa from "papaparse";
import { z } from "zod";
import { errorHandler, assertUser } from './error-handler';
import { NotificationService } from './services/notification-service';
import { exportReport, ExportFormat } from './utils/report-exporter-enhanced';
import path from 'node:path';
import fs from 'node:fs';
import { sendCampaignEmails } from './services/email-service';
import { ThreatIntelligenceService } from './services/threat-intelligence/threat-intelligence.service';
import { threatFeedScheduler } from './services/threat-intelligence/threat-feed-scheduler';
import { reportingScheduler } from './services/reporting-scheduler';
import reconnaissanceRoutes from './routes/reconnaissance';
import { registerModularRoutes } from './routes/index';
import { broadcastCampaignEvent } from './services/realtime';

const upload = multer();

export async function registerRoutes(app: Express): Promise<Server> {
  // Setup authentication
  setupAuth(app);
  app.use("/api", tenantAccess);

  // Register modular routes (health, dashboard, notifications, threat intelligence)
  registerModularRoutes(app);

  // ===============================================
  // LEGACY ROUTES BELOW (Being migrated to modular structure)
  // Note: User management and roles endpoints have been moved to server/routes/users.ts
  // NOTE: This file contains endpoints that are pending modularization migration
  // ===============================================

  // Dashboard Stats - Real Data
  

  // Dashboard Metrics - Real Data
  

  // Alias for phishing metrics to match frontend client
  

  // At-Risk Users - Real Data
  

  // Threat Landscape - Real Data (Enhanced with Threat Intelligence)
  

  // Dashboard Training Data (alias to match frontend expectation)
  

  // Recent Campaigns
  

  // Groups Endpoints
  

  

  

  

  // Targets Endpoints
  

  app.delete("/api/groups/:groupId/targets/:targetId", isAuthenticated, async (req, res) => {
    try {
      assertUser(req.user);
      const groupId = Number.parseInt(req.params.groupId, 10);
      const targetId = Number.parseInt(req.params.targetId, 10);

      if (Number.isNaN(groupId) || Number.isNaN(targetId)) {
        return res.status(400).json({ message: "Invalid group or target id" });
      }

      const group = await storage.getGroup(groupId);
      if (!group) {
        return res.status(404).json({ message: "Group not found" });
      }

      if (group.organizationId !== req.user.organizationId) {
        return res.status(403).json({ message: "Access denied" });
      }

      const target = await storage.getTarget(targetId);
      if (!target || target.groupId !== groupId) {
        return res.status(404).json({ message: "Target not found" });
      }

      if (target.organizationId !== req.user.organizationId) {
        return res.status(403).json({ message: "Access denied" });
      }

      await storage.deleteTarget(targetId);
      return res.status(204).send();
    } catch (error) {
      console.error("Error deleting target:", error);
      return res.status(500).json({ message: "Error deleting target" });
    }
  });

  

  

  // SMTP Profiles Endpoints
  

  

  

  // Email Templates Endpoints
  

  

  
  
  

  // Landing Pages Endpoints
  

  

  
  
  

  // Landing Page preview (returns raw HTML)
  

  // New endpoint to clone landing pages from existing URLs
  

  // Backward-compatible tracking route: redirect legacy /track?c=&t= to /l/:c/:t
  

  // Open tracking pixel (1x1 transparent gif)
  

  // Campaigns Endpoints
  
  
  
  
  
  
  // NOTE: User management endpoints (GET, POST, PUT, DELETE /api/users) have been
  // moved to server/routes/users.ts for better modularization

  // Reports Export Endpoints
  

  // Individual Campaign Report Export
  
  
  

  // Notification Endpoints
  

  

  

  

  

  // Notification Preferences
  

  

  // Admin endpoint to create notifications
  

  // Error statistics endpoint
  app.get("/api/debug/errors", isAuthenticated, isAdmin, (req, res) => {
    try {
      const stats = errorHandler.getErrorStats();
      res.json(stats);
    } catch (error) {
      console.error("Error fetching error statistics:", error);
      res.status(500).json({ message: "Error fetching error statistics" });
    }
  });

  // Clear error history endpoint
  app.delete("/api/debug/errors", isAuthenticated, isAdmin, (req, res) => {
    try {
      errorHandler.clearHistory();
      res.json({ message: "Error history cleared" });
    } catch (error) {
      console.error("Error clearing error history:", error);
      res.status(500).json({ message: "Error clearing error history" });
    }
  });

  // Roles listing endpoint
  // NOTE: Roles endpoint (GET /api/roles) has been moved to server/routes/users.ts
  // since roles are closely related to user management

  // ===============================================
  // THREAT INTELLIGENCE ROUTES
  // ===============================================

  const threatService = new ThreatIntelligenceService();

  // Get threat intelligence analysis for dashboard
  

  // Get recent threats for threat landscape page
  

  // Search threats by domain or URL
  

  // Manually trigger threat feed ingestion (admin only)
  

  // Get threat feed scheduler status (admin only)
  

  // Start/stop threat feed scheduler (admin only)
  

  // Manual trigger for threat feed ingestion (admin only, for testing)
  

  // ===============================================
  // RECONNAISSANCE ROUTES
  // ===============================================

  // Register reconnaissance routes
  app.use('/api/reconnaissance', reconnaissanceRoutes);
  console.log('✅ Reconnaissance routes registered');

  // ===============================================
  // REPORTS API
  // ===============================================

  // Get report data for reports page and PDF generation
  

  // ===============================================
  // REPORT SCHEDULES API
  // ===============================================

  // List report schedules for organization
  

  // Create report schedule
  

  // Update report schedule
  

  // Delete report schedule
  

  // Initialize threat feed scheduler (now controlled via THREAT_FEED_ENABLED env var in index.ts)

  // Initialize reporting scheduler
  console.log('📊 Starting report scheduler...');
  if (process.env.REPORT_SCHEDULER_ENABLED === 'true') reportingScheduler.start(1);

  // Add error handling middleware (must be last)
  app.use(errorHandler.middleware);

  const httpServer = createServer(app);
  return httpServer;
}
