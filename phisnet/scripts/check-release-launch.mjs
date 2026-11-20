import {readFileSync,writeFileSync} from 'node:fs';
import {parse} from 'dotenv';
import assert from 'node:assert/strict';
const base='http://127.0.0.1:5000';
const password=parse(readFileSync('.env.investor-demo.accounts')).DEMO_PASSWORD;
const login=await fetch(base+'/api/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email:'orgadmin@demo.phishnet.test',password}),signal:AbortSignal.timeout(5000)});
assert.equal(login.status,200,'Sample login on the normal launcher');
const cookie=login.headers.getSetCookie().map(value=>value.split(';')[0]).join('; ');
async function get(path){const response=await fetch(base+path,{headers:{cookie},signal:AbortSignal.timeout(5000)});assert.equal(response.status,200,path);return response.json();}
const workspace=await get('/api/workspace'),readiness=await get('/api/pilot/readiness'),overview=await get('/api/dashboard/overview?days=0&dataset=demo'),timed=await get('/api/dashboard/overview/records?days=0&dataset=demo&event=timed_report');
assert.equal(workspace.demonstration,true);assert.equal(readiness.workerDeliveryPaused,true);assert.equal(readiness.mailMode,'local-only');assert.equal(overview.signals.sent,36);assert.equal(timed.total,18);
const result={at:new Date().toISOString(),base,normalLauncherVerified:true,sampleLogin:true,newWorkspaceEndpoint:true,outcomeRecords:true,workerDeliveryPaused:true,mailMode:readiness.mailMode};
writeFileSync('logs/investor-release/launch.json',JSON.stringify(result,null,2));console.log(JSON.stringify(result));
