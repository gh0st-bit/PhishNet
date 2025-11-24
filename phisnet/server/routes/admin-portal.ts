import type { Express } from "express";
import { Router, Request, Response } from "express";
import sanitizeHtml from "sanitize-html";
import { db } from "../db";
import { validateBody } from "../middleware/validation";
import { isAuthenticated, isAdmin } from "../auth"; // optional guards if needed
import {
  // Tables
  trainingModules,
  quizzes,
  quizQuestions,
  badges,
  trainingProgress,
  users,
  articles,
  flashcardDecks,
  flashcards,
  // Schemas & validation
  insertTrainingModuleSchema,
  updateTrainingModuleSchema,
  insertQuizSchema,
  updateQuizSchema,
  insertQuizQuestionSchema,
  updateQuizQuestionSchema,
  insertBadgeSchema,
  updateBadgeSchema,
  insertArticleSchema,
  updateArticleSchema,
  createArticleRequestSchema,
  insertFlashcardDeckSchema,
  updateFlashcardDeckSchema,
  insertFlashcardSchema,
  updateFlashcardSchema,
  // Types
  type InsertTrainingModule,
  type InsertArticle,
  type InsertFlashcardDeck,
  type InsertFlashcard,
  type InsertQuiz,
  type InsertQuizQuestion,
  type InsertBadge,
} from "../../shared/schema";
import { eq, and, desc, like, or, sql } from "drizzle-orm";

const router = Router();

// Helper for pagination
function parsePaginationParams(pageParam: any, pageSizeParam: any) {
  const page = Math.max(1, parseInt(pageParam, 10) || 1);
  const pageSize = Math.min(100, Math.max(1, parseInt(pageSizeParam, 10) || 20));
  const offset = (page - 1) * pageSize;
  return { page, pageSize, offset };
}

function buildPaginationMetadata(total: number, page: number, pageSize: number) {
  return {
    pagination: {
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    },
  };
}


// ========================================
// TRAINING MODULE MANAGEMENT
// ========================================

/**
 * GET /api/admin/training-modules
 * Get all training modules for the organization
 */
router.get("/training-modules", async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    const orgId = req.user.organizationId;

    const modules = await db
      .select({
        id: trainingModules.id,
        title: trainingModules.title,
        description: trainingModules.description,
        category: trainingModules.category,
        difficulty: trainingModules.difficulty,
        durationMinutes: trainingModules.durationMinutes,
        thumbnailUrl: trainingModules.thumbnailUrl,
        videoUrl: trainingModules.videoUrl,
        isRequired: trainingModules.isRequired,
        orderIndex: trainingModules.orderIndex,
        tags: trainingModules.tags,
        createdAt: trainingModules.createdAt,
        updatedAt: trainingModules.updatedAt,
        // Count of users assigned (via progress)
        assignedCount: sql<number>`(
          SELECT COUNT(DISTINCT user_id) 
          FROM training_progress 
          WHERE module_id = ${trainingModules.id}
        )`,
        // Count of completions
        completedCount: sql<number>`(
          SELECT COUNT(*) 
          FROM training_progress 
          WHERE module_id = ${trainingModules.id} 
          AND status = 'completed'
        )`
      })
      .from(trainingModules)
      .where(eq(trainingModules.organizationId, orgId))
      .orderBy(desc(trainingModules.createdAt));

    res.json({ modules });
  } catch (error: any) {
    console.error("Error fetching training modules:", error);
    res.status(500).json({ message: "Failed to fetch training modules" });
  }
});

/**
 * POST /api/admin/training-modules
 * Create a new training module
 */
router.post("/training-modules", validateBody(insertTrainingModuleSchema), async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    const orgId = req.user.organizationId;
    const moduleData: InsertTrainingModule = {
      organizationId: orgId,
      title: req.body.title,
      description: req.body.description,
      category: req.body.category,
      difficulty: req.body.difficulty,
      durationMinutes: req.body.durationMinutes,
      videoUrl: req.body.videoUrl,
      thumbnailUrl: req.body.thumbnailUrl,
      transcript: req.body.transcript,
      isRequired: req.body.isRequired ?? false,
      orderIndex: req.body.orderIndex ?? 0,
      tags: req.body.tags || [],
      createdBy: req.user.id,
    };

    const [newModule] = await db
      .insert(trainingModules)
      .values(moduleData)
      .returning();

    res.status(201).json({ module: newModule });
  } catch (error: any) {
    console.error("Error creating training module:", error);
    res.status(500).json({ message: "Failed to create training module" });
  }
});

/**
 * PUT /api/admin/training-modules/:id
 * Update a training module
 */
router.put("/training-modules/:id", validateBody(updateTrainingModuleSchema), async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    const moduleId = Number.parseInt(req.params.id);
    const orgId = req.user.organizationId;

    // Verify ownership
    const [existing] = await db
      .select()
      .from(trainingModules)
      .where(
        and(
          eq(trainingModules.id, moduleId),
          eq(trainingModules.organizationId, orgId)
        )
      )
      .limit(1);

    if (!existing) {
      return res.status(404).json({ message: "Training module not found" });
    }

    const updateData: Partial<InsertTrainingModule> = {
      title: req.body.title,
      description: req.body.description,
      category: req.body.category,
      difficulty: req.body.difficulty,
      durationMinutes: req.body.durationMinutes,
      videoUrl: req.body.videoUrl,
      thumbnailUrl: req.body.thumbnailUrl,
      transcript: req.body.transcript,
      isRequired: req.body.isRequired,
      orderIndex: req.body.orderIndex,
      tags: req.body.tags,
      updatedAt: new Date(),
    };

    const [updatedModule] = await db
      .update(trainingModules)
      .set(updateData)
      .where(eq(trainingModules.id, moduleId))
      .returning();

    res.json({ module: updatedModule });
  } catch (error: any) {
    console.error("Error updating training module:", error);
    res.status(500).json({ message: "Failed to update training module" });
  }
});

