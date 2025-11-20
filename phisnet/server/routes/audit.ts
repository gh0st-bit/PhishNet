import type { Express } from "express";
import { isAuthenticated, isAdmin } from "../auth";
import { AuditService } from "../services/audit.service";
import { z } from "zod";

const auditQuerySchema = z.object({
  userId: z.coerce.number().optional(),
  action: z.string().optional(),
  resource: z.string().optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  limit: z.coerce.number().min(1).max(1000).optional().default(50),
  offset: z.coerce.number().min(0).optional().default(0),
});

export function registerAuditRoutes(app: Express) {
  /**
   * GET /api/audit/logs - Retrieve audit logs (admin only)
   */
  app.get("/api/audit/logs", isAuthenticated, isAdmin, async (req, res) => {
    try {
      const user = (req as any).user;
      if (!user || !user.organizationId) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      const query = auditQuerySchema.parse(req.query);

      const result = await AuditService.getLogs({
        organizationId: user.organizationId,
        userId: query.userId,
        action: query.action,
        resource: query.resource,
        startDate: query.startDate ? new Date(query.startDate) : undefined,
        endDate: query.endDate ? new Date(query.endDate) : undefined,
        limit: query.limit,
        offset: query.offset,
      });

      res.json(result);
    } catch (error: any) {
      console.error("[Audit API] Failed to retrieve logs:", error);
      res.status(500).json({ message: error.message || "Failed to retrieve audit logs" });
    }
  });

  /**
   * GET /api/audit/logs/:id - Get single audit log entry (admin only)
   */
  app.get("/api/audit/logs/:id", isAuthenticated, isAdmin, async (req, res) => {
    try {
      const user = (req as any).user;
      if (!user || !user.organizationId) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      const id = parseInt(req.params.id, 10);
      if (Number.isNaN(id)) {
        return res.status(400).json({ message: "Invalid audit log ID" });
      }

      const log = await AuditService.getLogById(id, user.organizationId);
      if (!log) {
        return res.status(404).json({ message: "Audit log not found" });
      }

      res.json(log);
    } catch (error: any) {
      console.error("[Audit API] Failed to retrieve log:", error);
      res.status(500).json({ message: error.message || "Failed to retrieve audit log" });
    }
  });

  /**
   * GET /api/audit/export - Export audit logs to CSV (admin only)
   */
  app.get("/api/audit/export", isAuthenticated, isAdmin, async (req, res) => {
    try {
      const user = (req as any).user;
      if (!user || !user.organizationId) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      const query = auditQuerySchema.parse(req.query);

      const csv = await AuditService.exportToCSV({
        organizationId: user.organizationId,
        userId: query.userId,
        action: query.action,
        resource: query.resource,
        startDate: query.startDate ? new Date(query.startDate) : undefined,
        endDate: query.endDate ? new Date(query.endDate) : undefined,
      });

      res.setHeader("Content-Type", "text/csv");
      res.setHeader("Content-Disposition", `attachment; filename="audit-logs-${Date.now()}.csv"`);
      res.send(csv);
    } catch (error: any) {
      console.error("[Audit API] Failed to export logs:", error);
      res.status(500).json({ message: error.message || "Failed to export audit logs" });
    }
  });
}
