import { test, expect } from '@playwright/test';
import { readFileSync, appendFileSync, existsSync } from 'node:fs';
import {parse} from 'dotenv';
import pg from 'pg';

test.use({trace:'off', actionTimeout:10000});
test.setTimeout(30000);
const accountFile='logs/role-review/accounts.json';
const review=existsSync(accountFile)?JSON.parse(readFileSync(accountFile,'utf8')):null;
test.beforeEach(()=>test.skip(!review,'Run scripts/qa-role-review.mjs first'));
async function signIn(page:any, role:string, ui=false) {
  const {email}=review.accounts[role];
  if(!ui){expect((await page.request.post('/api/login',{data:{email,password:review.password}})).status()).toBe(200);return;}
  await page.goto('/auth');await page.getByLabel('Email',{exact:true}).fill(email);await page.getByLabel('Password',{exact:true}).fill(review.password);await page.getByLabel('Password',{exact:true}).press('Enter');
}
function record(name:string,input:unknown,status:number,output:unknown){appendFileSync('logs/role-review/browser-inputs.jsonl',JSON.stringify({at:new Date().toISOString(),name,input,status,output})+'\n');}
test.afterEach(async({page},info)=>{if(info.status!==info.expectedStatus)await page.screenshot({path:`logs/role-review/failure-${info.title.replace(/[^a-z0-9]/gi,'-').slice(0,100)}.png`,fullPage:true,timeout:5000}).catch(()=>{});});

// Every page the signed-in role can reach, as listed by the Ctrl+K palette.
async function reachablePages(page:any){await page.getByRole('button',{name:'Search or jump to a page',exact:true}).click();const list=page.getByRole('listbox',{name:'Pages',exact:true});await expect(list).toBeVisible();const names=await list.getByRole('option').evaluateAll((os:Element[])=>os.map(o=>o.firstElementChild?.textContent));await page.keyboard.press('Escape');await expect(list).toHaveCount(0);return names;}

for(const [role,path]of Object.entries({admin:'/',orgadmin:'/org-admin',manager:'/manager',employee:'/employee'}))test(`${role}: browser login and Dashboard first`,async({page})=>{
  await signIn(page,role,true);await expect(page).toHaveURL('http://localhost:5000'+path);
  const pages=await reachablePages(page);expect(pages[0]).toBe('Dashboard');
  if(role==='employee'){expect(pages).not.toContain('Campaigns');await page.goto('/org-admin');await expect(page).toHaveURL(/\/employee$/);}
  if(role==='manager'){expect(pages).not.toContain('SMTP Profiles');await page.goto('/admin/content/articles');await expect(page).toHaveURL(/\/manager$/);}
});

test('supplied admin logs in and can open the new content controls',async({page})=>{
  await page.goto('/auth');await page.getByLabel('Email',{exact:true}).fill('admin.1@audit.test');await page.getByLabel('Password',{exact:true}).fill('PhishNetAuditOnly2026!');await page.getByRole('button',{name:'Sign in',exact:true}).click();await expect(page).toHaveURL('http://localhost:5000/');
  await page.goto('/admin/content/videos');await page.getByRole('button',{name:'Add New Video',exact:true}).click();await expect(page.getByRole('dialog')).toBeVisible();
  await page.goto('/admin/content/mcqs');await page.getByRole('button',{name:'Add New MCQ',exact:true}).click();await expect(page.getByRole('dialog')).toContainText('Choose the quiz');
});

test('admin adds a video through Content Videos',async({page})=>{
  await signIn(page,'admin');await page.goto('/admin/content/videos');await page.getByRole('button',{name:'Add New Video',exact:true}).click();
  const title=`QA browser video ${Date.now()}`,dialog=page.getByRole('dialog');
  await dialog.locator('#title').fill(title);await dialog.locator('#description').fill('Persistent UI review video');await dialog.locator('#videoUrl').fill('https://example.com/qa-video.mp4');
  const pending=page.waitForResponse(r=>r.url().endsWith('/api/admin/training-modules')&&r.request().method()==='POST');await dialog.getByRole('button',{name:'Create Module',exact:true}).click();const response=await pending;
  const output=await response.json();record('Video create',{title,videoUrl:'https://example.com/qa-video.mp4'},response.status(),output);expect(response.status()).toBe(201);
  await expect(dialog).not.toBeVisible();await expect(page.getByText(title,{exact:true})).toBeVisible();
});

