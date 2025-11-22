/**
 * Employee Portal API Routes
 * Handles all employee-facing features: training, quizzes, certificates, gamification
 */

import { Router, type Request, type Response } from "express";
import { db } from "../db";
import { isAuthenticated, hasOrganization, isEmployee } from "../auth";
import { 
  trainingModules, 
  trainingProgress, 
  quizzes,
  quizQuestions,
  quizAttempts,
  certificates,
  userPoints,
  badges,
  userBadges,
  articles,
  flashcardDecks,
  flashcards
} from "../../shared/schema";
import { eq, and, desc, sql, count } from "drizzle-orm";
import { z } from "zod";
import crypto from "node:crypto";

const router = Router();

// All employee routes require authentication, organization membership, and employee role (not admin)
router.use(isAuthenticated);
router.use(hasOrganization);
router.use(isEmployee);

// ========================================
// TRAINING MODULES ENDPOINTS
// ========================================

/**
 * GET /api/employee/training
 * Get all training modules assigned to the current user
 */
router.get("/training", async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    const userId = req.user.id;
    const orgId = req.user.organizationId;

    // Get all training modules for the org with user's progress
    const modules = await db
      .select({
        id: trainingModules.id,
        title: trainingModules.title,
        description: trainingModules.description,
        category: trainingModules.category,
        difficulty: trainingModules.difficulty,
        durationMinutes: trainingModules.durationMinutes,
        thumbnailUrl: trainingModules.thumbnailUrl,
        isRequired: trainingModules.isRequired,
        tags: trainingModules.tags,
        progressStatus: trainingProgress.status,
        progressPercentage: trainingProgress.progressPercentage,
        completedAt: trainingProgress.completedAt,
        dueDate: trainingProgress.dueDate,
      })
      .from(trainingModules)
      .leftJoin(
        trainingProgress,
        and(
          eq(trainingProgress.moduleId, trainingModules.id),
          eq(trainingProgress.userId, userId)
        )
      )
      .where(eq(trainingModules.organizationId, orgId))
      .orderBy(desc(trainingModules.isRequired), trainingModules.orderIndex);

    res.json({ modules });
  } catch (error: any) {
    console.error("Error fetching training modules:", error);
    res.status(500).json({ message: "Failed to fetch training modules" });
  }
});

/**
 * GET /api/employee/training/:id
 * Get a specific training module with video URL and transcript
 */
router.get("/training/:id", async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    const moduleId = Number.parseInt(req.params.id);
    const userId = req.user.id;

    const [module] = await db
      .select()
      .from(trainingModules)
      .where(eq(trainingModules.id, moduleId))
      .limit(1);

    if (!module) {
      return res.status(404).json({ message: "Training module not found" });
    }

    // Get user's progress
    const [progress] = await db
      .select()
      .from(trainingProgress)
      .where(
        and(
          eq(trainingProgress.moduleId, moduleId),
          eq(trainingProgress.userId, userId)
        )
      )
      .limit(1);

    res.json({ module, progress });
  } catch (error: any) {
    console.error("Error fetching training module:", error);
    res.status(500).json({ message: "Failed to fetch training module" });
  }
});

/**
 * POST /api/employee/training/:id/progress
 * Update user's progress on a training module
 */
router.post("/training/:id/progress", async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    const moduleId = Number.parseInt(req.params.id);
    const userId = req.user.id;
      const { progressPercentage, videoTimestamp, status } = req.body;

    // Check if progress record exists
    const [existing] = await db
      .select()
      .from(trainingProgress)
      .where(
        and(
          eq(trainingProgress.moduleId, moduleId),
          eq(trainingProgress.userId, userId)
        )
      )
      .limit(1);

    if (existing) {
      // Update existing progress
      const updateData: any = {
        progressPercentage,
          videoTimestamp,
        status,
        updatedAt: new Date(),
      };

      // Mark as completed if progress is 100%
      if (progressPercentage >= 100 && !existing.completedAt) {
        updateData.completedAt = new Date();
        updateData.status = "completed";

        // Award points for completion
        await awardPoints(userId, 50, "training_completion");
      }

      await db
        .update(trainingProgress)
        .set(updateData)
        .where(eq(trainingProgress.id, existing.id));
    } else {
      // Create new progress record
      await db.insert(trainingProgress).values({
        userId,
        moduleId,
        progressPercentage,
          videoTimestamp,
        status: status || "in_progress",
      });
    }

    res.json({ success: true });
  } catch (error: any) {
    console.error("Error updating training progress:", error);
    res.status(500).json({ message: "Failed to update progress" });
  }
});

