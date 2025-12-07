import { db } from "../db";
import {
  trainingProgress,
  trainingModules,
  userPoints,
  userBadges,
  badges,
  quizAttempts,
} from "@shared/schema";
import { and, eq, sql, gte, lte, desc } from "drizzle-orm";

function startOfDay(d: Date) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

function endOfDay(d: Date) {
  const x = new Date(d);
  x.setHours(23, 59, 59, 999);
  return x;
}

export class DashboardInsightsService {
  async getInsights(userId: number, organizationId: number) {
    const todayStart = startOfDay(new Date());
    const todayEnd = endOfDay(new Date());

    // Completed modules today
    const [{ completedToday }] = await db
      .select({ completedToday: sql<number>`count(*)::int` })
      .from(trainingProgress)
      .where(
        and(
          eq(trainingProgress.userId, userId),
          sql`${trainingProgress.completedAt} IS NOT NULL`,
          gte(trainingProgress.completedAt, todayStart),
          lte(trainingProgress.completedAt, todayEnd)
        )
      );

    // Default daily goal target: 1 module/day
    const dailyTarget = 1;
    const dailyProgressPct = Math.min(100, Math.round((completedToday / dailyTarget) * 100));

    // Modules due soon (for suggestions)
    const dueSoon = await db
      .select({
        id: trainingProgress.id,
        moduleId: trainingProgress.moduleId,
        dueDate: trainingProgress.dueDate,
        title: trainingModules.title,
      })
      .from(trainingProgress)
      .innerJoin(trainingModules, eq(trainingModules.id, trainingProgress.moduleId))
      .where(
        and(
          eq(trainingProgress.userId, userId),
          sql`${trainingProgress.status} != 'completed'`,
          sql`${trainingProgress.dueDate} IS NOT NULL`
        )
      )
      .orderBy(trainingProgress.dueDate)
      .limit(1);

    // Recent achievements (last 3)
    const recentAchievements = await db
      .select({
        badgeId: userBadges.badgeId,
        earnedAt: userBadges.earnedAt,
        name: badges.name,
        rarity: badges.rarity,
        iconUrl: badges.iconUrl,
      })
      .from(userBadges)
      .innerJoin(badges, eq(badges.id, userBadges.badgeId))
      .where(eq(userBadges.userId, userId))
      .orderBy(desc(userBadges.earnedAt))
      .limit(3);

    const [{ totalBadges }] = await db
      .select({ totalBadges: sql<number>`count(*)::int` })
      .from(userBadges)
      .where(eq(userBadges.userId, userId));

    // Points & next milestone (every 500 pts as a simple milestone)
    const [pointsRow] = await db
      .select({ totalPoints: userPoints.totalPoints })
      .from(userPoints)
      .where(eq(userPoints.userId, userId))
      .limit(1);
    const totalPoints = pointsRow?.totalPoints ?? 0;
    const nextMilestoneAt = Math.ceil(totalPoints / 500) * 500 + (totalPoints % 500 === 0 ? 500 : 0);
    const pointsToNext = Math.max(0, nextMilestoneAt - totalPoints);

    // Basic learning insight: top category from completed modules and weak area from recent quiz attempts
    const topCategoryRows = await db.execute(sql`
      SELECT tm.category, COUNT(*)::int AS cnt
      FROM ${trainingProgress} tp
      JOIN ${trainingModules} tm ON tm.id = tp.module_id
      WHERE tp.user_id = ${userId} AND tp.status = 'completed'
      GROUP BY tm.category
      ORDER BY cnt DESC
      LIMIT 1
    `);
    const topCategory = topCategoryRows.rows?.[0]?.category ?? null;

    const weakAreaRows = await db.execute(sql`
      SELECT tm.category, AVG(qa.score)::int AS avg_score, COUNT(*)::int as attempts
      FROM ${quizAttempts} qa
      JOIN ${trainingModules} tm ON tm.id = (SELECT module_id FROM quizzes q WHERE q.id = qa.quiz_id)
      WHERE qa.user_id = ${userId} AND qa.completed_at IS NOT NULL
      GROUP BY tm.category
      HAVING COUNT(*) > 0
      ORDER BY avg_score ASC
      LIMIT 1
    `);
    const weakArea = weakAreaRows.rows?.[0]?.category ?? null;

    return {
      dailyGoal: {
        target: dailyTarget,
        completedToday,
        progress: dailyProgressPct,
        suggestion: dueSoon[0]?.title || (weakArea ? `Practice ${weakArea}` : "Start a module today"),
        dueSoon: dueSoon[0] ? { moduleId: dueSoon[0].moduleId, title: dueSoon[0].title, dueDate: dueSoon[0].dueDate } : null,
      },
      achievements: {
        total: totalBadges,
        recent: recentAchievements,
      },
      insights: {
        topCategory,
        weakArea,
      },
      milestone: {
        currentPoints: totalPoints,
        nextAt: nextMilestoneAt,
        remaining: pointsToNext,
      },
    };
  }
}

export const dashboardInsightsService = new DashboardInsightsService();
