import { chromium } from '@playwright/test';
import { readFileSync, writeFileSync, mkdirSync, readdirSync } from 'node:fs';
import { parse } from 'dotenv';
import ts from 'typescript';
const env=parse(readFileSync('.env.audit'));
if(new URL(env.DATABASE_URL).pathname!=='/phishnet_audit'||env.MAIL_TRANSPORT!=='sink')throw new Error('Requires isolated audit sink');
const review=JSON.parse(readFileSync('logs/role-review/accounts.json'));
const base='http://localhost:5000',out='logs/button-audit';mkdirSync(out,{recursive:true});
const app=readFileSync('client/src/App.tsx','utf8');
const paths=[...new Set([...app.matchAll(/<ProtectedRoute path="([^"]+)"/g)].map(m=>m[1]))].filter(p=>!p.includes(':'));
const common=['/settings','/profile','/notifications','/local-inbox'];
function allowed(role,p){const content=p.startsWith('/admin/content/')||['/admin/training','/admin/quizzes'].includes(p);return common.includes(p)||(role==='Admin'?!p.startsWith('/employee'):role==='OrgAdmin'?p.startsWith('/org-admin')||content:role==='Manager'?p==='/manager':p.startsWith('/employee'));}
const source=[];
function scan(dir){for(const e of readdirSync(dir,{withFileTypes:true})){const p=dir+'/'+e.name;if(e.isDirectory()){if(p!=='client/src/components/ui')scan(p);continue;}if(!p.endsWith('.tsx'))continue;const raw=readFileSync(p,'utf8'),tree=ts.createSourceFile(p,raw,ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);function visit(n){if(ts.isJsxElement(n)||ts.isJsxSelfClosingElement(n)){const open=ts.isJsxElement(n)?n.openingElement:n,name=open.tagName.getText(tree);if(/^(Button|button|TabsTrigger|DropdownMenuItem|AlertDialogAction|Switch|SelectTrigger)$/.test(name)){const props=open.attributes.properties.map(a=>a.getText(tree));source.push({file:p,line:tree.getLineAndCharacterOfPosition(n.getStart()).line+1,component:name,text:ts.isJsxElement(n)?n.children.map(c=>c.getText(tree)).join(' ').replace(/\s+/g,' ').slice(0,200):'',props});}}ts.forEachChild(n,visit);}visit(tree);}}
scan('client/src/pages');scan('client/src/components');writeFileSync(out+'/source-controls.json',JSON.stringify(source,null,2));
if(process.argv.includes('--source-only')){console.log('Source controls: '+source.length);process.exit(0);}
const results=[],pages=[],denials=[],requests=[];
const browser=await chromium.launch({channel:'chrome',headless:true});
const actors={admin:'Admin',owner:'OrgAdmin',manager:'Manager',employee:'User'};
const unsafe=/launch|send|resend|run now|ingest|test domain|test contact|reconnaissance|rotate|disable 2fa|delete|remove|revoke|publish|unpublish|mark .*read|clear|reset|save|update|create|install|assign|complete|submit|invite|record|report suspicious|verify|retry delivery|resume|cancel campaign/i;
const safelyOpens=/^(add|new|create|edit|delete|remove|invite|assign|preview|view|manage|configure|import|export|download|refresh|back|cancel|close|next|previous|continue|start|retry|show|hide|flip|open|filter|search|select|copy|mark)/i;
const selector='button, [role="tab"], [role="switch"], [role="combobox"], a[href]';
async function controls(root){return root.locator(selector).evaluateAll(nodes=>nodes.filter(el=>el.getBoundingClientRect().width&&el.getBoundingClientRect().height).map((el,index)=>({index,tag:el.tagName,role:el.getAttribute('role')||'',name:el.getAttribute('aria-label')||el.getAttribute('title')||(el.textContent||'').trim().replace(/\s+/g,' '),href:el.getAttribute('href'),disabled:el.disabled||el.getAttribute('aria-disabled')==='true',type:el.getAttribute('type'),html:el.outerHTML.slice(0,450)})));}
async function state(page){return {url:page.url(),body:(await page.locator('body').innerText()).replace(/\s+/g,' '),dialogs:await page.getByRole('dialog').count(),alerts:await page.getByRole('alertdialog').count()};}
function flush(){writeFileSync(out+'/controls.json',JSON.stringify({at:new Date().toISOString(),sourceControls:source.length,pages,denials,results,requests,simulationLaunched:false,method:'Read-only click probes; mutation requests prevented and explicitly recorded as needing write-workflow verification. Repeated identical controls grouped with instance counts.'},null,2));}
try{
for(const [actor,role]of Object.entries(actors)){
 const context=await browser.newContext({baseURL:base,acceptDownloads:true});
 const login=await context.request.post('/api/login',{data:{email:review.accounts[actor].email,password:review.password}});if(!login.ok())throw new Error(actor+' login failed');
 const page=await context.newPage();page.setDefaultTimeout(2500);let runtime=[],http=[],blocked=[],downloads=0,choosers=0;
 page.on('pageerror',e=>runtime.push(e.message));page.on('download',()=>downloads++);page.on('filechooser',()=>choosers++);page.on('dialog',d=>d.dismiss());
 page.on('response',r=>{if(r.url().includes('/api/')&&r.status()>=400)http.push({status:r.status(),path:new URL(r.url()).pathname});});
 await page.route('**/api/**',async route=>{const r=route.request();if(!['GET','HEAD','OPTIONS'].includes(r.method())){const entry={actor,path:new URL(r.url()).pathname,method:r.method()};blocked.push(entry);requests.push({...entry,prevented:true});await route.fulfill({status:409,contentType:'application/json',body:JSON.stringify({message:'Read-only QA probe: use the disposable write-workflow test for this action'})});}else await route.continue();});
 for(const path of paths){
  runtime=[];http=[];await page.goto(path);await page.waitForTimeout(180);await page.locator('main').waitFor({timeout:12000}).catch(()=>{});
  if(!allowed(role,path)){denials.push({actor,path,redirect:new URL(page.url()).pathname,denied:new URL(page.url()).pathname!==path});continue;}
  const settled=await page.locator('main').innerText().catch(()=> '');if(!settled.trim()||new URL(page.url()).pathname!==path){pages.push({actor,path,status:'FAIL',error:'Missing main content or unexpected redirect',url:page.url()});flush();continue;}
  const tabNames=await page.getByRole('main').getByRole('tab').allTextContents();const variants=['',...tabNames.map(s=>s.trim())];let total=0;
  for(const tab of variants){
   await page.goto(path);await page.locator('main').waitFor();await page.waitForTimeout(100);if(tab)await page.getByRole('main').getByRole('tab',{name:tab,exact:true}).click().catch(()=>{});await page.waitForTimeout(120);
   const found=await controls(page.getByRole('main'));const groups=new Map();for(const c of found){const key=[c.tag,c.role,c.name,c.href,c.disabled].join('|');if(groups.has(key))groups.get(key).instances++;else groups.set(key,{...c,instances:1});}
   total+=found.length;
   for(const c of groups.values()){
    const entry={actor,path,tab,control:c.name||'[unnamed]',tag:c.tag,role:c.role,instances:c.instances,disabled:c.disabled};
    if(c.disabled){results.push({...entry,status:'DISABLED',detail:'Disabled in current data/configuration state'});continue;}
    if(c.tag==='A'){results.push({...entry,status:'LINK_INVENTORIED',href:c.href});continue;}
    if(c.role==='tab'){results.push({...entry,status:'TAB_OPENED'});continue;}
    // Deliberately never launch a simulation or start network reconnaissance.
    if(/launch|send local simulation|run reconnaissance|start reconnaissance|ingest|test domain|test contact/i.test(c.name)){results.push({...entry,status:'DEFERRED',detail:'Campaign delivery or external network work excluded by prior instruction'});continue;}
    await page.keyboard.press('Escape').catch(()=>{});
    await page.goto(path);await page.locator('main').waitFor();await page.waitForTimeout(90);if(tab)await page.getByRole('main').getByRole('tab',{name:tab,exact:true}).click().catch(()=>{});await page.waitForTimeout(80);
    let loc=c.role?page.getByRole('main').getByRole(c.role,{name:c.name,exact:true}).first():c.name?page.getByRole('main').getByRole('button',{name:c.name,exact:true}).first():page.getByRole('main').locator('button').filter({hasText:/^$/}).first();
    const before=await state(page),b=blocked.length,h=http.length,r=runtime.length,d=downloads,f=choosers;
    try{
     await loc.click();await page.waitForTimeout(220);const after=await state(page);
     let status=blocked.length>b?'WRITE_DEFERRED':runtime.length>r||http.slice(h).some(v=>v.status>=500)?'FAIL':before.url!==after.url?'NAVIGATED':downloads>d?'DOWNLOADED':choosers>f?'FILE_CHOOSER_OPENED':after.dialogs>before.dialogs||after.alerts>before.alerts?'DIALOG_OPENED':before.body!==after.body?'UI_CHANGED':c.role==='switch'||c.role==='combobox'?'CONTROL_ACTIVATED':'NO_OBSERVABLE_EFFECT';
     const nested=after.dialogs||after.alerts?await controls(page.locator('[role="dialog"], [role="alertdialog"]').last()):[];
     results.push({...entry,status,nestedControls:nested,errors:runtime.slice(r),responses:http.slice(h),mutation:blocked.slice(b)});
     if(status==='FAIL'||status==='NO_OBSERVABLE_EFFECT')await page.screenshot({path:out+'/'+actor+'-'+results.length+'.png',fullPage:true}).catch(()=>{});
    }catch(e){results.push({...entry,status:'PROBE_ERROR',error:e.message.split('\n')[0]});}
   }
  }
  pages.push({actor,path,status:runtime.length||http.some(v=>v.status>=500)?'FAIL':'LOADED',renderedControlInstances:total,runtime,http:http.filter(v=>v.status!==409)});flush();console.log(actor+' '+path+' '+total+' controls');
 }
 await context.close();
}
}finally{flush();await browser.close();}
const counts=results.reduce((o,r)=>(o[r.status]=(o[r.status]||0)+1,o),{});console.log(JSON.stringify({pages:pages.length,denials:denials.length,controls:results.length,counts}));
