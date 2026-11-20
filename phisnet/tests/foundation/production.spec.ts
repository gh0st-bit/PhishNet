import { sendSimulation } from '../../server/services/delivery-provider';
import { randomUUID } from 'node:crypto';
import { createServer as createHttpServer } from 'node:http';
import { createServer as createSmtpServer } from 'node:net';
import speakeasy from 'speakeasy';
import { getPrivateObject,putPrivateObject,deletePrivateObject } from '../../server/services/object-store';
import { nextReportRun } from '../../server/services/report-cadence';
import { reportingScheduler } from '../../server/services/reporting-scheduler';
import { safeFetchText,isPublicAddress } from '../../server/services/safe-fetch';
import { PostgresRateLimitStore } from '../../server/middleware/rate-limit-store';
import { generateKeyPairSync,sign } from 'node:crypto';
import { createRecurringOccurrences,withinSendWindow } from '../../server/services/campaign-automation';
import { queueRemediation,processRemediation,remindTraining } from '../../server/services/training-automation';
import { applyWebhookEvents,validWebhook } from '../../server/services/delivery-webhook';
import { suspectedAutomation } from '../../server/services/tracking-events';
import { withTenant } from '../../server/database-context';
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { pool } from '../../server/db';
import { storage } from '../../server/storage';
import { dispatchOne, enqueueCampaign, recoverDispatchLeases,deliveryFailureState } from '../../server/services/campaign-dispatch';
import { trackingToken, validTrackingToken } from '../../server/services/tracking-token';
import { readConfig } from '../../server/config';
import { io } from 'socket.io-client';

const base = process.env.E2E_BASE_URL || 'http://localhost:5000';
const password = readFileSync('.env.audit.accounts','utf8').trim().split('=')[1];
const extraCampaigns:number[]=[];const extraGroups:number[]=[];let trainingModuleId:number|undefined;
let cookie = '', betaCookie = '', employeeCookie = '';
let orgId: number, otherOrgId: number, campaignId: number, targetId: number, groupId: number, templateId: number, smtpId: number, landingId: number;
async function request(path: string, session = cookie, method = 'GET', body?: unknown) {
  return fetch(base + path, { method, headers: { cookie: session, 'Content-Type': 'application/json' }, body: body === undefined ? undefined : JSON.stringify(body) });
}
async function login(email: string) {
  const response = await request('/api/login','', 'POST', { email, password });
  assert.equal(response.status,200);
  const data = await response.json();
  assert.equal(data.password,undefined);
  assert.equal(data.twoFactorSecret,undefined);
  assert.equal(data.twoFactorBackupCodes,undefined);
  return response.headers.getSetCookie().map(value => value.split(';')[0]).join('; ');
}
before(async () => {
  assert.equal((await pool.query('SELECT current_database() AS name')).rows[0].name,'phishnet_audit');
  const orgs = await pool.query("SELECT id,name FROM organizations WHERE name IN ('Audit Alpha','Audit Beta') ORDER BY name");
  orgId=orgs.rows[0].id; otherOrgId=orgs.rows[1].id;
  cookie=await login(`orgadmin.${orgId}@audit.test`);
  betaCookie=await login(`orgadmin.${otherOrgId}@audit.test`);
  employeeCookie=await login(`user.${orgId}@audit.test`);
  groupId=(await pool.query("INSERT INTO groups(name,organization_id) VALUES('Regression audience',$1) RETURNING id",[orgId])).rows[0].id;
  targetId=(await pool.query("INSERT INTO targets(first_name,last_name,email,group_id,organization_id) VALUES('Test','Recipient','recipient@audit.test',$1,$2) RETURNING id",[groupId,orgId])).rows[0].id;
  smtpId=(await pool.query("INSERT INTO smtp_profiles(name,host,port,username,password,from_email,from_name,organization_id) VALUES('Sink','localhost',1025,'unused','unused','sender@audit.test','Audit',$1) RETURNING id",[orgId])).rows[0].id;
  templateId=(await pool.query("INSERT INTO email_templates(name,subject,html_content,sender_name,sender_email,organization_id) VALUES('Regression','Test','<a href=\"{{TrackingURL}}\">View</a>','Audit','sender@audit.test',$1) RETURNING id",[orgId])).rows[0].id;
  landingId=(await pool.query("INSERT INTO landing_pages(name,html_content,capture_passwords,organization_id) VALUES('Regression','<form><input name=\"email\"></form>',true,$1) RETURNING id",[orgId])).rows[0].id;
  campaignId=(await pool.query("INSERT INTO campaigns(name,target_group_id,smtp_profile_id,email_template_id,landing_page_id,organization_id) VALUES('Regression',$1,$2,$3,$4,$5) RETURNING id",[groupId,smtpId,templateId,landingId,orgId])).rows[0].id;
});
after(async () => {
  for(const id of extraCampaigns)await pool.query('DELETE FROM campaigns WHERE id=$1',[id]);
  if (campaignId) await pool.query('DELETE FROM campaigns WHERE id=$1',[campaignId]);
  if (targetId) await pool.query('DELETE FROM targets WHERE id=$1',[targetId]);
  for(const id of extraGroups)await pool.query('DELETE FROM groups WHERE id=$1',[id]);
  if(trainingModuleId)await pool.query('DELETE FROM training_modules WHERE id=$1',[trainingModuleId]);
  if (groupId) await pool.query('DELETE FROM groups WHERE id=$1',[groupId]);
  if (templateId) await pool.query('DELETE FROM email_templates WHERE id=$1',[templateId]);
  if (landingId) await pool.query('DELETE FROM landing_pages WHERE id=$1',[landingId]);
  if (smtpId) await pool.query('DELETE FROM smtp_profiles WHERE id=$1',[smtpId]);
  storage.stopSessionStore(); await pool.end();
});

