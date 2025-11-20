import { db } from '../db';
import { organizations, auditLogs, notificationsSchema, campaignResults } from '@shared/schema';
import { sql } from 'drizzle-orm';

export interface DataRetentionSummary {
  ranAt: string;
  perOrganization: Array<{
    organizationId: number;
    days: number;
    cutoff: string;
    deletedAuditLogs: number;
    deletedNotifications: number;
    clearedSubmittedData: number;
  }>;
}

export class DataRetentionService {
  static async runCleanup(dryRun: boolean = false): Promise<DataRetentionSummary> {
    const now = new Date();
    const orgs = await db.select().from(organizations);
    const perOrganization: DataRetentionSummary['perOrganization'] = [];

    for (const org of orgs) {
      const days = Math.max(0, org.dataRetentionDays ?? 365);
      const cutoff = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);

      // Count candidates first
      const auditResult = await db.execute<{ count: string }>(
        sql`SELECT COUNT(*)::int AS count FROM ${auditLogs} WHERE ${auditLogs.organizationId} = ${org.id} AND ${auditLogs.createdAt} <= ${cutoff}`
      );
      const notifResult = await db.execute<{ count: string }>(
        sql`SELECT COUNT(*)::int AS count FROM ${notificationsSchema} WHERE ${notificationsSchema.organizationId} = ${org.id} AND ${notificationsSchema.createdAt} <= ${cutoff}`
      );
      const submittedResult = await db.execute<{ count: string }>(
        sql`SELECT COUNT(*)::int AS count FROM ${campaignResults} WHERE ${campaignResults.organizationId} = ${org.id} AND ${campaignResults.submittedData} IS NOT NULL AND ${campaignResults.submittedAt} IS NOT NULL AND ${campaignResults.submittedAt} <= ${cutoff}`
      );
      
      const auditCount = auditResult.rows?.[0]?.count || '0';
      const notifCount = notifResult.rows?.[0]?.count || '0';
      const submittedCount = submittedResult.rows?.[0]?.count || '0';

      let deletedAuditLogs = Number(auditCount) || 0;
      let deletedNotifications = Number(notifCount) || 0;
      let clearedSubmittedData = Number(submittedCount) || 0;

      if (!dryRun) {
        if (deletedAuditLogs > 0) {
          await db.execute(sql`DELETE FROM ${auditLogs} WHERE ${auditLogs.organizationId} = ${org.id} AND ${auditLogs.createdAt} <= ${cutoff}`);
        }
        if (deletedNotifications > 0) {
          await db.execute(sql`DELETE FROM ${notificationsSchema} WHERE ${notificationsSchema.organizationId} = ${org.id} AND ${notificationsSchema.createdAt} <= ${cutoff}`);
        }
        if (clearedSubmittedData > 0) {
          await db.execute(
            sql`UPDATE ${campaignResults} SET ${campaignResults.submittedData} = NULL WHERE ${campaignResults.organizationId} = ${org.id} AND ${campaignResults.submittedData} IS NOT NULL AND ${campaignResults.submittedAt} IS NOT NULL AND ${campaignResults.submittedAt} <= ${cutoff}`
          );
        }
      }

      perOrganization.push({
        organizationId: org.id,
        days,
        cutoff: cutoff.toISOString(),
        deletedAuditLogs,
        deletedNotifications,
        clearedSubmittedData,
      });
    }

    return { ranAt: now.toISOString(), perOrganization };
  }
}
