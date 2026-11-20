import {randomBytes,scryptSync} from 'node:crypto';
import {mkdirSync,writeFileSync,existsSync} from 'node:fs';
import {pool} from '../server/db';
import {gamificationService} from '../server/services/gamification.service';

const REFRESH=process.argv.includes('--refresh');
const TRAINING_XP=50; // Same award and idempotency key as the employee completion route.

// Fixture import only. No dispatch queue, tracking endpoint, SMTP, or worker is invoked.
// Opens per round (10, 9, 8 of 12): 27 of 36 accepted, and every clicker or reporter also opened.
const OPENED_PER_ROUND=[10,9,8];

// Shifts every fixture timestamp by one interval so the workspace looks as it did when prepared:
// newest campaign 7 days ago, lessons due in 7 days or 2 days overdue. Intervals (and the
// 10-minute median report time) are preserved. Touches only the investor-v1 sample organization.
async function refresh(client:any,orgId:number){
  const {rows:[anchor]}=await client.query("SELECT extract(epoch FROM now()-(max(created_at)+interval '7 days'))::float8 AS shift FROM campaigns WHERE organization_id=$1 AND dataset='demo'",[orgId]);
  if(anchor?.shift==null)throw new Error('Sample campaigns not found; refusing to refresh');
  const shift=anchor.shift;
  const users="SELECT id FROM users WHERE organization_id=$2";
  await client.query("UPDATE campaigns SET created_at=created_at+make_interval(secs=>$1::float8),end_date=end_date+make_interval(secs=>$1::float8),updated_at=updated_at+make_interval(secs=>$1::float8),scheduled_at=scheduled_at+make_interval(secs=>$1::float8),launched_at=launched_at+make_interval(secs=>$1::float8) WHERE organization_id=$2 AND dataset='demo'",[shift,orgId]);
  await client.query("UPDATE campaign_results r SET sent_at=r.sent_at+make_interval(secs=>$1::float8),opened_at=r.opened_at+make_interval(secs=>$1::float8),clicked_at=r.clicked_at+make_interval(secs=>$1::float8),submitted_at=r.submitted_at+make_interval(secs=>$1::float8),reported_at=r.reported_at+make_interval(secs=>$1::float8),created_at=r.created_at+make_interval(secs=>$1::float8),updated_at=r.updated_at+make_interval(secs=>$1::float8) FROM campaigns c WHERE c.id=r.campaign_id AND c.organization_id=$2 AND c.dataset='demo'",[shift,orgId]);
  await client.query(`UPDATE training_progress SET due_date=due_date+make_interval(secs=>$1::float8),completed_at=completed_at+make_interval(secs=>$1::float8),assigned_at=assigned_at+make_interval(secs=>$1::float8) WHERE user_id IN (${users})`,[shift,orgId]);
  await client.query("UPDATE learning_path_assignments SET due_at=due_at+make_interval(secs=>$1::float8),created_at=created_at+make_interval(secs=>$1::float8),completed_at=completed_at+make_interval(secs=>$1::float8) WHERE organization_id=$2",[shift,orgId]);
  // Backfill opens for fixtures prepared before opens were recorded (idempotent).
  await client.query(`WITH ranked AS (
      SELECT r.id, row_number() OVER (PARTITION BY r.campaign_id ORDER BY r.target_id)-1 AS i,
             dense_rank() OVER (ORDER BY c.created_at)-1 AS round
      FROM campaign_results r JOIN campaigns c ON c.id=r.campaign_id WHERE c.organization_id=$1 AND c.dataset='demo')
    UPDATE campaign_results r SET opened=true, opened_at=r.sent_at+interval '1 minute', status=CASE WHEN r.status='sent' THEN 'opened' ELSE r.status END
    FROM ranked WHERE ranked.id=r.id AND NOT coalesce(r.opened,false)
      AND (r.clicked OR r.reported OR ranked.i < (ARRAY[${OPENED_PER_ROUND.join(',')}])[ranked.round+1])`,[orgId]);
}

// Awards the same points the employee completion route gives, keyed so it never double-counts.
async function awardCompletedTraining(orgId:number){
  const {rows}=await pool.query("SELECT tp.user_id,tp.module_id FROM training_progress tp JOIN users u ON u.id=tp.user_id WHERE u.organization_id=$1 AND tp.status='completed'",[orgId]);
  for(const row of rows)await gamificationService.awardXP(row.user_id,TRAINING_XP,'training_completion',`training:${row.module_id}`);
}

