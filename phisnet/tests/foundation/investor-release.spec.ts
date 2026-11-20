import {withTenant} from '../../server/database-context';
import {test,after} from 'node:test';
import assert from 'node:assert/strict';
import {randomBytes} from 'node:crypto';
import {normalizeBadgeCriterion,evaluateBadgeCriterion,type BadgeFacts} from '../../shared/badge-criteria';
import {pool} from '../../server/db';
import {awardEligibleBadges} from '../../server/services/badge-evaluation';
import {overview,overviewRows} from '../../server/routes/product-overview';
import {enqueueCampaign} from '../../server/services/campaign-dispatch';
import {outcomeRecords} from '../../server/services/outcome-records';

test('badge criteria normalize legacy values and reject malformed requirements',()=>{
  assert.deepEqual(normalizeBadgeCriterion({type:'points',requiredPoints:50}),{type:'points_earned',target:50});
  for(const value of [undefined,{type:'points_earned',threshold:0},{type:'quiz_pass',quizId:-1},{type:'unknown',count:1},{type:'streak_days',days:1.5}])assert.throws(()=>normalizeBadgeCriterion(value));
  const facts:BadgeFacts={points:50,streak:3,quizzes:[2,3],training:[4],perfect:[3]};
  for(const criterion of [{type:'points_earned',threshold:50},{type:'streak_days',days:3},{type:'quiz_pass',quizId:2},{type:'quizzes_passed',count:2},{type:'training_complete',moduleId:4},{type:'training_complete',count:1},{type:'perfect_score',requiredCount:1}])assert.equal(evaluateBadgeCriterion(criterion,facts).earned,true);
  assert.equal(evaluateBadgeCriterion({type:'points_earned',threshold:100},facts).progress,50);
  assert.equal(evaluateBadgeCriterion({type:'custom',description:'Reviewed by administrator'},facts).earned,false);
});

test('concurrent awards are idempotent, unpublished badges stay locked, snapshots survive archive',async()=>{
  const suffix=randomBytes(6).toString('hex');
  const {rows:[org]}=await pool.query("INSERT INTO organizations(name) VALUES($1) RETURNING id",['Disposable investor test '+suffix]);
  const ids:number[]=[];
  try {
    const {rows:[user]}=await pool.query("INSERT INTO users(email,password,first_name,last_name,organization_id,organization_name) VALUES($1,'unusable','Test','Learner',$2,'Disposable') RETURNING id",[suffix+'@audit.test',org.id]);
    await pool.query('INSERT INTO user_points(user_id,total_points,current_streak,last_activity_date) VALUES($1,50,3,now())',[user.id]);
    for(const published of [true,false]){
      const {rows:[badge]}=await pool.query("INSERT INTO badges(name,category,criteria,published) VALUES($1,'milestone',$2,$3) RETURNING id",['Disposable investor '+suffix,JSON.stringify({type:'points_earned',threshold:25}),published]);ids.push(badge.id);
    }
    await withTenant(org.id,user.id,()=>Promise.all([awardEligibleBadges(user.id),awardEligibleBadges(user.id),awardEligibleBadges(user.id)]));
    const {rows}=await pool.query('SELECT * FROM user_badges WHERE user_id=$1 AND badge_id=ANY($2::int[])',[user.id,ids]);
    assert.equal(rows.length,1);assert.equal(rows[0].badge_id,ids[0]);
    await pool.query("UPDATE badges SET archived_at=now(),published=false,name='Changed after award' WHERE id=$1",[ids[0]]);
    const {rows:[retained]}=await pool.query('SELECT award_snapshot FROM user_badges WHERE id=$1',[rows[0].id]);
    assert.equal(retained.award_snapshot.name,'Disposable investor '+suffix);
  }finally{
    // Only exact disposable IDs created above are removed; retained QA data is untouched.
    await pool.query('DELETE FROM badges WHERE id=ANY($1::int[])',[ids]);
    await pool.query('DELETE FROM organizations WHERE id=$1',[org.id]);
  }
});

test('sample outcomes reconcile, exports retain provenance, and sending is blocked',async()=>{
  const {rows:[org]}=await pool.query("SELECT id FROM organizations WHERE preferences->>'fixture'='investor-v1'");
  assert.ok(org,'Run the guarded investor-demo importer first');
  const data=await overview(org.id,0,'demo');
  assert.equal(data.demonstration,true);assert.equal(data.signals.sent,36);assert.equal(data.signals.clicked,12);assert.equal(data.signals.reported,18);
  assert.equal(data.signals.report_timing_samples,18);assert.ok(Math.abs(Number(data.signals.median_report_seconds)-600)<1);
  assert.equal(data.repeatClickers,4);assert.equal(data.learning.assigned,13);assert.equal(data.learning.completed,8);
  assert.equal(data.trends.reduce((n,t)=>n+t.accepted,0),36);
  for(const [event,total] of [['campaigns',3],['sent',36],['clicked',12],['reported',18],['completed',8],['overdue',2],['repeat_clickers',4],['timed_report',18]] as const)assert.equal((await outcomeRecords(org.id,0,'demo',event,1)).total,total,event);
  assert.ok(overviewRows(data).some(row=>row[1]==='Sample data'));
  const customer=await overview(org.id,0,'customer');assert.equal(customer.signals.sent,0);assert.equal(customer.rates.report,null);
  const {rows:[campaign]}=await pool.query('SELECT id FROM campaigns WHERE organization_id=$1 LIMIT 1',[org.id]);
  await assert.rejects(()=>enqueueCampaign(campaign.id,org.id),/Sample workspaces cannot send/);
  const {rows:[queue]}=await pool.query('SELECT count(*)::int AS n FROM campaign_dispatch WHERE organization_id=$1',[org.id]);assert.equal(queue.n,0);
});
after(()=>pool.end());
