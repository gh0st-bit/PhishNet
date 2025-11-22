/**
 * Gamification Service
 * Handles XP, leveling, badge unlocks, and achievements
 */

import { db } from "../db";
import { userPoints, userBadges, badges } from "@shared/schema";
import { eq, sql } from "drizzle-orm";

// Level thresholds (XP required for each level)
const LEVEL_THRESHOLDS = [
  0,      // Level 1
  100,    // Level 2
  250,    // Level 3
  500,    // Level 4
  1000,   // Level 5
  1750,   // Level 6
  2750,   // Level 7
  4000,   // Level 8
  6000,   // Level 9
  8500,   // Level 10
  12000,  // Level 11
  16000,  // Level 12
  21000,  // Level 13
  27000,  // Level 14
  35000,  // Level 15
  45000,  // Level 16
  57000,  // Level 17
  72000,  // Level 18
  90000,  // Level 19
  112000, // Level 20
];

export class GamificationService {
  /**
   * Calculate level from total points
   */
  calculateLevel(points: number): number {
    let level = 1;
    for (let i = LEVEL_THRESHOLDS.length - 1; i >= 0; i--) {
      if (points >= LEVEL_THRESHOLDS[i]) {
        level = i + 1;
        break;
      }
    }
    return level;
  }

  /**
   * Get XP progress for current level
   */
  getLevelProgress(points: number): { level: number; currentLevelXP: number; nextLevelXP: number; progress: number } {
    const level = this.calculateLevel(points);
    const currentThreshold = LEVEL_THRESHOLDS[level - 1] || 0;
    const nextThreshold = LEVEL_THRESHOLDS[level] || LEVEL_THRESHOLDS[LEVEL_THRESHOLDS.length - 1] + 10000;
    
    const currentLevelXP = points - currentThreshold;
    const xpNeeded = nextThreshold - currentThreshold;
    const progress = xpNeeded > 0 ? Math.round((currentLevelXP / xpNeeded) * 100) : 100;

    return {
      level,
      currentLevelXP,
      nextLevelXP: nextThreshold,
      progress: Math.min(100, progress),
    };
  }

  /**
   * Award XP to user and handle level-ups
   * Returns: { leveledUp: boolean, oldLevel: number, newLevel: number, badges: any[] }
   */
  async awardXP(userId: number, xp: number, reason: string): Promise<{ leveledUp: boolean; oldLevel: number; newLevel: number; newBadges: any[] }> {
    // Get or create user points
    let [userPoint] = await db
      .select()
      .from(userPoints)
      .where(eq(userPoints.userId, userId))
      .limit(1);

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    if (userPoint) {
      const oldLevel = this.calculateLevel(userPoint.totalPoints);
      const newPoints = userPoint.totalPoints + xp;
      const newLevel = this.calculateLevel(newPoints);

      // Update streak
      const lastActivity = userPoint.lastActivityDate ? new Date(userPoint.lastActivityDate) : null;
      let newStreak = userPoint.currentStreak;

      if (lastActivity) {
        lastActivity.setHours(0, 0, 0, 0);
        const daysDiff = Math.floor((today.getTime() - lastActivity.getTime()) / (1000 * 60 * 60 * 24));

        if (daysDiff === 1) {
          newStreak = userPoint.currentStreak + 1;
        } else if (daysDiff > 1) {
          newStreak = 1;
        }
      } else {
        newStreak = 1;
      }

      await db
        .update(userPoints)
        .set({
          totalPoints: newPoints,
          currentStreak: newStreak,
          longestStreak: Math.max(newStreak, userPoint.longestStreak),
          lastActivityDate: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(userPoints.userId, userId));

      // Check for new badges
      const newBadges = await this.checkBadgeUnlocks(userId, newPoints, newStreak);

      return {
        leveledUp: newLevel > oldLevel,
        oldLevel,
        newLevel,
        newBadges,
      };
    } else {
      // Create new record
      await db.insert(userPoints).values({
        userId,
        totalPoints: xp,
        currentStreak: 1,
        longestStreak: 1,
        lastActivityDate: new Date(),
      });

      const newBadges = await this.checkBadgeUnlocks(userId, xp, 1);

      return {
        leveledUp: false,
        oldLevel: 1,
        newLevel: this.calculateLevel(xp),
        newBadges,
      };
    }
  }

  /**
   * Check and award badges based on criteria
   */
  private async checkBadgeUnlocks(userId: number, totalPoints: number, currentStreak: number): Promise<any[]> {
    try {
      // Get all badges the user hasn't earned yet
      const allBadges = await db.select().from(badges);
      const earnedBadges = await db
        .select()
        .from(userBadges)
        .where(eq(userBadges.userId, userId));

      const earnedBadgeIds = new Set(earnedBadges.map(b => b.badgeId));
      const unearnedBadges = allBadges.filter(b => !earnedBadgeIds.has(b.id));

      const newlyEarned: any[] = [];

      for (const badge of unearnedBadges) {
        const criteria = badge.criteria as any;
        let earned = false;

        if (!criteria || !criteria.type) continue;

        switch (criteria.type) {
          case "total_points":
          case "points":
            earned = totalPoints >= (criteria.amount || criteria.requiredPoints || 0);
            break;
          case "streak":
            earned = currentStreak >= (criteria.days || criteria.requiredDays || 0);
            break;
          // Add more criteria types as needed
        }

        if (earned) {
          await db.insert(userBadges).values({
            userId,
            badgeId: badge.id,
          });
          newlyEarned.push(badge);
        }
      }

      return newlyEarned;
    } catch (error) {
      console.error("Error checking badge unlocks:", error);
      return [];
    }
  }

  /**
   * Get user's gamification status
   */
  async getUserStatus(userId: number) {
    const [pointsData] = await db
      .select()
      .from(userPoints)
      .where(eq(userPoints.userId, userId))
      .limit(1);

    if (!pointsData) {
      return {
        totalPoints: 0,
        level: 1,
        levelProgress: { level: 1, currentLevelXP: 0, nextLevelXP: 100, progress: 0 },
        currentStreak: 0,
        longestStreak: 0,
      };
    }

    const levelProgress = this.getLevelProgress(pointsData.totalPoints);

    return {
      totalPoints: pointsData.totalPoints,
      level: levelProgress.level,
      levelProgress,
      currentStreak: pointsData.currentStreak,
      longestStreak: pointsData.longestStreak,
      lastActivityDate: pointsData.lastActivityDate,
    };
  }
}

export const gamificationService = new GamificationService();
