import { test, expect } from '@playwright/test';
import { readFileSync,appendFileSync,mkdirSync } from 'node:fs';
const review=JSON.parse(readFileSync('logs/role-review/accounts.json','utf8'));
test.use({trace:'off',actionTimeout:10000,navigationTimeout:15000});
test.setTimeout(60000);
mkdirSync('logs/button-audit',{recursive:true});
async function login(page:any,actor:string){expect((await page.request.post('/api/login',{data:{email:review.accounts[actor].email,password:review.password}})).status()).toBe(200);}
async function mutation(page:any,path:string,method:string,action:()=>Promise<any>){const pending=page.waitForResponse((r:any)=>new URL(r.url()).pathname===path&&r.request().method()===method);await action();const r=await pending;const body=method!=='POST' ? null : path==='/api/reports/schedules' ? (await(await page.request.get(path)).json()).find((v:any)=>v.recipients===r.request().postDataJSON().recipients) : await r.json().catch(()=>null);appendFileSync('logs/button-audit/write-workflows.jsonl',JSON.stringify({at:new Date().toISOString(),test:test.info().title,path,method,status:r.status(),resourceId:body?.id||body?.schedule?.id})+'\n');expect(r.ok(),JSON.stringify(body)).toBe(true);return body;}
async function select(page:any,label:string,option:string){await page.getByLabel(label,{exact:false}).click();await page.getByRole('option',{name:option,exact:true}).click();}
for(const actor of ['admin','owner','manager','employee'])test(`${actor}: shared header routes and logout work`,async({page})=>{
 await login(page,actor);const home=actor==='admin'?'/':actor==='owner'?'/org-admin':actor==='manager'?'/manager':'/employee';await page.goto(home);if(actor==='admin'){await page.goto('/manager');await expect(page).toHaveURL('http://localhost:5000/');}
 const menu=()=>page.locator('header button[aria-haspopup="menu"]').first();await menu().click();await expect(page.getByRole('menu')).toBeVisible();
 if(actor==='admin'||actor==='owner'){await page.getByRole('menuitem',{name:'Organization',exact:true}).click();await expect(page).toHaveURL(new RegExp((actor==='admin'?'/organization':'/org-admin/settings')+'$'));}
 else{await expect(page.getByRole('menuitem',{name:'Organization',exact:true})).toHaveCount(0);await page.keyboard.press('Escape');await expect(page.getByRole('menu')).toHaveCount(0);}
 await menu().click();await page.getByRole('menuitem',{name:'Profile',exact:true}).click();await expect(page).toHaveURL(/\/profile$/);
 await menu().click();await page.getByRole('menuitem',{name:'Settings',exact:true}).click();await expect(page).toHaveURL(/\/settings$/);
 await menu().click();await page.getByRole('menuitem',{name:'Log out',exact:true}).click();await expect(page).toHaveURL(/\/auth/);expect((await page.request.get('/api/user')).status()).toBe(401);
});
test('audit View opens actual row details and employee Daily Goal Start navigates',async({page})=>{
 await login(page,'admin');await page.goto('/audit-logs');await page.getByRole('button',{name:'View',exact:true}).first().click();await expect(page.getByRole('dialog')).toContainText('Audit Log Details');await expect(page.getByRole('dialog')).toContainText('Action');await page.keyboard.press('Escape');await expect(page.getByRole('dialog')).toHaveCount(0);
 await page.request.post('/api/logout');await login(page,'employee');await page.goto('/employee');
 const goal=page.getByRole('main').locator('div').filter({has:page.getByText('Daily Goal',{exact:true})}).filter({has:page.getByRole('button',{name:'Start',exact:true})}).last();await goal.getByRole('button',{name:'Start',exact:true}).click();await expect(page).toHaveURL(/\/employee\/training(?:\/\d+)?$/);
});
for(const actor of ['admin','owner']){
 const prefix=actor==='admin'?'':'/org-admin';
 test(`${actor}: groups create, edit, target CRUD, import and group delete`,async({page})=>{
  await login(page,actor);const name='Button QA '+actor+' '+Date.now();let id:number|undefined;
  try{
   await page.goto(prefix+'/groups');await page.getByRole('button',{name:'Create Group',exact:true}).click();await page.getByLabel('Group Name',{exact:true}).fill(name);const data=await mutation(page,'/api/groups','POST',()=>page.getByRole('dialog').getByRole('button',{name:'Create Group',exact:true}).click());id=data.id;
   let row=page.getByRole('row').filter({hasText:name});await expect(row).toBeVisible();await row.getByRole('button',{name:'Edit',exact:true}).click();await page.getByLabel('Description (Optional)',{exact:true}).fill('Verified edit');await mutation(page,'/api/groups/'+id,'PUT',()=>page.getByRole('button',{name:'Update Group',exact:true}).click());
   await row.getByRole('button',{name:'Preview',exact:true}).click();await page.getByRole('button',{name:'Add Target',exact:true}).click();await page.getByRole('dialog').getByLabel('Email',{exact:true}).fill('button-target@audit.test');const target=await mutation(page,`/api/groups/${id}/targets`,'POST',()=>page.getByRole('dialog').getByRole('button',{name:'Add Target',exact:true}).click());
   const targetRow=page.getByRole('row').filter({hasText:'button-target@audit.test'});await targetRow.getByRole('button',{name:'Edit target',exact:true}).click();await page.getByLabel('Position (Optional)',{exact:true}).fill('QA');await mutation(page,`/api/groups/${id}/targets/${target.id}`,'PUT',()=>page.getByRole('button',{name:'Update Target',exact:true}).click());
   page.once('dialog',d=>d.accept());await mutation(page,`/api/groups/${id}/targets/${target.id}`,'DELETE',()=>targetRow.getByRole('button',{name:'Delete target',exact:true}).click());
   await page.getByRole('button',{name:'Import CSV',exact:true}).click();await page.locator('#csv-upload').setInputFiles({name:'qa.csv',mimeType:'text/csv',buffer:Buffer.from('firstName,lastName,email\nButton,Imported,button-import@audit.test\n')});await mutation(page,`/api/groups/${id}/import`,'POST',()=>page.getByRole('dialog').getByRole('button',{name:'Import Targets',exact:true}).click());await expect(page.getByRole('row').filter({hasText:'button-import@audit.test'})).toBeVisible();
   await row.getByRole('button',{name:'Delete',exact:true}).click();await mutation(page,'/api/groups/'+id,'DELETE',()=>page.getByRole('alertdialog').getByRole('button',{name:/Delete Group/}).click());await expect(row).toHaveCount(0);id=undefined;
  }finally{if(id)await page.request.delete('/api/groups/'+id);}
 });
 test(`${actor}: SMTP create, edit without replacing secret and delete`,async({page})=>{
  await login(page,actor);const name='Button SMTP '+actor+' '+Date.now();let id:number|undefined;
  try{await page.goto(prefix+'/smtp-profiles');await page.getByRole('button',{name:'Create SMTP Profile',exact:true}).click();for(const [label,value]of Object.entries({'Profile Name':name,'SMTP Host':'localhost','Port':'1025','Username':'qa','Password':'DisposableOnly2026!','Sender Name':'QA','Sender Email':'qa@audit.test'}))await page.getByRole('dialog').getByLabel(label,{exact:true}).fill(value);
   const data=await mutation(page,'/api/smtp-profiles','POST',()=>page.getByRole('button',{name:'Create Profile',exact:true}).click());id=data.id;let row=page.getByRole('row').filter({hasText:name});await row.getByRole('button',{name:'Edit',exact:true}).click();await expect(page.getByRole('dialog').getByLabel('Password',{exact:true})).toHaveValue('');await page.getByRole('dialog').getByLabel('Profile Name',{exact:true}).fill(name+' edited');await mutation(page,'/api/smtp-profiles/'+id,'PUT',()=>page.getByRole('button',{name:'Update Profile',exact:true}).click());
   const saved=(await(await page.request.get('/api/smtp-profiles')).json()).find((p:any)=>p.id===id);expect(saved.password).toBeFalsy();expect(saved.name).toBe(name+' edited');await row.getByRole('button',{name:'Delete',exact:true}).click();await mutation(page,'/api/smtp-profiles/'+id,'DELETE',()=>page.getByRole('alertdialog').getByRole('button',{name:/Delete/}).click());id=undefined;
  }finally{if(id)await page.request.delete('/api/smtp-profiles/'+id);}
 });
 test(`${actor}: template import/export, save, preview, edit and delete`,async({page})=>{
  await login(page,actor);const name='Button Template '+actor+' '+Date.now();let id:number|undefined;
  try{await page.goto(prefix+'/templates');await page.getByRole('button',{name:'Create New Template',exact:true}).click();await page.getByLabel('Template Name *',{exact:true}).fill(name);await page.getByLabel('Subject *',{exact:true}).fill('QA practice');
   const chooser=page.waitForEvent('filechooser');await page.getByRole('button',{name:'Import',exact:true}).click();await(await chooser).setFiles({name:'qa.html',mimeType:'text/html',buffer:Buffer.from('<p>Disposable QA content</p>')});await expect(page.getByRole('textbox',{name:'HTML content',exact:true})).toHaveValue('<p>Disposable QA content</p>');
   await page.getByRole('button',{name:'Preview Email',exact:true}).click();await expect(page.getByRole('region',{name:'Email preview'})).toContainText('No email has been sent.');await expect(page.frameLocator('iframe[title="Draft email preview"]').locator('body')).toContainText('Disposable QA content');await page.getByRole('button',{name:'Close preview',exact:true}).click();await expect(page.getByRole('region',{name:'Email preview'})).toHaveCount(0);
   const download=page.waitForEvent('download');await page.getByRole('button',{name:'Export',exact:true}).click();expect((await download).suggestedFilename()).toMatch(/\.html$/);
   const data=await mutation(page,'/api/email-templates','POST',()=>page.getByRole('button',{name:'Save Template',exact:true}).click());id=data.id;const row=page.getByRole('row').filter({hasText:name});await expect(row).toBeVisible();await row.getByRole('button',{name:'Preview',exact:true}).click();await expect(page.getByRole('dialog')).toContainText('QA practice');await page.keyboard.press('Escape');await row.getByRole('button',{name:'Edit',exact:true}).click();await page.getByLabel('Subject *',{exact:true}).fill('Updated QA');await mutation(page,'/api/email-templates/'+id,'PUT',()=>page.getByRole('button',{name:'Save Template',exact:true}).click());await expect(row).toContainText('Updated QA');await row.getByRole('button',{name:'Delete',exact:true}).click();await mutation(page,'/api/email-templates/'+id,'DELETE',()=>page.getByRole('alertdialog').getByRole('button',{name:/Delete/}).click());id=undefined;
  }finally{if(id)await page.request.delete('/api/email-templates/'+id);}
 });
}
test('Admin report schedule create, edit, toggle and delete stays unsent',async({page})=>{
 await login(page,'admin');const email='button-schedule-'+Date.now()+'@audit.test';let id:number|undefined;
 try{await page.goto('/report-schedules');await page.getByRole('button',{name:'Create Schedule',exact:true}).first().click();await page.getByLabel('Recipients',{exact:true}).fill(email);const data=await mutation(page,'/api/reports/schedules','POST',()=>page.getByRole('dialog').getByRole('button',{name:'Create Schedule',exact:true}).click());id=data.id||data.schedule?.id;expect(id).toBeTruthy();const row=page.getByRole('row').filter({hasText:email});await row.getByRole('button',{name:'Edit',exact:true}).click();await page.getByLabel('Time of Day',{exact:true}).fill('10:15');await mutation(page,'/api/reports/schedules/'+id,'PUT',()=>page.getByRole('button',{name:'Update Schedule',exact:true}).click());await mutation(page,'/api/reports/schedules/'+id,'PUT',()=>row.getByRole('switch').click());await expect(row.getByRole('switch')).not.toBeChecked();await row.getByRole('button',{name:'Delete',exact:true}).click();await mutation(page,'/api/reports/schedules/'+id,'DELETE',()=>page.getByRole('alertdialog').getByRole('button',{name:/Delete/}).click());id=undefined;
 }finally{if(id)await page.request.delete('/api/reports/schedules/'+id);}
});
