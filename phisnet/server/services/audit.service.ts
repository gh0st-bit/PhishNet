import { eq, desc, and, gte, lte, sql, like } from "drizzle-orm";
import { db } from "../db";
import { auditLogs, users } from "@shared/schema";
import type { AuditLog } from "@shared/schema";

export interface AuditContext {
  userId?: number;
  organizationId: number;
  ip?: string;
  userAgent?: string;
}

export interface AuditLogFilter {
  organizationId: number;
  userId?: number;
  action?: string;
  resource?: string;
  startDate?: Date;
  endDate?: Date;
  limit?: number;
  offset?: number;
}

export class AuditService {
  /**
   * Log an audit event
   */
  static async log(params: {
    context: AuditContext;
    action: string;
    resource?: string;
    resourceId?: number;
    metadata?: Record<string, any>;
  }): Promise<AuditLog> {
    const { context, action, resource, resourceId, metadata } = params;

    const [entry] = await db
      .insert(auditLogs)
      .values({
        organizationId: context.organizationId,
        userId: context.userId,
        action,
        resource,
        resourceId,
        ip: context.ip,
        userAgent: context.userAgent,
        metadata: metadata || {},
      })
      .returning();

    return entry;
  }

  /**
   * Retrieve audit logs with filters and pagination
   */
  static async getLogs(filter: AuditLogFilter): Promise<{
    logs: Array<AuditLog & { user?: { firstName: string; lastName: string; email: string } }>;
    total: number;
  }> {
    const conditions = [eq(auditLogs.organizationId, filter.organizationId)];

    if (filter.userId) {
      conditions.push(eq(auditLogs.userId, filter.userId));
    }
    if (filter.action) {
      conditions.push(like(auditLogs.action, `%${filter.action}%`));
    }
    if (filter.resource) {
      conditions.push(like(auditLogs.resource, `%${filter.resource}%`));
    }
    if (filter.startDate) {
      conditions.push(gte(auditLogs.createdAt, filter.startDate));
    }
    if (filter.endDate) {
      conditions.push(lte(auditLogs.createdAt, filter.endDate));
    }

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    // Count total
    const [{ count }] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(auditLogs)
      .where(whereClause);

    // Fetch logs with user info
    const logs = await db
      .select({
        id: auditLogs.id,
        organizationId: auditLogs.organizationId,
        userId: auditLogs.userId,
        action: auditLogs.action,
        resource: auditLogs.resource,
        resourceId: auditLogs.resourceId,
        ip: auditLogs.ip,
        userAgent: auditLogs.userAgent,
        metadata: auditLogs.metadata,
        createdAt: auditLogs.createdAt,
        userFirstName: users.firstName,
        userLastName: users.lastName,
        userEmail: users.email,
      })
      .from(auditLogs)
      .leftJoin(users, eq(auditLogs.userId, users.id))
      .where(whereClause)
      .orderBy(desc(auditLogs.createdAt))
      .limit(filter.limit || 50)
      .offset(filter.offset || 0);

    return {
      logs: logs.map((log) => ({
        id: log.id,
        organizationId: log.organizationId,
        userId: log.userId,
        action: log.action,
        resource: log.resource,
        resourceId: log.resourceId,
        ip: log.ip,
        userAgent: log.userAgent,
        metadata: log.metadata as Record<string, any>,
        createdAt: log.createdAt,
        user:
          log.userFirstName && log.userLastName && log.userEmail
            ? {
                firstName: log.userFirstName,
                lastName: log.userLastName,
                email: log.userEmail,
              }
            : undefined,
      })),
      total: count,
    };
  }

  /**
   * Get a single audit log entry by ID
   */
  static async getLogById(
    id: number,
    organizationId: number
  ): Promise<(AuditLog & { user?: { firstName: string; lastName: string; email: string } }) | null> {
    const [result] = await db
      .select({
        id: auditLogs.id,
        organizationId: auditLogs.organizationId,
        userId: auditLogs.userId,
        action: auditLogs.action,
        resource: auditLogs.resource,
        resourceId: auditLogs.resourceId,
        ip: auditLogs.ip,
        userAgent: auditLogs.userAgent,
        metadata: auditLogs.metadata,
        createdAt: auditLogs.createdAt,
        userFirstName: users.firstName,
        userLastName: users.lastName,
        userEmail: users.email,
      })
      .from(auditLogs)
      .leftJoin(users, eq(auditLogs.userId, users.id))
      .where(and(eq(auditLogs.id, id), eq(auditLogs.organizationId, organizationId)))
      .limit(1);

    if (!result) return null;

    return {
      id: result.id,
      organizationId: result.organizationId,
      userId: result.userId,
      action: result.action,
      resource: result.resource,
      resourceId: result.resourceId,
      ip: result.ip,
      userAgent: result.userAgent,
      metadata: result.metadata as Record<string, any>,
      createdAt: result.createdAt,
      user:
        result.userFirstName && result.userLastName && result.userEmail
          ? {
              firstName: result.userFirstName,
              lastName: result.userLastName,
              email: result.userEmail,
            }
          : undefined,
    };
  }

  /**
   * Export audit logs to CSV format
   */
  static async exportToCSV(filter: AuditLogFilter): Promise<string> {
    const { logs } = await this.getLogs({ ...filter, limit: 10000, offset: 0 });

    const headers = ["ID", "Timestamp", "User", "Action", "Resource", "Resource ID", "IP", "Metadata"];
    const rows = logs.map((log) => [
      log.id,
      log.createdAt.toISOString(),
      log.user ? `${log.user.firstName} ${log.user.lastName} (${log.user.email})` : "System",
      log.action,
      log.resource || "",
      log.resourceId?.toString() || "",
      log.ip || "",
      JSON.stringify(log.metadata || {}),
    ]);

    return [headers, ...rows].map((row) => row.map((cell) => `"${cell}"`).join(",")).join("\n");
  }
}