/**
 * DELETE /api/admin/training-modules/:id
 * Delete a training module
 */
router.delete("/training-modules/:id", async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    const moduleId = Number.parseInt(req.params.id);
    const orgId = req.user.organizationId;

    // Verify ownership
    const [existing] = await db
      .select()
      .from(trainingModules)
      .where(
        and(
          eq(trainingModules.id, moduleId),
          eq(trainingModules.organizationId, orgId)
        )
      )
      .limit(1);

    if (!existing) {
      return res.status(404).json({ message: "Training module not found" });
    }

    // Delete associated progress records first
    await db
      .delete(trainingProgress)
      .where(eq(trainingProgress.moduleId, moduleId));

    // Delete the module
    await db
      .delete(trainingModules)
      .where(eq(trainingModules.id, moduleId));

    res.json({ success: true });
  } catch (error: any) {
    console.error("Error deleting training module:", error);
    res.status(500).json({ message: "Failed to delete training module" });
  }
});

/**
 * POST /api/admin/training-modules/:id/assign
 * Assign training module to users
 */
router.post("/training-modules/:id/assign", async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    const moduleId = Number.parseInt(req.params.id);
    const orgId = req.user.organizationId;
    const { userIds, dueDate } = req.body;

    if (!Array.isArray(userIds) || userIds.length === 0) {
      return res.status(400).json({ message: "userIds must be a non-empty array" });
    }

    // Verify module exists and belongs to org
    const [module] = await db
      .select()
      .from(trainingModules)
      .where(
        and(
          eq(trainingModules.id, moduleId),
          eq(trainingModules.organizationId, orgId)
        )
      )
      .limit(1);

    if (!module) {
      return res.status(404).json({ message: "Training module not found" });
    }

    // Create progress records for each user (if not already exists)
    const progressRecords = userIds.map(userId => ({
      userId,
      moduleId,
      status: "not_started" as const,
      progressPercentage: 0,
      dueDate: dueDate ? new Date(dueDate) : null,
    }));

    // Insert or update on conflict
    for (const record of progressRecords) {
      await db
        .insert(trainingProgress)
        .values(record)
        .onConflictDoUpdate({
          target: [trainingProgress.userId, trainingProgress.moduleId],
          set: {
            dueDate: record.dueDate,
            updatedAt: new Date(),
          },
        });
    }

    res.json({ 
      success: true, 
      message: `Assigned to ${userIds.length} user(s)` 
    });
  } catch (error: any) {
    console.error("Error assigning training module:", error);
    res.status(500).json({ message: "Failed to assign training module" });
  }
});

// ========================================
// QUIZ MANAGEMENT
// ========================================

/**
 * GET /api/admin/quizzes
 * Get all quizzes for the organization
 */
router.get("/quizzes", async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ message: "Unauthorized" });
    }
    const orgId = req.user.organizationId;
    const { page, pageSize, offset } = parsePaginationParams(req.query.page, req.query.pageSize);

    // Total quizzes count for org
    const [countRow] = await db
      .select({ total: sql<number>`count(*)` })
      .from(quizzes)
      .where(eq(quizzes.organizationId, orgId));
    const total = countRow?.total ?? 0;

    const rows = await db
      .select({
        id: quizzes.id,
        title: quizzes.title,
        description: quizzes.description,
        passingScore: quizzes.passingScore,
        timeLimit: quizzes.timeLimit,
        allowRetakes: quizzes.allowRetakes,
        maxAttempts: quizzes.maxAttempts,
        randomizeQuestions: quizzes.randomizeQuestions,
        showCorrectAnswers: quizzes.showCorrectAnswers,
        createdAt: quizzes.createdAt,
      })
      .from(quizzes)
      .where(eq(quizzes.organizationId, orgId))
      .orderBy(desc(quizzes.createdAt))
      .limit(pageSize)
      .offset(offset);

    res.json({
      quizzes: rows,
      ...buildPaginationMetadata(total, page, pageSize),
    });
  } catch (error: any) {
    console.error("Error fetching quizzes:", error);
    res.status(500).json({ message: "Failed to fetch quizzes" });
  }
});

/**
 * GET /api/admin/quizzes/:id
 * Get a specific quiz with all questions
 */
router.get("/quizzes/:id", async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    const quizId = Number.parseInt(req.params.id);
    const orgId = req.user.organizationId;

    const [quiz] = await db
      .select()
      .from(quizzes)
      .where(
        and(
          eq(quizzes.id, quizId),
          eq(quizzes.organizationId, orgId)
        )
      )
      .limit(1);

    if (!quiz) {
      return res.status(404).json({ message: "Quiz not found" });
    }

    const questions = await db
      .select()
      .from(quizQuestions)
      .where(eq(quizQuestions.quizId, quizId))
      .orderBy(quizQuestions.orderIndex);

    res.json({ quiz, questions });
  } catch (error: any) {
    console.error("Error fetching quiz:", error);
    res.status(500).json({ message: "Failed to fetch quiz" });
  }
});

