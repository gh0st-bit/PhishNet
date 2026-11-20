import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { parse } from 'dotenv';
import pg from 'pg';
import assert from 'node:assert/strict';

const base = 'http://localhost:5000', password = 'QaReview2026!';
const env = parse(readFileSync('.env.audit'));
if (new URL(env.DATABASE_URL).pathname !== '/phishnet_audit' || env.MAIL_TRANSPORT !== 'sink') throw new Error('Requires isolated audit mode');
const db = new pg.Client({ connectionString: env.CONTROL_DATABASE_URL });
await db.connect();
const sessions = {}, accounts = {}, data = {}, results = [], requests = [];
mkdirSync('logs/role-review', { recursive: true });
function safe(value) { return JSON.parse(JSON.stringify(value, (key, value) => /password|secret|token|certificate/i.test(key) ? '[redacted]' : value)); }
async function request(actor, path, method='GET', body, statuses=[200,201,202,204]) {
  const r = await fetch(base+path,{method,headers:{cookie:sessions[actor]||'','Content-Type':'application/json',Origin:base},body:body===undefined?undefined:JSON.stringify(body),redirect:'manual',signal:AbortSignal.timeout(15000)});
  const raw = await r.text(); let output;try{output=JSON.parse(raw);}catch{output=raw;}
  requests.push({actor,method,path:path.replace(/([?&]token=)[^&]+/g,'$1[redacted]'),input:safe(body??null),status:r.status,response:safe(output)});
  assert.ok(statuses.includes(r.status),`${actor} ${method} ${path}: ${r.status} ${raw.slice(0,300)}`);
  if(path==='/api/login'&&r.status===200)sessions[actor]=r.headers.getSetCookie().map(v=>v.split(';')[0]).join('; ');
  return output;
}
async function check(name, fn){try{await fn();results.push({name,status:'PASS'});console.log('PASS',name);}catch(e){results.push({name,status:'FAIL',error:e.message});console.log('FAIL',name,e.message);}}
async function existing(email){return (await db.query('SELECT id,email,organization_id,organization_name FROM users WHERE email=$1',[email])).rows[0];}
async function login(actor,email,pwd=password){const user=await request(actor,'/api/login','POST',{email,password:pwd});assert.ok(user.id,'Login returned pending authentication');accounts[actor]={email,role:user.roles,isAdmin:user.isAdmin,id:user.id,organizationId:user.organizationId,organizationName:user.organizationName};return user;}
async function owner(actor,email,name){
  if(!await existing(email)) {
    await request('anonymous','/api/register','POST',{firstName:'QA',lastName:actor,email,password,organizationName:name});
    const {rows:[user]}=await db.query('SELECT email_verification_token FROM users WHERE email=$1',[email]);
    await request('anonymous',`/api/verify-email?token=${encodeURIComponent(user.email_verification_token)}`);
  }
  return login(actor,email);
}
async function user(actor,email,role,creator='owner'){
  const choices=await request(creator,'/api/roles');const selected=choices.find(r=>r.name===role);assert.ok(selected,`Role ${role} missing`);
  if(!await existing(email)) await request(creator,'/api/users','POST',{firstName:'QA',lastName:role,email,password,roleId:selected.id,isActive:true});
  return login(actor,email);
}
try {
  await check('Original supplied admin credentials',()=>login('root','admin.1@audit.test','PhishNetAuditOnly2026!'));
  await check('Create separate global Admin through Users API',()=>user('admin','qa.admin@review.test','Admin','root'));
  await check('Register and verify independent Alpha tenant owner',()=>owner('owner','qa.owner@review.test','QA Review Alpha'));
  await check('Register and verify independent Beta tenant owner',()=>owner('beta','qa.betaowner@review.test','QA Review Beta'));
  for(const [actor,email,role] of [['orgadmin','qa.orgadmin@review.test','OrgAdmin'],['manager','qa.manager@review.test','Manager'],['employee','qa.employee@review.test','User']])await check(`Create and sign in ${role}`,()=>user(actor,email,role));
  await check('Create Beta employee',()=>user('betaemployee','qa.betaemployee@review.test','User','beta'));
  await check('Admin role is effective in backend and user response',async()=>{const u=await request('admin','/api/user');assert.equal(u.isAdmin,true);await request('admin','/api/admin/operations');});
  await check('Organization admin cannot see or assign global Admin role',async()=>{
    const roles=await request('owner','/api/roles');assert.ok(!roles.some(r=>r.name==='Admin'));
    const adminRole=(await request('admin','/api/roles')).find(r=>r.name==='Admin');
    await request('owner','/api/users','POST',{firstName:'Forbidden',lastName:'Admin',email:'qa.forbidden@review.test',password,roleId:adminRole.id},[403]);
    await request('owner',`/api/users/${accounts.employee.id}`,'PUT',{roleId:adminRole.id},[403]);
    await request('owner',`/api/users/${accounts.owner.id}`,'PUT',{isActive:false},[400]);
  });
  const permissions = {
    admin:{'/api/admin/organizations':200,'/api/admin/operations':200,'/api/admin/articles':200,'/api/campaigns':200,'/api/smtp-profiles':200,'/api/employee/articles':403},
    orgadmin:{'/api/admin/organizations':403,'/api/admin/operations':403,'/api/admin/articles':200,'/api/campaigns':200,'/api/users':200,'/api/smtp-profiles':200,'/api/employee/articles':403},
    manager:{'/api/admin/organizations':403,'/api/admin/operations':403,'/api/admin/articles':403,'/api/campaigns':403,'/api/users':403,'/api/smtp-profiles':403,'/api/delivery/domains':403,'/api/employee/articles':403,'/api/manager/overview':200},
    employee:{'/api/admin/organizations':403,'/api/admin/articles':403,'/api/campaigns':403,'/api/users':403,'/api/smtp-profiles':403,'/api/dashboard/stats':403,'/api/employee/articles':200,'/api/employee/quizzes':200},
  };
  for(const [actor,paths]of Object.entries(permissions)) for(const [path,status]of Object.entries(paths))await check(`Permission ${actor} GET ${path} -> ${status}`,()=>request(actor,path,'GET',undefined,[status]));
  await check('Manager cannot create users, edit delivery settings or assign learning',async()=>{
    await request('manager','/api/users','POST',{firstName:'Forbidden'},[403]);
    await request('manager','/api/smtp-profiles','POST',{name:'Forbidden'},[403]);
    await request('manager','/api/admin/training-assignments','POST',{userIds:[accounts.employee.id],moduleId:1},[403]);
  });
  for(const actor of ['owner','beta'])await check(`Create persistent ${actor} verification data`,async()=>{
    const marker=actor==='owner'?'QA Alpha':'QA Beta';
    const group=await request(actor,'/api/groups','POST',{name:marker+' audience',description:'Persistent role review fixture'});
    await request(actor,`/api/groups/${group.id}/targets`,'POST',{firstName:'Synthetic',lastName:'Recipient',email:`${actor}-recipient@review.test`});
    const smtp=await request(actor,'/api/smtp-profiles','POST',{name:marker+' sender',host:'localhost',port:1025,username:'qa',password:'SyntheticOnly123!',fromEmail:'qa@review.test',fromName:'QA'});
    const template=await request(actor,'/api/email-templates','POST',{name:marker+' template',subject:'QA review',htmlContent:'<p>QA review <a href="{{TrackingURL}}">Open</a></p>',senderName:'QA',senderEmail:'qa@review.test'});
    const landing=await request(actor,'/api/landing-pages','POST',{name:marker+' landing',htmlContent:'<h1>QA review landing</h1>'});
    const campaign=await request(actor,'/api/campaigns','POST',{name:marker+' campaign',targetGroupId:group.id,smtpProfileId:smtp.id,emailTemplateId:template.id,landingPageId:landing.id});
    const article=(await request(actor,'/api/admin/articles','POST',{title:marker+' published article',category:'phishing',content:`<h2>${marker} preview content</h2><p>Persistent synthetic review article.</p>`,published:true})).article;
    const draft=(await request(actor,'/api/admin/articles','POST',{title:marker+' private draft',category:'phishing',content:'<p>Draft must be hidden from employees.</p>',published:false})).article;
    const deck=(await request(actor,'/api/admin/flashcard-decks','POST',{title:marker+' deck',category:'phishing'})).deck;
    await request(actor,`/api/admin/flashcard-decks/${deck.id}/cards`,'POST',{frontContent:'QA prompt',backContent:'QA answer'});
    await request(actor,`/api/admin/flashcard-decks/${deck.id}/publish`,'PATCH',{published:true});
    const module=(await request(actor,'/api/admin/training-modules','POST',{title:marker+' video',category:'phishing',difficulty:'beginner',durationMinutes:2,videoUrl:'https://example.com/qa-video.mp4'})).module;
    const quiz=(await request(actor,'/api/admin/quizzes','POST',{title:marker+' quiz',description:'Role review quiz',passingScore:80})).quiz;
    const question=(await request(actor,`/api/admin/quizzes/${quiz.id}/questions`,'POST',{questionText:'Should suspicious mail be reported?',questionType:'multiple_choice',options:['Yes','No'],correctAnswer:'Yes',points:10})).question;
    await request(actor,`/api/admin/quizzes/${quiz.id}/publish`,'PATCH',{published:true});
    data[actor]={group,smtp,template,landing,campaign,article,draft,deck,module,quiz,question};
  });
  if(data.owner&&data.beta){
    const a=data.owner,b=data.beta;
    for(const actor of ['orgadmin','manager'])await check(`Tenant isolation ${actor}: list, direct read and write`,async()=>{
      const groups=await request(actor,'/api/groups');assert.ok(groups.some(g=>g.id===a.group.id));assert.ok(!groups.some(g=>g.id===b.group.id));
      await request(actor,`/api/campaigns/${b.campaign.id}`,'GET',undefined,[403,404]);
      await request(actor,`/api/groups/${b.group.id}`,'PUT',{name:'Forbidden cross-tenant update'},[403,404]);
      const users=await request(actor,'/api/users');assert.ok(users.every(u=>u.organizationId===accounts.owner.organizationId));
    });
    await check('Employee sees published tenant content and no drafts/other tenant',async()=>{
      const list=await request('employee','/api/employee/articles');assert.ok(list.some(v=>v.id===a.article.id));assert.ok(!list.some(v=>v.id===a.draft.id||v.id===b.article.id));
      await request('employee',`/api/employee/articles/${a.draft.id}`,'GET',undefined,[404]);
      await request('employee',`/api/employee/articles/${b.article.id}`,'GET',undefined,[404]);
      await request('employee',`/api/employee/flashcard-decks/${b.deck.id}/cards`,'GET',undefined,[404]);
      const quizzes=await request('employee','/api/employee/quizzes');assert.ok(JSON.stringify(quizzes).includes(a.quiz.title));assert.ok(!JSON.stringify(quizzes).includes(b.quiz.title));
    });
    await check('Notifications exclude campaign management and private drafts for employees',async()=>{
      const list=(await request('employee','/api/notifications?limit=100')).notifications;
      assert.ok(list.some(n=>n.metadata?.articleId===a.article.id));assert.ok(list.some(n=>n.metadata?.deckId===a.deck.id));
      assert.ok(!list.some(n=>n.type==='campaign_created'||n.metadata?.articleId===a.draft.id));
      assert.ok(list.every(n=>!JSON.stringify(n).includes('QA Beta')));
    });
    await check('Assign and complete employee training, submit quiz',async()=>{
      await request('owner','/api/admin/training-assignments','POST',{userIds:[accounts.employee.id],moduleId:a.module.id,dueDays:7});
      await request('employee',`/api/employee/training/${a.module.id}/progress`,'POST',{progressPercentage:100,videoTimestamp:120,status:'completed'});
      const result=await request('employee',`/api/employee/quizzes/${a.quiz.id}/submit`,'POST',{answers:{[a.question.id]:'Yes'},startedAt:new Date(Date.now()-5000).toISOString()});assert.equal(result.score,100);
    });
  }
  await check('Disabled account cannot log in',async()=>{
    const u=await request('owner','/api/users','POST',{firstName:'QA',lastName:'Disabled',email:`qa.disabled.${Date.now()}@review.test`,password,isActive:false});
    await request('disabled','/api/login','POST',{email:u.email,password},[401]);await request('owner',`/api/users/${u.id}`,'DELETE');
  });
}finally{
  await db.end();
  writeFileSync('logs/role-review/accounts.json',JSON.stringify({password,accounts,fixtures:safe(data)},null,2));
  writeFileSync('logs/role-review/results.json',JSON.stringify({at:new Date().toISOString(),results,requests},null,2));
  console.log(JSON.stringify({passed:results.filter(r=>r.status==='PASS').length,failed:results.filter(r=>r.status==='FAIL').length}));
  process.exitCode=results.some(r=>r.status==='FAIL')?1:0;
}