test('admin creates a quiz then adds a working MCQ through Content MCQs',async({page})=>{
  await signIn(page,'admin');await page.goto('/admin/content/mcqs');await page.getByRole('button',{name:'Create Quiz',exact:true}).click();
  let dialog=page.getByRole('dialog');const title=`QA browser quiz ${Date.now()}`;
  await dialog.getByPlaceholder('e.g., Phishing Awareness Quiz').fill(title);await dialog.getByPlaceholder('What this quiz covers...').fill('Persistent QA quiz');
  const pending=page.waitForResponse(r=>r.url().endsWith('/api/admin/quizzes')&&r.request().method()==='POST');await dialog.getByRole('button',{name:'Create Quiz',exact:true}).click();const created=await pending;const output=await created.json();record('Quiz create',{title},created.status(),output);expect(created.status()).toBe(201);
  await expect(dialog).not.toBeVisible();await page.getByRole('button',{name:'Add New MCQ',exact:true}).click();dialog=page.getByRole('dialog');await dialog.getByLabel('Quiz',{exact:true}).selectOption(String(output.quiz.id));await dialog.getByRole('button',{name:'Continue',exact:true}).click();
  dialog=page.getByRole('dialog');await dialog.getByPlaceholder('Enter your question...').fill('QA browser: should you report suspicious mail?');
  await dialog.getByPlaceholder('Option 1',{exact:true}).pressSequentially('Yes');await dialog.getByPlaceholder('Option 2',{exact:true}).pressSequentially('No');await expect(dialog.getByPlaceholder('Option 1',{exact:true})).toHaveValue('Yes');
  await dialog.getByText('Select correct option',{exact:true}).click();await page.getByRole('option',{name:'Yes',exact:true}).click();
  const question=page.waitForResponse(r=>r.url().endsWith(`/api/admin/quizzes/${output.quiz.id}/questions`)&&r.request().method()==='POST');await dialog.getByRole('button',{name:'Add Question',exact:true}).click();const response=await question;record('MCQ create',{questionText:'QA browser: should you report suspicious mail?',options:['Yes','No'],correctAnswer:'Yes'},response.status(),await response.json());expect(response.status()).toBe(201);
  await expect(dialog).not.toBeVisible();await expect(page.getByText('QA browser: should you report suspicious mail?',{exact:true})).toBeVisible();await expect(page.getByRole('main')).toBeVisible();
});

test('organization admin previews a draft article without publishing',async({page})=>{
  await signIn(page,'orgadmin');const article=review.fixtures.owner.draft;await page.goto(`/admin/content/articles?preview=${article.id}`);
  await expect(page.getByRole('dialog')).toContainText(article.title);await expect(page.frameLocator('iframe[title="Article preview"]').getByText('Draft must be hidden from employees.')).toBeVisible();
});

for(const [type,role]of [['campaign','owner'],['article','owner'],['flashcard','owner'],['article','employee'],['flashcard','employee']] as const)test(`${role}: bell opens the actual ${type} destination`,async({page})=>{
  await signIn(page,role);await page.goto(role==='employee'?'/employee':'/org-admin');
  const notifications=(await (await page.request.get('/api/notifications?limit=100')).json()).notifications;
  let n=notifications.find((n:any)=>type==='campaign'?(n.type==='campaign_created'&&(n.metadata?.campaignId===review.fixtures.owner.campaign.id||n.actionUrl?.endsWith(`campaign=${review.fixtures.owner.campaign.id}`))):n.type===type&&(type==='article'?n.metadata?.articleId===review.fixtures.owner.article.id:n.metadata?.deckId===review.fixtures.owner.deck.id));expect(n).toBeTruthy();
  let database:pg.Client|undefined,notificationId:number|undefined;
  if(type==='campaign'){
    const env=parse(readFileSync('.env.audit'));if(new URL(env.CONTROL_DATABASE_URL).pathname!=='/phishnet_audit'||env.MAIL_TRANSPORT!=='sink')throw new Error('Requires audit sink');
    database=new pg.Client({connectionString:env.CONTROL_DATABASE_URL});await database.connect();const title='QA current campaign notification '+Date.now();const fresh=await database.query('INSERT INTO notifications(user_id,organization_id,type,title,message,priority,action_url,metadata) VALUES($1,$2,$3,$4,$5,$6,$7,$8) RETURNING id',[review.accounts[role].id,review.accounts[role].organizationId,n.type,title,n.message,n.priority,n.actionUrl,JSON.stringify(n.metadata)]);notificationId=fresh.rows[0].id;n={...n,id:notificationId,title};await page.reload();
  }
  try {
  await page.getByRole('button',{name:'Notifications',exact:true}).click();await page.getByRole('button',{name:`Notification: ${n.title}`,exact:true}).first().click();
  await expect(page).toHaveURL('http://localhost:5000'+n.actionUrl);
  if(type==='campaign')await expect(page.getByRole('dialog')).toContainText(review.fixtures.owner.campaign.name);
  if(type==='article'&&role==='owner'){await expect(page.getByRole('dialog')).toContainText(review.fixtures.owner.article.title);await expect(page.frameLocator('iframe[title="Article preview"]').getByText('QA Alpha preview content')).toBeVisible();}
  if(type==='article'&&role==='employee')await expect(page.getByText('QA Alpha preview content',{exact:true})).toBeVisible();
  if(type==='flashcard'){await expect(page.getByText('QA prompt',{exact:true})).toBeVisible();await expect(page.getByRole('main')).toBeVisible();}
  } finally {if(database){if(notificationId)await database.query('DELETE FROM notifications WHERE id=$1',[notificationId]);await database.end();}}
});

