import { test, expect } from '@playwright/test';

for (const field of ['Email', 'Password']) {
  test(`Enter in ${field} signs in instead of opening password recovery`, async ({ page }) => {
    await page.goto('/auth');
    await page.getByLabel('Email', { exact: true }).fill('admin.1@audit.test');
    await page.getByLabel('Password', { exact: true }).fill(process.env.E2E_PASSWORD!);
    await page.getByLabel(field, { exact: true }).press('Enter');
    await expect(page).toHaveURL(new URL('/',process.env.E2E_BASE_URL||'http://localhost:5000').href);
    await expect(page.getByRole('main')).toBeVisible();
  });
}

test('rail flyouts navigate, close, and keep the active section; Ctrl+K jumps to pages', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 650 });
  await page.goto('/auth');
  await page.getByLabel('Email', { exact: true }).fill('admin.1@audit.test');
  await page.getByLabel('Password', { exact: true }).fill(process.env.E2E_PASSWORD!);
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await expect(page).toHaveURL(new URL('/',process.env.E2E_BASE_URL||'http://localhost:5000').href);
  const rail = page.getByRole('navigation', { name: 'Sections', exact: true });
  await expect(rail.getByRole('button', { name: 'Home', exact: true })).toHaveAttribute('data-active', 'true');
  // Opening a section shows its pages; choosing one navigates and closes the flyout.
  await rail.getByRole('button', { name: 'Settings', exact: true }).click();
  const settingsPages = page.getByRole('navigation', { name: 'Settings pages', exact: true });
  await settingsPages.getByRole('link', { name: 'Settings', exact: true }).click();
  await expect(page).toHaveURL(/\/settings$/);
  await expect(page.getByRole('main')).toBeVisible();
  await expect(settingsPages).toHaveCount(0);
  await expect(rail.getByRole('button', { name: 'Settings', exact: true })).toHaveAttribute('data-active', 'true');
  // Escape closes a flyout and returns focus to its rail button.
  await rail.getByRole('button', { name: 'Learning', exact: true }).click();
  const learningPages = page.getByRole('navigation', { name: 'Learning pages', exact: true });
  await expect(learningPages.getByRole('link', { name: 'Articles', exact: true })).toHaveCount(1);
  await page.keyboard.press('Escape');
  await expect(learningPages).toHaveCount(0);
  await expect(rail.getByRole('button', { name: 'Learning', exact: true })).toBeFocused();
  // Clicking outside also closes it.
  await rail.getByRole('button', { name: 'Reports', exact: true }).click();
  await expect(page.getByRole('navigation', { name: 'Reports pages', exact: true })).toBeVisible();
  await page.getByRole('main').click({ position: { x: 600, y: 400 } });
  await expect(page.getByRole('navigation', { name: 'Reports pages', exact: true })).toHaveCount(0);
  await page.goBack();
  await expect(page).toHaveURL(new URL('/',process.env.E2E_BASE_URL||'http://localhost:5000').href);
  await expect(rail.getByRole('button', { name: 'Home', exact: true })).toHaveAttribute('data-active', 'true');
  // Ctrl+K palette: type, Enter opens the first match.
  await page.keyboard.press('Control+k');
  await page.getByRole('textbox', { name: 'Jump to a page', exact: true }).fill('templates');
  await page.keyboard.press('Enter');
  await expect(page).toHaveURL(/templates$/);
});