test('configuration rejects invalid port and insecure production configuration', () => {
  assert.throws(() => readConfig({ DATABASE_URL:'unused',SESSION_SECRET:'x',PORT:'0' }));
  assert.throws(() => readConfig({ DATABASE_URL:'unused',SESSION_SECRET:'x',NODE_ENV:'production' }));
});
test('registration cannot join an existing tenant by name', async () => {
  const response = await request('/api/register', '', 'POST', { email: 'new-member@audit.test', password: 'OnlySyntheticPassword123!', firstName:'Audit',lastName:'New',organizationName:'Audit Alpha',isAdmin:true });
  assert.equal(response.status,409);
});
test('authenticated user responses omit authentication secrets', async () => {
  const response = await request('/api/user');
  assert.equal(response.status,200);
  const user=await response.json();
  for (const field of ['password','twoFactorSecret','twoFactorBackupCodes','emailVerificationToken']) assert.equal(user[field],undefined,field);
});
test('database rejects a cross-tenant campaign resource reference', async () => {
  await assert.rejects(pool.query("INSERT INTO campaigns(name,target_group_id,smtp_profile_id,email_template_id,landing_page_id,organization_id) VALUES('Invalid',$1,$2,$3,$4,$5)",[groupId,smtpId,templateId,landingId,otherOrgId]), (error: any)=>error.code==='23503');
});
test('RLS filters unscoped queries and rejects cross-tenant writes', async () => {
  await withTenant(orgId,1,async()=> {
    const {rows}=await pool.query('SELECT organization_id FROM groups');
    assert.ok(rows.length>0);
    assert.ok(rows.every(row=>row.organization_id===orgId));
    assert.equal((await pool.query('SELECT current_user AS role')).rows[0].role,'phishnet_tenant');
    await assert.rejects(pool.query("INSERT INTO groups(name,organization_id) VALUES('Forbidden',$1)",[otherOrgId]),(error:any)=>error.code==='42501');
  });
});
test('RLS context is transaction-local across rollback and pooled reuse', async () => {
  await withTenant(orgId,1,async()=> {
    const client=await pool.connect();
    try {
      await client.query('BEGIN');
      assert.equal((await client.query("SELECT current_setting('app.organization_id') AS tenant")).rows[0].tenant,String(orgId));
      await client.query('ROLLBACK');
    } finally {client.release();}
  });
  for (let index=0;index<10;index++) {
    await withTenant(otherOrgId,2,async()=> {
      const {rows}=await pool.query('SELECT organization_id FROM groups');
      assert.ok(rows.every(row=>row.organization_id===otherOrgId));
    });
  }
});
test('tracking tokens bind both identifiers and reject tampering', () => {
  const token=trackingToken(campaignId,targetId);
  assert.equal(validTrackingToken(token,campaignId,targetId),true);
  assert.equal(validTrackingToken(token,campaignId,targetId+1),false);
  assert.equal(validTrackingToken(token+'x',campaignId,targetId),false);
});
test('employee cannot read campaigns, SMTP credentials or captures', async () => {
  for (const path of ['/api/campaigns','/api/smtp-profiles','/api/admin/credential-captures']) assert.equal((await request(path,employeeCookie)).status,403,path);
});
test('cross-tenant campaign reads and writes are rejected', async () => {
  assert.equal((await request(`/api/campaigns/${campaignId}`,betaCookie)).status,404);
  assert.equal((await request(`/api/campaigns/${campaignId}/launch`,betaCookie,'POST')).status,404);
});
test('untrusted browser writes are rejected', async () => {
  const response=await fetch(base+'/api/session-ping',{ method:'POST',headers:{ cookie,origin:'https://untrusted.example' } });
  assert.equal(response.status,403);
});
test('anonymous realtime connection is rejected', async () => {
  const socket=io(base+'/campaigns',{ transports:['websocket'],reconnection:false,timeout:3000 });
  try { await new Promise<void>((resolve,reject) => {
    socket.once('connect',()=>reject(new Error('Anonymous socket authenticated')));
    socket.once('connect_error',()=>resolve());
  }); } finally { socket.disconnect(); }
});
test('concurrent launch snapshots recipients only once', async () => {
  const outcomes=await Promise.allSettled([enqueueCampaign(campaignId,orgId),enqueueCampaign(campaignId,orgId)]);
  assert.equal(outcomes.filter(result=>result.status==='fulfilled').length,1);
  assert.equal((await pool.query('SELECT count(*)::int AS n FROM campaign_dispatch WHERE campaign_id=$1',[campaignId])).rows[0].n,1);
});
test('paused campaigns do not dispatch and resume restores eligibility', async () => {
  assert.equal((await request(`/api/campaigns/${campaignId}/pause`,cookie,'POST')).status,200);
  assert.equal(await dispatchOne(),false);
  assert.equal((await request(`/api/campaigns/${campaignId}/resume`,cookie,'POST')).status,200);
});
test('worker accepts mail once and leaves observation window active', async () => {
  assert.equal(await dispatchOne(),true);
  assert.equal(await dispatchOne(),false);
  const job=(await pool.query('SELECT state FROM campaign_dispatch WHERE campaign_id=$1',[campaignId])).rows[0];
  assert.equal(job.state,'accepted');
  assert.equal((await pool.query('SELECT status FROM campaigns WHERE id=$1',[campaignId])).rows[0].status,'Active');
});
test('public tracking requires a signed token and constrains redirect', async () => {
  assert.equal((await request(`/o/${campaignId}/${targetId}.gif`,'')).status,404);
  const response=await fetch(`${base}/c/${campaignId}/${targetId}?token=${trackingToken(campaignId,targetId)}&u=aHR0cHM6Ly9ldmlsLmV4YW1wbGU=`,{redirect:'manual'});
  assert.equal(response.status,302);
  assert.ok(response.headers.get('location')?.startsWith(`/l/${campaignId}/${targetId}?token=`));
});
test('capture is encrypted, lists omit passwords, reveal is audited and tenant scoped', async () => {
  const response=await request('/c/submit','','POST',{ email:'recipient@audit.test',username:'test',password:'SyntheticPassword123!',cid:campaignId,tid:templateId,lid:landingId,targetId,token:trackingToken(campaignId,targetId) });
  assert.equal(response.status,201,await response.clone().text());
  const { captureId }=await response.json();
  const stored=(await pool.query('SELECT password FROM credential_captures WHERE id=$1',[captureId])).rows[0].password;
  assert.notEqual(stored,'SyntheticPassword123!');
  const listing=await (await request(`/api/admin/credential-captures?campaignId=${campaignId}`)).json();
  assert.equal(listing.pagination.total,1);
  assert.equal(listing.data[0].password,null);
  assert.equal(listing.data[0].passwordAnalysis.breached,null);
  assert.equal((await request(`/api/admin/credential-captures/${captureId}/reveal`,betaCookie,'POST')).status,404);
  const reveal=await request(`/api/admin/credential-captures/${captureId}/reveal`,cookie,'POST');
  assert.equal(reveal.status,200);
  assert.equal((await reveal.json()).password,'SyntheticPassword123!');
  assert.equal((await pool.query("SELECT count(*)::int AS n FROM audit_logs WHERE resource_id=$1 AND action='capture.reveal'",[captureId])).rows[0].n,1);
  const other=await (await request(`/api/admin/credential-captures?campaignId=${campaignId}`,betaCookie)).json();
  assert.equal(other.pagination.total,0);
});
test('campaign landing snapshots preserve password-off defaults after edits',async()=>{
 await pool.query('UPDATE landing_pages SET capture_passwords=false WHERE id=$1',[landingId]);
 const id=(await pool.query("INSERT INTO campaigns(name,target_group_id,smtp_profile_id,email_template_id,landing_page_id,organization_id) VALUES('No password retention',$1,$2,$3,$4,$5) RETURNING id",[groupId,smtpId,templateId,landingId,orgId])).rows[0].id;extraCampaigns.push(id);
 try{await enqueueCampaign(id,orgId);await pool.query('UPDATE landing_pages SET capture_passwords=true WHERE id=$1',[landingId]);
  const response=await request('/c/submit','','POST',{email:'recipient@audit.test',username:'test',password:'MustNotBeStored123!',cid:id,tid:templateId,lid:landingId,targetId,token:trackingToken(id,targetId)});assert.equal(response.status,201);
  assert.equal((await pool.query('SELECT count(*)::int AS n FROM credential_captures WHERE campaign_id=$1',[id])).rows[0].n,0);
  const evidence=(await pool.query('SELECT submitted_data FROM campaign_results WHERE campaign_id=$1',[id])).rows[0].submitted_data;assert.deepEqual(evidence,{submitted:true});
 }finally{await pool.query('UPDATE landing_pages SET capture_passwords=true WHERE id=$1',[landingId]);await pool.query("UPDATE campaigns SET status='Cancelled' WHERE id=$1",[id]);await pool.query("UPDATE campaign_dispatch SET state='cancelled' WHERE campaign_id=$1",[id]);}
});
test('expired sending leases become ambiguous without an automatic resend', async () => {
  await pool.query("UPDATE campaign_dispatch SET state='sending',locked_at=now()-interval '5 minutes' WHERE campaign_id=$1",[campaignId]);
  await recoverDispatchLeases();
  assert.equal((await pool.query('SELECT state FROM campaign_dispatch WHERE campaign_id=$1',[campaignId])).rows[0].state,'ambiguous');
  assert.equal(await dispatchOne(),false);
});
test('SMTP list never returns its stored secret', async () => {
  const profiles=await (await request('/api/smtp-profiles')).json();
  assert.ok(profiles.every((profile: any)=>!profile.password));
});
test('management and employee read endpoints respond without server errors', async () => {
  for (const path of ['/api/dashboard/stats','/api/dashboard/metrics','/api/campaigns','/api/groups','/api/email-templates','/api/landing-pages','/api/smtp-profiles','/api/notifications','/api/users','/api/organization']) {
    const response=await request(path); assert.equal(response.status,200,`${path}: ${await response.clone().text()}`);
  }
  for (const path of ['/api/employee/training','/api/employee/quizzes','/api/employee/points','/api/employee/badges','/api/employee/leaderboard','/api/employee/flashcard-decks','/api/employee/articles']) {
    const response=await request(path,employeeCookie); assert.equal(response.status,200,`${path}: ${await response.clone().text()}`);
  }
});

