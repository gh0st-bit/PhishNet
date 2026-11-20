import {awardEligibleBadges} from './badge-evaluation';
import {pool} from '../db';
import {randomUUID} from 'node:crypto';
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
  async awardXP(userId:number,xp:number,reason:string,eventKey=reason+':'+randomUUID()):Promise<{leveledUp:boolean;oldLevel:number;newLevel:number;newBadges:any[]}>{
    if(!Number.isInteger(xp)||xp<0||xp>10000)throw new Error('Invalid points award');
    const client=await pool.connect();let oldPoints=0,newPoints=0,streak=0;
    try{await client.query('BEGIN');await client.query('SELECT pg_advisory_xact_lock($1)',[userId]);
      const {rows:[user]}=await client.query('SELECT organization_id FROM users WHERE id=$1 AND is_active',[userId]);if(!user)throw new Error('Active employee required');
      const {rows:[prior]}=await client.query('SELECT * FROM user_points WHERE user_id=$1 FOR UPDATE',[userId]);oldPoints=prior?.total_points||0;
      const inserted=await client.query('INSERT INTO points_events(organization_id,user_id,event_key,reason,points) VALUES($1,$2,$3,$4,$5) ON CONFLICT(user_id,event_key) DO NOTHING RETURNING id',[user.organization_id,userId,eventKey,reason,xp]);
      if(!inserted.rowCount){await client.query('COMMIT');return {leveledUp:false,oldLevel:this.calculateLevel(oldPoints),newLevel:this.calculateLevel(oldPoints),newBadges:[]};}
      const today=new Date().toISOString().slice(0,10),last=prior?.last_activity_date?new Date(prior.last_activity_date).toISOString().slice(0,10):null;
      const yesterday=new Date(Date.now()-86400000).toISOString().slice(0,10);streak=last===today?prior.current_streak:last===yesterday?prior.current_streak+1:1;newPoints=oldPoints+xp;
      await client.query(`INSERT INTO user_points(user_id,total_points,current_streak,longest_streak,last_activity_date) VALUES($1,$2,$3,$3,now()) ON CONFLICT(user_id) DO UPDATE SET total_points=$2,current_streak=$3,longest_streak=greatest(user_points.longest_streak,$3),last_activity_date=now(),updated_at=now()`,[userId,newPoints,streak]);
      await client.query('COMMIT');
    }catch(error){await client.query('ROLLBACK');throw error;}finally{client.release();}
    const newBadges=await this.checkBadgeUnlocks(userId,newPoints,streak);const oldLevel=this.calculateLevel(oldPoints),newLevel=this.calculateLevel(newPoints);return {leveledUp:newLevel>oldLevel,oldLevel,newLevel,newBadges};
  }

  /**
   * Check and award badges based on criteria
   */
  private async checkBadgeUnlocks(userId: number, totalPoints: number, currentStreak: number): Promise<any[]> {
    return awardEligibleBadges(userId);
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