// ========================================
// QUIZ ENDPOINTS
// ========================================

/**
 * GET /api/employee/quizzes
 * Get all available quizzes for the user
 */
router.get("/quizzes", async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    const userId = req.user.id;
    const orgId = req.user.organizationId;

    // Get all quizzes with user's best attempt
    const quizzesWithAttempts = await db
      .select({
        id: quizzes.id,
        title: quizzes.title,
        description: quizzes.description,
        passingScore: quizzes.passingScore,
        timeLimit: quizzes.timeLimit,
        allowRetakes: quizzes.allowRetakes,
        maxAttempts: quizzes.maxAttempts,
        moduleId: quizzes.moduleId,
        bestScore: sql<number>`MAX(${quizAttempts.score})`.as("best_score"),
        attemptCount: count(quizAttempts.id).as("attempt_count"),
        lastAttemptDate: sql<Date>`MAX(${quizAttempts.completedAt})`.as("last_attempt_date"),
      })
      .from(quizzes)
      .leftJoin(
        quizAttempts,
        and(
          eq(quizAttempts.quizId, quizzes.id),
          eq(quizAttempts.userId, userId)
        )
      )
      .where(eq(quizzes.organizationId, orgId))
      .groupBy(quizzes.id);

    res.json({ quizzes: quizzesWithAttempts });
  } catch (error: any) {
    console.error("Error fetching quizzes:", error);
    res.status(500).json({ message: "Failed to fetch quizzes" });
  }
});

/**
 * GET /api/employee/quizzes/:id
 * Get a specific quiz with all questions (for taking the quiz)
 */
router.get("/quizzes/:id", async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    const quizId = Number.parseInt(req.params.id);

    const [quiz] = await db
      .select()
      .from(quizzes)
      .where(eq(quizzes.id, quizId))
      .limit(1);

    if (!quiz) {
      return res.status(404).json({ message: "Quiz not found" });
    }

    // Get all questions (without correct answers for initial load)
    const questions = await db
      .select({
        id: quizQuestions.id,
        questionType: quizQuestions.questionType,
        questionText: quizQuestions.questionText,
        questionImage: quizQuestions.questionImage,
        options: quizQuestions.options,
        points: quizQuestions.points,
        orderIndex: quizQuestions.orderIndex,
      })
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
 * POST /api/employee/quizzes/:id/submit
 * Submit quiz answers and get score
 */
router.post("/quizzes/:id/submit", async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    const quizId = Number.parseInt(req.params.id);
    const userId = req.user.id;
    const { answers, startedAt } = req.body;

    // Get quiz and questions
    const [quiz] = await db
      .select()
      .from(quizzes)
      .where(eq(quizzes.id, quizId))
      .limit(1);

    if (!quiz) {
      return res.status(404).json({ message: "Quiz not found" });
    }

    const questions = await db
      .select()
      .from(quizQuestions)
      .where(eq(quizQuestions.quizId, quizId));

    // Calculate score
    let correctAnswers = 0;
    const results: any[] = [];

    for (const question of questions) {
      const userAnswer = answers[question.id];
      const correctAnswer = question.correctAnswer;
      const isCorrect = JSON.stringify(userAnswer) === JSON.stringify(correctAnswer);

      if (isCorrect) {
        correctAnswers++;
      }

      results.push({
        questionId: question.id,
        userAnswer,
        correctAnswer: quiz.showCorrectAnswers ? correctAnswer : undefined,
        isCorrect,
        explanation: quiz.showCorrectAnswers ? question.explanation : undefined,
      });
    }

    const score = Math.round((correctAnswers / questions.length) * 100);
    const passed = score >= quiz.passingScore;
    const timeSpent = Math.floor((Date.now() - new Date(startedAt).getTime()) / 1000);

    // Get attempt number
    const previousAttempts = await db
      .select()
      .from(quizAttempts)
      .where(
        and(
          eq(quizAttempts.quizId, quizId),
          eq(quizAttempts.userId, userId)
        )
      );

    const attemptNumber = previousAttempts.length + 1;

    // Save attempt
    const [attempt] = await db
      .insert(quizAttempts)
      .values({
        userId,
        quizId,
        attemptNumber,
        score,
        totalQuestions: questions.length,
        correctAnswers,
        answers: answers as any,
        passed,
        startedAt: new Date(startedAt),
        completedAt: new Date(),
        timeSpent,
      })
      .returning();

    // Award points
    if (passed) {
      const points = score === 100 ? 100 : 50; // Bonus for perfect score
      await awardPoints(userId, points, "quiz_completion");

      // Check if this unlocks any badges
      await checkBadgeUnlocks(userId);
    }

    res.json({
      attempt,
      score,
      passed,
      correctAnswers,
      totalQuestions: questions.length,
      results,
    });
  } catch (error: any) {
    console.error("Error submitting quiz:", error);
    res.status(500).json({ message: "Failed to submit quiz" });
  }
});

