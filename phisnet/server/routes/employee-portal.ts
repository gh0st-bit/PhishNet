import {badgeFacts} from '../services/badge-evaluation';
import {evaluateBadgeCriterion} from '@shared/badge-criteria';
import {answerMatches} from '@shared/quiz-grading';
import {pool} from '../db';
import { reliableRoutes } from '../http';
/**
 * Employee Portal API Routes
 * Handles all employee-facing features: training, quizzes, certificates, gamification
 */

import { Router, type Request, type Response } from "express";
import { db } from "../db";
import { isAuthenticated, hasOrganization, isEmployee } from "../auth";
import { dashboardAnalyticsService } from "../services/dashboard-analytics.service";
import { dashboardInsightsService } from "../services/dashboard-insights.service";
import { gamificationService } from "../services/gamification.service";
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

const router = reliableRoutes(Router());

// All employee routes require authentication, organization membership, and employee role (not admin)
router.use(isAuthenticated);
router.use(hasOrganization);
router.use(isEmployee);

// ========================================
// DASHBOARD ANALYTICS ENDPOINTS
// ========================================

/**
 * GET /api/employee/dashboard/analytics
 * Get comprehensive dashboard analytics data
 */
router.get("/dashboard/analytics", async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    const userId = req.user.id;
    const organizationId = req.user.organizationId;

    const analytics = await dashboardAnalyticsService.getDashboardAnalytics(userId, organizationId);
    
    res.json(analytics);
  } catch (error: any) {
    console.error("Error fetching dashboard analytics:", error);
    res.status(500).json({ message: "Failed to fetch dashboard analytics" });
  }
});

/**
 * GET /api/employee/dashboard/insights
 * Lightweight personalized insights for widgets
 */
router.get("/dashboard/insights", async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    const userId = req.user.id;
    const organizationId = req.user.organizationId;

    const insights = await dashboardInsightsService.getInsights(userId, organizationId);
    res.json(insights);
  } catch (error: any) {
    console.error("Error fetching dashboard insights:", error);
    res.status(500).json({ message: "Failed to fetch dashboard insights" });
  }
});

/**
 * GET /api/employee/level
 * Get user's current level and XP progress
 */