/**
 * POST /api/admin/quizzes
 * Create a new quiz
 */
router.post("/quizzes", validateBody(insertQuizSchema), async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    const orgId = req.user.organizationId;
    const quizData: InsertQuiz = {
      organizationId: orgId,
      title: req.body.title,
      description: req.body.description,
      passingScore: req.body.passingScore ?? 80,
      timeLimit: req.body.timeLimit,
      allowRetakes: req.body.allowRetakes ?? true,
      maxAttempts: req.body.maxAttempts,
      showCorrectAnswers: req.body.showCorrectAnswers ?? true,
      createdBy: req.user.id,
    };

    const [newQuiz] = await db
      .insert(quizzes)
      .values(quizData)
      .returning();

    res.status(201).json({ quiz: newQuiz });
  } catch (error: any) {
    console.error("Error creating quiz:", error);
    res.status(500).json({ message: "Failed to create quiz" });
  }
});

/**
 * PUT /api/admin/quizzes/:id
 * Update a quiz
 */
router.put("/quizzes/:id", validateBody(updateQuizSchema), async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    const quizId = Number.parseInt(req.params.id);
    const orgId = req.user.organizationId;

    // Verify ownership
    const [existing] = await db
      .select()
      .from(quizzes)
      .where(
        and(
          eq(quizzes.id, quizId),
          eq(quizzes.organizationId, orgId)
        )
      )
      .limit(1);

    if (!existing) {
      return res.status(404).json({ message: "Quiz not found" });
    }

    const updateData: Partial<InsertQuiz> = {
      title: req.body.title,
      description: req.body.description,
      passingScore: req.body.passingScore,
      timeLimit: req.body.timeLimit,
      allowRetakes: req.body.allowRetakes,
      maxAttempts: req.body.maxAttempts,
      showCorrectAnswers: req.body.showCorrectAnswers,
      updatedAt: new Date(),
    };

    const [updatedQuiz] = await db
      .update(quizzes)
      .set(updateData)
      .where(eq(quizzes.id, quizId))
      .returning();

    res.json({ quiz: updatedQuiz });
  } catch (error: any) {
    console.error("Error updating quiz:", error);
    res.status(500).json({ message: "Failed to update quiz" });
  }
});

/**
 * DELETE /api/admin/quizzes/:id
 * Delete a quiz and all its questions
 */
router.delete("/quizzes/:id", async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    const quizId = Number.parseInt(req.params.id);
    const orgId = req.user.organizationId;

    // Verify ownership
    const [existing] = await db
      .select()
      .from(quizzes)
      .where(
        and(
          eq(quizzes.id, quizId),
          eq(quizzes.organizationId, orgId)
        )
      )
      .limit(1);

    if (!existing) {
      return res.status(404).json({ message: "Quiz not found" });
    }

    // Delete questions first
    await db
      .delete(quizQuestions)
      .where(eq(quizQuestions.quizId, quizId));

    // Delete the quiz
    await db
      .delete(quizzes)
      .where(eq(quizzes.id, quizId));

    res.json({ success: true });
  } catch (error: any) {
    console.error("Error deleting quiz:", error);
    res.status(500).json({ message: "Failed to delete quiz" });
  }
});

/**
 * PATCH /api/admin/quizzes/:id/publish
 * Toggle published status of a quiz
 */
router.patch("/quizzes/:id/publish", async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    const quizId = Number.parseInt(req.params.id);
    const orgId = req.user.organizationId;
    const { published } = req.body;

    if (typeof published !== 'boolean') {
      return res.status(400).json({ message: "published must be a boolean" });
    }

    // Verify ownership
    const [existing] = await db
      .select()
      .from(quizzes)
      .where(
        and(
          eq(quizzes.id, quizId),
          eq(quizzes.organizationId, orgId)
        )
      )
      .limit(1);

    if (!existing) {
      return res.status(404).json({ message: "Quiz not found" });
    }

    const [updatedQuiz] = await db
      .update(quizzes)
      .set({ published, updatedAt: new Date() })
      .where(eq(quizzes.id, quizId))
      .returning();

    res.json({ quiz: updatedQuiz, message: `Quiz ${published ? 'published' : 'unpublished'} successfully` });
  } catch (error: any) {
    console.error("Error updating quiz publish status:", error);
    res.status(500).json({ message: "Failed to update quiz publish status" });
  }
});

/**
 * POST /api/admin/quizzes/:id/questions
 * Add a question to a quiz
 */