test('scheduled campaign creation preserves a draft until explicit launch', async()=> {
  const response=await request('/api/campaigns',cookie,'POST',{name:'Scheduled draft',targetGroupId:groupId,smtpProfileId:smtpId,emailTemplateId:templateId,landingPageId:landingId,scheduledAt:new Date(Date.now()+86400000).toISOString(),recurrenceDays:7,trainingDueDays:5});
  assert.equal(response.status,201,await response.clone().text());const campaign=await response.json();extraCampaigns.push(campaign.id);
  assert.equal(campaign.status,'Draft');assert.equal(campaign.recurrenceDays,7);
  assert.equal((await pool.query('SELECT count(*)::int AS n FROM campaign_dispatch WHERE campaign_id=$1',[campaign.id])).rows[0].n,0);
});
test('dynamic audiences match directory rules and snapshot recipients from another group',async()=> {
  await pool.query("UPDATE targets SET department='IT' WHERE id=$1",[targetId]);
  const dynamicId=(await pool.query(`INSERT INTO groups(name,organization_id,filter_rules) VALUES('Dynamic IT',$1,'{"department":"IT"}') RETURNING id`,[orgId])).rows[0].id;extraGroups.push(dynamicId);
  const id=(await pool.query("INSERT INTO campaigns(name,target_group_id,smtp_profile_id,email_template_id,landing_page_id,organization_id) VALUES('Dynamic regression',$1,$2,$3,$4,$5) RETURNING id",[dynamicId,smtpId,templateId,landingId,orgId])).rows[0].id;extraCampaigns.push(id);
  assert.equal((await enqueueCampaign(id,orgId)).queued,1);
  assert.equal((await pool.query('SELECT target_id FROM campaign_dispatch WHERE campaign_id=$1',[id])).rows[0].target_id,targetId);
  const landing=await request(`/l/${id}/${targetId}?token=${trackingToken(id,targetId)}`,'');assert.equal(landing.status,200);
  await pool.query("UPDATE campaigns SET status='Cancelled' WHERE id=$1",[id]);
});
test('recurring generation is idempotent across concurrent workers',async()=> {
  await pool.query("UPDATE campaigns SET recurrence_days=7,next_run_at=now()-interval '1 minute',launched_at=now() WHERE id=$1",[campaignId]);
  await Promise.all([createRecurringOccurrences(),createRecurringOccurrences()]);
  const {rows}=await pool.query('SELECT id FROM campaigns WHERE recurrence_parent_id=$1',[campaignId]);extraCampaigns.push(...rows.map(row=>row.id));assert.equal(rows.length,1);
  await pool.query("UPDATE campaigns SET status='Cancelled' WHERE recurrence_parent_id=$1",[campaignId]);
});
test('remediation assigns training and reminders once, then respects completion',async()=> {
  const user=(await pool.query("SELECT id,email FROM users WHERE organization_id=$1 AND email LIKE 'user.%' LIMIT 1",[orgId])).rows[0];
  const owner=(await pool.query('SELECT id FROM users WHERE organization_id=$1 LIMIT 1',[orgId])).rows[0];
  trainingModuleId=(await pool.query("INSERT INTO training_modules(organization_id,title,category,duration_minutes,created_by) VALUES($1,'Password remediation','passwords',5,$2) RETURNING id",[orgId,owner.id])).rows[0].id;
  await pool.query('UPDATE targets SET email=$2 WHERE id=$1',[targetId,user.email]);
  await pool.query('UPDATE campaigns SET training_module_id=$2,password_training_module_id=$2 WHERE id=$1',[campaignId,trainingModuleId]);
  await queueRemediation(campaignId,targetId,'weak_password');await queueRemediation(campaignId,targetId,'weak_password');
  assert.equal(await processRemediation(),true);assert.equal(await processRemediation(),false);
  assert.equal((await pool.query('SELECT count(*)::int AS n FROM training_assignments WHERE campaign_id=$1',[campaignId])).rows[0].n,1);
  await pool.query("UPDATE training_assignments SET due_at=now()-interval '1 hour' WHERE campaign_id=$1",[campaignId]);
  assert.equal(await remindTraining(),1);assert.equal(await remindTraining(),0);
  await pool.query("UPDATE training_progress SET status='completed' WHERE user_id=$1 AND module_id=$2",[user.id,trainingModuleId]);
  await pool.query("UPDATE training_assignments SET last_reminded_at=now()-interval '2 days' WHERE campaign_id=$1",[campaignId]);assert.equal(await remindTraining(),0);
});
test('send windows support overnight windows and scanner signals are explicit',()=> {
  assert.equal(withinSendWindow(new Date('2026-10-29T23:00:00Z'),'UTC',22*60,6*60),true);
  assert.equal(withinSendWindow(new Date('2026-10-29T12:00:00Z'),'UTC',22*60,6*60),false);
  assert.equal(suspectedAutomation('Proofpoint Link Scanner'),true);assert.equal(suspectedAutomation('Mozilla/5.0 Firefox'),false);
});
test('provider webhook signatures bind the raw body and timestamp',()=> {
  const {publicKey,privateKey}=generateKeyPairSync('ec',{namedCurve:'prime256v1'});const key=publicKey.export({type:'spki',format:'pem'}).toString();
  const timestamp=String(Math.floor(Date.now()/1000));const body=Buffer.from('[]');const signature=sign('sha256',Buffer.concat([Buffer.from(timestamp),body]),privateKey).toString('base64');
  assert.equal(validWebhook(body,signature,timestamp,key),true);assert.equal(validWebhook(Buffer.from('[1]'),signature,timestamp,key),false);
  assert.equal(validWebhook(body,signature,timestamp,key,Date.now()+600000),false);
});
test('provider callbacks deduplicate events and suppress bounced recipients',async()=> {
  const email=(await pool.query('SELECT snapshot FROM campaign_dispatch WHERE campaign_id=$1',[campaignId])).rows[0].snapshot.to;
  const event={sg_event_id:`audit-bounce-${campaignId}`,event:'bounce',email,timestamp:Math.floor(Date.now()/1000),phishnet_campaign:campaignId,phishnet_target:targetId,phishnet_org:orgId};
  assert.equal(await applyWebhookEvents([event]),1);assert.equal(await applyWebhookEvents([event]),0);
  assert.equal((await pool.query('SELECT count(*)::int AS n FROM delivery_suppressions WHERE organization_id=$1 AND email=lower($2)',[orgId,email])).rows[0].n,1);
  await pool.query('DELETE FROM delivery_suppressions WHERE organization_id=$1 AND email=lower($2)',[orgId,email]);
});


