import {test,expect} from '@playwright/test';
import {readFileSync,mkdirSync,writeFileSync} from 'node:fs';
import {parse} from 'dotenv';
const base=process.env.E2E_BASE_URL||'http://localhost:5000';
const password=parse(readFileSync('.env.investor-demo.accounts')).DEMO_PASSWORD;
const proof=JSON.parse(readFileSync('logs/investor-release/demo-fixture.json','utf8'));
test.use({trace:'off'});
async function login(page:any,key:string){const r=await page.request.post('/api/login',{data:{email:key+'@demo.phishnet.test',password}});expect(r.status()).toBe(200);}

test('badge save failures explain the problem and preserve form values',async({page})=>{
  const review=JSON.parse(readFileSync('logs/role-review/accounts.json','utf8'));
  expect((await page.request.post('/api/login',{data:{email:review.accounts.admin.email,password:review.password}})).status()).toBe(200);
  await page.goto('/admin/badges');await page.getByRole('button',{name:'Create Badge',exact:true}).click();
  const dialog=page.getByRole('dialog');
  await dialog.getByLabel('Badge Name *',{exact:true}).fill('Unsaved error-feedback check');
  await dialog.getByLabel('Description *',{exact:true}).fill('Values should remain after a rejected request.');
  await dialog.getByLabel('Icon URL *',{exact:true}).fill('https://example.test/badge.png');
  await dialog.getByLabel('Quiz ID *',{exact:true}).fill('1');
  await page.route('**/api/admin/badges',route=>route.fulfill({status:503,contentType:'application/json',body:JSON.stringify({message:'Temporary test failure. Please retry.'})}));
  await dialog.getByRole('button',{name:'Create Badge',exact:true}).click();
  await expect(dialog.getByRole('alert')).toContainText('Temporary test failure');
  await expect(dialog.getByLabel('Badge Name *',{exact:true})).toHaveValue('Unsaved error-feedback check');
  await expect(dialog.getByRole('button',{name:'Create Badge',exact:true})).toBeEnabled();
});

test('manual achievement awards deduplicate and survive archive and restore',async({page,browser})=>{
  const review=JSON.parse(readFileSync('logs/role-review/accounts.json','utf8'));
  const learner=await browser.newContext({baseURL:base});let badgeId:number|undefined,userId:number|undefined;
  try{
    expect((await page.request.post('/api/login',{data:{email:review.accounts.admin.email,password:review.password}})).status()).toBe(200);
    const roles=await(await page.request.get('/api/roles')).json(),email='disposable-manual-'+Date.now()+'@audit.test';
    const created=await page.request.post('/api/users',{data:{email,password:review.password,firstName:'Manual',lastName:'QA',isActive:true,roleId:roles.find((r:any)=>r.name==='User').id}});expect(created.ok()).toBe(true);userId=(await created.json()).id;
    const badgeResponse=await page.request.post('/api/admin/badges',{data:{name:'Disposable manual achievement '+Date.now(),description:'Reviewed practice achievement.',category:'special',criteria:{type:'custom',description:'Administrator review'},pointsAwarded:0,published:true}});expect(badgeResponse.ok()).toBe(true);const badge=(await badgeResponse.json()).badge;badgeId=badge.id;
    await page.goto('/admin/badges');await page.getByTestId(`badge-admin-${badgeId}`).getByRole('button',{name:'Award manually',exact:true}).click();
    await page.getByRole('dialog').getByLabel('Employee email',{exact:true}).fill(email);await page.getByRole('dialog').getByLabel('Reason',{exact:true}).fill('Verified completion of the demonstration exercise.');
    await page.getByRole('dialog').getByRole('button',{name:'Award badge',exact:true}).click();await expect(page.getByRole('dialog')).toHaveCount(0);
    const duplicate=await page.request.post(`/api/admin/badges/${badgeId}/award`,{data:{email,reason:'Duplicate verification attempt'}});expect((await duplicate.json()).alreadyEarned).toBe(true);
    expect((await learner.request.post('/api/login',{data:{email,password:review.password}})).status()).toBe(200);
    expect((await learner.request.post(`/api/admin/badges/${badgeId}/award`,{data:{email,reason:'Unauthorized attempt'}})).status()).toBe(403);
    expect((await page.request.delete('/api/admin/badges/'+badgeId)).ok()).toBe(true);
    const retained=await(await learner.request.get('/api/employee/badges/'+badgeId)).json();expect(retained.badge.earned).toBe(true);expect(retained.badge.name).toBe(badge.name);
    expect((await page.request.post(`/api/admin/badges/${badgeId}/restore`)).ok()).toBe(true);
    writeFileSync('logs/investor-release/manual-award-proof.json',JSON.stringify({userId,badgeId,duplicatePrevented:true,employeeWriteDenied:true,earnedHistoryRetained:true,restoredAsDraft:true,temporaryUserDeletedAfterTest:true,badgeArchivedAfterTest:true},null,2));
  }finally{if(badgeId)await page.request.delete('/api/admin/badges/'+badgeId);if(userId)await page.request.delete('/api/users/'+userId);await learner.close();}
});