router.post("/quizzes/:id/questions", validateBody(insertQuizQuestionSchema), async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    const quizId = Number.parseInt(req.params.id);
    const orgId = req.user.organizationId;

    // Verify quiz ownership
    const [quiz] = await db
      .select()
      .from(quizzes)
      .where(
        and(
          eq(quizzes.id, quizId),
          eq(quizzes.organizationId, orgId)
        )
      )
      .limit(1);

    if (!quiz) {
      return res.status(404).json({ message: "Quiz not found" });
    }

    const questionData: InsertQuizQuestion = {
      quizId,
      questionType: req.body.questionType,
      questionText: req.body.questionText,
      options: req.body.options || req.body.questionOptions || [],
      correctAnswer: req.body.correctAnswer,
      explanation: req.body.explanation,
      points: req.body.points ?? 10,
      orderIndex: req.body.orderIndex ?? 0,
    };

    const [newQuestion] = await db
      .insert(quizQuestions)
      .values(questionData)
      .returning();

    res.status(201).json({ question: newQuestion });
  } catch (error: any) {
    console.error("Error adding quiz question:", error);
    res.status(500).json({ message: "Failed to add quiz question" });
  }
});

/**
 * PUT /api/admin/quiz-questions/:id
 * Update a quiz question
 */
router.put("/quiz-questions/:id", validateBody(updateQuizQuestionSchema), async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    const questionId = Number.parseInt(req.params.id);
    const orgId = req.user.organizationId;

    // Verify question exists and belongs to org's quiz
    const [existing] = await db
      .select({
        question: quizQuestions,
        quiz: quizzes,
      })
      .from(quizQuestions)
      .innerJoin(quizzes, eq(quizQuestions.quizId, quizzes.id))
      .where(
        and(
          eq(quizQuestions.id, questionId),
          eq(quizzes.organizationId, orgId)
        )
      )
      .limit(1);

    if (!existing) {
      return res.status(404).json({ message: "Question not found" });
    }

    const updateData: Partial<InsertQuizQuestion> = {
      questionType: req.body.questionType,
      questionText: req.body.questionText,
      options: req.body.options || req.body.questionOptions,
      correctAnswer: req.body.correctAnswer,
      explanation: req.body.explanation,
      points: req.body.points,
      orderIndex: req.body.orderIndex,
    };

    const [updatedQuestion] = await db
      .update(quizQuestions)
      .set(updateData)
      .where(eq(quizQuestions.id, questionId))
      .returning();

    res.json({ question: updatedQuestion });
  } catch (error: any) {
    console.error("Error updating quiz question:", error);
    res.status(500).json({ message: "Failed to update quiz question" });
  }
});

/**
 * DELETE /api/admin/quiz-questions/:id
 * Delete a quiz question
 */
router.delete("/quiz-questions/:id", async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    const questionId = Number.parseInt(req.params.id);
    const orgId = req.user.organizationId;

    // Verify question exists and belongs to org's quiz
    const [existing] = await db
      .select({
        question: quizQuestions,
        quiz: quizzes,
      })
      .from(quizQuestions)
      .innerJoin(quizzes, eq(quizQuestions.quizId, quizzes.id))
      .where(
        and(
          eq(quizQuestions.id, questionId),
          eq(quizzes.organizationId, orgId)
        )
      )
      .limit(1);

    if (!existing) {
      return res.status(404).json({ message: "Question not found" });
    }

    await db
      .delete(quizQuestions)
      .where(eq(quizQuestions.id, questionId));

    res.json({ success: true });
  } catch (error: any) {
    console.error("Error deleting quiz question:", error);
    res.status(500).json({ message: "Failed to delete quiz question" });
  }
});

// ========================================
// BADGE MANAGEMENT
// ========================================

/**
 * GET /api/admin/badges
 * Get all badges
 */
router.get("/badges", async (req: Request, res: Response) => {
  try {
    const { page, pageSize, offset } = parsePaginationParams(req.query.page, req.query.pageSize);

    // Total count
    const [countRow] = await db.select({ total: sql<number>`count(*)` }).from(badges);
    const total = countRow?.total ?? 0;

    const rows = await db
      .select({
        id: badges.id,
        name: badges.name,
        description: badges.description,
        criteria: badges.criteria,
        rarity: badges.rarity,
        iconUrl: badges.iconUrl,
        pointsAwarded: badges.pointsAwarded,
        category: badges.category,
        createdAt: badges.createdAt,
        earnedCount: sql<number>`(
          SELECT COUNT(*) FROM user_badges WHERE badge_id = ${badges.id}
        )`
      })
      .from(badges)
      .orderBy(desc(badges.createdAt))
      .limit(pageSize)
      .offset(offset);

    res.json({
      badges: rows,
      ...buildPaginationMetadata(total, page, pageSize),
    });
  } catch (error: any) {
    console.error("Error fetching badges:", error);
    res.status(500).json({ message: "Failed to fetch badges" });
  }
});

/**
 * POST /api/admin/badges
 * Create a new badge
 */
router.post("/badges", validateBody(insertBadgeSchema), async (req: Request, res: Response) => {
  try {
    const badgeData: InsertBadge = {
      name: req.body.name,
      description: req.body.description,
      criteria: req.body.criteria,
      category: req.body.category || 'special',
      rarity: req.body.rarity ?? "common",
      iconUrl: req.body.iconUrl,
      pointsAwarded: req.body.pointsAwarded ?? 0,
    };

    const [newBadge] = await db
      .insert(badges)
      .values(badgeData)
      .returning();

    res.status(201).json({ badge: newBadge });
  } catch (error: any) {
    console.error("Error creating badge:", error);
    res.status(500).json({ message: "Failed to create badge" });
  }
});

/**
 * PUT /api/admin/badges/:id
 * Update a badge
 */
