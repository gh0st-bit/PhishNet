import { test, expect } from '@playwright/test';

// Basic smoke test to ensure the Notifications page route is wired
// NOTE: This assumes the app is running with a logged-in session in dev.
// If auth redirects to /auth, the test will skip gracefully.

test('notifications page is reachable and renders heading', async ({ page }) => {
  await page.goto('http://localhost:5173/notifications');

  // If we were redirected to auth, skip test with a soft expectation
  if (page.url().includes('/auth')) {
    test.info().annotations.push({ type: 'skip', description: 'Requires authenticated session to view /notifications' });
    test.skip();
  }

  const heading = page.getByRole('heading', { name: 'Notifications' });
  await expect(heading).toBeVisible();
});