test('imports reject local networks, numeric loopback and unsafe protocols',async()=>{
  for(const url of ['http://127.0.0.1','http://2130706433','http://[::1]','http://169.254.169.254/latest/meta-data','file:///etc/passwd','http://localhost','http://10.0.0.1','http://user:pass@example.com'])await assert.rejects(safeFetchText(url));
  for(const ip of ['192.168.1.1','100.64.0.1','198.18.0.1','2001:db8::1','::ffff:127.0.0.1'])assert.equal(isPublicAddress(ip),false,ip);
  assert.equal(isPublicAddress('8.8.8.8'),true);
});

test('report exports redact credentials and enforce tenant and owner downloads',async()=>{
  const response=await request('/api/reports/export',cookie,'POST',{type:'users',format:'json'});assert.equal(response.status,200,await response.clone().text());
  const {downloadUrl,filename}=await response.json();
  try{
    assert.equal((await request(downloadUrl,betaCookie)).status,404);
    assert.equal((await request(downloadUrl,employeeCookie)).status,403);
    const download=await request(downloadUrl);assert.equal(download.status,200);assert.equal(download.headers.get('cache-control'),'no-store');
    const json=await download.text();for(const forbidden of ['twoFactorSecret','password','twoFactorBackupCodes','encryptedPassword'])assert.ok(!json.includes('"'+forbidden+'"'),forbidden);
    assert.equal((await request('/api/reports/download/../../.env')).status,404);
  }finally{const {rows:[record]}=await pool.query('DELETE FROM report_exports WHERE filename=$1 RETURNING object_key',[filename]);if(record)await deletePrivateObject(record.object_key);}
  assert.equal((await request('/api/reports/export',cookie,'POST',{type:'users',dateRange:{start:'bad',end:'bad'}})).status,400);
});