// ========================================
// CERTIFICATES ENDPOINTS
// ========================================

/**
 * GET /api/employee/certificates
 * Get all certificates earned by the user
 */
router.get("/certificates", async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    const userId = req.user.id;

    const userCertificates = await db
      .select()
      .from(certificates)
      .where(eq(certificates.userId, userId))
      .orderBy(desc(certificates.issuedAt));

    res.json({ certificates: userCertificates });
  } catch (error: any) {
    console.error("Error fetching certificates:", error);
    res.status(500).json({ message: "Failed to fetch certificates" });
  }
});

/**
 * GET /api/employee/certificates/:code/verify
 * Verify a certificate by its verification code
 */
router.get("/certificates/:code/verify", async (req: Request, res: Response) => {
  try {
    const verificationCode = req.params.code;

    const [certificate] = await db
      .select()
      .from(certificates)
      .where(eq(certificates.verificationCode, verificationCode))
      .limit(1);

    if (!certificate) {
      return res.status(404).json({ message: "Certificate not found" });
    }

    // Check if expired
    if (certificate.expiresAt && new Date(certificate.expiresAt) < new Date()) {
      return res.json({ valid: false, reason: "expired" });
    }

    res.json({ valid: true, certificate });
  } catch (error: any) {
    console.error("Error verifying certificate:", error);
    res.status(500).json({ message: "Failed to verify certificate" });
  }
});

// ========================================
// GAMIFICATION ENDPOINTS
// ========================================

/**
 * GET /api/employee/points
 * Get user's points and streak information
 */
router.get("/points", async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    const userId = req.user.id;

    let [points] = await db
      .select()
      .from(userPoints)
      .where(eq(userPoints.userId, userId))
      .limit(1);

    // Initialize if doesn't exist
    if (!points) {
      [points] = await db
        .insert(userPoints)
        .values({ userId })
        .returning();
    }

    res.json({ points });
  } catch (error: any) {
    console.error("Error fetching points:", error);
    res.status(500).json({ message: "Failed to fetch points" });
  }
});

/**
 * GET /api/employee/badges
 * Get all badges and which ones the user has earned
 */
router.get("/badges", async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    const userId = req.user.id;

    // Get all badges
    const allBadges = await db.select().from(badges);

    // Get user's earned badges
    const earnedBadgeIds = await db
      .select({ badgeId: userBadges.badgeId, earnedAt: userBadges.earnedAt })
      .from(userBadges)
      .where(eq(userBadges.userId, userId));

    const earnedMap = new Map(
      earnedBadgeIds.map(b => [b.badgeId, b.earnedAt])
    );

    // Merge data
    const badgesWithStatus = allBadges.map(badge => ({
      ...badge,
      earned: earnedMap.has(badge.id),
      earnedAt: earnedMap.get(badge.id) || null,
    }));

    res.json({ badges: badgesWithStatus });
  } catch (error: any) {
    console.error("Error fetching badges:", error);
    res.status(500).json({ message: "Failed to fetch badges" });
  }
});

