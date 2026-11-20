import type { Express } from "express";
import { pool } from "../db";
import { isAuthenticated, hasOrganization, isEmployee } from "../auth";
import { z } from "zod";
import { answerMatches } from "@shared/quiz-grading";
const kinds = {
  module: "training_modules",
  article: "articles",
  deck: "flashcard_decks",
  quiz: "quizzes",
} as const;
const step = z.object({
  kind: z.enum(["module", "article", "deck", "quiz"]),
  id: z.number().int().positive(),
});
async function capture(steps: z.infer<typeof step>[], org: number) {
  const result = [];
  for (const s of steps) {
    const item = (
      await pool.query(
        `SELECT * FROM ${kinds[s.kind]} WHERE id=$1 AND organization_id=$2 AND archived_at IS NULL`,
        [s.id, org],
      )
    ).rows[0];
    if (!item || (s.kind !== "module" && !item.published))
      throw Object.assign(
        new Error("Use published content from this organization"),
        { status: 400 },
      );
    if (s.kind === "deck")
      item.cards = (
        await pool.query(
          "SELECT id,front_content AS front,back_content AS back FROM flashcards WHERE deck_id=$1 ORDER BY order_index,id",
          [s.id],
        )
      ).rows;
    if (s.kind === "quiz") {
      item.questions = (
        await pool.query(
          "SELECT * FROM quiz_questions WHERE quiz_id=$1 ORDER BY order_index,id",
          [s.id],
        )
      ).rows;
      if (
        item.time_limit ||
        !item.questions.length ||
        item.questions.some(
          (q: any) =>
            ![
              "multiple_choice",
              "multiple_select",
              "true_false",
              "fill_blank",
            ].includes(q.question_type),
        )
      )
        throw Object.assign(
          new Error(
            "Use an untimed quiz with multiple-choice, multiple-select, true/false or fill-blank questions. Timed assessments remain available in Quizzes.",
          ),
          { status: 400 },
        );
    }
    result.push({ ...s, content: item });
  }
  return result;
}
export function registerLearningPaths(app: Express) {
  app.get("/api/pilot/path-resources", async (req, res) => {
    const resources = [];
    for (const [kind, table] of Object.entries(kinds)) {
      const title = kind === "deck" ? "title" : "title";
      const rows = (
        await pool.query(
          `SELECT id,${title} AS title FROM ${table} WHERE organization_id=$1 AND archived_at IS NULL ${kind === "module" ? "" : "AND published"} ORDER BY ${title} LIMIT 500`,
          [req.user!.organizationId],
        )
      ).rows;
      resources.push(...rows.map((r) => ({ ...r, kind })));
    }
    res.json(resources);
  });
  app.get("/api/pilot/learning-paths", async (req, res) =>
    res.json(
      (
        await pool.query(
          "SELECT id,name,steps,created_at FROM learning_paths WHERE organization_id=$1 ORDER BY id DESC",
          [req.user!.organizationId],
        )
      ).rows,
    ),
  );
  app.post("/api/pilot/learning-paths", async (req, res) => {
    const data = z
      .object({
        name: z.string().trim().min(1).max(100),
        steps: z.array(step).min(1).max(20),
      })
      .parse(req.body);
    await capture(data.steps, req.user!.organizationId);
    const {
      rows: [saved],
    } = await pool.query(
      "INSERT INTO learning_paths(organization_id,name,steps) VALUES($1,$2,$3) RETURNING id,name",
      [req.user!.organizationId, data.name, JSON.stringify(data.steps)],
    );
    res.status(201).json(saved);
  });
  app.post("/api/pilot/learning-paths/:id/assign", async (req, res) => {
    const data = z
        .object({
          userIds: z.array(z.number().int().positive()).min(1).max(100),
          dueDays: z.number().int().min(1).max(365).default(14),
        })
        .parse(req.body),
      org = req.user!.organizationId;
    const path = (
      await pool.query(
        "SELECT * FROM learning_paths WHERE id=$1 AND organization_id=$2",
        [Number(req.params.id), org],
      )
    ).rows[0];
    if (!path)
      return res.status(404).json({ message: "Learning path not found" });
    const snapshot = { name: path.name, steps: await capture(path.steps, org) };
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      let assigned = 0;
      const ids = [...new Set(data.userIds)],
        valid = await client.query(
          `SELECT u.id FROM users u WHERE u.organization_id=$1 AND u.id=ANY($2::int[]) AND u.is_active AND NOT u.is_admin AND EXISTS(SELECT 1 FROM user_roles ur JOIN roles r ON r.id=ur.role_id WHERE ur.user_id=u.id AND r.name='User') AND NOT EXISTS(SELECT 1 FROM user_roles ur JOIN roles r ON r.id=ur.role_id WHERE ur.user_id=u.id AND r.name IN ('Admin','OrgAdmin','Manager'))`,
          [org, ids],
        );
      if (valid.rowCount !== ids.length) {
        await client.query("ROLLBACK");
        return res
          .status(400)
          .json({ message: "Choose active employees from this organization" });
      }
      for (const userId of ids) {
        const saved = await client.query(
          `INSERT INTO learning_path_assignments(organization_id,user_id,path_id,content_snapshot,due_at) VALUES($1,$2,$3,$4,now()+($5*interval '1 day')) ON CONFLICT(path_id,user_id) DO NOTHING RETURNING id`,
          [org, userId, path.id, JSON.stringify(snapshot), data.dueDays],
        );
        if (saved.rowCount) {
          assigned++;
          await client.query(
            `INSERT INTO notifications(organization_id,user_id,type,title,message,priority,action_url) VALUES($1,$2,'training','Learning path assigned','A new learning path is ready in your learning portal.','medium','/employee/learning-paths')`,
            [org, userId],
          );
        }
      }
      await client.query("COMMIT");
      res.status(201).json({ assigned });
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  });
  app.delete("/api/pilot/learning-paths/:id", async (req, res) => {
    const id = Number(req.params.id),
      org = req.user!.organizationId;
    if (
      (
        await pool.query(
          "SELECT 1 FROM learning_path_assignments WHERE path_id=$1 AND organization_id=$2 LIMIT 1",
          [id, org],
        )
      ).rowCount
    )
      return res
        .status(409)
        .json({
          message:
            "Assigned paths retain their learning history and cannot be deleted",
        });
    const removed = await pool.query(
      "DELETE FROM learning_paths WHERE id=$1 AND organization_id=$2 RETURNING id",
      [id, org],
    );
    res
      .status(removed.rowCount ? 200 : 404)
      .json({ deleted: !!removed.rowCount });
  });
  const guards = [isAuthenticated, hasOrganization, isEmployee];
  app.get("/api/employee/learning-paths", ...guards, async (req, res) =>
    res.json(
      (
        await pool.query(
          `SELECT a.id,a.content_snapshot->>'name' AS name,a.due_at,a.completed_at,jsonb_array_length(a.content_snapshot->'steps') AS total_steps,(SELECT count(*)::int FROM learning_path_steps p WHERE p.assignment_id=a.id) AS completed_steps FROM learning_path_assignments a WHERE a.organization_id=$1 AND a.user_id=$2 ORDER BY a.due_at`,
          [req.user!.organizationId, req.user!.id],
        )
      ).rows,
    ),
  );
  app.get("/api/employee/learning-paths/:id", ...guards, async (req, res) => {
    const a = (
      await pool.query(
        "SELECT * FROM learning_path_assignments WHERE id=$1 AND organization_id=$2 AND user_id=$3",
        [Number(req.params.id), req.user!.organizationId, req.user!.id],
      )
    ).rows[0];
    if (!a) return res.status(404).json({ message: "Assignment not found" });
    const completed = (
      await pool.query(
        "SELECT ordinal,evidence FROM learning_path_steps WHERE assignment_id=$1 ORDER BY ordinal",
        [a.id],
      )
    ).rows;
    const steps = a.content_snapshot.steps.map((s: any, index: number) => ({
      ...s,
      locked: index > completed.length,
      content:
        s.kind === "quiz"
          ? {
              title: s.content.title,
              passing_score: s.content.passing_score,
              questions: s.content.questions.map((q: any) => ({
                id: q.id,
                question_text: q.question_text,
                question_type: q.question_type,
                options: q.options,
              })),
            }
          : s.content,
    }));
    res.json({
      id: a.id,
      name: a.content_snapshot.name,
      due_at: a.due_at,
      completed_at: a.completed_at,
      steps,
      completed,
    });
  });
  app.post(
    "/api/employee/learning-paths/:id/steps/:ordinal",
    ...guards,
    async (req, res) => {
      const ordinal = z.coerce
          .number()
          .int()
          .min(0)
          .max(19)
          .parse(req.params.ordinal),
        body = z
          .object({
            acknowledged: z.boolean().optional(),
            answers: z.record(z.string(), z.any()).optional(),
          })
          .parse(req.body),
        client = await pool.connect();
      try {
        await client.query("BEGIN");
        const a = (
          await client.query(
            "SELECT * FROM learning_path_assignments WHERE id=$1 AND organization_id=$2 AND user_id=$3 FOR UPDATE",
            [Number(req.params.id), req.user!.organizationId, req.user!.id],
          )
        ).rows[0];
        if (!a) {
          await client.query("ROLLBACK");
          return res.status(404).json({ message: "Assignment not found" });
        }
        const done = (
          await client.query(
            "SELECT ordinal FROM learning_path_steps WHERE assignment_id=$1",
            [a.id],
          )
        ).rows;
        if (done.some((r) => r.ordinal === ordinal)) {
          await client.query("COMMIT");
          return res.json({ completed: true, duplicate: true });
        }
        const selected = a.content_snapshot.steps[ordinal];
        if (
          !selected ||
          done.filter((r) => r.ordinal < ordinal).length !== ordinal
        ) {
          await client.query("ROLLBACK");
          return res
            .status(409)
            .json({ message: "Complete earlier steps first" });
        }
        let evidence: any = { acknowledged: true };
        if (selected.kind === "quiz") {
          const count = (
            await client.query(
              "SELECT count(*)::int AS n FROM learning_path_attempts WHERE assignment_id=$1 AND ordinal=$2",
              [a.id, ordinal],
            )
          ).rows[0].n;
          const max =
            selected.content.allow_retakes === false
              ? 1
              : (selected.content.max_attempts ?? Infinity);
          if (count >= max) {
            await client.query("ROLLBACK");
            return res
              .status(409)
              .json({
                message:
                  "Assessment attempt limit reached. Ask your administrator for a new learning assignment.",
              });
          }
          const questions = selected.content.questions,
            correct = questions.filter((q: any) =>
              answerMatches(
                q.question_type,
                body.answers?.[q.id],
                q.correct_answer,
              ),
            ).length,
            score = Math.round((correct / questions.length) * 100),
            passed = score >= selected.content.passing_score;
          await client.query(
            "INSERT INTO learning_path_attempts(assignment_id,organization_id,ordinal,score) VALUES($1,$2,$3,$4)",
            [a.id, a.organization_id, ordinal, score],
          );
          if (!passed) {
            await client.query("COMMIT");
            return res
              .status(422)
              .json({
                message: `Assessment score ${score}%. Passing score ${selected.content.passing_score}%.`,
                score,
                passed: false,
              });
          }
          evidence = { score, passed };
        } else if (body.acknowledged !== true) {
          await client.query("ROLLBACK");
          return res
            .status(400)
            .json({
              message: "Acknowledge completion after reviewing this content",
            });
        }
        await client.query(
          "INSERT INTO learning_path_steps(assignment_id,organization_id,ordinal,evidence) VALUES($1,$2,$3,$4)",
          [a.id, a.organization_id, ordinal, JSON.stringify(evidence)],
        );
        const complete = done.length + 1 === a.content_snapshot.steps.length;
        if (complete)
          await client.query(
            "UPDATE learning_path_assignments SET completed_at=now() WHERE id=$1",
            [a.id],
          );
        await client.query("COMMIT");
        res.json({ completed: true, pathCompleted: complete, evidence });
      } catch (error) {
        await client.query("ROLLBACK");
        throw error;
      } finally {
        client.release();
      }
    },
  );
}
