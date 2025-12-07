import { db } from "../db";
import { 
  users, 
  trainingProgress, 
  trainingModules,
  quizAttempts, 
  quizzes,
  userBadges,
  badges,
  userPoints,
  articles,
  flashcards,
  flashcardDecks
} from "../../shared/schema";
import { eq, and, gte, lte, desc, sql, count } from "drizzle-orm";
import { subDays, startOfDay, endOfDay, format, differenceInDays } from "date-fns";

export class DashboardAnalyticsService {
  /**
   * Calculate learning trends over time (modules completed, quizzes passed, points earned)
   */
  async calculateLearningTrends(userId: number, days: number = 30) {
    const startDate = subDays(new Date(), days);
    
    // Get daily module completions
    const moduleCompletions = await db
      .select({
        date: sql<string>`DATE(${trainingProgress.completedAt})`,
        count: sql<number>`COUNT(*)::int`
      })
      .from(trainingProgress)
      .where(
        and(
          eq(trainingProgress.userId, userId),
          gte(trainingProgress.completedAt, startDate),
          sql`${trainingProgress.status} = 'completed'`
        )
      )
      .groupBy(sql`DATE(${trainingProgress.completedAt})`);

    // Get daily quiz passes
    const quizPasses = await db
      .select({
        date: sql<string>`DATE(${quizAttempts.completedAt})`,
        count: sql<number>`COUNT(*)::int`
      })
      .from(quizAttempts)
      .innerJoin(quizzes, eq(quizAttempts.quizId, quizzes.id))
      .where(
        and(
          eq(quizAttempts.userId, userId),
          gte(quizAttempts.completedAt, startDate),
          sql`${quizAttempts.score} >= ${quizzes.passingScore}`
        )
      )
      .groupBy(sql`DATE(${quizAttempts.completedAt})`);

    // Get daily points earned
    const pointsHistory = await db
      .select({
        date: sql<string>`DATE(${userPoints.updatedAt})`,
        points: sql<number>`0::int` // userPoints doesn't track individual point events
      })
      .from(userPoints)
      .where(
        and(
          eq(userPoints.userId, userId),
          gte(userPoints.updatedAt, startDate)
        )
      )
      .groupBy(sql`DATE(${userPoints.updatedAt})`);

    // Merge data by date
    const trendsMap = new Map<string, { date: string; modulesCompleted: number; quizzesPassed: number; pointsEarned: number }>();
    
    for (let i = 0; i < days; i++) {
      const date = format(subDays(new Date(), i), 'yyyy-MM-dd');
      trendsMap.set(date, { date, modulesCompleted: 0, quizzesPassed: 0, pointsEarned: 0 });
    }

    moduleCompletions.forEach(m => {
      const existing = trendsMap.get(m.date);
      if (existing) existing.modulesCompleted = m.count;
    });

    quizPasses.forEach(q => {
      const existing = trendsMap.get(q.date);
      if (existing) existing.quizzesPassed = q.count;
    });

    pointsHistory.forEach(p => {
      const existing = trendsMap.get(p.date);
      if (existing) existing.pointsEarned = p.points;
    });

    return Array.from(trendsMap.values()).sort((a, b) => a.date.localeCompare(b.date));
  }

  /**
   * Get skill breakdown by category and difficulty
   */
  async getSkillBreakdown(userId: number) {
    const breakdown = await db
      .select({
        category: trainingModules.category,
        difficulty: trainingModules.difficulty,
        total: sql<number>`COUNT(*)::int`,
        completed: sql<number>`COUNT(CASE WHEN ${trainingProgress.status} = 'completed' THEN 1 END)::int`,
        avgProgress: sql<number>`AVG(${trainingProgress.progressPercentage})::int`
      })
      .from(trainingModules)
      .leftJoin(
        trainingProgress,
        and(
          eq(trainingProgress.moduleId, trainingModules.id),
          eq(trainingProgress.userId, userId)
        )
      )
      .groupBy(trainingModules.category, trainingModules.difficulty);

    return breakdown;
  }

