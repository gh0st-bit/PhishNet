import type { Express } from "express";
import { isAuthenticated, hasOrganization, isAdminOrOrgAdmin } from "../auth";
import { pool } from "../db";
import { z } from "zod";
export function registerReportedMessages(app: Express) {
  app.post(
    "/api/employee/report-message",
    isAuthenticated,
    hasOrganization,
    async (req, res) => {
      const body = z
        .object({
          messageKey: z.string().trim().min(1).max(500),
          subject: z.string().max(300).default(""),
        })
        .parse(req.body);
      const org = req.user!.organizationId,
        client = await pool.connect();
      try {
        await client.query("BEGIN");
        const {
          rows: [match],
        } = await client.query(
          `SELECT d.campaign_id,d.target_id FROM campaign_dispatch d JOIN targets t ON t.id=d.target_id WHERE d.organization_id=$1 AND d.message_id=$2 AND t.employee_id=$3 AND d.state='accepted'`,
          [org, body.messageKey, req.user!.id],
        );
        const result = await client.query(
          `INSERT INTO reported_messages(organization_id,reporter_id,message_key,subject,campaign_id,target_id,status) VALUES($1,$2,$3,$4,$5,$6,$7) ON CONFLICT(organization_id,reporter_id,message_key) DO NOTHING RETURNING id`,
          [
            org,
            req.user!.id,
            body.messageKey,
            body.subject,
            match?.campaign_id ?? null,
            match?.target_id ?? null,
            match ? "matched" : "unmatched",
          ],
        );
        if (match && result.rowCount) {
          const changed = await client.query(
            `UPDATE campaign_results SET reported=true,reported_at=now(),updated_at=now() WHERE campaign_id=$1 AND target_id=$2 AND organization_id=$3 AND sent AND NOT reported RETURNING id`,
            [match.campaign_id, match.target_id, org],
          );
          if (changed.rowCount)
            await client.query(
              `INSERT INTO campaign_events(organization_id,campaign_id,target_id,event_type,suspected_automated) VALUES($1,$2,$3,'reported',false)`,
              [org, match.campaign_id, match.target_id],
            );
        }
        await client.query("COMMIT");
        res
          .status(result.rowCount ? 201 : 200)
          .json({
            received: true,
            duplicate: !result.rowCount,
            matched: !!match,
            message:
              "Thank you for reporting. Your security team can review the report.",
          });
      } catch (error) {
        await client.query("ROLLBACK");
        throw error;
      } finally {
        client.release();
      }
    },
  );
  app.get(
    "/api/pilot/reported-messages",
    isAuthenticated,
    hasOrganization,
    isAdminOrOrgAdmin,
    async (req, res) =>
      res.json(
        (
          await pool.query(
            "SELECT id,reporter_id,subject,status,created_at FROM reported_messages WHERE organization_id=$1 ORDER BY id DESC LIMIT 100",
            [req.user!.organizationId],
          )
        ).rows,
      ),
  );
}