router.get("/level", async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    const status = await gamificationService.getUserStatus(req.user.id);
    res.json(status);
  } catch (error: any) {
    console.error("Error fetching level:", error);
    res.status(500).json({ message: "Failed to fetch level" });
  }
});

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

    const captured=(await pool.query('SELECT content_snapshot FROM training_progress WHERE user_id=$1 AND module_id=$2',[userId,moduleId])).rows[0]?.content_snapshot;
    const saved=captured?.module?Object.fromEntries(Object.entries(captured.module).map(([key,value])=>[key.replace(/_([a-z])/g,(_m,c)=>c.toUpperCase()),value])):module;
    res.json({module:saved,progress,contentCapturedAt:captured?.capturedAt||null});
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
    const parsed=z.object({progressPercentage:z.number().int().min(0).max(100),videoTimestamp:z.number().int().min(0).max(86400).default(0),status:z.enum(['not_started','in_progress','completed']).optional()}).safeParse(req.body);
    if(!parsed.success)return res.status(400).json({message:'Invalid learning progress'});
    const {progressPercentage,videoTimestamp,status}=parsed.data;
    if(!(await pool.query('SELECT 1 FROM training_modules WHERE id=$1 AND organization_id=$2',[moduleId,req.user.organizationId])).rowCount)return res.status(404).json({message:'Training module not found'});

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

    if(existing?.status==='completed')return res.json({success:true});
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

        // Award XP for completion
        await gamificationService.awardXP(userId, 50, "training_completion",`training:${moduleId}`);
      }

      await db
        .update(trainingProgress)
        .set(updateData)
        .where(eq(trainingProgress.id, existing.id));
    } else {
      await db.insert(trainingProgress).values({userId,moduleId,progressPercentage,videoTimestamp,status:progressPercentage>=100?'completed':status||'in_progress',completedAt:progressPercentage>=100?new Date():null});
      if(progressPercentage>=100)await gamificationService.awardXP(userId,50,'training_completion',`training:${moduleId}`);
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
      .where(
        and(
          eq(quizzes.organizationId, orgId),
          eq(quizzes.published, true) // Only published quizzes
        )
      )
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
      .where(
        and(
          eq(quizzes.id, quizId),
          eq(quizzes.published, true) // Only published quizzes
        )
      )
      .limit(1);

    if (!quiz) {
      return res.status(404).json({ message: "Quiz not found or not published" });
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
      const isCorrect = answerMatches(question.questionType,userAnswer,correctAnswer);

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

    // Award XP and capture gamification data
    let gamificationData = null;
    if (passed) {
      const xp = score === 100 ? 100 : 50; // Bonus for perfect score
      const gamificationResult = await gamificationService.awardXP(userId, xp, "quiz_completion",`quiz-attempt:${attempt.id}`);
      gamificationData = {
        xpGained: xp,
        leveledUp: gamificationResult.leveledUp,
        oldLevel: gamificationResult.oldLevel,
        newLevel: gamificationResult.newLevel,
        newBadges: gamificationResult.newBadges?.map((badge: any) => ({
          id: badge.id,
          name: badge.name,
          description: badge.description,
          rarity: badge.rarity,
        })),
      };
    }

    res.json({
      attempt,
      score,
      passed,
      correctAnswers,
      totalQuestions: questions.length,
      results,
      gamification: gamificationData,
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

    // Get all badges (only published ones)
    const allBadges = await db
      .select()
      .from(badges)
      .where(sql`(${badges.published} AND ${badges.archivedAt} IS NULL) OR EXISTS (SELECT 1 FROM user_badges ub WHERE ub.badge_id=${badges.id} AND ub.user_id=${userId})`);

    // Get user's earned badges
    const earnedBadgeIds = await db
      .select({ badgeId: userBadges.badgeId, earnedAt: userBadges.earnedAt, snapshot: userBadges.awardSnapshot })
      .from(userBadges)
      .where(eq(userBadges.userId, userId));

    const earnedMap = new Map(
      earnedBadgeIds.map(b => [b.badgeId, b.earnedAt])
    );

    const facts=await badgeFacts(userId);
    // Merge data
    const badgesWithStatus = allBadges.map(badge => ({
      ...badge,
      ...(earnedBadgeIds.find(b=>b.badgeId===badge.id)?.snapshot as object || {}),
      earned: earnedMap.has(badge.id),
      earnedAt: earnedMap.get(badge.id) || null,
      ...(()=>{try { const evaluated=evaluateBadgeCriterion(badge.criteria,facts);return {progress:earnedMap.has(badge.id)?100:evaluated.progress,progressDetails:evaluated};}catch{return {progress:0,progressDetails:null};}})(),
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

    // Get badge details (only if published)
    const [badge] = await db
      .select()
      .from(badges)
      .where(
        and(
          eq(badges.id, badgeId),
          sql`((${badges.published} AND ${badges.archivedAt} IS NULL) OR EXISTS(SELECT 1 FROM user_badges ub WHERE ub.badge_id=${badges.id} AND ub.user_id=${userId}))`
        )
      );

    if (!badge) {
      return res.status(404).json({ message: "Badge not found or not published" });
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

    let progress=earned?100:0;
    let progressDetails:any=null;
    if(!earned) {
      try { const result=evaluateBadgeCriterion(badge.criteria,await badgeFacts(userId)); progress=result.progress; progressDetails=result; } catch { progressDetails={type:'unavailable',current:0,required:0}; }
    }

    res.json({
      badge: {
        ...badge,
        ...(earned ? userBadgeRecord[0].awardSnapshot as object || {} : {}),
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
    const enabled=(await pool.query("SELECT COALESCE((preferences->>'leaderboardEnabled')::boolean,false) AS enabled FROM organizations WHERE id=$1",[req.user!.organizationId])).rows[0]?.enabled;
    if(!enabled)return res.json({leaderboard:[],enabled:false});
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
// ARTICLES ENDPOINTS
// ========================================

// ========================================
// FLASHCARDS ENDPOINTS
// ========================================

/**
 * GET /api/employee/flashcard-decks
 * Get all published flashcard decks with card counts
 */
router.get("/flashcard-decks", async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    const orgId = req.user.organizationId;

    // Get published decks with card counts
    const decks = await db
      .select({
        id: flashcardDecks.id,
        title: flashcardDecks.title,
        description: flashcardDecks.description,
        category: flashcardDecks.category,
        cardCount: sql<number>`cast(count(${flashcards.id}) as integer)`,
      })
      .from(flashcardDecks)
      .leftJoin(flashcards, eq(flashcards.deckId, flashcardDecks.id))
      .where(
        and(
          eq(flashcardDecks.organizationId, orgId),
          eq(flashcardDecks.published, true)
        )
      )
      .groupBy(
        flashcardDecks.id,
        flashcardDecks.title,
        flashcardDecks.description,
        flashcardDecks.category
      )
      .orderBy(flashcardDecks.title);

    // Prevent caching to ensure published status changes are reflected immediately
    res.set('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.json(decks);
  } catch (error: any) {
    console.error("Error fetching flashcard decks:", error);
    res.status(500).json({ message: "Failed to fetch flashcard decks" });
  }
});

/**
 * GET /api/employee/flashcard-decks/:id/cards
 * Get all cards for a specific published deck
 */
router.get("/flashcard-decks/:id/cards", async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    const orgId = req.user.organizationId;
    const deckId = Number.parseInt(req.params.id);

    if (isNaN(deckId)) {
      return res.status(400).json({ message: "Invalid deck ID" });
    }

    // Verify deck exists and is published
    const [deck] = await db
      .select()
      .from(flashcardDecks)
      .where(
        and(
          eq(flashcardDecks.id, deckId),
          eq(flashcardDecks.organizationId, orgId),
          eq(flashcardDecks.published, true)
        )
      )
      .limit(1);

    if (!deck) {
      return res.status(404).json({ message: "Deck not found or not published" });
    }

    // Get all cards for this deck, ordered by orderIndex
    const cards = await db
      .select()
      .from(flashcards)
      .where(eq(flashcards.deckId, deckId))
      .orderBy(flashcards.orderIndex);

    console.log(`[FLASHCARDS] Deck ${deckId}: Found ${cards.length} cards`);
    console.log('[FLASHCARDS] Cards data:', JSON.stringify(cards, null, 2));

    // Prevent caching to ensure card updates are reflected immediately
    res.set('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.json(cards);
  } catch (error: any) {
    console.error("Error fetching flashcards:", error);
    res.status(500).json({ message: "Failed to fetch flashcards" });
  }
});

// ========================================
// ARTICLES ENDPOINTS
// ========================================

/**
 * GET /api/employee/articles
 * Get all published articles for the employee's organization
 */
router.get("/articles", async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    const orgId = req.user.organizationId;

    // Only return published articles
    const publishedArticles = await db
      .select()
      .from(articles)
      .where(
        and(
          eq(articles.organizationId, orgId),
          eq(articles.published, true)
        )
      )
      .orderBy(desc(articles.publishedAt));

    res.json(publishedArticles);
  } catch (error: any) {
    console.error("Error fetching articles:", error);
    res.status(500).json({ message: "Failed to fetch articles" });
  }
});

/**
 * GET /api/employee/articles/:id
 * Get a specific published article
 */
router.get("/articles/:id", async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    const orgId = req.user.organizationId;
    const articleId = Number.parseInt(req.params.id);

    if (isNaN(articleId)) {
      return res.status(400).json({ message: "Invalid article ID" });
    }

    const [article] = await db
      .select()
      .from(articles)
      .where(
        and(
          eq(articles.id, articleId),
          eq(articles.organizationId, orgId),
          eq(articles.published, true) // Only published articles
        )
      )
      .limit(1);

    if (!article) {
      return res.status(404).json({ message: "Article not found or not published" });
    }

    res.json(article);
  } catch (error: any) {
    console.error("Error fetching article:", error);
    res.status(500).json({ message: "Failed to fetch article" });
  }
});

// ========================================
// HELPER FUNCTIONS
// ========================================
// Note: Points/XP and badge unlocks now handled by gamificationService

export function registerEmployeePortalRoutes(app: any) {
  app.use("/api/employee", router);
  console.log("✅ Employee portal routes registered");
}