  /**
   * Generate activity heatmap data (GitHub-style calendar)
   */
  async getActivityHeatmap(userId: number, days: number = 90) {
    const startDate = subDays(new Date(), days);

    const activities = await db
      .select({
        date: sql<string>`DATE(activity_date)`,
        count: sql<number>`SUM(activity_count)::int`
      })
      .from(
        sql`(
          SELECT ${trainingProgress.updatedAt} as activity_date, 1 as activity_count
          FROM ${trainingProgress}
          WHERE ${trainingProgress.userId} = ${userId}
            AND ${trainingProgress.updatedAt} >= ${startDate}
          UNION ALL
          SELECT ${quizAttempts.completedAt} as activity_date, 1 as activity_count
          FROM ${quizAttempts}
          WHERE ${quizAttempts.userId} = ${userId}
            AND ${quizAttempts.completedAt} >= ${startDate}
          UNION ALL
          SELECT ${userBadges.earnedAt} as activity_date, 1 as activity_count
          FROM ${userBadges}
          WHERE ${userBadges.userId} = ${userId}
            AND ${userBadges.earnedAt} >= ${startDate}
        ) as activities`
      )
      .groupBy(sql`DATE(activity_date)`);

    return activities;
  }

  /**
   * Get quiz performance trends over time
   */
  async getQuizPerformanceTrends(userId: number, limit: number = 20) {
    const attempts = await db
      .select({
        quizId: quizzes.id,
        quizTitle: quizzes.title,
        category: sql<string>`'General'`, // quizzes table doesn't have category
        score: quizAttempts.score,
        passingScore: quizzes.passingScore,
        completedAt: quizAttempts.completedAt
      })
      .from(quizAttempts)
      .innerJoin(quizzes, eq(quizAttempts.quizId, quizzes.id))
      .where(eq(quizAttempts.userId, userId))
      .orderBy(desc(quizAttempts.completedAt))
      .limit(limit);

    // Group by category for category-wise trends
    const byCategory = attempts.reduce((acc, attempt) => {
      const cat = attempt.category || 'General';
      if (!acc[cat]) acc[cat] = [];
      acc[cat].push({
        date: attempt.completedAt || new Date(),
        score: attempt.score ?? 0,
        passingScore: attempt.passingScore
      });
      return acc;
    }, {} as Record<string, Array<{ date: Date; score: number; passingScore: number }>>);

    return { attempts, byCategory };
  }

  /**
   * Get streak history for visualization
   */
  async getStreakHistory(userId: number, days: number = 90) {
    const startDate = subDays(new Date(), days);
    
    const activities = await db
      .select({
        date: sql<string>`DATE(activity_date)`
      })
      .from(
        sql`(
          SELECT ${trainingProgress.updatedAt} as activity_date
          FROM ${trainingProgress}
          WHERE ${trainingProgress.userId} = ${userId}
            AND ${trainingProgress.updatedAt} >= ${startDate}
          UNION
          SELECT ${quizAttempts.completedAt} as activity_date
          FROM ${quizAttempts}
          WHERE ${quizAttempts.userId} = ${userId}
            AND ${quizAttempts.completedAt} >= ${startDate}
        ) as activities`
      )
      .groupBy(sql`DATE(activity_date)`)
      .orderBy(sql`DATE(activity_date)`);

    // Calculate streaks
    const activeDays = new Set(activities.map(a => a.date));
    const streakData = [];
    let currentStreak = 0;
    let maxStreak = 0;

    for (let i = 0; i < days; i++) {
      const date = format(subDays(new Date(), i), 'yyyy-MM-dd');
      const isActive = activeDays.has(date);
      
      if (isActive) {
        currentStreak++;
        maxStreak = Math.max(maxStreak, currentStreak);
      } else {
        currentStreak = 0;
      }

      streakData.push({ date, active: isActive });
    }

    return { streakData: streakData.reverse(), currentStreak, maxStreak };
  }

  /**
   * Get upcoming deadlines for training modules
   */
  async getUpcomingDeadlines(userId: number, organizationId: number) {
    const now = new Date();
    const futureDate = new Date();
    futureDate.setDate(futureDate.getDate() + 30); // Next 30 days

    const upcomingModules = await db
      .select({
        moduleId: trainingModules.id,
        title: trainingModules.title,
        dueDate: trainingProgress.dueDate,
        progress: trainingProgress.progressPercentage,
        status: trainingProgress.status
      })
      .from(trainingModules)
      .leftJoin(
        trainingProgress,
        and(
          eq(trainingProgress.moduleId, trainingModules.id),
          eq(trainingProgress.userId, userId)
        )
      )
      .where(
        and(
          eq(trainingModules.organizationId, organizationId),
          sql`${trainingProgress.dueDate} IS NOT NULL`,
          gte(trainingProgress.dueDate, now),
          lte(trainingProgress.dueDate, futureDate),
          sql`(${trainingProgress.status} IS NULL OR ${trainingProgress.status} != 'completed')`
        )
      )
      .orderBy(trainingProgress.dueDate);

    return upcomingModules.map(m => ({
      ...m,
      daysUntilDue: m.dueDate ? differenceInDays(m.dueDate, now) : null,
      urgency: m.dueDate ? (differenceInDays(m.dueDate, now) <= 7 ? 'high' : differenceInDays(m.dueDate, now) <= 14 ? 'medium' : 'low') : 'none'
    }));
  }

