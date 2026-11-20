import { pool } from '../db';
import type { PoolClient } from 'pg';

export async function queueRemediation(campaignId:number,targetId:number,reason:'clicked'|'submitted'|'weak_password') {
  await pool.query(`INSERT INTO remediation_jobs(organization_id,campaign_id,target_id,reason)
    SELECT c.organization_id,c.id,t.id,$3 FROM campaigns c JOIN targets t ON t.organization_id=c.organization_id
    WHERE c.id=$1 AND t.id=$2 AND (c.training_module_id IS NOT NULL OR c.password_training_module_id IS NOT NULL)
    ON CONFLICT(campaign_id,target_id,reason) DO NOTHING`,[campaignId,targetId,reason]);
}

export async function assignTraining(client:PoolClient,organizationId:number,userId:number,moduleId:number,dueDays:number,reason:string,campaignId:number|null=null) {
  const valid=await client.query(`SELECT 1 FROM users u JOIN training_modules m ON m.organization_id=u.organization_id
    WHERE u.id=$1 AND m.id=$2 AND u.organization_id=$3 AND u.is_active=true AND m.archived_at IS NULL`,[userId,moduleId,organizationId]);
  if(!valid.rowCount) throw Object.assign(new Error('Use an active lesson and employee from this organization'),{status:400});
  await client.query(`SELECT pg_advisory_xact_lock(hashtext($1))`,[`training:${userId}:${moduleId}`]);
  const existing=await client.query('SELECT 1 FROM training_assignments WHERE user_id=$1 AND module_id=$2 AND campaign_id IS NOT DISTINCT FROM $3',[userId,moduleId,campaignId]);
  if(existing.rowCount) return false;
  await client.query(`INSERT INTO training_progress(user_id,module_id,due_date) VALUES($1,$2,now()+($3*interval '1 day'))
    ON CONFLICT(user_id,module_id) DO NOTHING`,[userId,moduleId,dueDays]);
  await client.query(`INSERT INTO training_assignments(organization_id,user_id,module_id,campaign_id,reason,due_at)
    VALUES($1,$2,$3,$4,$5,now()+($6*interval '1 day'))`,[organizationId,userId,moduleId,campaignId,reason,dueDays]);
  await client.query(`INSERT INTO notifications(organization_id,user_id,type,title,message,priority,action_url)
    VALUES($1,$2,'training','Training assigned','A security awareness module has been assigned to you.','medium','/employee/training')`,[organizationId,userId]);
  return true;
}

export async function processRemediation() {
  const client=await pool.connect();
  let jobId:number|undefined;
  try {
    await client.query('BEGIN');
    const {rows:[job]}=await client.query(`SELECT j.*,c.training_module_id,c.password_training_module_id,c.training_due_days,t.email,t.employee_id
      FROM remediation_jobs j JOIN campaigns c ON c.id=j.campaign_id JOIN targets t ON t.id=j.target_id
      WHERE j.state='queued' AND j.available_at<=now() ORDER BY j.id FOR UPDATE OF j SKIP LOCKED LIMIT 1`);
    if(!job){await client.query('COMMIT');return false;}
    jobId=job.id;
    const moduleId=job.reason==='weak_password' ? job.password_training_module_id || job.training_module_id : job.training_module_id;
    if(moduleId) {
      const {rows:[user]}=await client.query('SELECT id FROM users WHERE organization_id=$1 AND is_active=true AND (($3::int IS NOT NULL AND id=$3) OR ($3::int IS NULL AND lower(email)=lower($2)))',[job.organization_id,job.email,job.employee_id]);
      if(user) await assignTraining(client,job.organization_id,user.id,moduleId,job.training_due_days,job.reason,job.campaign_id);
      else await client.query(`INSERT INTO pending_learning(organization_id,campaign_id,target_id,module_id,email,reason,due_days) VALUES($1,$2,$3,$4,lower($5),$6,$7) ON CONFLICT DO NOTHING`,[job.organization_id,job.campaign_id,job.target_id,moduleId,job.email,job.reason,job.training_due_days]);
    }
    await client.query("UPDATE remediation_jobs SET state='completed',updated_at=now() WHERE id=$1",[job.id]);
    await client.query('COMMIT');return true;
  } catch(error){await client.query('ROLLBACK');
    if(jobId){await client.query("UPDATE remediation_jobs SET attempts=attempts+1,state=CASE WHEN attempts>=2 THEN 'failed' ELSE 'queued' END,available_at=now()+interval '1 minute',updated_at=now() WHERE id=$1",[jobId]);return true;}
    throw error;}
  finally{client.release();}
}

export async function remindTraining() {
  const client=await pool.connect();
  try {
    await client.query('BEGIN');
    const {rows}=await client.query(`SELECT a.* FROM training_assignments a JOIN training_progress p ON p.user_id=a.user_id AND p.module_id=a.module_id
      WHERE p.status<>'completed' AND a.due_at<=now()+interval '1 day'
      AND (a.last_reminded_at IS NULL OR a.last_reminded_at<now()-interval '1 day')
      ORDER BY a.due_at LIMIT 100 FOR UPDATE OF a SKIP LOCKED`);
    for(const assignment of rows) {
      await client.query(`INSERT INTO notifications(organization_id,user_id,type,title,message,priority,action_url)
        VALUES($1,$2,'training','Training reminder','Please complete your assigned security training.','medium','/employee/training')`,[assignment.organization_id,assignment.user_id]);
      await client.query('UPDATE training_assignments SET last_reminded_at=now() WHERE id=$1',[assignment.id]);
    }
    await client.query('COMMIT');return rows.length;
  } catch(error){await client.query('ROLLBACK');throw error;}
  finally{client.release();}
}

export async function resolvePendingLearning(){
 const client=await pool.connect();try{await client.query('BEGIN');
  const {rows}=await client.query(`SELECT p.*,u.id AS user_id FROM pending_learning p JOIN users u ON u.organization_id=p.organization_id AND lower(u.email)=p.email AND u.is_active WHERE p.resolved_at IS NULL ORDER BY p.id LIMIT 100 FOR UPDATE OF p SKIP LOCKED`);
  for(const p of rows){
   await assignTraining(client,p.organization_id,p.user_id,p.module_id,p.due_days,p.reason,p.campaign_id);
   await client.query('UPDATE targets SET employee_id=$2 WHERE id=$1 AND organization_id=$3 AND employee_id IS NULL',[p.target_id,p.user_id,p.organization_id]);
   await client.query('UPDATE pending_learning SET resolved_at=now() WHERE id=$1',[p.id]);
  }
  await client.query('COMMIT');return rows.length;
 }catch(error){await client.query('ROLLBACK');throw error;}finally{client.release();}
}