async function prepare(){
  if(process.env.MAIL_TRANSPORT!=='sink'||process.env.WORKER_DELIVERY_PAUSED!=='true')throw new Error('Prepare samples only with sink transport and paused worker');
  const client=await pool.connect();
  try {
    await client.query('BEGIN');await client.query("SELECT pg_advisory_xact_lock(hashtext('investor-demo-v1'))");
    const existing=await client.query("SELECT id FROM organizations WHERE preferences->>'fixture'='investor-v1'");
    if(existing.rowCount){
      if(!REFRESH){await client.query('COMMIT');console.log('Existing sample workspace retained; no records or credentials changed. Run `node scripts/run-audit.mjs investor-demo-refresh` before a demonstration to re-anchor sample dates to today.');return;}
      const orgId=existing.rows[0].id;await refresh(client,orgId);await client.query('COMMIT');
      await awardCompletedTraining(orgId);
      console.log('Sample workspace refreshed: dates re-anchored to today, opens backfilled, completed-lesson points awarded. Credentials unchanged. No messages sent.');return;
    }
    if(existsSync('.env.investor-demo.accounts'))throw new Error('Credential file already exists without a workspace; review it before preparing samples');
    const password=randomBytes(20).toString('base64url')+'!';
    const {rows:[org]}=await client.query("INSERT INTO organizations(name,encryption_key,preferences) VALUES('PhishNet Sample Company',$1,$2) RETURNING id",[randomBytes(32).toString('base64'),JSON.stringify({demonstration:true,fixture:'investor-v1',brandName:'PhishNet Sample Company',locale:'en-US',timezone:'UTC',accentColor:'#ed8800',leaderboardEnabled:false})]);
    const accounts:any[]=[];
    async function user(key:string,role:string,first:string,last:string){
      const salt=randomBytes(32).toString('hex');
      const email=key+'@demo.phishnet.test';
      const {rows:[record]}=await client.query("INSERT INTO users(email,password,first_name,last_name,organization_id,organization_name,email_verified) VALUES($1,$2,$3,$4,$5,'PhishNet Sample Company',true) RETURNING id",[email,scryptSync(password,salt,64).toString('hex')+'.'+salt,first,last,org.id]);
      const roleResult=await client.query('INSERT INTO user_roles(user_id,role_id) SELECT $1,id FROM roles WHERE name=$2 RETURNING user_id',[record.id,role]);
      if(!roleResult.rowCount)throw new Error('Required role not installed: '+role);
      accounts.push({email,role,id:record.id});return record.id;
    }
    const owner=await user('orgadmin','OrgAdmin','Sam','Owner'),manager=await user('manager','Manager','Morgan','Team Lead');
    const employees:number[]=[];
    for(let i=0;i<12;i++)employees.push(await user(i===0?'employee':`employee${i+1}`,'User',`Sample ${i+1}`,'Colleague'));
    const {rows:[team]}=await client.query("INSERT INTO teams(organization_id,name) VALUES($1,'Customer Operations') RETURNING id",[org.id]);
    await client.query('INSERT INTO team_managers(organization_id,team_id,user_id) VALUES($1,$2,$3)',[org.id,team.id,manager]);
    for(const id of employees.slice(0,8))await client.query('INSERT INTO team_members(organization_id,team_id,user_id) VALUES($1,$2,$3)',[org.id,team.id,id]);
    const {rows:[group]}=await client.query("INSERT INTO groups(organization_id,name) VALUES($1,'Sample employees') RETURNING id",[org.id]);
    const targets:number[]=[];
    for(let i=0;i<employees.length;i++){
      const {rows:[t]}=await client.query("INSERT INTO targets(organization_id,group_id,employee_id,first_name,last_name,email) VALUES($1,$2,$3,$4,'Colleague',$5) RETURNING id",[org.id,group.id,employees[i],`Sample ${i+1}`,accounts[i+2].email]);targets.push(t.id);
    }
    const {rows:[smtp]}=await client.query("INSERT INTO smtp_profiles(organization_id,name,host,port,username,password,from_email,from_name,delivery_mode) VALUES($1,'Sample only — never sends','localhost',2525,'sample','not-a-secret','training@demo.phishnet.test','Sample Learning Team','local_inbox') RETURNING id",[org.id]);
    const {rows:[template]}=await client.query("INSERT INTO email_templates(organization_id,name,subject,html_content,sender_name,sender_email,created_by_id) VALUES($1,'Sample account notice','Sample account review','<p>Fictional demonstration content. No message was sent.</p>','Sample Learning Team','training@demo.phishnet.test',$2) RETURNING id",[org.id,owner]);
    const {rows:[landing]}=await client.query("INSERT INTO landing_pages(organization_id,name,html_content,capture_data,capture_passwords,created_by_id) VALUES($1,'Sample learning page','<h1>Sample exercise</h1><p>Fictional data. Never enter a real password.</p>',false,false,$2) RETURNING id",[org.id,owner]);
    const campaignIds:number[]=[];
    for(let round=0;round<3;round++){
      const {rows:[c]}=await client.query("INSERT INTO campaigns(organization_id,name,status,target_group_id,smtp_profile_id,email_template_id,landing_page_id,created_by_id,dataset,created_at,end_date) VALUES($1,$2,'Completed',$3,$4,$5,$6,$7,'demo',now()-($8*interval '1 day'),now()-($8*interval '1 day')+interval '1 day') RETURNING id",[org.id,`Sample history — round ${round+1}`,group.id,smtp.id,template.id,landing.id,owner,21-round*7]);campaignIds.push(c.id);
      for(let i=0;i<targets.length;i++){
        const clicked=i<6-round*2,reported=i<4+round*2,opened=clicked||reported||i<OPENED_PER_ROUND[round];
        await client.query("INSERT INTO campaign_results(organization_id,campaign_id,target_id,status,sent,sent_at,opened,opened_at,clicked,clicked_at,reported,reported_at,created_at) VALUES($1,$2,$3,$4,true,now()-($7*interval '1 day'),$8,CASE WHEN $8 THEN now()-($7*interval '1 day')+interval '1 minute' END,$5,CASE WHEN $5 THEN now()-($7*interval '1 day')+interval '2 minutes' END,$6,CASE WHEN $6 THEN now()-($7*interval '1 day')+interval '10 minutes' END,now()-($7*interval '1 day'))",[org.id,c.id,targets[i],reported?'reported':clicked?'clicked':opened?'opened':'sent',clicked,reported,21-round*7,opened]);
      }
    }
    const {rows:[module]}=await client.query("INSERT INTO training_modules(organization_id,title,description,category,difficulty,duration_minutes,transcript,created_by) VALUES($1,'Pause, verify, report','An original short awareness lesson.','phishing','beginner',3,$2,$3) RETURNING id",[org.id,'Before responding to an unexpected request: pause, verify using a known contact route, and report the message. A familiar logo alone does not establish authenticity.',owner]);
    for(let i=0;i<employees.length;i++)await client.query("INSERT INTO training_progress(user_id,module_id,status,progress_percentage,due_date,completed_at) VALUES($1,$2,$3,$4,now()+($5*interval '1 day'),CASE WHEN $4=100 THEN now()-interval '1 day' END)",[employees[i],module.id,i<8?'completed':'not_started',i<8?100:0,i<10?7:-2]);
    const snapshot={name:'Sample starter learning path',steps:[{kind:'module',id:module.id,title:'Pause, verify, report',content:{id:module.id,title:'Pause, verify, report',transcript:'Pause before acting. Verify unexpected requests through a known contact route. Report suspicious messages.',durationMinutes:3}}]};
    const {rows:[path]}=await client.query("INSERT INTO learning_paths(organization_id,name,steps) VALUES($1,$2,$3) RETURNING id",[org.id,snapshot.name,JSON.stringify([{kind:'module',id:module.id}])]);
    await client.query("INSERT INTO learning_path_assignments(organization_id,user_id,path_id,content_snapshot,due_at) VALUES($1,$2,$3,$4,now()+interval '7 days')",[org.id,employees[0],path.id,JSON.stringify(snapshot)]);
    const proof={fixture:'investor-v1',organizationId:org.id,campaignIds,accounts,expected:{accepted:36,opened:27,clicked:12,reported:18,repeatClickers:4,medianReportSeconds:600,moduleAssigned:12,moduleCompleted:8},messagesSent:0,dispatchesCreated:0};
    mkdirSync('logs/investor-release',{recursive:true});
    writeFileSync('.env.investor-demo.accounts',`DEMO_PASSWORD=${password}\n`,{mode:0o600,flag:'wx'});
    await client.query('COMMIT');
    writeFileSync('logs/investor-release/demo-fixture.json',JSON.stringify(proof,null,2));
    await awardCompletedTraining(org.id);
    console.log('Separate sample workspace prepared. Password: ignored .env.investor-demo.accounts. Account list and expected totals: logs/investor-release/demo-fixture.json. No messages sent.');
  } catch(error){await client.query('ROLLBACK');throw error;}finally{client.release();}
}
prepare().catch(error=>{console.error(error.message);process.exitCode=1;}).finally(()=>pool.end());