/**
 * GET /api/employee/badges/:id
 * Get detailed information about a specific badge
 */
router.get("/badges/:id", async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    const userId = req.user.id;
    const badgeId = Number.parseInt(req.params.id);

    if (isNaN(badgeId)) {
      return res.status(400).json({ message: "Invalid badge ID" });
    }

    // Get badge details
    const [badge] = await db
      .select()
      .from(badges)
      .where(eq(badges.id, badgeId));

    if (!badge) {
      return res.status(404).json({ message: "Badge not found" });
    }

    // Check if user has earned this badge
    const userBadgeRecord = await db
      .select()
      .from(userBadges)
      .where(
        and(
          eq(userBadges.userId, userId),
          eq(userBadges.badgeId, badgeId)
        )
      );

    const earned = userBadgeRecord.length > 0;
    const earnedAt = earned ? userBadgeRecord[0].earnedAt : null;

    // Get total number of users who earned this badge
    const [{ count }] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(userBadges)
      .where(eq(userBadges.badgeId, badgeId));

    // Calculate user progress based on badge criteria
    let progress = 0;
    let progressDetails = null;

    const criteria = badge.criteria as any;
    
    if (earned) {
      progress = 100;
    } else if (criteria) {
      // Calculate progress based on criteria type
      if (criteria.type === 'points' && criteria.requiredPoints) {
        const [userStats] = await db
          .select({ totalPoints: users.totalPoints })
          .from(users)
          .where(eq(users.id, userId));
        
        if (userStats) {
          progress = Math.min(100, (userStats.totalPoints / criteria.requiredPoints) * 100);
          progressDetails = {
            current: userStats.totalPoints,
            required: criteria.requiredPoints,
            type: 'points'
          };
        }
      } else if (criteria.type === 'quiz_completion' && criteria.requiredCompletions) {
        const [{ quizCount }] = await db
          .select({ quizCount: sql<number>`count(DISTINCT quiz_id)::int` })
          .from(quizAttempts)
          .where(
            and(
              eq(quizAttempts.userId, userId),
              gte(quizAttempts.score, sql`(SELECT passing_score FROM quizzes WHERE id = quiz_attempts.quiz_id)`)
            )
          );
        
        progress = Math.min(100, (quizCount / criteria.requiredCompletions) * 100);
        progressDetails = {
          current: quizCount,
          required: criteria.requiredCompletions,
          type: 'quiz_completion'
        };
      } else if (criteria.type === 'streak' && criteria.requiredDays) {
        // For streak badges, we'd need to calculate current streak
        // Simplified version - just show requirement
        progressDetails = {
          current: 0,
          required: criteria.requiredDays,
          type: 'streak'
        };
      } else if (criteria.type === 'perfect_score' && criteria.requiredCount) {
        const [{ perfectScores }] = await db
          .select({ perfectScores: sql<number>`count(*)::int` })
          .from(quizAttempts)
          .where(
            and(
              eq(quizAttempts.userId, userId),
              eq(quizAttempts.score, 100)
            )
          );
        
        progress = Math.min(100, (perfectScores / criteria.requiredCount) * 100);
        progressDetails = {
          current: perfectScores,
          required: criteria.requiredCount,
          type: 'perfect_score'
        };
      }
    }

    res.json({
      badge: {
        ...badge,
        earned,
        earnedAt,
        totalEarned: count,
        progress: Math.round(progress),
        progressDetails
      }
    });
  } catch (error: any) {
    console.error("Error fetching badge details:", error);
    res.status(500).json({ message: "Failed to fetch badge details" });
  }
});

/**
 * GET /api/employee/leaderboard
 * Get leaderboard of top users by points
 */