test('private profile image uploads reject executable content and isolate tenants',async()=>{
  const before=(await request('/api/user',employeeCookie).then(r=>r.json()));
  const original=before.profilePicture;let assetId:string|undefined;
  try{
    const invalid=new FormData();invalid.set('profilePicture',new Blob(['<svg onload="alert(1)"></svg>'],{type:'image/png'}),'spoof.png');
    assert.equal((await fetch(base+'/api/user/profile-picture',{method:'POST',headers:{cookie:employeeCookie},body:invalid})).status,415);
    const form=new FormData();form.set('profilePicture',new Blob([Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a3ioAAAAASUVORK5CYII=','base64')],{type:'image/png'}),'pixel.png');
    const response=await fetch(base+'/api/user/profile-picture',{method:'POST',headers:{cookie:employeeCookie},body:form});assert.equal(response.status,200,await response.clone().text());
    const user=await response.json();assetId=user.profilePicture.split('/').at(-1);
    assert.equal((await request(user.profilePicture,employeeCookie)).status,200);
    assert.equal((await request(user.profilePicture,betaCookie)).status,404);
    assert.equal((await request(user.profilePicture,'')).status,401);
  }finally{await pool.query('UPDATE users SET profile_picture=$2 WHERE id=$1',[before.id,original]);if(assetId){const {rows:[asset]}=await pool.query('DELETE FROM private_assets WHERE id=$1 RETURNING object_key',[assetId]);if(asset)await deletePrivateObject(asset.object_key);}}
});

test('S3-compatible storage round-trips private objects against a local protocol fixture',async()=>{
  const objects=new Map<string,Buffer>();const server=createHttpServer(async(req,res)=>{
    const key=req.url!.split('?')[0];
    if(req.method==='PUT'){const chunks:Buffer[]=[];for await(const chunk of req)chunks.push(chunk);objects.set(key,Buffer.concat(chunks));res.end();}
    else if(req.method==='GET'){const body=objects.get(key);if(!body){res.statusCode=404;return res.end();}res.setHeader('Content-Length',body.length);res.end(body);}
    else if(req.method==='DELETE'){objects.delete(key);res.statusCode=204;res.end();}else res.end();
  });
  await new Promise<void>(resolve=>server.listen(0,'127.0.0.1',resolve));const port=(server.address() as any).port;
  const previous={...process.env};Object.assign(process.env,{ASSET_STORAGE:'s3',S3_ENDPOINT:`http://127.0.0.1:${port}`,S3_REGION:'us-east-1',S3_BUCKET:'audit-only',S3_ACCESS_KEY_ID:'audit',S3_SECRET_ACCESS_KEY:'audit-only'});
  const key=`assets/${orgId}/${randomUUID()}.png`;const bytes=Buffer.from('private audit object');
  try{await putPrivateObject(key,bytes,'image/png');assert.deepEqual(await getPrivateObject(key),bytes);await deletePrivateObject(key);assert.equal(objects.size,0);}
  finally{for(const name of ['ASSET_STORAGE','S3_ENDPOINT','S3_REGION','S3_BUCKET','S3_ACCESS_KEY_ID','S3_SECRET_ACCESS_KEY'])if(previous[name]===undefined)delete process.env[name];else process.env[name]=previous[name];await new Promise<void>(resolve=>server.close(()=>resolve()));}
});

test('reports claim each occurrence once across concurrent schedulers',async()=>{
  const id=(await pool.query("INSERT INTO report_schedules(organization_id,type,cadence,time_of_day,timezone,recipients,next_run_at) VALUES($1,'executive','daily','12:00','UTC','recipient@audit.test',now()-interval '1 minute') RETURNING id",[orgId])).rows[0].id;
  try{await Promise.all([reportingScheduler.checkAndRunDueReports(),reportingScheduler.checkAndRunDueReports()]);
    const {rows}=await pool.query('SELECT state FROM report_runs WHERE schedule_id=$1',[id]);assert.equal(rows.length,1);assert.equal(rows[0].state,'accepted');
  }finally{await pool.query('DELETE FROM report_schedules WHERE id=$1',[id]);}
});

test('report cadence handles tenant timezones and DST offsets',()=>{
 assert.equal(nextReportRun('daily','09:00','Asia/Karachi',new Date('2026-01-01T03:00Z')).toISOString(),'2026-01-01T04:00:00.000Z');
 assert.equal(nextReportRun('daily','09:00','America/New_York',new Date('2026-03-08T04:00Z')).toISOString(),'2026-03-08T13:00:00.000Z');
 assert.throws(()=>nextReportRun('daily','25:00','UTC'));
});

test('shared login counters are atomic across separate store instances',async()=>{
 const bucket='regression-'+randomUUID();const a=new PostgresRateLimitStore(bucket),b=new PostgresRateLimitStore(bucket);
 try{const increments=await Promise.all(Array.from({length:20},(_,i)=>(i%2?a:b).increment('synthetic-client')));assert.deepEqual(increments.map(r=>r.totalHits).sort((a,b)=>a-b),Array.from({length:20},(_,i)=>i+1));}
 finally{await pool.query('DELETE FROM rate_limit_counters WHERE bucket=$1',[bucket]);}
});

test('mandatory MFA pending sessions allow setup but cannot access application data',async()=>{
 const org=(await pool.query("INSERT INTO organizations(name,two_factor_required) VALUES($1,true) RETURNING id",['MFA regression '+randomUUID()])).rows[0].id;
 const email=`mfa-${randomUUID()}@audit.test`;let id:number|undefined;
 try{
  id=(await pool.query("INSERT INTO users(email,password,first_name,last_name,organization_id,organization_name,email_verified,is_active) SELECT $1,password,'MFA','Test',$2,'MFA test',true,true FROM users WHERE email='user.1@audit.test' RETURNING id",[email,org])).rows[0].id;
  const loginResponse=await request('/api/login','','POST',{email,password});assert.equal(loginResponse.status,200);assert.equal((await loginResponse.json()).requiresTwoFactorSetup,true);
  let pending=loginResponse.headers.getSetCookie().map(v=>v.split(';')[0]).join('; ');
  assert.equal((await request('/api/user',pending)).status,401);assert.equal((await request('/api/campaigns',pending)).status,401);
  const setup=await request('/api/user/2fa/setup',pending,'POST',{});assert.equal(setup.status,200);const {manualEntryKey}=await setup.json();
  const token=speakeasy.totp({secret:manualEntryKey,encoding:'base32'});
  const verified=await request('/api/user/2fa/verify-setup',pending,'POST',{token});assert.equal(verified.status,200);const {backupCodes}=await verified.json();assert.equal(backupCodes.length,8);
  assert.equal((await request('/api/user',pending)).status,401);
  const challenge=await request('/api/login','','POST',{email,password});assert.equal((await challenge.json()).requiresTwoFactor,true);pending=challenge.headers.getSetCookie().map(v=>v.split(';')[0]).join('; ');
  const accepted=await request('/api/login/2fa',pending,'POST',{backupCode:backupCodes[0]});assert.equal(accepted.status,200);
  const challenge2=await request('/api/login','','POST',{email,password});const pending2=challenge2.headers.getSetCookie().map(v=>v.split(';')[0]).join('; ');
  assert.equal((await request('/api/login/2fa',pending2,'POST',{backupCode:backupCodes[0]})).status,401);
 }finally{if(id)await pool.query('DELETE FROM users WHERE id=$1',[id]);await pool.query('DELETE FROM organizations WHERE id=$1',[org]);}
});


test('real SMTP protocol acceptance and connection loss after DATA have distinct outcomes',async()=>{
 for(const drop of [false,true]){
  let dataSeen=false;const server=createSmtpServer(socket=>{
   socket.write('220 localhost audit SMTP\r\n');let buffer='',inData=false;
   socket.on('data',chunk=>{buffer+=chunk.toString();let boundary;
    while((boundary=buffer.indexOf('\r\n'))>=0){const line=buffer.slice(0,boundary);buffer=buffer.slice(boundary+2);
     if(inData){if(line==='.'){dataSeen=true;inData=false;if(drop)socket.destroy();else socket.write('250 accepted by audit fixture\r\n');}continue;}
     if(/^EHLO|^HELO/.test(line))socket.write('250-localhost\r\n250 AUTH PLAIN\r\n');
     else if(/^AUTH/.test(line))socket.write('235 authenticated\r\n');
     else if(line==='DATA'){inData=true;socket.write('354 end with dot\r\n');}
     else if(line==='QUIT'){socket.end('221 goodbye\r\n');}
     else socket.write('250 OK\r\n');
    }
   });
  });await new Promise<void>(resolve=>server.listen(0,'127.0.0.1',resolve));
  const transport=process.env.MAIL_TRANSPORT,external=process.env.SIMULATION_EXTERNAL_DELIVERY_ENABLED;delete process.env.MAIL_TRANSPORT;process.env.SIMULATION_EXTERNAL_DELIVERY_ENABLED='true';
  try{
   const profile={host:'127.0.0.1',port:(server.address() as any).port,username:'audit',password:'audit',fromEmail:'sender@audit.test',fromName:'Audit'} as any;
   const action=sendSimulation(profile,{to:'recipient@audit.test',html:'<p>Synthetic protocol fixture</p>',subject:'Audit',messageId:'<audit@audit.test>',campaignId:1,targetId:1,organizationId:1});
   if(drop)await assert.rejects(action,(error:any)=>{assert.equal(deliveryFailureState(error,1),'ambiguous');return true;});
   else assert.ok((await action).messageId);
   assert.equal(dataSeen,true);
  }finally{process.env.MAIL_TRANSPORT=transport;if(external===undefined)delete process.env.SIMULATION_EXTERNAL_DELIVERY_ENABLED;else process.env.SIMULATION_EXTERNAL_DELIVERY_ENABLED=external;await new Promise<void>(resolve=>server.close(()=>resolve()));}
 }
 assert.equal(deliveryFailureState({code:'ECONNECTION',command:'CONN'},1),'queued');
 assert.equal(deliveryFailureState({code:'PROVIDER_UNCERTAIN',responseCode:503},1),'ambiguous');
});
