import { pool } from '../server/db';
import { storage } from '../server/storage';
import { enqueueCampaign } from '../server/services/campaign-dispatch';
import { randomUUID,createHmac } from 'node:crypto';
import { spawn } from 'node:child_process';
import { mkdir,writeFile } from 'node:fs/promises';

// This is deliberately unavailable for a production database or a real mail transport.
if(new URL(process.env.DATABASE_URL!).pathname!=='/phishnet_audit'||process.env.MAIL_TRANSPORT!=='sink')throw new Error('Load test requires isolated phishnet_audit and MAIL_TRANSPORT=sink');
const name='capacity-'+randomUUID();const organizationIds:number[]=[];const sessions:string[]=[];const children:ReturnType<typeof spawn>[]=[];
const latency:number[]=[];let errors=0,total=0,stopping=false;
process.on('SIGINT',()=>{stopping=true;});process.on('SIGTERM',()=>{stopping=true;});
async function sample(cookies:string[]){
 await Promise.all(cookies.map(async(cookie,i)=>{
   const start=performance.now();total++;
   try{const response=await fetch('http://localhost:5000'+(i%2?'/api/campaigns/summary':'/api/groups'),{headers:{cookie},signal:AbortSignal.timeout(15000)});await response.arrayBuffer();if(response.status!==200)errors++;}
   catch{errors++;}finally{latency.push(performance.now()-start);}
 }));
}
async function run(){
 await mkdir('logs',{recursive:true});const start=performance.now();
 const client=await pool.connect();const campaignIds:number[]=[];const cookies:string[]=[];
 try{
  await client.query('BEGIN');
  const {rows:orgs}=await client.query("INSERT INTO organizations(name) SELECT $1||'-'||i FROM generate_series(1,100) i RETURNING id",[name]);
  organizationIds.push(...orgs.map(o=>o.id));
  for(const org of orgs){
   const group=(await client.query("INSERT INTO groups(name,organization_id,filter_rules) VALUES('Capacity cohort',$1,'{\"department\":\"Simulation cohort\"}') RETURNING id",[org.id])).rows[0].id;
   await client.query("INSERT INTO targets(first_name,last_name,email,department,organization_id,group_id) SELECT 'Synthetic','Employee '||i,$1||'-'||$2||'-'||i||'@audit.test',CASE WHEN i<=100 THEN 'Simulation cohort' ELSE 'Directory' END,$2,$3 FROM generate_series(1,1000) i",[name,org.id,group]);
   const {rows:users}=await client.query("INSERT INTO users(email,password,first_name,last_name,organization_id,organization_name,email_verified,is_active) SELECT $1||'-'||$2||'-'||i||'@audit.test','SSO-only-synthetic','Synthetic','Employee '||i,$2,$1,true,true FROM generate_series(1,1000) i RETURNING id",[name,org.id]);
   const manager=users[0].id;
   await client.query("INSERT INTO user_roles(user_id,role_id) SELECT $1,id FROM roles WHERE name='Manager'",[manager]);
   const sid=randomUUID();sessions.push(sid);
   await client.query("INSERT INTO session(sid,sess,expire) VALUES($1,$2,now()+interval '2 hours')",[sid,JSON.stringify({cookie:{originalMaxAge:7200000,expires:new Date(Date.now()+7200000).toISOString(),httpOnly:true,path:'/'},passport:{user:manager}})]);
   const signature=createHmac('sha256',process.env.SESSION_SECRET!).update(sid).digest('base64').replace(/=+$/,'');cookies.push('connect.sid='+encodeURIComponent('s:'+sid+'.'+signature));
   const smtp=(await client.query("INSERT INTO smtp_profiles(name,host,port,username,password,from_email,from_name,organization_id) VALUES('Capacity sink','localhost',1025,'unused','unused','sender@audit.test','Capacity',$1) RETURNING id",[org.id])).rows[0].id;
   const template=(await client.query("INSERT INTO email_templates(name,subject,html_content,sender_name,sender_email,organization_id) VALUES('Capacity','Synthetic capacity test','<p>Hello {{FirstName}} <a href=\"{{TrackingURL}}\">Training</a></p>','Capacity','sender@audit.test',$1) RETURNING id",[org.id])).rows[0].id;
   const landing=(await client.query("INSERT INTO landing_pages(name,html_content,organization_id) VALUES('Capacity','<h1>Audit simulation</h1>',$1) RETURNING id",[org.id])).rows[0].id;
   const campaign=(await client.query("INSERT INTO campaigns(name,target_group_id,smtp_profile_id,email_template_id,landing_page_id,organization_id,created_by_id,end_date) VALUES('Capacity',$1,$2,$3,$4,$5,$6,now()+interval '2 hours') RETURNING id",[group,smtp,template,landing,org.id,manager])).rows[0].id;campaignIds.push(campaign);
  }
  await client.query('COMMIT');
 }catch(error){await client.query('ROLLBACK');throw error;}finally{client.release();}
 console.log(JSON.stringify({event:'fixtures_ready',tenants:100,employees:100000,targets:100000,seedSeconds:(performance.now()-start)/1000}));
 await writeFile('logs/load-fixture.json',JSON.stringify({namespace:name,organizationIds,sessions}));
 for(let i=0;i<campaignIds.length;i+=2)await Promise.all(campaignIds.slice(i,i+2).map((id,j)=>enqueueCampaign(id,organizationIds[i+j])));
 for(let i=0;i<2;i++)children.push(spawn(process.execPath,['--import','tsx','server/worker.ts'],{env:{...process.env,WORKER_CONCURRENCY:'2',SINK_LATENCY_MS:'250',DISPATCH_INTERVAL_MS:'0',HTTP_LOG_ENABLED:'false'},stdio:['ignore','ignore','pipe']}));
 for(const child of children)child.stderr?.on('data',()=>{});
 const sendingStart=performance.now();let nextSample=0,accepted=0;const progress:number[]=[];
 while(!stopping&&performance.now()-sendingStart<3600000){
   const elapsed=performance.now()-sendingStart;
   if(elapsed>=nextSample){await sample(cookies);nextSample=elapsed+10000;}
   const {rows:[counts]}=await pool.query("SELECT count(*) FILTER(WHERE state='accepted')::int AS accepted,count(*) FILTER(WHERE state IN ('failed','ambiguous'))::int AS errors FROM campaign_dispatch WHERE organization_id=ANY($1::integer[])",[organizationIds]);accepted=counts.accepted;
   if(counts.errors)throw new Error('Dispatch failure during isolated load');
   const minute=Math.floor(elapsed/60000);if(!progress.includes(minute)){progress.push(minute);console.log(JSON.stringify({event:'progress',seconds:Math.round(elapsed/1000),accepted,httpRequests:total,httpErrors:errors}));}
   if(accepted===10000)break;
   if(children.some(child=>child.exitCode!==null))throw new Error('Capacity worker exited unexpectedly');
   await new Promise(resolve=>setTimeout(resolve,1000));
 }
 const duration=(performance.now()-sendingStart)/1000;latency.sort((a,b)=>a-b);
 const report={at:new Date().toISOString(),tenants:100,employees:100000,targets:100000,concurrentReaders:100,workerProcesses:2,totalWorkerConcurrency:4,sinkLatencyMs:250,messages:10000,accepted,durationSeconds:duration,observedMessagesPerHour:accepted/duration*3600,httpRequests:total,httpErrors:errors,errorRate:errors/Math.max(1,total),p50Ms:latency[Math.floor(latency.length*.5)],p95Ms:latency[Math.floor(latency.length*.95)],p99Ms:latency[Math.floor(latency.length*.99)],realProviderVerified:false};
 await writeFile('logs/capacity-audit.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report));
 if(stopping||accepted!==10000||report.p95Ms>=500||report.errorRate>=.01||duration>3600)process.exitCode=1;
}
run().catch(error=>{console.error(error.message);process.exitCode=1;}).finally(async()=>{
 for(const child of children)child.kill('SIGTERM');
 await Promise.all(children.map(child=>child.exitCode!==null?Promise.resolve():new Promise(resolve=>child.once('exit',resolve))));
 if(organizationIds.length){
  // Remove only fixtures created by this invocation, respecting historical restrictive FKs.
  await pool.query('DELETE FROM session WHERE sid=ANY($1::text[])',[sessions]);
  for(const table of ['campaigns','training_modules','landing_pages','email_templates','smtp_profiles','targets','groups','users','organizations'])await pool.query(`DELETE FROM ${table} WHERE ${table==='organizations'?'id':'organization_id'}=ANY($1::integer[])`,[organizationIds]);
 }
 storage.stopSessionStore();await pool.end();
});
