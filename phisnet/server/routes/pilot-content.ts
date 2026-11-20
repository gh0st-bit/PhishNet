import type { Express } from "express";
import { pool } from "../db";
import {
  starterLessons,
  starterScenarios,
  lessonText,
} from "../services/starter-content";
import { z } from "zod";
export function registerPilotContent(app: Express) {
  app.get("/api/pilot/starter-content", (_req, res) =>
    res.json({
      version: 1,
      lessons: starterLessons,
      scenarios: starterScenarios,
    }),
  );
  app.post("/api/pilot/starter-content/install", async (req, res) => {
    const client = await pool.connect(),
      org = req.user!.organizationId;
    const modules: number[] = [],
      templates: number[] = [];
    try {
      await client.query("BEGIN");
      await client.query("SELECT pg_advisory_xact_lock(hashtext($1))", [
        "starter:" + org,
      ]);
      for (const lesson of starterLessons) {
        const tags = JSON.stringify(["phishnet-starter-v1:" + lesson.key]);
        let module = (
          await client.query(
            "SELECT id FROM training_modules WHERE organization_id=$1 AND tags @> $2::jsonb",
            [org, tags],
          )
        ).rows[0];
        if (!module)
          module = (
            await client.query(
              `INSERT INTO training_modules(organization_id,title,description,category,difficulty,duration_minutes,transcript,tags,created_by) VALUES($1,$2,'A short practical security lesson.',$6,'beginner',5,$3,$4,$5) RETURNING id`,
              [
                org,
                lesson.title,
                lessonText(lesson),
                tags,
                req.user!.id,
                lesson.category,
              ],
            )
          ).rows[0];
        modules.push(module.id);
      }
      let landing = (
        await client.query(
          "SELECT id FROM landing_pages WHERE organization_id=$1 AND name=$2",
          [org, "PhishNet starter training page v1"],
        )
      ).rows[0];
      if (!landing)
        landing = (
          await client.query(
            `INSERT INTO landing_pages(organization_id,name,html_content,capture_data,capture_passwords,enable_microlearning,learning_title,learning_content,learning_tips,created_by_id) VALUES($1,$2,$3,true,false,true,'Pause, verify and report','This was a controlled awareness exercise. Review the sender, destination and request before acting.',$4,$5) RETURNING id`,
            [
              org,
              "PhishNet starter training page v1",
              '<h1>Training exercise</h1><p>Use only a practice code. Do not enter a real password.</p><form><label>Practice code<input name="practiceCode" required></label><button type="submit">Continue</button></form>',
              JSON.stringify(starterLessons[0].steps),
              req.user!.id,
            ],
          )
        ).rows[0];
      for (const item of starterScenarios) {
        const name = "PhishNet starter v1: " + item.key;
        let template = (
          await client.query(
            "SELECT id FROM email_templates WHERE organization_id=$1 AND name=$2",
            [org, name],
          )
        ).rows[0];
        if (!template)
          template = (
            await client.query(
              `INSERT INTO email_templates(organization_id,name,subject,html_content,sender_name,sender_email,type,complexity,description,category,created_by_id) VALUES($1,$2,$3,$4,'Training Team','training@phishnet.test','custom',$5,$6,$7,$8) RETURNING id`,
              [
                org,
                name,
                item.subject,
                `<p>Hello {{FirstName}},</p><p>${item.premise}</p><p><a href="{{TrackingURL}}">Review notice</a></p>`,
                item.difficulty,
                item.premise,
                item.lesson,
                req.user!.id,
              ],
            )
          ).rows[0];
        templates.push(template.id);
      }
      await client.query("COMMIT");
      res
        .status(201)
        .json({
          modules,
          templates,
          landingPageId: landing.id,
          message:
            "Starter learning and draft templates installed. No campaign was created or sent.",
        });
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  });
  app.get("/api/pilot/content-history/:entity/:id", async (req, res) => {
    const entity = z
      .enum([
        "training_modules",
        "articles",
        "quizzes",
        "flashcard_decks",
        "email_templates",
        "landing_pages",
      ])
      .parse(req.params.entity);
    res.json(
      (
        await pool.query(
          "SELECT version,recorded_at,snapshot FROM content_versions WHERE organization_id=$1 AND entity_type=$2 AND entity_id=$3 ORDER BY version DESC LIMIT 50",
          [req.user!.organizationId, entity, Number(req.params.id)],
        )
      ).rows,
    );
  });
}
