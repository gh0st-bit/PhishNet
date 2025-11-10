import type { Express } from 'express';
import { isAuthenticated, isAdmin } from '../auth';
import { ThreatIntelligenceService } from '../services/threat-intelligence/threat-intelligence.service';
import { threatFeedScheduler } from '../services/threat-intelligence/threat-feed-scheduler';

function assertUser(user: Express.User | undefined): asserts user is Express.User {
  if (!user) {
    throw new Error('User not authenticated');
  }
}

export function registerThreatIntelligenceRoutes(app: Express) {
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
      const limit = Number.parseInt(req.query.limit as string, 10) || 50;
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
      
      const limit = Number.parseInt(req.query.limit as string, 10) || 20;
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
        const intervalHours = Number.parseInt(String(req.body.intervalHours), 10) || 2;
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
}
