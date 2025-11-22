import { test, expect } from '@playwright/test';

// Basic smoke test for Notifications page.
// Uses backend port by default; supports optional auth if redirected.
const BASE_URL = process.env.BASE_URL || 'http://localhost:5000';
const EMPLOYEE_EMAIL = process.env.E2E_EMPLOYEE_EMAIL || 'test0user@mail.com';
const EMPLOYEE_PASSWORD = process.env.E2E_EMPLOYEE_PASSWORD || 'Uma212295@w';

test('notifications page is reachable and renders heading', async ({ page }) => {
  await page.goto(`${BASE_URL}/notifications`);

  if (page.url().includes('/auth')) {
    // Attempt login then retry
    await page.fill('input[type="email"]', EMPLOYEE_EMAIL);
    await page.fill('input[type="password"]', EMPLOYEE_PASSWORD);
    await page.click('button[type="submit"]');
    await page.waitForURL('**/employee/**', { timeout: 10000 });
    await page.goto(`${BASE_URL}/notifications`);
  }

  const heading = page.getByRole('heading', { name: /Notifications/i });
  await expect(heading).toBeVisible();
});