router.put("/badges/:id", validateBody(updateBadgeSchema), async (req: Request, res: Response) => {
  try {
    const badgeId = Number.parseInt(req.params.id);

    const [existing] = await db
      .select()
      .from(badges)
      .where(eq(badges.id, badgeId))
      .limit(1);

    if (!existing) {
      return res.status(404).json({ message: "Badge not found" });
    }

    const updateData: Partial<InsertBadge> = {
      name: req.body.name,
      description: req.body.description,
      criteria: req.body.criteria,
      rarity: req.body.rarity,
      iconUrl: req.body.iconUrl,
    };

    const [updatedBadge] = await db
      .update(badges)
      .set(updateData)
      .where(eq(badges.id, badgeId))
      .returning();

    res.json({ badge: updatedBadge });
  } catch (error: any) {
    console.error("Error updating badge:", error);
    res.status(500).json({ message: "Failed to update badge" });
  }
});

/**
 * DELETE /api/admin/badges/:id
 * Delete a badge
 */
router.delete("/badges/:id", async (req: Request, res: Response) => {
  try {
    const badgeId = Number.parseInt(req.params.id);

    const [existing] = await db
      .select()
      .from(badges)
      .where(eq(badges.id, badgeId))
      .limit(1);

    if (!existing) {
      return res.status(404).json({ message: "Badge not found" });
    }

    await db
      .delete(badges)
      .where(eq(badges.id, badgeId));

    res.json({ success: true });
  } catch (error: any) {
    console.error("Error deleting badge:", error);
    res.status(500).json({ message: "Failed to delete badge" });
  }
});

/**
 * PATCH /api/admin/badges/:id/publish
 * Toggle published status of a badge
 */
router.patch("/badges/:id/publish", async (req: Request, res: Response) => {
  try {
    const badgeId = Number.parseInt(req.params.id);
    const { published } = req.body;

    if (typeof published !== 'boolean') {
      return res.status(400).json({ message: "published must be a boolean" });
    }

    const [existing] = await db
      .select()
      .from(badges)
      .where(eq(badges.id, badgeId))
      .limit(1);

    if (!existing) {
      return res.status(404).json({ message: "Badge not found" });
    }

    const [updatedBadge] = await db
      .update(badges)
      .set({ published })
      .where(eq(badges.id, badgeId))
      .returning();

    res.json({ badge: updatedBadge, message: `Badge ${published ? 'published' : 'unpublished'} successfully` });
  } catch (error: any) {
    console.error("Error updating badge publish status:", error);
    res.status(500).json({ message: "Failed to update badge publish status" });
  }
});

/**
 * GET /api/admin/users
 * Get all users in the organization (for assignment)
 */
router.get("/users", async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    const orgId = req.user.organizationId;

    const orgUsers = await db
      .select({
        id: users.id,
        firstName: users.firstName,
        lastName: users.lastName,
        email: users.email,
      })
      .from(users)
      .where(eq(users.organizationId, orgId))
      .orderBy(users.firstName, users.lastName);

    res.json({ users: orgUsers });
  } catch (error: any) {
    console.error("Error fetching users:", error);
    res.status(500).json({ message: "Failed to fetch users" });
  }
});

// ========================================
// ARTICLES MANAGEMENT
// ========================================

/**
 * GET /api/admin/articles
 * Get all articles for the organization
 */
router.get("/articles", async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    const orgId = req.user.organizationId;
    const { category, search } = req.query;
    const { page, pageSize, offset } = parsePaginationParams(req.query.page, req.query.pageSize);

    // Build WHERE conditions
    let whereConditions = [eq(articles.organizationId, orgId)];
    if (category && typeof category === 'string') {
      whereConditions.push(eq(articles.category, category));
    }
    if (search && typeof search === 'string') {
      whereConditions.push(
        or(
          like(articles.title, `%${search}%`),
          like(articles.content, `%${search}%`)
        )!
      );
    }

    // Count query
    const [countRow] = await db
      .select({ total: sql<number>`count(*)` })
      .from(articles)
      .where(and(...whereConditions));
    const total = countRow?.total ?? 0;

    // Data query
    const rows = await db
      .select({
        id: articles.id,
        title: articles.title,
        excerpt: articles.excerpt,
        content: articles.content,
        category: articles.category,
        tags: articles.tags,
        thumbnailUrl: articles.thumbnailUrl,
        author: articles.author,
        readTimeMinutes: articles.readTimeMinutes,
        publishedAt: articles.publishedAt,
        updatedAt: articles.updatedAt,
        authorName: sql<string>`CONCAT(${users.firstName}, ' ', ${users.lastName})`,
      })
      .from(articles)
      .leftJoin(users, eq(articles.author, users.id))
      .where(and(...whereConditions))
      .orderBy(desc(articles.publishedAt))
      .limit(pageSize)
      .offset(offset);

    res.json({
      articles: rows,
      ...buildPaginationMetadata(total, page, pageSize),
    });
  } catch (error: any) {
    console.error("Error fetching articles:", error);
    res.status(500).json({ message: "Failed to fetch articles" });
  }
});

/**
 * GET /api/admin/articles/:id
 * Get a single article by ID
 */