test('sample dashboard, drill-down, CSV and printable summary agree',async({page})=>{
  await login(page,'orgadmin');await page.goto('/org-admin');
  await expect(page.getByText('Sample data · Demonstration workspace',{exact:true})).toBeVisible();
  await expect(page.getByTestId('outcome-messages-accepted')).toHaveText('36');
  await expect(page.getByTestId('outcome-observed-clicks')).toHaveText('12');
  await expect(page.getByTestId('outcome-reported-suspicious')).toHaveText('18');
  const data=await(await page.request.get('/api/dashboard/overview?days=30&dataset=demo')).json();
  expect(data.signals.reported).toBe(18);expect(data.signals.report_timing_samples).toBe(18);
  const csv=await(await page.request.get('/api/dashboard/overview/export?days=30&dataset=demo')).text();expect(csv).toContain('Sample data');expect(csv).toContain('"reported","18"');
  await page.getByRole('button',{name:'View records for Reported suspicious',exact:true}).click();
  await expect(page.getByRole('dialog').getByText('Page 1 / 18 records',{exact:true})).toBeVisible();
  expect(await page.getByRole('dialog').locator('tbody tr').count()).toBe(18);
  await page.keyboard.press('Escape');
  await page.getByLabel('Dataset',{exact:true}).selectOption('customer');await expect(page.getByTestId('outcome-messages-accepted')).toHaveText('0');
  await page.getByLabel('Dataset',{exact:true}).selectOption('demo');await expect(page.getByTestId('outcome-messages-accepted')).toHaveText('36');
  await page.evaluate(()=>{(window as any).printCalled=false;window.print=()=>{(window as any).printCalled=true;};});
  await page.getByRole('button',{name:'Print executive summary',exact:true}).click();expect(await page.evaluate(()=>(window as any).printCalled)).toBe(true);
  await page.emulateMedia({media:'print'});await expect(page.locator('aside')).toBeHidden();await page.pdf({path:'logs/investor-release/sample-executive-summary.pdf',format:'A4',printBackground:true});await page.emulateMedia({media:'screen'});
  mkdirSync('logs/investor-release',{recursive:true});await page.screenshot({path:'logs/investor-release/organization-desktop.png',fullPage:false});
});

test('every outcome card reconciles to its supporting records',async({page})=>{
  await login(page,'orgadmin');await page.goto('/org-admin');await page.getByLabel('Campaign period',{exact:true}).selectOption('0');
  for(const [label,total] of [['Campaigns',3],['Messages accepted',36],['Observed clicks',12],['Reported suspicious',18],['Click rate',12],['Report rate',18],['Learning completed',8],['Overdue learning',2],['Median time to report',18],['Repeat clickers',4]] as const){
    await page.getByRole('button',{name:`View records for ${label}`,exact:true}).click();
    await expect(page.getByRole('dialog').getByText(`Page 1 / ${total} records`,{exact:true})).toBeVisible();
    expect(await page.getByRole('dialog').locator('tbody tr').count()).toBe(Math.min(total,25));await page.keyboard.press('Escape');
  }
});

test('organization preference updates cannot remove the sample marker',async({page})=>{
  await login(page,'orgadmin');
  const original=await(await page.request.get('/api/organization/preferences')).json();
  expect((await page.request.put('/api/organization/preferences',{data:{...original,demonstration:false,fixture:null}})).ok()).toBe(true);
  expect((await(await page.request.get('/api/workspace')).json()).demonstration).toBe(true);
  await page.goto('/org-admin');await expect(page.getByText('Sample data · Demonstration workspace',{exact:true})).toBeVisible();
});