test('notification listing uses the same working article preview destination',async({page})=>{
  await signIn(page,'owner');await page.goto('/notifications');const r=await page.request.get('/api/notifications?limit=100');const n=(await r.json()).notifications.find((n:any)=>n.type==='article'&&n.metadata?.articleId===review.fixtures.owner.article.id);
  await page.getByRole('button').filter({hasText:n.message}).first().click();await expect(page.getByRole('dialog')).toContainText(review.fixtures.owner.article.title);
});

test('OrgAdmin can create an employee through Users and immediately see it',async({page})=>{
  await signIn(page,'orgadmin');await page.goto('/org-admin/users');await page.getByRole('button',{name:'Add User',exact:true}).click();const dialog=page.getByRole('dialog'),email=`qa.browser.${Date.now()}@review.test`;
  for(const [name,value]of Object.entries({'First Name':'QA','Last Name':'Browser employee','Email':email,'Password':review.password}))await dialog.getByLabel(name,{exact:true}).fill(value);
  await dialog.getByRole('combobox').click();await expect(page.getByRole('option',{name:'Admin',exact:true})).toHaveCount(0);await page.getByRole('option',{name:'User',exact:true}).click();
  const pending=page.waitForResponse(r=>r.url().endsWith('/api/users')&&r.request().method()==='POST');await dialog.getByRole('button',{name:'Create User',exact:true}).click();const r=await pending;record('OrgAdmin creates User',{email,role:'User'},r.status(),await r.json());expect(r.status()).toBe(201);await expect(dialog).not.toBeVisible();await expect(page.getByText(email,{exact:true})).toBeVisible();
});

for(const type of ['campaign','article','flashcard'])test(`global Admin bell opens its own ${type} notification`,async({page})=>{
  await signIn(page,'admin');const name=`QA admin ${type} ${Date.now()}`;
  const create=async(path:string,body:any)=>{const r=await page.request.post(path,{data:body});expect(r.status()).toBe(201);return r.json();};
  let id:number,fixture:any;
  if(type==='campaign'){
    const group=await create('/api/groups',{name:name+' audience'});
    const smtp=await create('/api/smtp-profiles',{name:name+' sender',host:'localhost',port:1025,username:'qa',password:'SyntheticOnly123!',fromEmail:'qa@review.test',fromName:'QA'});
    const template=await create('/api/email-templates',{name:name+' template',subject:'QA',htmlContent:'<p>QA</p>',senderName:'QA',senderEmail:'qa@review.test'});
    const landing=await create('/api/landing-pages',{name:name+' landing',htmlContent:'<h1>QA</h1>'});
    const campaign=await create('/api/campaigns',{name,targetGroupId:group.id,smtpProfileId:smtp.id,emailTemplateId:template.id,landingPageId:landing.id});id=campaign.id;fixture={group,smtp,template,landing,campaign};
  }else if(type==='article'){
    fixture=(await create('/api/admin/articles',{title:name,category:'phishing',content:'<h2>QA admin notification preview</h2>',published:true})).article;id=fixture.id;
  }else{
    fixture=(await create('/api/admin/flashcard-decks',{title:name,category:'phishing'})).deck;id=fixture.id;
    await create(`/api/admin/flashcard-decks/${id}/cards`,{frontContent:'QA admin notification prompt',backContent:'QA admin notification answer'});
    expect((await page.request.patch(`/api/admin/flashcard-decks/${id}/publish`,{data:{published:true}})).status()).toBe(200);
  }
  record(`Global Admin ${type} notification fixture`,{name},201,fixture);
  const notifications=(await (await page.request.get('/api/notifications?limit=100')).json()).notifications;
  const n=notifications.find((n:any)=>type==='campaign'?n.actionUrl===`/campaigns?campaign=${id}`:n.type===type&&(type==='article'?n.metadata?.articleId===id:n.metadata?.deckId===id));expect(n).toBeTruthy();
  await page.goto('/');await page.getByRole('button',{name:'Notifications',exact:true}).click();await page.getByRole('button',{name:`Notification: ${n.title}`,exact:true}).first().click();
  await expect(page).toHaveURL('http://localhost:5000'+n.actionUrl);
  if(type==='campaign')await expect(page.getByRole('dialog')).toContainText(name);
  if(type==='article')await expect(page.frameLocator('iframe[title="Article preview"]').getByText('QA admin notification preview')).toBeVisible();
  if(type==='flashcard')await expect(page.getByText('QA admin notification prompt',{exact:true})).toBeVisible();
});
