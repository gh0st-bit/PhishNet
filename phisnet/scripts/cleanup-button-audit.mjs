import {readFileSync,writeFileSync,existsSync} from 'node:fs';
import {parse} from 'dotenv';
import pg from 'pg';
const env=parse(readFileSync('.env.audit')),review=JSON.parse(readFileSync('logs/role-review/accounts.json'));
if(new URL(env.DATABASE_URL).pathname!=='/phishnet_audit'||env.MAIL_TRANSPORT!=='sink')throw new Error('Requires audit database and sink');
const base='http://127.0.0.1:5000',results=[];
for(const actor of ['admin','owner']){
 const response=await fetch(base+'/api/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email:review.accounts[actor].email,password:review.password})});if(!response.ok)throw new Error('QA login failed');const cookie=response.headers.getSetCookie().map(v=>v.split(';')[0]).join('; ');
 async function get(path){const response=await fetch(base+path,{headers:{cookie}});if(!response.ok)throw new Error('Read failed: '+path);return response.json();}
 async function remove(path,name){const response=await fetch(base+path,{method:'DELETE',headers:{cookie,Origin:base}});results.push({actor,path,name,status:response.status});if(!response.ok)throw new Error('Fixture cleanup failed: '+path+' '+response.status);}
 const readiness=await get('/api/pilot/readiness');if(readiness.mailMode!=='local-only'||!readiness.workerDeliveryPaused)throw new Error('Expected paused local audit server');
 const campaignData=await get('/api/campaigns?limit=100');for(const row of campaignData.campaigns||campaignData)if(/^Button Draft (admin|owner) \d+/.test(row.name))await remove('/api/campaigns/'+row.id,row.name);
 for(const [path,pattern]of [['/api/groups',/^Button (QA (admin|owner) \d+|Draft (admin|owner) \d+|permission \d+)/],['/api/smtp-profiles',/^Button (SMTP|Draft) (admin|owner) \d+/],['/api/email-templates',/^Button (Template|Draft) (admin|owner) \d+/],['/api/landing-pages',/^Button (Landing|Draft) (admin|owner) \d+/]]){
  const data=await get(path);for(const row of data.templates||data)if(pattern.test(row.name))await remove(path+'/'+row.id,row.name);
 }
 const schedules=await get('/api/reports/schedules');for(const row of schedules)if(/^button-schedule-\d+@audit\.test$/.test(row.recipients))await remove('/api/reports/schedules/'+row.id,row.recipients);
 if(actor==='admin'){const organizations=await get('/api/admin/organizations');for(const row of organizations)if(/^Button Organization \d+$/.test(row.name))await remove('/api/admin/organizations/'+row.id,row.name);}
}
const baseline=new Set(JSON.parse(readFileSync('logs/product-maturity/baseline.json')).tables.campaigns);
const fixtures=readFileSync('logs/role-review/browser-inputs.jsonl','utf8').trim().split('\n').filter(Boolean).map(line=>JSON.parse(line));
const fixtureIds=[...new Set(fixtures.filter(row=>row.name==='Global Admin campaign notification fixture').map(row=>row.output?.campaign?.id).filter(id=>Number.isInteger(id)&&!baseline.has(id)))];
const client=new pg.Client({connectionString:env.CONTROL_DATABASE_URL});await client.connect();let demoCampaigns=[],remainingDisposableCounts={},badgeForeignKeyDefinition;
try{
 if(fixtureIds.length)demoCampaigns=(await client.query("UPDATE campaigns SET dataset='demo' WHERE id=ANY($1::integer[]) AND organization_id=$2 AND name ~ '^QA admin campaign [0-9]{13}$' AND dataset<>'demo' RETURNING id,name",[fixtureIds,review.accounts.admin.organizationId])).rows;
 badgeForeignKeyDefinition=(await client.query("SELECT pg_get_constraintdef(oid) AS definition FROM pg_constraint WHERE conrelid='user_badges'::regclass AND contype='f' AND confrelid='badges'::regclass")).rows[0]?.definition;
 for(const [table,column,pattern]of [['organizations','name','^Button Organization [0-9]+$'],['users','email','^button-(notifications|badge-gap|orgadmin)-'],['campaigns','name','^Button Draft (admin|owner) [0-9]+'],['groups','name','^Button (QA (admin|owner)|Draft (admin|owner)|permission) [0-9]+'],['smtp_profiles','name','^Button (SMTP|Draft) (admin|owner) [0-9]+'],['email_templates','name','^Button (Template|Draft) (admin|owner) [0-9]+'],['landing_pages','name','^Button (Landing|Draft) (admin|owner) [0-9]+'],['badges','name','^Button (Badge|badge gap|badge tile) [0-9]+'],['training_modules','title','^Button badge gap [0-9]+'],['report_schedules','recipients','^button-schedule-[0-9]+@audit[.]test$'],['notifications','title','^QA current campaign notification [0-9]+']]){
  remainingDisposableCounts[table]=Number((await client.query(`SELECT count(*) AS total FROM ${table} WHERE ${column} ~ $1`,[pattern])).rows[0].total);
 }
}finally{await client.end();}
const prior=existsSync('logs/button-audit/cleanup.json')?JSON.parse(readFileSync('logs/button-audit/cleanup.json')):{};
writeFileSync('logs/button-audit/cleanup.json',JSON.stringify({at:new Date().toISOString(),scope:'Only exact synthetic name patterns from this button audit; baseline IDs preserved. Logged non-baseline campaign notification fixtures are tagged demo.',results:[...(prior.results||[]),...results],demoCampaigns:[...(prior.demoCampaigns||[]),...demoCampaigns],remainingDisposableCounts,badgeForeignKeyDefinition},null,2));console.log(JSON.stringify({removed:results.length,taggedDemo:demoCampaigns.length,failures:results.filter(r=>r.status>=400).length,remainingDisposableCounts,badgeForeignKeyDefinition}));
if(Object.values(remainingDisposableCounts).some(count=>count!==0))process.exitCode=1;
