import {chromium} from '@playwright/test';
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {createHash} from 'node:crypto';
const base='http://127.0.0.1:5000',dir='logs/button-audit',review=JSON.parse(readFileSync('logs/role-review/accounts.json')),audit=JSON.parse(readFileSync(dir+'/controls.json'));
const results=process.argv.includes('--resume')?JSON.parse(readFileSync(dir+'/followup.json')).results:[];const priorMap=new Map(results.map(r=>[[r.actor,r.path,r.tab,r.parent||'',r.control,r.level].join('|'),r]));const retryKeys=new Set([...priorMap.values()].filter(r=>r.status==='PROBE_ERROR'||r.status==='NO_OBSERVABLE_EFFECT'&&/^(Review|Retake|Update Campaign)$/.test(r.control)).map(r=>[r.actor,r.path,r.tab,r.parent||r.control].join('|')));mkdirSync(dir,{recursive:true});
const selector='button,[role="combobox"],[role="switch"],[role="menuitem"],a[href]';
const forbidden=/launch|send local simulation|start reconnaissance|run reconnaissance|test domain|test contact|check dns|ingest|run now|rotate/i;
const browser=await chromium.launch({channel:'chrome',headless:true});
function save(){writeFileSync(dir+'/followup.json',JSON.stringify({at:new Date().toISOString(),results,simulationLaunched:false,method:'Stable DOM identity, nested dialogs/menus, native confirmations, input/ARIA state and native form validation. Mutations prevented; successful write cycles recorded separately.'},null,2));}
try{for(const actor of (process.argv.includes('--remaining')?['owner','manager','employee']:['admin','owner','manager','employee'])){
 const context=await browser.newContext({baseURL:base,acceptDownloads:true});const response=await context.request.post('/api/login',{data:{email:review.accounts[actor].email,password:review.password}});if(!response.ok())throw new Error('Login failed');
 const page=await context.newPage();page.setDefaultTimeout(4000);page.setDefaultNavigationTimeout(15000);let blocked=[],runtime=[],http=[],events=[];
 page.on('pageerror',e=>runtime.push(e.message));page.on('dialog',async d=>{events.push('native '+d.type());await d.dismiss();});page.on('download',()=>events.push('download'));page.on('filechooser',()=>events.push('file chooser'));page.on('popup',async p=>{events.push('popup');await p.waitForLoadState('domcontentloaded').catch(()=>{});await p.close().catch(()=>{});});
 page.on('response',r=>{if(r.url().includes('/api/')&&r.status()>=400)http.push({path:new URL(r.url()).pathname,status:r.status()});});
 await context.route('**/api/**',async route=>{const request=route.request();if(!['GET','HEAD','OPTIONS'].includes(request.method())){blocked.push({method:request.method(),path:new URL(request.url()).pathname});await route.fulfill({status:409,contentType:'application/json',body:'{"message":"Read-only QA probe; write flow tested separately"}'});}else await route.continue();});
 async function getControls(root){return root.locator(selector).evaluateAll(nodes=>nodes.filter(el=>el.getBoundingClientRect().width&&el.getBoundingClientRect().height).map((el,index)=>{el.setAttribute('data-qa-probe',String(index));return {index,tag:el.tagName,role:el.getAttribute('role'),name:el.getAttribute('aria-label')||el.getAttribute('title')||(el.textContent||'').trim().replace(/\s+/g,' '),disabled:el.disabled||el.getAttribute('aria-disabled')==='true',href:el.getAttribute('href')};}));}
 async function state(){return createHash('sha256').update(await page.locator('body').evaluate(el=>JSON.stringify({text:el.innerText,inputs:[...el.querySelectorAll('input,textarea,select,button,[role="switch"],[role="combobox"]')].map(n=>[n.type==='password'?'[password]':n.value,n.checked,n.getAttribute('aria-checked'),n.getAttribute('aria-expanded'),n.getAttribute('aria-pressed'),n.getAttribute('data-state'),n.className])}))).digest('hex');}
 async function open(path,tab){await page.goto(path);await page.locator('main').waitFor({timeout:10000});await page.waitForLoadState('networkidle',{timeout:3000}).catch(()=>{});if(tab){await page.getByRole('main').getByRole('tab',{name:tab,exact:true}).click();await page.waitForTimeout(80);}}
 async function find(root,name,tag,role){const normalized=value=>value.replace(/(?:about )?\d+ (?:seconds?|minutes?|hours?|days?|months?|years?) ago$/,'').replaceAll('New','').replace(/:\s*\d+/g,':#').replace(/\(\s*\d+\s*\/\s*\d+\s*\)/g,'(#/#)').replace(/\s+/g,' ').trim();for(let attempt=0;attempt<20;attempt++){const controls=await getControls(root);const found=controls.find(c=>(normalized(c.name)===normalized(name)||(name===''&&c.name==='More actions'))&&(!tag||c.tag===tag)&&(!role||c.role===role));if(found)return root.locator('[data-qa-probe="'+found.index+'"]').first();await page.waitForTimeout(150);}throw new Error('Control not present after restoring its page/tab');}
 async function probe(loc,meta){const before=await state(),b=blocked.length,r=runtime.length,h=http.length,e=events.length,url=page.url();
  try{await loc.click();await page.waitForTimeout(220);const invalid=await page.locator('input:invalid,textarea:invalid,select:invalid').count();const errors=runtime.slice(r),responses=http.slice(h),event=events.slice(e);let status=blocked.length>b?'WRITE_DEFERRED':errors.length||responses.some(r=>r.status>=500)?'FAIL':event.length?'OPENED_'+event.join('_').toUpperCase().replaceAll(' ','_'):page.url()!==url?'NAVIGATED':before!==await state()?'UI_CHANGED':invalid?'VALIDATION_BLOCKED':'NO_OBSERVABLE_EFFECT';results.push({...meta,status,events:event,errors,responses,mutation:blocked.slice(b)});return status;}catch(error){results.push({...meta,status:'PROBE_ERROR',error:error.message.split('\n')[0]});return 'PROBE_ERROR';}}
 const seen=new Set();
 for(const item of audit.results.filter(r=>r.actor===actor&&['PROBE_ERROR','NO_OBSERVABLE_EFFECT','LINK_INVENTORIED','DIALOG_OPENED','UI_CHANGED','CONTROL_ACTIVATED'].includes(r.status))){
  if(process.argv.includes('--retry')&&!retryKeys.has([actor,item.path,item.tab,item.control].join('|')))continue;const key=[item.path,item.tab,item.control,item.tag,item.role].join('|');if(seen.has(key))continue;seen.add(key);const meta={actor,path:item.path,tab:item.tab,control:item.control,level:'page'};
  try{
   await open(item.path,item.tab);if(actor==='admin'&&item.path==='/manager'){results.push({...meta,status:'RESTRICTED',reason:'Manager-only route now redirects platform Admin to its home'});continue;}let loc=await find(page.getByRole('main'),item.control==='[unnamed]'?'':item.control,item.tag,item.role);
   if(forbidden.test(item.control)){results.push({...meta,status:'DEFERRED',reason:'External work or simulation launch excluded'});continue;}
   if(item.tag==='A'&&item.href&&!item.href.startsWith('/')&&!item.href.startsWith(base)){results.push({...meta,status:'EXTERNAL_LINK',href:item.href});continue;}
   const status=await probe(loc,meta);
   if(['WRITE_DEFERRED','PROBE_ERROR','FAIL'].includes(status))continue;
   const portal=page.locator('[role="dialog"],[role="alertdialog"],[role="menu"]').last();
   if(await portal.isVisible().catch(()=>false)){
    const nested=await getControls(portal);const unique=[...new Map(nested.map(c=>[[c.name,c.tag,c.role].join('|'),c])).values()];
    for(const child of unique){const nestedMeta={...meta,parent:item.control,control:child.name||'[unnamed]',level:'dialog/menu'};
     if(child.disabled){results.push({...nestedMeta,status:'DISABLED'});continue;}
     if(forbidden.test(child.name)){results.push({...nestedMeta,status:'DEFERRED',reason:'External work or simulation launch excluded'});continue;}
     try{await open(item.path,item.tab);loc=await find(page.getByRole('main'),item.control==='[unnamed]'?'':item.control,item.tag,item.role);await loc.click();await page.waitForTimeout(120);const current=page.locator('[role="dialog"],[role="alertdialog"],[role="menu"]').last();const nestedLoc=await find(current,child.name,child.tag,child.role);await probe(nestedLoc,nestedMeta);}catch(error){results.push({...nestedMeta,status:'PROBE_ERROR',error:error.message.split('\n')[0]});}
    }
   }
  }catch(error){results.push({...meta,status:'PROBE_ERROR',error:error.message.split('\n')[0]});}
  save();
 }
 await context.close();console.log(actor+' followup complete: '+results.length+' probes');save();
}}finally{save();await browser.close();}
console.log(JSON.stringify(results.reduce((counts,r)=>(counts[r.status]=(counts[r.status]||0)+1,counts),{})));