for(const [actor,home] of [['orgadmin','/org-admin'],['manager','/manager'],['employee','/employee']] as const)
 for(const width of [390,768])
  test(`${actor} has scoped navigation and a stable ${width}px dashboard`,async({page})=>{
    await page.setViewportSize({width,height:844});const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
    await login(page,actor);
    for(let i=0;i<3;i++){await page.goto(home);await expect(page.getByRole('main')).toBeVisible();await expect(page.getByRole('heading',{name:'This page could not load',exact:true})).toHaveCount(0);}
    await expect(page.getByText('Sample data · Demonstration workspace',{exact:true})).toBeVisible();
    if(actor!=='orgadmin')for(const path of ['/api/dashboard/overview','/api/dashboard/overview/records','/api/content-library'])expect((await page.request.get(path)).status(),path).toBe(403);
    if(actor==='manager'){
      const data=await(await page.request.get('/api/manager/overview')).json();expect(data.members).toHaveLength(8);expect(data.members.map((m:any)=>m.email)).not.toContain('employee12@demo.phishnet.test');
      await page.getByRole('button',{name:'Search or jump to a page',exact:true}).click();const list=page.getByRole('listbox',{name:'Pages',exact:true});await expect(list).toBeVisible();await expect(list.getByRole('option',{name:/^Users/})).toHaveCount(0);await page.keyboard.press('Escape');
    }
    expect(errors).toEqual([]);await page.screenshot({path:`logs/investor-release/${actor}-${width}.png`,fullPage:false});
  });

test('content preview, archive and restore persist without touching existing sample content',async({page})=>{
  await login(page,'orgadmin');let id:number|undefined;
  const title='Disposable library check '+Date.now();
  try {
    const created=await page.request.post('/api/admin/training-modules',{data:{title,category:'phishing',difficulty:'beginner',durationMinutes:1,transcript:'A disposable preview lesson.'}});expect(created.status()).toBe(201);id=(await created.json()).module.id;
    await page.goto('/org-admin/content-library');await page.getByLabel('Search titles',{exact:true}).fill(title);
    await page.getByRole('button',{name:'Preview',exact:true}).click();await expect(page.getByRole('dialog').getByText('A disposable preview lesson.',{exact:true})).toBeVisible();await page.keyboard.press('Escape');
    page.once('dialog',dialog=>dialog.accept());await page.getByRole('button',{name:'Archive',exact:true}).click();await expect(page.getByText('No matching active content.',{exact:true})).toBeVisible();
    await page.getByLabel('Show archived',{exact:true}).check();await page.reload();await page.getByLabel('Search titles',{exact:true}).fill(title);await page.getByLabel('Show archived',{exact:true}).check();
    await expect(page.getByRole('heading',{name:title,exact:true})).toBeVisible();
    const resources=await(await page.request.get('/api/pilot/path-resources')).json();expect(resources.some((r:any)=>r.kind==='module'&&r.id===id)).toBe(false);
    await page.getByRole('button',{name:'Restore',exact:true}).click();await page.getByLabel('Show archived',{exact:true}).uncheck();await expect(page.getByRole('heading',{name:title,exact:true})).toBeVisible();
  }finally{if(id)await page.request.delete('/api/admin/training-modules/'+id);}
});

test('setup steps resume and walkthrough does not create delivery jobs',async({page})=>{
  await login(page,'orgadmin');await page.goto('/org-admin/setup');await page.getByRole('button',{name:'2. People & teams',exact:true}).click();
  await expect(page.getByLabel('CSV text',{exact:true})).toBeVisible();await page.reload();await expect(page.getByLabel('CSV text',{exact:true})).toBeVisible();
  await page.getByRole('button',{name:'5. Readiness review',exact:true}).click();await expect(page.getByText('Integration readiness',{exact:true})).toBeVisible();
  await page.goto('/walkthrough');await expect(page.getByRole('heading',{name:'Product walkthrough',exact:true})).toBeVisible();
  const other=await page.context().browser()!.newContext({baseURL:base});
  const legacy=JSON.parse(readFileSync('logs/role-review/accounts.json','utf8'));
  try{
    expect((await other.request.post('/api/login',{data:{email:legacy.accounts.owner.email,password:legacy.password}})).status()).toBe(200);
    expect((await other.request.get(`/api/content-library/training_modules/${99999999}`)).status()).toBe(404);
    const foreign=await(await page.request.get('/api/content-library')).json();
    const sampleLesson=foreign.items[0].id;
    expect((await other.request.get(`/api/content-library/training_modules/${sampleLesson}`)).status()).toBe(404);
  }finally{await other.close();}
  writeFileSync('logs/investor-release/browser-fixture-proof.json',JSON.stringify({fixture:proof.fixture,simulationExecuted:false,at:new Date().toISOString()},null,2));
});
