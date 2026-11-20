import {test,expect} from '@playwright/test';
import {readFileSync,writeFileSync} from 'node:fs';
import {parse} from 'dotenv';
import pg from 'pg';
const review=JSON.parse(readFileSync('logs/role-review/accounts.json','utf8'));
const baseline=JSON.parse(readFileSync('logs/product-maturity/baseline.json','utf8'));
test.use({trace:'off',actionTimeout:10000,userAgent:'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/130.0.0.0 Safari/537.36'});
async function login(context:any,actor:string,base='http://localhost:5000'){
 const response=await context.request.post(base+'/api/login',{data:{email:review.accounts[actor].email,password:review.password}});expect(response.status()).toBe(200);
}
test('all previously recorded QA data remains present and manager scope is enforced',async({page})=>{
 const db=new pg.Client({connectionString:parse(readFileSync('.env.audit')).CONTROL_DATABASE_URL});await db.connect();
 try{
  for(const [table,ids]of Object.entries(baseline.tables)){
   const result=await db.query(`SELECT id FROM ${table} WHERE id=ANY($1::integer[])`,[ids]);expect(result.rowCount,table+' persistent IDs').toBe((ids as number[]).length);
  }
  await login(page.context(),'manager');
  expect((await page.request.get('/api/dashboard/overview?days=0')).status()).toBe(403);
  const response=await page.request.get('/api/manager/overview');expect(response.status()).toBe(200);
  await page.goto('/manager');await expect(page.getByRole('heading',{name:'Manager dashboard',exact:true})).toBeVisible();
  await expect(page.getByText('QA Beta campaign',{exact:true})).toHaveCount(0);
  expect((await page.request.get('/api/manager/export')).status()).toBe(200);
  writeFileSync('logs/product-maturity/preservation.json',JSON.stringify({tablesChecked:Object.keys(baseline.tables),allBaselineIdsPresent:true,managerScopeEnforced:true,checkedAt:new Date().toISOString()},null,2));
 }finally{await db.end();}
});
test('icon actions have a hover and keyboard tooltip without firing the action',async({page})=>{
 await login(page.context(),'owner');await page.goto('/org-admin/groups');const button=page.getByRole('button',{name:'Delete',exact:true}).first();await expect(button).toBeVisible();
 await button.hover();await expect(page.getByRole('tooltip')).toHaveText('Delete');await page.keyboard.press('Escape');await expect(page.getByRole('tooltip')).toHaveCount(0);
 await page.mouse.move(0,0);await button.focus();await expect(page.getByRole('tooltip')).toHaveText('Delete');await expect(page.getByRole('alertdialog')).toHaveCount(0);
 await page.screenshot({path:'logs/product-maturity/tooltip.png',fullPage:true});
});
test('local delivery, recipient actions, signed landing page, reports and tenant isolation work over the LAN URL',async({browser})=>{
 test.setTimeout(90000);
 const operator=await browser.newContext({baseURL:'http://localhost:5000'});await login(operator,'owner');
 const status=await(await operator.request.get('/api/lab/status')).json();expect(status.enabled).toBe(true);expect(status.outboundEmail).toBe(false);
 const lan=status.baseUrl;
 const employee=await browser.newContext({baseURL:lan,userAgent:'Mozilla/5.0 Chrome/130.0.0.0 Safari/537.36'});await login(employee,'employee',lan);
 const beta=await browser.newContext({baseURL:lan});await login(beta,'betaemployee',lan);
 const op=await operator.newPage(),recipient=await employee.newPage();const name='QA local outcome proof '+Date.now();
 try{
  await op.goto('/local-inbox');await op.getByLabel('Campaign name',{exact:true}).fill(name);
  await op.getByLabel(review.accounts.employee.email,{exact:true}).check();await op.getByLabel(review.accounts.owner.email,{exact:true}).check();
  const queued=op.waitForResponse(r=>r.url().endsWith('/api/lab/campaigns')&&r.request().method()==='POST');await op.getByRole('button',{name:'Send local simulation',exact:true}).click();const response=await queued;expect(response.status()).toBe(202);const campaign=await response.json();
  let inbox:any[]=[];
  await expect.poll(async()=>{inbox=(await(await operator.request.get('/api/lab/messages')).json()).filter((m:any)=>m.campaign_id===campaign.campaignId);return inbox.filter(m=>m.delivery_accepted).length;},{timeout:30000}).toBe(2);
  const target=inbox.find(m=>m.recipient_email===review.accounts.employee.email),own=inbox.find(m=>m.recipient_email===review.accounts.owner.email);
  expect((await operator.request.post(`/api/lab/messages/${target.id}/open`)).status()).toBe(403);
  expect((await beta.request.get(`/api/lab/messages/${target.id}`)).status()).toBe(404);
  const betaList=await(await beta.request.get('/api/lab/messages')).json();expect(betaList.some((m:any)=>m.campaign_id===campaign.campaignId)).toBe(false);
  expect((await employee.request.get('/api/lab/recipients')).status()).toBe(403);
  expect((await employee.request.post('/api/lab/campaigns',{data:{name:'Forbidden',userIds:[review.accounts.employee.id]}})).status()).toBe(403);
  const before=await(await operator.request.get(`/api/campaigns/${campaign.campaignId}/results`)).json();expect(before.every((r:any)=>!r.opened&&!r.clicked&&!r.reported)).toBe(true);
  await recipient.goto(lan+'/local-inbox');await recipient.getByRole('button').filter({hasText:name}).filter({hasText:review.accounts.employee.email}).click();
  await recipient.getByRole('button',{name:'Open message (record read)',exact:true}).click();await expect(recipient.getByRole('status')).toContainText('Opening recorded');
  const download=recipient.waitForEvent('download');await recipient.getByRole('link',{name:'Download harmless attachment',exact:true}).click();expect((await download).suggestedFilename()).toBe('phishnet-training.txt');
  const popup=recipient.waitForEvent('popup');await recipient.getByRole('link',{name:'Open simulation link',exact:true}).click();const landing=await popup;await expect(landing.getByRole('heading',{name:'PhishNet training notice'})).toBeVisible();
  await landing.getByLabel('Training code',{exact:false}).fill('DEMO');await landing.getByRole('button',{name:'Complete simulation',exact:true}).click();await expect(landing.getByRole('heading',{name:'Simulation complete'})).toBeVisible();
  await op.getByRole('button').filter({hasText:name}).filter({hasText:review.accounts.owner.email}).click();await op.getByRole('button',{name:'Report suspicious',exact:true}).click();await expect(op.getByRole('status')).toContainText('Thank you');
  await operator.request.post(`/api/lab/messages/${own.id}/report`);
  const result=await(await operator.request.get(`/api/campaigns/${campaign.campaignId}/results`)).json();expect(result.filter((r:any)=>r.sent).length).toBe(2);expect(result.filter((r:any)=>r.opened).length).toBe(1);expect(result.filter((r:any)=>r.clicked).length).toBe(1);expect(result.filter((r:any)=>r.submitted).length).toBe(1);expect(result.filter((r:any)=>r.reported).length).toBe(1);
  const overview=await(await operator.request.get('/api/dashboard/overview?days=0&dataset=all')).json();expect(overview.signals.sent).toBeGreaterThanOrEqual(2);expect(overview.signals.reported).toBeGreaterThanOrEqual(1);
  await op.goto(`/org-admin/campaigns?campaign=${campaign.campaignId}`);await expect(op.getByTestId('campaign-reported')).toHaveText('1');
  const report=await(await operator.request.get('/api/reports/data')).json();expect(report.summary.reportedCount).toBeGreaterThanOrEqual(1);
  await op.screenshot({path:'logs/product-maturity/local-campaign-results.png',fullPage:true});
  writeFileSync('logs/product-maturity/local-outcome-proof.json',JSON.stringify({at:new Date().toISOString(),lanUrl:lan,campaign,recipientMessages:inbox.map(m=>({id:m.id,email:m.recipient_email})),observed:{sent:2,opened:1,clicked:1,submitted:1,reported:1,harmlessAttachmentDownloaded:true},overview:overview.signals,reportSummary:report.summary,scopeIsolation:true},null,2));
 }finally{await operator.close();await employee.close();await beta.close();}
});
