import { test, expect } from '@playwright/test';

test('organization administrator can sign in and open campaign management', async ({ page }) => {
  test.skip(!process.env.E2E_PASSWORD || !process.env.E2E_ORG_ADMIN_EMAIL, 'Set explicit isolated test credentials');
  await page.goto('/auth');
  await page.getByLabel('Email', { exact: true }).fill(process.env.E2E_ORG_ADMIN_EMAIL!);
  await page.getByLabel('Password', { exact: true }).fill(process.env.E2E_PASSWORD!);
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await expect(page).toHaveURL(/\/org-admin$/);
  await page.locator('aside nav').getByRole('button',{name:'Campaigns',exact:true}).click();
  await page.getByRole('link', { name: 'Campaigns', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Campaigns', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Create Campaign', exact: true }).click();
  await expect(page.getByLabel('Campaign Name', { exact: true })).toBeVisible();
});
