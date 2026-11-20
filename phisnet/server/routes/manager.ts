import type { Express } from "express";
import { isAuthenticated, hasOrganization } from "../auth";
import { appRole } from "@shared/access-control";
import { pool } from "../db";
const scope = `EXISTS(SELECT 1 FROM team_members tm JOIN team_managers mgr ON mgr.team_id=tm.team_id AND mgr.organization_id=tm.organization_id WHERE tm.user_id=u.id AND tm.organization_id=$1 AND mgr.user_id=$2)`;
export function registerManager(app: Express) {
  app.use("/api/manager", isAuthenticated, hasOrganization, (req, res, next) =>
    appRole(req.user) === "Manager"
      ? next()
      : res.status(403).json({ message: "Manager role required" }),
  );
  const load = async (org: number, manager: number) => {
    const args = [org, manager];
    const teams = (
      await pool.query(
        "SELECT t.id,t.name FROM teams t JOIN team_managers m ON m.team_id=t.id WHERE t.organization_id=$1 AND m.user_id=$2 ORDER BY t.name",
        args,
      )
    ).rows;
    const members = (
      await pool.query(
        `SELECT u.id,u.first_name,u.last_name,u.email,
   ((SELECT count(*)::int FROM training_progress p WHERE p.user_id=u.id)+(SELECT count(*)::int FROM learning_path_assignments a WHERE a.user_id=u.id)) AS assigned,
   ((SELECT count(*)::int FROM training_progress p WHERE p.user_id=u.id AND p.status='completed')+(SELECT count(*)::int FROM learning_path_assignments a WHERE a.user_id=u.id AND a.completed_at IS NOT NULL)) AS completed,
   ((SELECT count(*)::int FROM training_progress p WHERE p.user_id=u.id AND p.status<>'completed' AND p.due_date<now())+(SELECT count(*)::int FROM learning_path_assignments a WHERE a.user_id=u.id AND a.completed_at IS NULL AND a.due_at<now())) AS overdue
   FROM users u WHERE u.organization_id=$1 AND u.is_active AND ${scope} ORDER BY u.last_name,u.id`,
        args,
      )
    ).rows;
    const signals = (
      await pool.query(
        `SELECT count(*) FILTER(WHERE r.sent)::int AS accepted,count(*) FILTER(WHERE r.sent AND r.clicked)::int AS clicked,count(*) FILTER(WHERE r.sent AND r.submitted)::int AS submitted,count(*) FILTER(WHERE r.sent AND r.reported)::int AS reported
   FROM campaign_results r JOIN targets t ON t.id=r.target_id JOIN users u ON u.id=t.employee_id WHERE r.organization_id=$1 AND ${scope}`,
        args,
      )
    ).rows[0];
    const assignments = (
      await pool.query(
        `SELECT a.id,u.id AS user_id,u.email,m.title,p.status,a.due_at FROM training_assignments a JOIN users u ON u.id=a.user_id JOIN training_modules m ON m.id=a.module_id JOIN training_progress p ON p.user_id=a.user_id AND p.module_id=a.module_id WHERE a.organization_id=$1 AND ${scope} ORDER BY a.due_at LIMIT 200`,
        args,
      )
    ).rows;
    const paths = (
      await pool.query(
        `SELECT a.id,u.email,a.content_snapshot->>'name' AS title,a.due_at,a.completed_at FROM learning_path_assignments a JOIN users u ON u.id=a.user_id WHERE a.organization_id=$1 AND ${scope} ORDER BY a.due_at LIMIT 200`,
        args,
      )
    ).rows;
    return {
      teams,
      members,
      signals,
      assignments,
      paths,
      scope: "assigned teams",
      generatedAt: new Date().toISOString(),
    };
  };
  app.get("/api/manager/overview", async (req, res) =>
    res.json(await load(req.user!.organizationId, req.user!.id)),
  );
  app.get("/api/manager/export", async (req, res) => {
    const data = await load(req.user!.organizationId, req.user!.id);
    const cell = (v: any) =>
      '"' +
      String(v ?? "")
        .replaceAll('"', '""')
        .replace(/^[=+@-]/, "'$&") +
      '"';
    res
      .attachment("team-learning.csv")
      .type("text/csv")
      .send(
        [
          ["Email", "Assigned", "Completed", "Overdue"],
          ...data.members.map((m) => [
            m.email,
            m.assigned,
            m.completed,
            m.overdue,
          ]),
        ]
          .map((r) => r.map(cell).join(","))
          .join("\r\n"),
      );
  });
  app.post("/api/manager/assignments/:id/remind", async (req, res) => {
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      const {
        rows: [assignment],
      } = await client.query(
        `SELECT a.id,a.user_id,a.organization_id,a.last_reminded_at,p.status FROM training_assignments a JOIN users u ON u.id=a.user_id JOIN training_progress p ON p.user_id=a.user_id AND p.module_id=a.module_id WHERE a.id=$3 AND a.organization_id=$1 AND ${scope} FOR UPDATE OF a`,
        [req.user!.organizationId, req.user!.id, Number(req.params.id)],
      );
      if (!assignment) {
        await client.query("ROLLBACK");
        return res.status(404).json({ message: "Assignment not found" });
      }
      if (
        assignment.status === "completed" ||
        (assignment.last_reminded_at &&
          Date.now() - new Date(assignment.last_reminded_at).getTime() <
            86400000)
      ) {
        await client.query("ROLLBACK");
        return res
          .status(409)
          .json({
            message:
              "Completed assignments need no reminder; reminders are limited to once per 24 hours",
          });
      }
      await client.query(
        `INSERT INTO notifications(organization_id,user_id,type,title,message,priority,action_url) VALUES($1,$2,'training','Learning follow-up','Your manager has reminded you to complete assigned learning.','medium','/employee/training')`,
        [assignment.organization_id, assignment.user_id],
      );
      await client.query(
        "UPDATE training_assignments SET last_reminded_at=now() WHERE id=$1",
        [assignment.id],
      );
      await client.query("COMMIT");
      res.json({ success: true });
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  });
  app.post("/api/manager/paths/:id/remind", async (req, res) => {
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      const {
        rows: [a],
      } = await client.query(
        `SELECT a.* FROM learning_path_assignments a JOIN users u ON u.id=a.user_id WHERE a.id=$3 AND a.organization_id=$1 AND ${scope} FOR UPDATE OF a`,
        [req.user!.organizationId, req.user!.id, Number(req.params.id)],
      );
      if (!a) {
        await client.query("ROLLBACK");
        return res.status(404).json({ message: "Assignment not found" });
      }
      if (
        a.completed_at ||
        (a.last_reminded_at &&
          Date.now() - new Date(a.last_reminded_at).getTime() < 86400000)
      ) {
        await client.query("ROLLBACK");
        return res
          .status(409)
          .json({
            message:
              "Completed paths need no reminder; reminders are limited to once per 24 hours",
          });
      }
      await client.query(
        `INSERT INTO notifications(organization_id,user_id,type,title,message,priority,action_url) VALUES($1,$2,'training','Learning path follow-up','Your manager has reminded you to complete your learning path.','medium','/employee/learning-paths')`,
        [a.organization_id, a.user_id],
      );
      await client.query(
        "UPDATE learning_path_assignments SET last_reminded_at=now() WHERE id=$1",
        [a.id],
      );
      await client.query("COMMIT");
      res.json({ success: true });
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  });
}
