import type { Express } from "express";
import { isAuthenticated, hasOrganization, isAdminOrOrgAdmin } from "../auth";
import { pool } from "../db";
import { z } from "zod";
import { previewEmployees } from "../services/pilot-onboarding";
import { METRIC_DEFINITIONS } from "@shared/product-metrics";
export function registerPilot(app: Express) {
  app.use("/api/pilot", isAuthenticated, hasOrganization, isAdminOrOrgAdmin);
  app.get("/api/pilot/readiness", async (req, res) => {
    const org = req.user!.organizationId;
    const {
      rows: [counts],
    } = await pool.query(
      `SELECT (SELECT count(*)::int FROM users WHERE organization_id=$1 AND is_active) AS employees,
   (SELECT count(*)::int FROM teams WHERE organization_id=$1) AS teams,(SELECT count(*)::int FROM smtp_profiles WHERE organization_id=$1) AS senders,
   (SELECT count(*)::int FROM email_templates WHERE organization_id=$1) AS templates,(SELECT count(*)::int FROM landing_pages WHERE organization_id=$1) AS landing_pages,
   (SELECT count(*)::int FROM training_modules WHERE organization_id=$1) AS learning,(SELECT count(*)::int FROM user_invites WHERE organization_id=$1 AND accepted_at IS NULL AND expires_at>now()) AS invitations`,
      [org],
    );
    const checks = [
      ["employees", "Add or invite employees", counts.employees > 1],
      ["teams", "Assign teams and managers", counts.teams > 0],
      ["senders", "Configure a sending connection", counts.senders > 0],
      [
        "templates",
        "Choose simulation content",
        counts.templates > 0 && counts.landing_pages > 0,
      ],
      ["learning", "Prepare follow-up learning", counts.learning > 0],
    ];
    const {rows:connections}=await pool.query(`SELECT p.id,p.name,o.profile_id AS oauth_profile,CASE WHEN o.enabled AND (o.client_secret IS NULL OR o.client_secret='') THEN 'Needs attention' ELSE 'Configured - unverified' END AS status FROM smtp_profiles p LEFT JOIN smtp_oauth_connections o ON o.profile_id=p.id WHERE p.organization_id=$1`,[org]);
    res.json({
      integrations:{microsoft365:connections.some(c=>c.oauth_profile)?'Configured - unverified':'Not configured',connections,reportingMailbox:'Not configured',verification:'External authentication, client installation, and controlled delivery have not been verified.'},
      counts,
      checks: checks.map(([id, label, complete]) => ({ id, label, complete })),
      metrics: METRIC_DEFINITIONS,
      externalDeliveryVerified: false,
      workerDeliveryPaused: process.env.WORKER_DELIVERY_PAUSED === "true",
      mailMode:
        process.env.MAIL_TRANSPORT === "sink"
          ? "local-only"
          : "external-configured",
      message:
        "Configuration checks do not prove external mail delivery. No messages are sent by this review.",
    });
  });
  const importBody = z.object({
    csv: z.string().max(1000000),
    mapping: z.object({
      email: z.string(),
      firstName: z.string().optional(),
      lastName: z.string().optional(),
    }),
  });
  app.post("/api/pilot/import/preview", async (req, res) => {
    const { csv, mapping } = importBody.parse(req.body);
    const result = previewEmployees(csv, mapping);
    const existing = (
      await pool.query(
        "SELECT lower(email) AS email FROM users WHERE organization_id=$1",
        [req.user!.organizationId],
      )
    ).rows;
    const emails = new Set(existing.map((u) => u.email));
    res.json({
      ...result,
      rows: result.rows.map((row) => ({
        ...row,
        status: row.error
          ? "invalid"
          : emails.has(row.email)
            ? "existing"
            : "new",
      })),
    });
  });
  app.post("/api/pilot/import/save", async (req, res) => {
    const { csv, mapping } = importBody.parse(req.body);
    const result = previewEmployees(csv, mapping);
    if (result.rows.some((r) => r.error))
      return res
        .status(400)
        .json({ message: "Resolve invalid rows before saving", ...result });
    const {
      rows: [saved],
    } = await pool.query(
      "INSERT INTO onboarding_imports(organization_id,created_by,rows) VALUES($1,$2,$3) RETURNING id",
      [req.user!.organizationId, req.user!.id, JSON.stringify(result.rows)],
    );
    res
      .status(201)
      .json({
        id: saved.id,
        count: result.rows.length,
        message: "Import saved. No invitations or accounts were created.",
      });
  });
  app.get("/api/pilot/imports", async (req, res) =>
    res.json(
      (
        await pool.query(
          "SELECT id,rows,created_at FROM onboarding_imports WHERE organization_id=$1 ORDER BY id DESC LIMIT 20",
          [req.user!.organizationId],
        )
      ).rows,
    ),
  );
  app.get("/api/pilot/teams", async (req, res) =>
    res.json(
      (
        await pool.query(
          `SELECT t.*,COALESCE((SELECT json_agg(user_id) FROM team_members WHERE team_id=t.id),'[]') AS members,COALESCE((SELECT json_agg(user_id) FROM team_managers WHERE team_id=t.id),'[]') AS managers FROM teams t WHERE organization_id=$1 ORDER BY name`,
          [req.user!.organizationId],
        )
      ).rows,
    ),
  );
  const teamBody = z.object({
    name: z.string().trim().min(1).max(100),
    members: z.array(z.number().int().positive()).max(1000),
    managers: z.array(z.number().int().positive()).max(100),
  });
  const teamWrite = async (req: any, res: any) => {
    const data = teamBody.parse(req.body),
      org = req.user.organizationId,
      client = await pool.connect();
    try {
      await client.query("BEGIN");
      const ids = [...new Set([...data.members, ...data.managers])];
      const valid = await client.query(
        "SELECT id FROM users WHERE organization_id=$1 AND id=ANY($2::int[]) AND is_active",
        [org, ids],
      );
      if (valid.rowCount !== ids.length)
        return await client
          .query("ROLLBACK")
          .then(() =>
            res
              .status(400)
              .json({ message: "Choose active users in this organization" }),
          );
      const managers = await client.query(
        `SELECT DISTINCT u.id FROM users u JOIN user_roles ur ON ur.user_id=u.id JOIN roles r ON r.id=ur.role_id WHERE u.organization_id=$1 AND u.id=ANY($2::int[]) AND r.name='Manager'`,
        [org, data.managers],
      );
      if (managers.rowCount !== new Set(data.managers).size)
        return await client
          .query("ROLLBACK")
          .then(() =>
            res
              .status(400)
              .json({ message: "Team managers must have the Manager role" }),
          );
      let id = Number(req.params.id);
      if (req.method === "POST")
        id = (
          await client.query(
            "INSERT INTO teams(organization_id,name) VALUES($1,$2) RETURNING id",
            [org, data.name],
          )
        ).rows[0].id;
      else if (
        !(
          await client.query(
            "UPDATE teams SET name=$3 WHERE id=$1 AND organization_id=$2 RETURNING id",
            [id, org, data.name],
          )
        ).rowCount
      )
        return await client
          .query("ROLLBACK")
          .then(() => res.status(404).json({ message: "Team not found" }));
      await client.query(
        "DELETE FROM team_members WHERE team_id=$1 AND organization_id=$2",
        [id, org],
      );
      await client.query(
        "DELETE FROM team_managers WHERE team_id=$1 AND organization_id=$2",
        [id, org],
      );
      for (const userId of new Set(data.members))
        await client.query(
          "INSERT INTO team_members(team_id,user_id,organization_id) VALUES($1,$2,$3)",
          [id, userId, org],
        );
      for (const userId of new Set(data.managers))
        await client.query(
          "INSERT INTO team_managers(team_id,user_id,organization_id) VALUES($1,$2,$3)",
          [id, userId, org],
        );
      await client.query("COMMIT");
      res.status(req.method === "POST" ? 201 : 200).json({ id, ...data });
    } catch (error: any) {
      await client.query("ROLLBACK");
      if (error.code === "23505")
        return res
          .status(409)
          .json({ message: "A team with this name already exists" });
      throw error;
    } finally {
      client.release();
    }
  };
  app.post("/api/pilot/teams", teamWrite);
  app.put("/api/pilot/teams/:id", teamWrite);
  app.delete("/api/pilot/teams/:id", async (req, res) => {
    const result = await pool.query(
      "DELETE FROM teams WHERE id=$1 AND organization_id=$2 RETURNING id",
      [Number(req.params.id), req.user!.organizationId],
    );
    res
      .status(result.rowCount ? 200 : 404)
      .json({ deleted: !!result.rowCount });
  });
  app.get(
    "/api/employee/points-history",
    isAuthenticated,
    hasOrganization,
    async (req, res) => {
      const { rows } = await pool.query(
        "SELECT points,reason,occurred_at,historical_balance FROM points_events WHERE user_id=$1 AND organization_id=$2 ORDER BY id DESC LIMIT 200",
        [req.user!.id, req.user!.organizationId],
      );
      res.json({
        events: rows,
        historyAvailableFrom:
          rows.filter((r) => !r.historical_balance).at(-1)?.occurred_at ?? null,
        message:
          "Historical balances are preserved; their original earning dates were not recorded.",
      });
    },
  );
}
