import { test,expect } from '@playwright/test';

const surfaces={
  admin:['/admin/operations','/','/campaigns','/reconnaissance','/templates','/groups','/landing-pages','/smtp-profiles','/reports','/report-schedules','/users','/enrollment','/organization-management','/settings','/profile','/organization','/threat-landscape','/notifications','/audit-logs','/admin/training','/admin/quizzes','/admin/badges','/admin/content/articles','/admin/content/articles/new','/admin/content/videos','/admin/content/flashcards','/admin/content/mcqs','/admin/credential-captures'],
  orgadmin:['/org-admin','/org-admin/campaigns','/org-admin/groups','/org-admin/users','/org-admin/reports','/org-admin/enrollment','/org-admin/templates','/org-admin/smtp-profiles','/org-admin/landing-pages','/org-admin/delivery','/org-admin/training-assignments'],
  user:['/employee','/employee/training','/employee/quizzes','/employee/badges','/employee/leaderboard','/employee/profile','/employee/articles','/employee/flashcards','/notifications'],
};
for(const [role,paths] of Object.entries(surfaces)) {
  test.describe(role,()=> {
    for(const path of paths) test(`${path} loads without runtime or API server errors`,async({page})=> {
      const failures:string[]=[];const runtime:string[]=[];
      page.on('pageerror',error=>runtime.push(error.message));
      page.on('response',response=>{if(response.url().includes('/api/')&&response.status()>=500)failures.push(`${response.status()} ${new URL(response.url()).pathname}`);});
      await page.goto('/auth');
      await page.getByLabel('Email',{exact:true}).fill(`${role}.1@audit.test`);
      await page.getByLabel('Password',{exact:true}).fill(process.env.E2E_PASSWORD!);
      await page.getByRole('button',{name:'Sign in',exact:true}).click();
      await expect(page).toHaveURL(role==='admin'?/\/$/:role==='orgadmin'?/\/org-admin$/:/\/employee$/);
      await page.goto(path);
      await expect(page).toHaveURL(new RegExp(path.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')+'$'));
      await expect(page.getByRole('main')).toBeVisible();
      await expect(page.getByText('This page could not load',{exact:true})).toHaveCount(0);
      await expect.poll(async()=>(await page.getByRole('main').innerText()).trim().length).toBeGreaterThan(15);
      expect(runtime).toEqual([]);expect(failures).toEqual([]);
    });
  });
}
test('organization campaign wizard works at a mobile viewport',async({page})=> {
  await page.setViewportSize({width:390,height:844});await page.goto('/auth');
  await page.getByLabel('Email',{exact:true}).fill('orgadmin.1@audit.test');await page.getByLabel('Password',{exact:true}).fill(process.env.E2E_PASSWORD!);
  await page.getByRole('button',{name:'Sign in',exact:true}).click();await expect(page).toHaveURL(/\/org-admin$/);
  await page.goto('/org-admin/campaigns');await page.getByRole('button',{name:'Create Campaign',exact:true}).click();
  await expect(page.getByLabel('Campaign Name',{exact:true})).toBeVisible();
  await page.getByRole('button',{name:'Continue',exact:true}).click();await expect(page.getByRole('alert')).toContainText('Enter a campaign name');
  await page.screenshot({path:'test-results/mobile-campaign-wizard.png',fullPage:true});
});
