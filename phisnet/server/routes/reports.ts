import type { Express } from 'express';
import { isAuthenticated, hasOrganization } from '../auth';
import { storage } from '../storage';
import { db } from '../db';
import { campaigns, users, campaignResults, targets, reportSchedules } from '@shared/schema';
import { insertReportScheduleSchema } from '@shared/schema';
import { eq, and, gte, lte, inArray } from 'drizzle-orm';
import { z } from 'zod';
import path from 'path';
import fs from 'fs';
import { exportReport, type ExportFormat } from '../utils/report-exporter-enhanced';

function assertUser(user: Express.User | undefined): asserts user is Express.User {
  if (!user) {
    throw new Error('User not authenticated');
  }
}

export function registerReportRoutes(app: Express) {
  // Export report in various formats
  app.post("/api/reports/export", isAuthenticated, hasOrganization, async (req, res) => {
    try {
      assertUser(req.user);
      const { type, dateRange, format = 'pdf', theme = 'dark' } = req.body;

      // Validate format
      const validFormats: ExportFormat[] = ['pdf', 'xlsx', 'json', 'csv'];
      const exportFormat = validFormats.includes(format) ? format : 'pdf';

      let reportData: any = {
        type,
        organizationName: req.user.organizationName,
        theme: theme, // Pass theme to exporter
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

      // Fetch report data based on type
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
        // Get comprehensive data
        const compCampaigns = await db.select().from(campaigns).where(dateFilter);
        const compUsers = await db.select().from(users).where(eq(users.organizationId, req.user.organizationId));
        const compResults = await db.select().from(campaignResults)
          .innerJoin(campaigns, eq(campaignResults.campaignId, campaigns.id))
          .where(dateFilter);
        
        reportData.campaigns = compCampaigns;
        reportData.users = compUsers;
        reportData.results = compResults;
        
        // Calculate summary metrics
        const allResults = compResults.map(r => r.campaign_results);
        const totalEmailsSent = allResults.length;
        const clickedCount = allResults.filter(r => r.clicked).length;
        const atRiskUsersSet = new Set<number>();
        for (const r of allResults) {
          if (r.clicked || r.submitted) atRiskUsersSet.add(r.targetId);
        }
        
        reportData.summary = {
          totalCampaigns: compCampaigns.length,
          totalEmailsSent,
          successRate: totalEmailsSent > 0 ? Math.round((clickedCount / totalEmailsSent) * 100) : 0,
          atRiskUsers: atRiskUsersSet.size,
        };
      }
      
      // Use enhanced exporter with format support
      const filename = await exportReport(reportData, exportFormat);
      
      res.json({ 
        success: true,
        filename,
        downloadUrl: `/api/reports/download/${filename}`,
        format: exportFormat
      });
    } catch (error) {
      console.error("Error exporting report:", error);
      res.status(500).json({ message: "Error exporting report", error: error instanceof Error ? error.message : 'Unknown error' });
    }
  });

  // Download report file
  app.get("/api/reports/download/:filename", isAuthenticated, (req, res) => {
    try {
      const filename = req.params.filename;
      const filepath = path.join(process.cwd(), 'uploads', filename);

      if (!fs.existsSync(filepath)) {
        return res.status(404).json({ message: "File not found" });
      }

      const onDownload = (err?: Error) => {
        if (err) {
          console.error("Error downloading file:", err);
          res.status(500).json({ message: "Error downloading file" });
          return;
        }
        // Clean up file after download
        const cleanup = async () => {
          try {
            await fs.promises.unlink(filepath);
          } catch (unlinkErr) {
            console.error("Error deleting file:", unlinkErr);
          }
        };
        setTimeout(() => { void cleanup(); }, 5000);
      };

      res.download(filepath, filename, onDownload);
    } catch (error) {
      console.error("Error serving download:", error);
      res.status(500).json({ message: "Error serving download" });
    }
  });

  // Get report data for dashboard
  app.get("/api/reports/data", isAuthenticated, hasOrganization, async (req, res) => {
    try {
      assertUser(req.user);
      const orgId = req.user.organizationId;

      // Parse optional date range (default to 1 year)
      const endParam = typeof req.query.endDate === 'string' ? new Date(req.query.endDate) : undefined;
      const startParam = typeof req.query.startDate === 'string' ? new Date(req.query.startDate) : undefined;
      const endDate = endParam && !Number.isNaN(endParam.getTime()) ? endParam : new Date();
      const startDate = startParam && !Number.isNaN(startParam.getTime()) ? startParam : new Date(new Date().setDate(new Date().getDate() - 365));

      // Fetch campaigns in range
      const orgCampaigns = await db.select().from(campaigns)
        .where(and(eq(campaigns.organizationId, orgId), gte(campaigns.createdAt, startDate), lte(campaigns.createdAt, endDate)));

      const campaignIds = orgCampaigns.map(c => c.id);

      // Fetch results for those campaigns
      const allResults = campaignIds.length > 0
        ? await db.select().from(campaignResults)
            .where(inArray(campaignResults.campaignId, campaignIds))
        : [];

      // Summary metrics
      const totalCampaigns = orgCampaigns.length;
      const totalEmailsSent = allResults.length;
      const clickedCount = allResults.filter(r => r.clicked).length;
      const atRiskUsersSet = new Set<number>();
      for (const r of allResults) {
        if (r.clicked || r.submitted) atRiskUsersSet.add(r.targetId);
      }
      const atRiskUsers = atRiskUsersSet.size;
      const successRate = totalEmailsSent > 0 ? Math.round((clickedCount / totalEmailsSent) * 100) : 0;

      // Monthly time series using campaign createdAt buckets
      const monthKey = (d: Date) => d.toLocaleString('en-US', { month: 'short', year: 'numeric' });
      const monthBuckets = new Map<string, { sent: number; opened: number; clicked: number; submitted: number }>();
      for (const c of orgCampaigns) {
        const key = monthKey(new Date(c.createdAt));
        if (!monthBuckets.has(key)) monthBuckets.set(key, { sent: 0, opened: 0, clicked: 0, submitted: 0 });
        const bucket = monthBuckets.get(key)!;
        const results = allResults.filter(r => r.campaignId === c.id);
        bucket.sent += results.length;
        bucket.opened += results.filter(r => r.opened).length;
        bucket.clicked += results.filter(r => r.clicked).length;
        bucket.submitted += results.filter(r => r.submitted).length;
      }
      const monthly = Array.from(monthBuckets.entries())
        .map(([name, vals]) => ({ name, ...vals }))
        .sort((a, b) => new Date(a.name).getTime() - new Date(b.name).getTime());

      // Campaign types distribution (use status buckets)
      const statusTitle = (s: string) => {
        const v = (s || '').toLowerCase();
        if (v === 'active') return 'Active';
        if (v === 'scheduled') return 'Scheduled';
        if (v === 'completed') return 'Completed';
        if (v === 'draft') return 'Draft';
        return (s || 'Unknown');
      };
      const typeCounts = new Map<string, number>();
      for (const c of orgCampaigns) {
        const key = statusTitle(String(c.status || 'Draft'));
        typeCounts.set(key, (typeCounts.get(key) || 0) + 1);
      }
      const campaignTypes = Array.from(typeCounts.entries()).map(([name, value]) => ({ name, value }));

      // Campaign table data
      const campaignsTable = orgCampaigns.map(c => {
        const results = allResults.filter(r => r.campaignId === c.id);
        const sent = results.length;
        const opened = results.filter(r => r.opened).length;
        const clicked = results.filter(r => r.clicked).length;
        const success = sent > 0 ? Math.round((clicked / sent) * 100) : 0;
        return {
          id: c.id,
          name: c.name,
          status: statusTitle(String(c.status || 'Draft')),
          sentCount: sent,
          openedCount: opened,
          clickedCount: clicked,
          successRate: success,
        };
      });

      // Users (targets) table data
      const targetAgg = new Map<number, { sent: number; clicked: number; submitted: number }>();
      for (const r of allResults) {
        const rec = targetAgg.get(r.targetId) || { sent: 0, clicked: 0, submitted: 0 };
        rec.sent += 1;
        if (r.clicked) rec.clicked += 1;
        if (r.submitted) rec.submitted += 1;
        targetAgg.set(r.targetId, rec);
      }
      let usersTable: any[] = [];
      if (targetAgg.size > 0) {
        const targetIds = Array.from(targetAgg.keys());
        const targetRows = await db.select().from(targets)
          .where(inArray(targets.id, targetIds));
        usersTable = targetRows.map(t => {
          const agg = targetAgg.get(t.id)!;
          const success = agg.sent > 0 ? Math.round((agg.clicked / agg.sent) * 100) : 0;
          let riskLevel: 'High Risk' | 'Medium Risk' | 'Low Risk' = 'Low Risk';
          const riskScore = agg.clicked + agg.submitted * 2;
          if (riskScore >= 3) riskLevel = 'High Risk';
          else if (riskScore >= 2) riskLevel = 'Medium Risk';
          return {
            id: t.id,
            name: `${t.firstName} ${t.lastName}`.trim(),
            department: t.department || 'Unknown',
            riskLevel,
            totalCampaigns: agg.sent,
            clickedCount: agg.clicked,
            submittedCount: agg.submitted,
            successRate: success,
          };
        });
      }

      // Trend data
      const trendData = monthly.map(m => {
        const sent = m.sent || 0;
        const clicked = m.clicked || 0;
        const sr = sent > 0 ? Math.round((clicked / sent) * 100) : 0;
        const awareness = Math.max(0, 100 - sr);
        return { month: m.name, successRate: sr, awareness };
      });

      const response = {
        summary: {
          totalCampaigns,
          totalEmailsSent,
          successRate,
          atRiskUsers,
        },
        chartData: {
          monthly,
          campaignTypes,
        },
        campaigns: campaignsTable,
        users: usersTable,
        trendData,
      };

      res.json(response);
    } catch (error) {
      console.error("Error generating report data:", error);
      res.status(500).json({ message: "Error generating report data" });
    }
  });

  // List report schedules
  app.get("/api/reports/schedules", isAuthenticated, hasOrganization, async (req, res) => {
    try {
      assertUser(req.user);
      const orgId = req.user.organizationId;

      const schedules = await db.select()
        .from(reportSchedules)
        .where(eq(reportSchedules.organizationId, orgId))
        .orderBy(reportSchedules.createdAt);

      res.json(schedules);
    } catch (error) {
      console.error("Error fetching report schedules:", error);
      res.status(500).json({ message: "Error fetching report schedules" });
    }
  });

  // Create report schedule
  app.post("/api/reports/schedules", isAuthenticated, hasOrganization, async (req, res) => {
    try {
      assertUser(req.user);
      const orgId = req.user.organizationId;

      const scheduleData = insertReportScheduleSchema.parse(req.body);

      // Calculate next run time based on cadence
      const now = new Date();
      const [hours, minutes] = scheduleData.timeOfDay.split(':').map(Number);
      const nextRun = new Date();
      nextRun.setHours(hours, minutes, 0, 0);
      
      if (nextRun <= now) {
        switch (scheduleData.cadence) {
          case 'daily':
            nextRun.setDate(nextRun.getDate() + 1);
            break;
          case 'weekly':
            nextRun.setDate(nextRun.getDate() + 7);
            break;
          case 'monthly':
            nextRun.setMonth(nextRun.getMonth() + 1);
            break;
        }
      }

      const [newSchedule] = await db.insert(reportSchedules)
        .values({
          ...scheduleData,
          organizationId: orgId,
          nextRunAt: nextRun,
        })
        .returning();

      res.status(201).json(newSchedule);
    } catch (error) {
      console.error("Error creating report schedule:", error);
      if (error instanceof z.ZodError) {
        res.status(400).json({ message: "Invalid schedule data", errors: error.errors });
      } else {
        res.status(500).json({ message: "Error creating report schedule" });
      }
    }
  });

  // Update report schedule
  app.put("/api/reports/schedules/:id", isAuthenticated, hasOrganization, async (req, res) => {
    try {
      assertUser(req.user);
      const orgId = req.user.organizationId;
      const scheduleId = Number.parseInt(req.params.id, 10);

      const existing = await db.select()
        .from(reportSchedules)
        .where(and(
          eq(reportSchedules.id, scheduleId),
          eq(reportSchedules.organizationId, orgId)
        ))
        .limit(1);

      if (existing.length === 0) {
        res.status(404).json({ message: "Schedule not found" });
        return;
      }

      const scheduleData = insertReportScheduleSchema.partial().parse(req.body);

      // Recalculate next run if time or cadence changed
      let nextRun = existing[0].nextRunAt;
      if (scheduleData.timeOfDay || scheduleData.cadence) {
        const timeOfDay = scheduleData.timeOfDay || existing[0].timeOfDay;
        const [hours, minutes] = timeOfDay.split(':').map(Number);
        const now = new Date();
        nextRun = new Date();
        nextRun.setHours(hours, minutes, 0, 0);
        
        if (nextRun <= now) {
          const cadence = scheduleData.cadence || existing[0].cadence;
          switch (cadence) {
            case 'daily':
              nextRun.setDate(nextRun.getDate() + 1);
              break;
            case 'weekly':
              nextRun.setDate(nextRun.getDate() + 7);
              break;
            case 'monthly':
              nextRun.setMonth(nextRun.getMonth() + 1);
              break;
          }
        }
      }

      const [updated] = await db.update(reportSchedules)
        .set({
          ...scheduleData,
          nextRunAt: nextRun,
          updatedAt: new Date(),
        })
        .where(eq(reportSchedules.id, scheduleId))
        .returning();

      res.json(updated);
    } catch (error) {
      console.error("Error updating report schedule:", error);
      if (error instanceof z.ZodError) {
        res.status(400).json({ message: "Invalid schedule data", errors: error.errors });
      } else {
        res.status(500).json({ message: "Error updating report schedule" });
      }
    }
  });

  // Delete report schedule
  app.delete("/api/reports/schedules/:id", isAuthenticated, hasOrganization, async (req, res) => {
    try {
      assertUser(req.user);
      const orgId = req.user.organizationId;
      const scheduleId = Number.parseInt(req.params.id, 10);

      const existing = await db.select()
        .from(reportSchedules)
        .where(and(
          eq(reportSchedules.id, scheduleId),
          eq(reportSchedules.organizationId, orgId)
        ))
        .limit(1);

      if (existing.length === 0) {
        res.status(404).json({ message: "Schedule not found" });
        return;
      }

      await db.delete(reportSchedules)
        .where(eq(reportSchedules.id, scheduleId));

      res.json({ message: "Schedule deleted successfully" });
    } catch (error) {
      console.error("Error deleting report schedule:", error);
      res.status(500).json({ message: "Error deleting report schedule" });
    }
  });
}
