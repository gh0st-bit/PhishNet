import type { Express } from 'express';
import { isAuthenticated, hasOrganization } from '../auth';
import { db } from '../db';
import { campaigns, users, groups } from '@shared/schema';
import { eq } from 'drizzle-orm';

function assertUser(user: Express.User | undefined): asserts user is Express.User {
  if (!user) {
    throw new Error('User not authenticated');
  }
}

export function registerDashboardRoutes(app: Express) {
  // Dashboard stats
  app.get("/api/dashboard/stats", isAuthenticated, hasOrganization, async (req, res) => {
    try {
      assertUser(req.user);
      const orgId = req.user.organizationId;
      
      const [allCampaigns, allUsers, allGroups] = await Promise.all([
        db.select().from(campaigns).where(eq(campaigns.organizationId, orgId)),
        db.select().from(users).where(eq(users.organizationId, orgId)),
        db.select().from(groups).where(eq(groups.organizationId, orgId))
      ]);
      
      res.json({ campaigns: allCampaigns.length, users: allUsers.length, groups: allGroups.length });
    } catch (error) {
      console.error("Error fetching dashboard stats:", error);
      res.status(500).json({ message: "Error fetching dashboard stats" });
    }
  });

  // Dashboard metrics
  app.get("/api/dashboard/metrics", isAuthenticated, hasOrganization, async (req, res) => {
    try {
      assertUser(req.user);
      const orgId = req.user.organizationId;
      
      const allCampaigns = await db.select().from(campaigns).where(eq(campaigns.organizationId, orgId));
      
      res.json({ totalCampaigns: allCampaigns.length });
    } catch (error) {
      console.error("Error fetching dashboard metrics:", error);
      res.status(500).json({ message: "Error fetching dashboard metrics" });
    }
  });

  // Phishing metrics (return array as expected by frontend)
  app.get("/api/dashboard/phishing-metrics", isAuthenticated, hasOrganization, async (req, res) => {
    try {
      assertUser(req.user);
      const orgId = req.user.organizationId;
      // Use the same implementation as legacy route: return an ARRAY of metrics
      const { storage } = await import('../storage');
      const metrics = await storage.getPhishingMetrics(orgId);
      res.json(metrics);
    } catch (error) {
      console.error("Error fetching phishing metrics:", error);
      res.status(500).json({ message: "Error fetching phishing metrics" });
    }
  });

  // Risk users
  app.get("/api/dashboard/risk-users", isAuthenticated, hasOrganization, async (req, res) => {
    try {
      assertUser(req.user);
      const { storage } = await import('../storage');
      const riskUsers = await storage.getAtRiskUsers(req.user.organizationId);
      res.json(riskUsers);
    } catch (error) {
      console.error("Error fetching risk users:", error);
      res.status(500).json({ message: "Error fetching risk users" });
    }
  });

  // Threats - Real Data (Enhanced with Threat Intelligence)
  app.get("/api/dashboard/threats", isAuthenticated, hasOrganization, async (req, res) => {
    try {
      assertUser(req.user);
      
      // Get threat intelligence analysis
      const { ThreatIntelligenceService } = await import('../services/threat-intelligence/threat-intelligence.service');
      const threatService = new ThreatIntelligenceService();
      const threatAnalysis = await threatService.getThreatAnalysis(req.user.organizationId);
      
      // Get recent threats from threat intelligence
      const recentThreats = await threatService.getRecentThreats(5);
      
      // Convert threat intelligence to dashboard format
      const threatData = recentThreats.map(threat => {
        let level: 'high' | 'medium' | 'low';
        let severity: 'High' | 'Medium' | 'Low';
        
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
          type: threat.threatType || 'unknown',
          severity,
          description: threat.description || `${threat.threatType} detected: ${threat.indicator}`,
          timestamp: threat.firstSeen || threat.createdAt,
          source: threat.source || 'Unknown',
          indicator: threat.indicator,
          level,
        };
      });
      
      // Count threats by severity
      const critical = threatData.filter(t => t.level === 'high').length;
      const high = threatData.filter(t => t.level === 'medium').length;
      
      res.json({
        total: threatData.length,
        critical,
        high,
        threats: threatData,
        ...threatAnalysis
      });
    } catch (error) {
      console.error("Error fetching dashboard threats:", error);
      res.status(500).json({ message: "Error fetching dashboard threats" });
    }
  });

  // Trainings (placeholder)
  app.get("/api/dashboard/trainings", isAuthenticated, (req, res) => {
    res.json({ 
      completed: 0, 
      pending: 0, 
      trainings: [] 
    });
  });
}