router.get("/articles/:id", async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    const articleId = Number.parseInt(req.params.id);
    const orgId = req.user.organizationId;

    const [article] = await db
      .select()
      .from(articles)
      .where(
        and(
          eq(articles.id, articleId),
          eq(articles.organizationId, orgId)
        )
      )
      .limit(1);

    if (!article) {
      return res.status(404).json({ message: "Article not found" });
    }

    res.json({ article });
  } catch (error: any) {
    console.error("Error fetching article:", error);
    res.status(500).json({ message: "Failed to fetch article" });
  }
});

/**
 * POST /api/admin/articles
 * Create a new article
 */
router.post("/articles", validateBody(createArticleRequestSchema), async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    const orgId = req.user.organizationId;
    
    // Sanitize HTML content to prevent XSS attacks
    const safeContent = sanitizeHtml(req.body.content, {
      allowedTags: [
        'p','br','span','div','b','i','u','strong','em','blockquote','code','pre',
        'ul','ol','li','table','thead','tbody','tr','td','th','h1','h2','h3','h4','h5','h6',
        'img','a','hr'
      ],
      allowedAttributes: {
        a: ['href','name','target','rel'],
        img: ['src','alt','title','width','height'],
        '*': ['style','class']
      },
      allowedSchemes: ['http','https','mailto'],
      allowProtocolRelative: false
    });
    
    const articleData: InsertArticle = {
      organizationId: orgId,
      title: req.body.title,
      content: safeContent,
      excerpt: req.body.excerpt,
      category: req.body.category,
      tags: req.body.tags || [],
      thumbnailUrl: req.body.thumbnailUrl,
      author: req.user.id,
      readTimeMinutes: req.body.readTimeMinutes,
    };

    const [newArticle] = await db
      .insert(articles)
      .values(articleData)
      .returning();

    res.status(201).json({ article: newArticle });
  } catch (error: any) {
    console.error("Error creating article:", error);
    res.status(500).json({ message: "Failed to create article" });
  }
});

/**
 * PUT /api/admin/articles/:id
 * Update an article
 */
router.put("/articles/:id", validateBody(updateArticleSchema), async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    const articleId = Number.parseInt(req.params.id);
    const orgId = req.user.organizationId;

    // Verify ownership
    const [existing] = await db
      .select()
      .from(articles)
      .where(
        and(
          eq(articles.id, articleId),
          eq(articles.organizationId, orgId)
        )
      )
      .limit(1);

    if (!existing) {
      return res.status(404).json({ message: "Article not found" });
    }

    // Sanitize HTML content if provided
    const safeContent = req.body.content ? sanitizeHtml(req.body.content, {
      allowedTags: [
        'p','br','span','div','b','i','u','strong','em','blockquote','code','pre',
        'ul','ol','li','table','thead','tbody','tr','td','th','h1','h2','h3','h4','h5','h6',
        'img','a','hr'
      ],
      allowedAttributes: {
        a: ['href','name','target','rel'],
        img: ['src','alt','title','width','height'],
        '*': ['style','class']
      },
      allowedSchemes: ['http','https','mailto'],
      allowProtocolRelative: false
    }) : undefined;

    const updateData: Partial<InsertArticle> = {
      title: req.body.title,
      content: safeContent,
      excerpt: req.body.excerpt,
      category: req.body.category,
      tags: req.body.tags,
      thumbnailUrl: req.body.thumbnailUrl,
      readTimeMinutes: req.body.readTimeMinutes,
      updatedAt: new Date(),
    };

    const [updatedArticle] = await db
      .update(articles)
      .set(updateData)
      .where(eq(articles.id, articleId))
      .returning();

    res.json({ article: updatedArticle });
  } catch (error: any) {
    console.error("Error updating article:", error);
    res.status(500).json({ message: "Failed to update article" });
  }
});

/**
 * DELETE /api/admin/articles/:id
 * Delete an article
 */
router.delete("/articles/:id", async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    const articleId = Number.parseInt(req.params.id);
    const orgId = req.user.organizationId;

    // Verify ownership
    const [existing] = await db
      .select()
      .from(articles)
      .where(
        and(
          eq(articles.id, articleId),
          eq(articles.organizationId, orgId)
        )
      )
      .limit(1);

    if (!existing) {
      return res.status(404).json({ message: "Article not found" });
    }

    await db.delete(articles).where(eq(articles.id, articleId));

    res.json({ message: "Article deleted successfully" });
  } catch (error: any) {
    console.error("Error deleting article:", error);
    res.status(500).json({ message: "Failed to delete article" });
  }
});

/**
 * PATCH /api/admin/articles/:id/publish
 * Toggle published status of an article
 */
router.patch("/articles/:id/publish", async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    const articleId = Number.parseInt(req.params.id);
    const orgId = req.user.organizationId;
    const { published } = req.body;

    if (typeof published !== 'boolean') {
      return res.status(400).json({ message: "published must be a boolean" });
    }

    // Verify ownership
    const [existing] = await db
      .select()
      .from(articles)
      .where(
        and(
          eq(articles.id, articleId),
          eq(articles.organizationId, orgId)
        )
      )
      .limit(1);

    if (!existing) {
      return res.status(404).json({ message: "Article not found" });
    }

    const [updatedArticle] = await db
      .update(articles)
      .set({ published, updatedAt: new Date() })
      .where(eq(articles.id, articleId))
      .returning();

    res.json({ article: updatedArticle, message: `Article ${published ? 'published' : 'unpublished'} successfully` });
  } catch (error: any) {
    console.error("Error updating article publish status:", error);
    res.status(500).json({ message: "Failed to update article publish status" });
  }
});

