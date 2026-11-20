import {test,expect} from '@playwright/test';
import {readFileSync,appendFileSync} from 'node:fs';
const review=JSON.parse(readFileSync('logs/role-review/accounts.json','utf8'));
test.use({trace:'off'});
test.beforeEach(async({page})=>{
 await page.route('**/api/lab/campaigns',route=>route.abort());
 await page.route('**/api/lab/messages/*/open',route=>route.abort());
 await page.route('**/api/lab/messages/*/report',route=>route.abort());
});
async function login(page:any,actor='admin'){
 const response=await page.request.post('/api/login',{data:{email:review.accounts[actor].email,password:review.password}});expect(response.status()).toBe(200);
}
const cases=[
 ['notifications','admin','/notifications','Refresh notifications',['/api/notifications?limit=50']],
 ['articles','admin','/admin/content/articles','Refresh',['/api/admin/articles']],
 ['flashcards','admin','/admin/content/flashcards','Refresh',['/api/admin/flashcard-decks']],
 ['audit logs','admin','/audit-logs','Refresh',['/api/audit/logs']],
 ['threat landscape','admin','/threat-landscape','Refresh',['/api/threat-intelligence/analysis','/api/threat-intelligence/threats']],
 ['overview','admin','/','Refresh outcomes',['/api/dashboard/overview']],
 ['employee dashboard','employee','/employee','Refresh dashboard',['/api/employee/training','/api/employee/quizzes','/api/employee/points','/api/employee/badges','/api/employee/leaderboard','/api/employee/dashboard/analytics','/api/employee/dashboard/insights','/api/employee/level']],
 ['employee training','employee','/employee/training','Refresh',['/api/employee/training']],
 ['employee quizzes','employee','/employee/quizzes','Refresh',['/api/employee/quizzes']],
 ['employee inbox','employee','/employee/inbox','Refresh inbox',['/api/lab/messages','/api/lab/status']],
] as const;
for(const [name,actor,path,label,endpoints]of cases)test(`${name}: refresh fetches current page data and confirms completion`,async({page})=>{
 await login(page,actor);await page.goto(path);const button=page.getByRole('button',{name:label,exact:true});await expect(button).toBeVisible();
 // Wait for the initial query so the click must cause a new round-trip.
 await page.waitForTimeout(500);
 const requests=endpoints.map(endpoint=>page.waitForResponse(r=>r.url().includes(endpoint)&&r.request().method()==='GET'&&r.ok()));
 await button.click();await Promise.all(requests);await expect(page.getByText('The latest saved data is now displayed.',{exact:true})).toBeVisible();await expect(button).toBeEnabled();
});

test('notification refresh replaces stale content and refreshes the bell count',async({page})=>{
 await login(page);await page.goto('/notifications');await page.waitForTimeout(500);
 await page.route('**/api/notifications?limit=50',route=>route.fulfill({json:{notifications:[{id:999999,type:'system',title:'Fresh refresh proof',message:'Read-only browser fixture',createdAt:new Date().toISOString(),isRead:false,priority:'low'}],unreadCount:1}}));
 const unread=page.waitForResponse(r=>r.url().includes('/api/notifications/unread-count')&&r.ok());
 await page.getByRole('button',{name:'Refresh notifications',exact:true}).click();await unread;await expect(page.getByText('Fresh refresh proof',{exact:true})).toBeVisible();
});

test('refresh failure is visible and retry restores current data',async({page})=>{
 await login(page);await page.goto('/notifications');await page.waitForTimeout(500);
 await page.route('**/api/notifications?limit=50',route=>route.fulfill({status:503,json:{message:'Temporary browser test failure'}}));
 const button=page.getByRole('button',{name:'Refresh notifications',exact:true});await button.click();await expect(page.getByText('Refresh failed',{exact:true})).toBeVisible();await expect(page.getByRole('alert').filter({hasText:'Notifications could not be loaded'})).toBeVisible();await expect(button).toBeEnabled();
 await page.unroute('**/api/notifications?limit=50');await button.click();await expect(page.getByText('The latest saved data is now displayed.',{exact:true})).toBeVisible();await expect(page.getByText('Notifications could not be loaded. Use Refresh notifications to retry.')).toHaveCount(0);
});

for(const tab of ['Dashboard Notifications','Email Notifications'])test(`${tab}: refresh settings reads server preferences`,async({page})=>{
 await login(page);await page.goto('/settings');await page.getByRole('tab',{name:'Notifications',exact:true}).click();await page.getByRole('tab',{name:tab,exact:true}).click();await page.waitForTimeout(500);
 const response=page.waitForResponse(r=>r.url().includes('/api/notifications/preferences')&&r.request().method()==='GET'&&r.ok());await page.getByRole('button',{name:'Refresh Settings',exact:true}).click();await response;await expect(page.getByText('The latest saved data is now displayed.',{exact:true})).toBeVisible();
});

for(const width of [1280,390])test(`employee uses one sidebar across dashboard and inbox at ${width}px`,async({page})=>{
 page.on('console',message=>{if(message.type()==='error')appendFileSync('logs/button-audit/mobile-console.jsonl',JSON.stringify({at:new Date().toISOString(),width,text:message.text()})+'\n');});
 page.on('pageerror',error=>appendFileSync('logs/button-audit/mobile-console.jsonl',JSON.stringify({at:new Date().toISOString(),width,error:error.message,stack:error.stack})+'\n')); 
 await page.setViewportSize({width,height:844});await login(page,'employee');await page.goto('/employee');await expect(page.getByRole('heading',{name:'Security Learning Portal',exact:true})).toBeVisible();
 const rail=page.getByRole('navigation',{name:'Sections',exact:true});await rail.getByRole('button',{name:'Home',exact:true}).click();const home=page.getByRole('navigation',{name:'Home pages',exact:true});
 await expect(home.getByRole('link',{name:'Dashboard',exact:true})).toBeVisible();await expect(page.getByRole('link',{name:'Local inbox',exact:true})).toHaveCount(0);
 await home.getByRole('link',{name:'My inbox',exact:true}).click();await expect(page).toHaveURL(/\/employee\/inbox$/);await expect(page.getByRole('main').getByRole('heading',{name:'My inbox',exact:true})).toBeVisible();await expect(page.getByRole('heading',{name:'Create a practice campaign',exact:true})).toHaveCount(0);
 await rail.getByRole('button',{name:'Learning',exact:true}).click();
 await page.getByRole('navigation',{name:'Learning pages',exact:true}).getByRole('link',{name:'Training',exact:true}).click();await expect(page).toHaveURL(/\/employee\/training$/);
 await page.goto('/local-inbox');await expect(page).toHaveURL(/\/employee\/inbox$/);await expect(page.getByRole('main')).toHaveCount(1);
 await page.screenshot({path:`logs/product-maturity/unified-inbox-${width}.png`,fullPage:true});
});
