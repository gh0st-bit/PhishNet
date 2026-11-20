import {test,expect} from '@playwright/test';
import {readFileSync,appendFileSync} from 'node:fs';
import {parse} from 'dotenv';
import pg from 'pg';
const review=JSON.parse(readFileSync('logs/role-review/accounts.json','utf8')),env=parse(readFileSync('.env.audit'));
if(new URL(env.CONTROL_DATABASE_URL).pathname!=='/phishnet_audit'||env.MAIL_TRANSPORT!=='sink')throw new Error('Requires audit sink');
test.use({trace:'off',actionTimeout:10000});test.setTimeout(60000);
for(const role of ['Admin','OrgAdmin','Manager','User'])test(`${role}: own notifications refresh, open, mark-all, delete and every preference toggle persist`,async({page,browser})=>{
 const admin=await browser.newContext();let id:number|undefined;const db=new pg.Client({connectionString:env.CONTROL_DATABASE_URL});await db.connect();
 async function action(path:string,method:string,fn:()=>Promise<any>){const pending=page.waitForResponse(r=>new URL(r.url()).pathname===path&&r.request().method()===method);await fn();const response=await pending;expect(response.ok()).toBe(true);if(path==='/api/notifications/preferences'){const saved=await(await page.request.get(path)).json();for(const [key,value]of Object.entries(response.request().postDataJSON())){const snake=key.replace(/[A-Z]/g,(letter:string)=>'_'+letter.toLowerCase());expect(saved[key]??saved[snake],key).toBe(value);}}appendFileSync('logs/button-audit/write-workflows.jsonl',JSON.stringify({at:new Date().toISOString(),test:test.info().title,path,method,status:response.status()})+'\n');}
 try{
  await admin.request.post('/api/login',{data:{email:review.accounts.admin.email,password:review.password}});const roles=await(await admin.request.get('/api/roles')).json();const email='button-notifications-'+role.toLowerCase()+'-'+Date.now()+'@audit.test';const created=await admin.request.post('/api/users',{data:{firstName:'Button',lastName:role,email,password:review.password,roleId:roles.find((r:any)=>r.name===role).id,isActive:true}});expect(created.status()).toBe(201);const user=await created.json();id=user.id;
  const notices=await db.query("INSERT INTO notifications(user_id,organization_id,type,title,message,priority,action_url) SELECT $1,$2,'password_changed','Button notice '||n,'Disposable QA event','low','/settings' FROM generate_series(1,3) n RETURNING id",[id,user.organizationId]);
  expect((await page.request.post('/api/login',{data:{email,password:review.password}})).status()).toBe(200);await page.goto('/notifications');await page.getByRole('button',{name:'Refresh notifications',exact:true}).click();await expect(page.getByText('Recent Notifications (3)',{exact:true})).toBeVisible();await page.getByRole('button').filter({hasText:'Button notice 1'}).click();await expect(page).toHaveURL(/\/settings$/);await page.goto('/notifications');await action('/api/notifications/mark-all-read','PUT',()=>page.getByRole('button',{name:'Mark All Read',exact:true}).click());await expect(page.getByRole('button',{name:'Mark All Read',exact:true})).toHaveCount(0);
  await action('/api/notifications/'+notices.rows[0].id,'DELETE',()=>page.locator('div.py-4').filter({hasText:'Button notice 1'}).getByRole('button',{name:'Delete notification',exact:true}).click());await expect(page.getByText('Recent Notifications (2)',{exact:true})).toBeVisible();
  await page.goto('/settings');await page.getByRole('tab',{name:'Notifications',exact:true}).click();
  for(const tab of ['Dashboard Notifications','Email Notifications']){
   await page.getByRole('tab',{name:tab,exact:true}).click();await expect(page.getByRole('button',{name:'Refresh Settings',exact:true})).toBeVisible();await page.getByRole('button',{name:'Refresh Settings',exact:true}).click();await expect(page.getByRole('switch').first()).toBeEnabled();const count=await page.getByRole('switch').count();
   for(let index=0;index<count;index++){const toggle=page.getByRole('switch').nth(index);if(await toggle.isDisabled())continue;const old=await toggle.isChecked();await action('/api/notifications/preferences','PUT',()=>toggle.click());await expect(toggle).toBeChecked({checked:!old});await action('/api/notifications/preferences','PUT',()=>toggle.click());await expect(toggle).toBeChecked({checked:old});}
   await page.reload();await page.getByRole('tab',{name:'Notifications',exact:true}).click();
  }
 }finally{if(id)await admin.request.delete('/api/users/'+id);await db.end();await admin.close();}
});