// ========================================
// FLASHCARD DECKS MANAGEMENT
// ========================================

/**
 * GET /api/admin/flashcard-decks
 * Get all flashcard decks for the organization
 */
router.get("/flashcard-decks", async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    const orgId = req.user.organizationId;
    const { category } = req.query;
    const { page, pageSize, offset } = parsePaginationParams(req.query.page, req.query.pageSize);

    // Build WHERE conditions
    let whereConditions = [eq(flashcardDecks.organizationId, orgId)];
    if (category && typeof category === 'string') {
      whereConditions.push(eq(flashcardDecks.category, category));
    }

    // Count query
    const [countRow] = await db
      .select({ total: sql<number>`count(*)` })
      .from(flashcardDecks)
      .where(and(...whereConditions));
    const total = countRow?.total ?? 0;

    // Data query
    const rows = await db
      .select({
        id: flashcardDecks.id,
        title: flashcardDecks.title,
        description: flashcardDecks.description,
        category: flashcardDecks.category,
        createdBy: flashcardDecks.createdBy,
        createdAt: flashcardDecks.createdAt,
        creatorName: sql<string>`CONCAT(${users.firstName}, ' ', ${users.lastName})`,
        cardCount: sql<number>`(
          SELECT COUNT(*) 
          FROM flashcards 
          WHERE deck_id = ${flashcardDecks.id}
        )`,
      })
      .from(flashcardDecks)
      .leftJoin(users, eq(flashcardDecks.createdBy, users.id))
      .where(and(...whereConditions))
      .orderBy(desc(flashcardDecks.createdAt))
      .limit(pageSize)
      .offset(offset);

    res.json({
      decks: rows,
      ...buildPaginationMetadata(total, page, pageSize),
    });
  } catch (error: any) {
    console.error("Error fetching flashcard decks:", error);
    res.status(500).json({ message: "Failed to fetch flashcard decks" });
  }
});

/**
 * GET /api/admin/flashcard-decks/:id
 * Get a single flashcard deck with all its cards
 */
router.get("/flashcard-decks/:id", async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    const deckId = Number.parseInt(req.params.id);
    const orgId = req.user.organizationId;

    const [deck] = await db
      .select()
      .from(flashcardDecks)
      .where(
        and(
          eq(flashcardDecks.id, deckId),
          eq(flashcardDecks.organizationId, orgId)
        )
      )
      .limit(1);

    if (!deck) {
      return res.status(404).json({ message: "Flashcard deck not found" });
    }

    const cards = await db
      .select()
      .from(flashcards)
      .where(eq(flashcards.deckId, deckId))
      .orderBy(flashcards.orderIndex);

    res.json({ deck, cards });
  } catch (error: any) {
    console.error("Error fetching flashcard deck:", error);
    res.status(500).json({ message: "Failed to fetch flashcard deck" });
  }
});

/**
 * POST /api/admin/flashcard-decks
 * Create a new flashcard deck
 */
router.post("/flashcard-decks", validateBody(insertFlashcardDeckSchema), async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    const orgId = req.user.organizationId;
    const deckData: InsertFlashcardDeck = {
      organizationId: orgId,
      title: req.body.title,
      description: req.body.description,
      category: req.body.category,
      createdBy: req.user.id,
    };

    const [newDeck] = await db
      .insert(flashcardDecks)
      .values(deckData)
      .returning();

    res.status(201).json({ deck: newDeck });
  } catch (error: any) {
    console.error("Error creating flashcard deck:", error);
    res.status(500).json({ message: "Failed to create flashcard deck" });
  }
});

/**
 * PUT /api/admin/flashcard-decks/:id
 * Update a flashcard deck
 */
router.put("/flashcard-decks/:id", validateBody(updateFlashcardDeckSchema), async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    const deckId = Number.parseInt(req.params.id);
    const orgId = req.user.organizationId;

    const [existing] = await db
      .select()
      .from(flashcardDecks)
      .where(
        and(
          eq(flashcardDecks.id, deckId),
          eq(flashcardDecks.organizationId, orgId)
        )
      )
      .limit(1);

    if (!existing) {
      return res.status(404).json({ message: "Flashcard deck not found" });
    }

    const updateData: Partial<InsertFlashcardDeck> = {
      title: req.body.title,
      description: req.body.description,
      category: req.body.category,
    };

    const [updatedDeck] = await db
      .update(flashcardDecks)
      .set(updateData)
      .where(eq(flashcardDecks.id, deckId))
      .returning();

    res.json({ deck: updatedDeck });
  } catch (error: any) {
    console.error("Error updating flashcard deck:", error);
    res.status(500).json({ message: "Failed to update flashcard deck" });
  }
});

/**
 * DELETE /api/admin/flashcard-decks/:id
 * Delete a flashcard deck (cascades to cards)
 */
