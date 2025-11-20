import { Router, Request, Response } from "express";
import { db } from "../db";
import { 
  trainingModules, 
  quizzes, 
  quizQuestions,
  badges,
  trainingProgress,
  users,
  type InsertTrainingModule,
  type InsertQuiz,
  type InsertQuizQuestion,
  type InsertBadge
} from "../../shared/schema";
import { eq, and, desc, sql } from "drizzle-orm";
import { isAdmin } from "../auth";

const router = Router();

// All routes require admin authentication
router.use(isAdmin);

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
router.post("/training-modules", async (req: Request, res: Response) => {
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
router.put("/training-modules/:id", async (req: Request, res: Response) => {
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

    const allQuizzes = await db
      .select()
      .from(quizzes)
      .where(eq(quizzes.organizationId, orgId))
      .orderBy(desc(quizzes.createdAt));

    res.json({ quizzes: allQuizzes });
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
router.post("/quizzes", async (req: Request, res: Response) => {
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
router.put("/quizzes/:id", async (req: Request, res: Response) => {
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
 * POST /api/admin/quizzes/:id/questions
 * Add a question to a quiz
 */
router.post("/quizzes/:id/questions", async (req: Request, res: Response) => {
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
      questionOptions: req.body.questionOptions || [],
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
router.put("/quiz-questions/:id", async (req: Request, res: Response) => {
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
      questionOptions: req.body.questionOptions,
      correctAnswer: req.body.correctAnswer,
      explanation: req.body.explanation,
      points: req.body.points,
      orderIndex: req.body.orderIndex,
      updatedAt: new Date(),
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
    const allBadges = await db
      .select({
        id: badges.id,
        name: badges.name,
        description: badges.description,
        criteria: badges.criteria,
        rarity: badges.rarity,
        iconUrl: badges.iconUrl,
        createdAt: badges.createdAt,
        // Count of users who have earned this badge
        earnedCount: sql<number>`(
          SELECT COUNT(*) 
          FROM user_badges 
          WHERE badge_id = ${badges.id}
        )`
      })
      .from(badges)
      .orderBy(desc(badges.createdAt));

    res.json({ badges: allBadges });
  } catch (error: any) {
    console.error("Error fetching badges:", error);
    res.status(500).json({ message: "Failed to fetch badges" });
  }
});

/**
 * POST /api/admin/badges
 * Create a new badge
 */
router.post("/badges", async (req: Request, res: Response) => {
  try {
    const badgeData: InsertBadge = {
      name: req.body.name,
      description: req.body.description,
      criteria: req.body.criteria,
      rarity: req.body.rarity ?? "common",
      iconUrl: req.body.iconUrl,
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
router.put("/badges/:id", async (req: Request, res: Response) => {
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

export function registerAdminPortalRoutes(app: Router) {
  app.use("/api/admin", router);
}
