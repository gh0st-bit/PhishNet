import {pool} from '../db';
import {evaluateBadgeCriterion, type BadgeFacts} from '@shared/badge-criteria';

export async function badgeFacts(userId:number, query=pool.query.bind(pool)):Promise<BadgeFacts> {
  const {rows:[facts]}=await query(`SELECT
    COALESCE((SELECT total_points FROM user_points WHERE user_id=$1),0)::int AS points,
    COALESCE((SELECT CASE WHEN last_activity_date::date >= (now() AT TIME ZONE 'UTC')::date-1 THEN current_streak ELSE 0 END FROM user_points WHERE user_id=$1),0)::int AS streak,
    ARRAY(SELECT DISTINCT quiz_id FROM quiz_attempts WHERE user_id=$1 AND passed AND completed_at IS NOT NULL) AS quizzes,
    ARRAY(SELECT DISTINCT module_id FROM training_progress WHERE user_id=$1 AND status='completed') AS training,
    ARRAY(SELECT DISTINCT quiz_id FROM quiz_attempts WHERE user_id=$1 AND score=100 AND completed_at IS NOT NULL) AS perfect`,[userId]);
  return facts;
}

export async function awardEligibleBadges(userId:number) {
  const client=await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query('SELECT pg_advisory_xact_lock($1)',[userId]);
    const facts=await badgeFacts(userId,client.query.bind(client));
    const {rows}=await client.query(`SELECT b.id FROM badges b WHERE published AND archived_at IS NULL AND NOT EXISTS(SELECT 1 FROM user_badges ub WHERE ub.user_id=$1 AND ub.badge_id=b.id) ORDER BY b.id`,[userId]);
    const awarded=[];
    for(const candidate of rows) {
      // Advisory locks need no UPDATE grant on the global badge catalog. Employees
      // retain SELECT-only catalog access; admin edits take the same per-badge lock.
      await client.query('SELECT pg_advisory_xact_lock(18468,$1)',[candidate.id]);
      const {rows:[badge]}=await client.query('SELECT * FROM badges WHERE id=$1 AND published AND archived_at IS NULL',[candidate.id]);
      if(!badge)continue;
      let eligible=false;
      try { eligible=evaluateBadgeCriterion(badge.criteria,facts).earned; } catch { continue; }
      if(!eligible)continue;
      await client.query('INSERT INTO user_badges(user_id,badge_id,award_snapshot) VALUES($1,$2,$3)',[userId,badge.id,JSON.stringify({name:badge.name,description:badge.description,iconUrl:badge.icon_url,rarity:badge.rarity})]);
      awarded.push(badge);
    }
    await client.query('COMMIT');return awarded;
  } catch(error) { await client.query('ROLLBACK');throw error; } finally {client.release();}
}