router.delete("/flashcard-decks/:id", async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    const deckId = Number.parseInt(req.params.id);
    const orgId = req.user.organizationId;

    const [existing] = await db
      .select()
      .from(flashcardDecks)
      .where(
        and(
          eq(flashcardDecks.id, deckId),
          eq(flashcardDecks.organizationId, orgId)
        )
      )
      .limit(1);

    if (!existing) {
      return res.status(404).json({ message: "Flashcard deck not found" });
    }

    await db.delete(flashcardDecks).where(eq(flashcardDecks.id, deckId));

    res.json({ message: "Flashcard deck deleted successfully" });
  } catch (error: any) {
    console.error("Error deleting flashcard deck:", error);
    res.status(500).json({ message: "Failed to delete flashcard deck" });
  }
});

/**
 * PATCH /api/admin/flashcard-decks/:id/publish
 * Toggle published status of a flashcard deck
 */
router.patch("/flashcard-decks/:id/publish", async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    const deckId = Number.parseInt(req.params.id);
    const orgId = req.user.organizationId;
    const { published } = req.body;

    if (typeof published !== 'boolean') {
      return res.status(400).json({ message: "published must be a boolean" });
    }

    const [existing] = await db
      .select()
      .from(flashcardDecks)
      .where(
        and(
          eq(flashcardDecks.id, deckId),
          eq(flashcardDecks.organizationId, orgId)
        )
      )
      .limit(1);

    if (!existing) {
      return res.status(404).json({ message: "Flashcard deck not found" });
    }

    const [updatedDeck] = await db
      .update(flashcardDecks)
      .set({ published })
      .where(eq(flashcardDecks.id, deckId))
      .returning();

    res.json({ deck: updatedDeck, message: `Flashcard deck ${published ? 'published' : 'unpublished'} successfully` });
  } catch (error: any) {
    console.error("Error updating flashcard deck publish status:", error);
    res.status(500).json({ message: "Failed to update flashcard deck publish status" });
  }
});

// ========================================
// FLASHCARDS MANAGEMENT
// ========================================

/**
 * POST /api/admin/flashcard-decks/:deckId/cards
 * Add a flashcard to a deck
 */
router.post("/flashcard-decks/:deckId/cards", validateBody(insertFlashcardSchema), async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    const deckId = Number.parseInt(req.params.deckId);
    const orgId = req.user.organizationId;

    // Verify deck ownership
    const [deck] = await db
      .select()
      .from(flashcardDecks)
      .where(
        and(
          eq(flashcardDecks.id, deckId),
          eq(flashcardDecks.organizationId, orgId)
        )
      )
      .limit(1);

    if (!deck) {
      return res.status(404).json({ message: "Flashcard deck not found" });
    }

    const cardData: InsertFlashcard = {
      deckId,
      frontContent: req.body.frontContent,
      backContent: req.body.backContent,
      orderIndex: req.body.orderIndex ?? 0,
    };

    const [newCard] = await db
      .insert(flashcards)
      .values(cardData)
      .returning();

    res.status(201).json({ card: newCard });
  } catch (error: any) {
    console.error("Error adding flashcard:", error);
    res.status(500).json({ message: "Failed to add flashcard" });
  }
});

/**
 * PUT /api/admin/flashcards/:id
 * Update a flashcard
 */
router.put("/flashcards/:id", validateBody(updateFlashcardSchema), async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    const cardId = Number.parseInt(req.params.id);
    const orgId = req.user.organizationId;

    // Verify card exists and belongs to org's deck
    const [existing] = await db
      .select({
        card: flashcards,
        deck: flashcardDecks,
      })
      .from(flashcards)
      .innerJoin(flashcardDecks, eq(flashcards.deckId, flashcardDecks.id))
      .where(
        and(
          eq(flashcards.id, cardId),
          eq(flashcardDecks.organizationId, orgId)
        )
      )
      .limit(1);

    if (!existing) {
      return res.status(404).json({ message: "Flashcard not found" });
    }

    const updateData: Partial<InsertFlashcard> = {
      frontContent: req.body.frontContent,
      backContent: req.body.backContent,
      orderIndex: req.body.orderIndex,
    };

    const [updatedCard] = await db
      .update(flashcards)
      .set(updateData)
      .where(eq(flashcards.id, cardId))
      .returning();

    res.json({ card: updatedCard });
  } catch (error: any) {
    console.error("Error updating flashcard:", error);
    res.status(500).json({ message: "Failed to update flashcard" });
  }
});

/**
 * DELETE /api/admin/flashcards/:id
 * Delete a flashcard
 */
router.delete("/flashcards/:id", async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    const cardId = Number.parseInt(req.params.id);
    const orgId = req.user.organizationId;

    // Verify card exists and belongs to org's deck
    const [existing] = await db
      .select({
        card: flashcards,
        deck: flashcardDecks,
      })
      .from(flashcards)
      .innerJoin(flashcardDecks, eq(flashcards.deckId, flashcardDecks.id))
      .where(
        and(
          eq(flashcards.id, cardId),
          eq(flashcardDecks.organizationId, orgId)
        )
      )
      .limit(1);

    if (!existing) {
      return res.status(404).json({ message: "Flashcard not found" });
    }

    await db.delete(flashcards).where(eq(flashcards.id, cardId));

    res.json({ message: "Flashcard deleted successfully" });
  } catch (error: any) {
    console.error("Error deleting flashcard:", error);
    res.status(500).json({ message: "Failed to delete flashcard" });
  }
});

export function registerAdminPortalRoutes(app: Router) {
  app.use("/api/admin", router);
}