  /**
   * Get recommended content based on user's weak areas and incomplete modules
   */
  async getRecommendedContent(userId: number, organizationId: number) {
    // Original intent: derive weak categories from quiz performance.
    // Issue: referenced trainingModules.category without joining trainingModules, causing Drizzle error.
    // Temporary approach: compute overall average quiz score and, if weak (<80), recommend incomplete modules.
    const overallQuizScore = await db
      .select({ avgScore: sql<number>`AVG(${quizAttempts.score})::int` })
      .from(quizAttempts)
      .where(eq(quizAttempts.userId, userId));

    const weakCategories = (overallQuizScore.length > 0 && overallQuizScore[0].avgScore < 80)
      ? [{ category: 'general', avgScore: overallQuizScore[0].avgScore }]
      : [];

    // Get incomplete modules in weak categories
    const recommendations = [];

    if (weakCategories.length > 0) {
      const modules = await db
        .select({
          id: trainingModules.id,
          title: trainingModules.title,
          category: trainingModules.category,
          difficulty: trainingModules.difficulty
        })
        .from(trainingModules)
        .leftJoin(
          trainingProgress,
          and(
            eq(trainingProgress.moduleId, trainingModules.id),
            eq(trainingProgress.userId, userId)
          )
        )
        .where(
          and(
            eq(trainingModules.organizationId, organizationId),
            sql`(${trainingProgress.status} IS NULL OR ${trainingProgress.status} != 'completed')`
          )
        )
        .orderBy(desc(trainingModules.difficulty))
        .limit(5);

      recommendations.push(...modules.map(m => ({ ...m, type: 'module', reason: 'Strengthen weak area (low quiz avg)' })));
    }

    // Get articles related to incomplete modules
    // Articles table doesn't exist yet, return empty array
    const articles: Array<{ id: number; title: string; category: string; estimatedReadTime: number | null }> = [];

    recommendations.push(...articles.map(a => ({ ...a, type: 'article', reason: 'Supplementary reading' })));

    return recommendations;
  }

  /**
   * Get completion funnel data (started → in-progress → completed)
   */
  async getCompletionFunnel(userId: number) {
    const [stats] = await db
      .select({
        started: sql<number>`COUNT(CASE WHEN ${trainingProgress.status} = 'started' THEN 1 END)::int`,
        inProgress: sql<number>`COUNT(CASE WHEN ${trainingProgress.status} = 'in_progress' THEN 1 END)::int`,
        completed: sql<number>`COUNT(CASE WHEN ${trainingProgress.status} = 'completed' THEN 1 END)::int`
      })
      .from(trainingProgress)
      .where(eq(trainingProgress.userId, userId));

    return stats;
  }

  /**
   * Get comprehensive dashboard analytics
   */
  async getDashboardAnalytics(userId: number, organizationId: number) {
    const [trends, skillBreakdown, heatmap, quizTrends, streakHistory, deadlines, recommendations, funnel] = await Promise.all([
      this.calculateLearningTrends(userId, 30),
      this.getSkillBreakdown(userId),
      this.getActivityHeatmap(userId, 90),
      this.getQuizPerformanceTrends(userId, 20),
      this.getStreakHistory(userId, 90),
      this.getUpcomingDeadlines(userId, organizationId),
      this.getRecommendedContent(userId, organizationId),
      this.getCompletionFunnel(userId)
    ]);

    return {
      trends,
      skillBreakdown,
      heatmap,
      quizTrends,
      streakHistory,
      deadlines,
      recommendations,
      funnel
    };
  }
}

export const dashboardAnalyticsService = new DashboardAnalyticsService();