router.get("/leaderboard", async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    const orgId = req.user.organizationId;
    const limit = Number.parseInt(req.query.limit as string) || 10;

    // Get top users by points (only from same organization)
    const leaderboard = await db.execute(sql`
      SELECT 
        u.id,
        u.first_name,
        u.last_name,
        up.total_points,
        up.current_streak,
        up.longest_streak,
        COUNT(ub.id) as badge_count,
        RANK() OVER (ORDER BY up.total_points DESC) as rank
      FROM users u
      JOIN user_points up ON u.id = up.user_id
      LEFT JOIN user_badges ub ON u.id = ub.user_id
      WHERE u.organization_id = ${orgId}
      GROUP BY u.id, u.first_name, u.last_name, up.total_points, up.current_streak, up.longest_streak
      ORDER BY up.total_points DESC
      LIMIT ${limit}
    `);

    res.json({ leaderboard: leaderboard.rows });
  } catch (error: any) {
    console.error("Error fetching leaderboard:", error);
    res.status(500).json({ message: "Failed to fetch leaderboard" });
  }
});

// ========================================
// HELPER FUNCTIONS
// ========================================

/**
 * Award points to a user and update their streak
 */
async function awardPoints(userId: number, points: number, activity: string) {
  try {
    const [userPoint] = await db
      .select()
      .from(userPoints)
      .where(eq(userPoints.userId, userId))
      .limit(1);

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    if (userPoint) {
      const lastActivity = userPoint.lastActivityDate
        ? new Date(userPoint.lastActivityDate)
        : null;
      
      let newStreak = userPoint.currentStreak;

      if (lastActivity) {
        lastActivity.setHours(0, 0, 0, 0);
        const daysDiff = Math.floor(
          (today.getTime() - lastActivity.getTime()) / (1000 * 60 * 60 * 24)
        );

        if (daysDiff === 1) {
          // Consecutive day
          newStreak = userPoint.currentStreak + 1;
        } else if (daysDiff > 1) {
          // Streak broken
          newStreak = 1;
        }
        // Same day, keep streak
      } else {
        newStreak = 1;
      }

      await db
        .update(userPoints)
        .set({
          totalPoints: userPoint.totalPoints + points,
          currentStreak: newStreak,
          longestStreak: Math.max(newStreak, userPoint.longestStreak),
          lastActivityDate: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(userPoints.userId, userId));
    } else {
      await db.insert(userPoints).values({
        userId,
        totalPoints: points,
        currentStreak: 1,
        longestStreak: 1,
        lastActivityDate: new Date(),
      });
    }
  } catch (error) {
    console.error("Error awarding points:", error);
  }
}

/**
 * Check if user has unlocked any new badges
 */
async function checkBadgeUnlocks(userId: number) {
  try {
    // Get user's points and achievements
    const [points] = await db
      .select()
      .from(userPoints)
      .where(eq(userPoints.userId, userId))
      .limit(1);

    if (!points) return;

    // Get all badges the user hasn't earned yet
    const allBadges = await db.select().from(badges);
    const earnedBadges = await db
      .select()
      .from(userBadges)
      .where(eq(userBadges.userId, userId));

    const earnedBadgeIds = new Set(earnedBadges.map(b => b.badgeId));
    const unearnedBadges = allBadges.filter(b => !earnedBadgeIds.has(b.id));

    // Check each badge's criteria
    for (const badge of unearnedBadges) {
      const criteria = badge.criteria as any;
      let earned = false;

      switch (criteria.type) {
        case "total_points":
          earned = points.totalPoints >= criteria.amount;
          break;
        case "streak":
          earned = points.currentStreak >= criteria.days;
          break;
        // Add more criteria checks as needed
      }

      if (earned) {
        await db.insert(userBadges).values({
          userId,
          badgeId: badge.id,
        });

        // Award bonus points for badge
        await awardPoints(userId, badge.pointsAwarded, "badge_earned");
      }
    }
  } catch (error) {
    console.error("Error checking badge unlocks:", error);
  }
}

export function registerEmployeePortalRoutes(app: any) {
  app.use("/api/employee", router);
  console.log("✅ Employee portal routes registered");
}
