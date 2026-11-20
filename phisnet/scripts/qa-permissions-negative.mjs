import { readFileSync,writeFileSync } from 'node:fs';
import { parse } from 'dotenv';
import pg from 'pg';
import assert from 'node:assert/strict';
const review=JSON.parse(readFileSync('logs/role-review/accounts.json'));
const env=parse(readFileSync('.env.audit'));if(new URL(env.DATABASE_URL).pathname!=='/phishnet_audit'||env.MAIL_TRANSPORT!=='sink')throw new Error('Isolated audit mode required');
const db=new pg.Client({connectionString:env.CONTROL_DATABASE_URL});await db.connect();
const base='http://localhost:5000',sessions={},results=[],requests=[];let temp,registeredOrg;
async function call(actor,path,method='GET',body,statuses=[200,201,202,204]){
 const r=await fetch(base+path,{method,headers:{cookie:sessions[actor]||'',Origin:base,'Content-Type':'application/json'},body:body===undefined?undefined:JSON.stringify(body)});const text=await r.text();let data;try{data=JSON.parse(text);}catch{data=text;}
 requests.push({actor,path:path.replace(/([?&]token=)[^&]+/g,'$1[redacted]'),method,status:r.status,input:body?{...body,password:body.password?'[redacted]':undefined}:undefined});assert.ok(statuses.includes(r.status),`${actor} ${method} ${path}: ${r.status} ${text.slice(0,200)}`);
 if(path==='/api/login'&&r.status===200)sessions[actor]=r.headers.getSetCookie().map(v=>v.split(';')[0]).join('; ');return data;
}
async function check(name,fn){try{await fn();results.push({name,status:'PASS'});console.log('PASS',name);}catch(e){results.push({name,status:'FAIL',error:e.message});console.log('FAIL',name,e.message);}}
try{
 await call('root','/api/login','POST',{email:'admin.1@audit.test',password:'PhishNetAuditOnly2026!'});
 await call('tenant','/api/login','POST',{email:'orgadmin.1@audit.test',password:'PhishNetAuditOnly2026!'});
 await call('owner','/api/login','POST',{email:review.accounts.owner.email,password:review.password});
 const roles=await call('root','/api/roles'),id=name=>roles.find(r=>r.name===name).id;
 temp=await call('root','/api/users','POST',{firstName:'QA',lastName:'Temporary',email:`qa.security.${Date.now()}@review.test`,password:review.password,roleId:id('Manager')});
 await call('temp','/api/login','POST',{email:temp.email,password:review.password});
 await check('Role promotion takes effect in an existing session',async()=>{await call('temp','/api/admin/operations','GET',undefined,[403]);await call('root',`/api/users/${temp.id}`,'PUT',{roleId:id('Admin')});await call('temp','/api/admin/operations');});
 await check('Legacy role-only Admin is recognized consistently',async()=>{await db.query('UPDATE users SET is_admin=false WHERE id=$1 AND email=$2',[temp.id,temp.email]);const user=await call('temp','/api/user');assert.equal(user.isAdmin,true);await call('temp','/api/admin/operations');});
 await check('Disabling an Admin revokes existing sessions and blocks login',async()=>{await call('root',`/api/users/${temp.id}`,'PUT',{isActive:false});await call('temp','/api/user','GET',undefined,[401]);await call('temp','/api/login','POST',{email:temp.email,password:review.password},[401]);});
 await check('Role demotion removes management access',async()=>{await call('root',`/api/users/${temp.id}`,'PUT',{roleId:id('User'),isActive:true});await call('temp','/api/login','POST',{email:temp.email,password:review.password});await call('temp','/api/groups','GET',undefined,[403]);await call('temp','/api/admin/operations','GET',undefined,[403]);});
 await check('Tenant admin cannot modify or delete a platform Admin in the same tenant',async()=>{await call('tenant',`/api/users/${review.accounts.admin.id}`,'PUT',{firstName:'Forbidden'},[403]);await call('tenant',`/api/users/${review.accounts.admin.id}`,'DELETE',undefined,[403]);});
 await check('Tenant admin cannot read or edit another tenant user',async()=>{await call('owner',`/api/users/${review.accounts.betaemployee.id}`,'PUT',{firstName:'Forbidden'},[404]);await call('owner',`/api/users/${review.accounts.betaemployee.id}`,'DELETE',undefined,[404]);});
 await check('Forged isAdmin and organizationId are ignored during tenant user creation',async()=>{const u=await call('owner','/api/users','POST',{firstName:'QA',lastName:'Forged flags',email:`qa.forged.${Date.now()}@review.test`,password:review.password,roleId:id('User'),isAdmin:true,organizationId:review.accounts.beta.organizationId});assert.equal(u.isAdmin,false);assert.equal(u.organizationId,review.accounts.owner.organizationId);await call('owner',`/api/users/${u.id}`,'DELETE');});
 await check('Public registration cannot create a platform administrator',async()=>{const email=`qa.signup.${Date.now()}@review.test`;const u=await call('anonymous','/api/register','POST',{email,password:review.password,firstName:'QA',lastName:'Signup',organizationName:`QA temporary signup ${Date.now()}`,isAdmin:true,roleId:id('Admin')});registeredOrg=u.organizationId;assert.equal(u.isAdmin,false);const{rows:[row]}=await db.query('SELECT email_verification_token FROM users WHERE id=$1',[u.id]);await call('anonymous',`/api/verify-email?token=${encodeURIComponent(row.email_verification_token)}`);const logged=await call('signup','/api/login','POST',{email,password:review.password});assert.equal(logged.isAdmin,false);assert.deepEqual(logged.roles,['OrgAdmin']);await call('signup','/api/admin/operations','GET',undefined,[403]);});
}finally{
 if(temp)await call('root',`/api/users/${temp.id}`,'DELETE');
 if(registeredOrg)await call('root',`/api/admin/organizations/${registeredOrg}`,'DELETE');
 await db.end();writeFileSync('logs/role-review/negative-permissions.json',JSON.stringify({results,requests},null,2));process.exitCode=results.some(r=>r.status==='FAIL')?1:0;
}
