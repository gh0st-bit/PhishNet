import { chromium } from '@playwright/test';
import { readFileSync, writeFileSync } from 'node:fs';
import { parse } from 'dotenv';
import assert from 'node:assert/strict';
const base = 'http://localhost:5000';
const password = parse(readFileSync('.env.audit.accounts')).AUDIT_PASSWORD;
const browser = await chromium.launch({ channel: 'chrome', headless: true });
const context = await browser.newContext({ baseURL: base });
context.setDefaultTimeout(10000);
const page = await context.newPage();
const results = [];
const created = [];
const prefix = `QA UI ${Date.now()}`;
async function run(area, fn) {
  if (process.env.QA_UI_AREA && !area.includes(process.env.QA_UI_AREA)) return;
  try { const detail = await fn(); results.push({ area, status: 'PASS', detail }); console.log('PASS', area); }
  catch (e) {
    results.push({ area, status: 'FAIL', error: e.message }); console.log('FAIL', area, e.message);
    await page.screenshot({ path: `logs/feature-cycle/form-${area.replace(/[^a-z0-9]/gi, '-')}.png`, fullPage: true, animations: 'disabled', timeout: 5000 }).catch(() => {});
  }
}
try {
  assert.ok((await context.request.post('/api/login', { data: { email: 'admin.1@audit.test', password } })).ok());
  await run('Group form create and edit', async () => {
    await page.goto('/groups'); await page.getByRole('button', { name: 'Create Group', exact: true }).click();
    let dialog = page.getByRole('dialog');
    await dialog.getByLabel('Group Name', { exact: true }).fill(prefix);
    await dialog.getByLabel('Description (Optional)', { exact: true }).fill('Created through the actual UI');
    const response = page.waitForResponse(r => r.url().endsWith('/api/groups') && r.request().method() === 'POST');
    await dialog.getByRole('button', { name: 'Create Group', exact: true }).click();
    const r = await response; assert.equal(r.status(), 201, await r.text()); const group = await r.json(); created.push(`/api/groups/${group.id}`);
    await page.getByRole('dialog').waitFor({ state: 'hidden' });
    const row = page.getByRole('row').filter({ hasText: prefix });
    await row.getByRole('button').nth(1).click();
    dialog = page.getByRole('dialog'); await dialog.getByLabel('Group Name', { exact: true }).fill(prefix + ' edited');
    const update = page.waitForResponse(r => r.url().endsWith(`/api/groups/${group.id}`) && r.request().method() === 'PUT');
    await dialog.getByRole('button', { name: 'Update Group', exact: true }).click(); assert.equal((await update).status(), 200);
  });
  await run('SMTP form create and update', async () => {
    await page.goto('/smtp-profiles'); await page.getByRole('button', { name: 'Create SMTP Profile', exact: true }).click();
    const dialog = page.getByRole('dialog');
    for (const [label, value] of Object.entries({ 'Profile Name': prefix, 'SMTP Host': 'localhost', 'Port': '1025', 'Username': 'qa', 'Password': 'SyntheticOnly123!', 'Sender Name': 'QA', 'Sender Email': 'qa@audit.test' })) {
      await dialog.getByLabel(label, { exact: true }).fill(value);
    }
    const response = page.waitForResponse(r => r.url().endsWith('/api/smtp-profiles') && r.request().method() === 'POST');
    await dialog.getByRole('button', { name: 'Create Profile', exact: true }).click();
    const r = await response; assert.equal(r.status(), 201, await r.text()); const profile = await r.json(); created.push(`/api/smtp-profiles/${profile.id}`);
    await dialog.waitFor({ state: 'hidden' });
    const row = page.getByRole('row').filter({ hasText: prefix });
    await row.getByRole('button').first().click();
    await dialog.getByLabel('Profile Name', { exact: true }).fill(prefix + ' edited');
    const update = page.waitForResponse(r => r.url().endsWith(`/api/smtp-profiles/${profile.id}`) && r.request().method() === 'PUT');
    await dialog.getByRole('button', { name: 'Update Profile', exact: true }).click(); assert.equal((await update).status(), 200);
  });
  await run('Template form save and list refresh', async () => {
    await page.goto('/templates'); await page.getByRole('button', { name: 'Create New Template', exact: true }).click();
    const dialog = page.getByRole('dialog');
    for (const [label, value] of Object.entries({ 'Template Name *': prefix, 'Subject *': 'Synthetic UI subject', 'Sender Name *': 'QA', 'Sender Email *': 'qa@audit.test' })) await dialog.getByLabel(label, { exact: true }).fill(value);
    await dialog.getByRole('textbox', { name: 'HTML content', exact: true }).fill('<p>Synthetic UI content</p>');
    const response = page.waitForResponse(r => r.url().endsWith('/api/email-templates') && r.request().method() === 'POST');
    await dialog.getByRole('button', { name: 'Save Template', exact: true }).click(); const r = await response; assert.equal(r.status(), 201, await r.text());
    created.push(`/api/email-templates/${(await r.json()).id}`);
    await dialog.waitFor({ state: 'hidden' }); await page.getByRole('main').getByText(prefix, { exact: true }).first().waitFor();
  });
  await run('Landing page form save and list refresh', async () => {
    await page.goto('/landing-pages'); await page.getByRole('button', { name: 'Create Landing Page', exact: true }).first().click();
    const dialog = page.getByRole('dialog'); await dialog.getByLabel('Landing Page Name', { exact: true }).fill(prefix);
    const response = page.waitForResponse(r => r.url().endsWith('/api/landing-pages') && r.request().method() === 'POST');
    await dialog.getByRole('button', { name: 'Create', exact: true }).click(); const r = await response; assert.equal(r.status(), 201, await r.text());
    created.push(`/api/landing-pages/${(await r.json()).id}`);
    await dialog.waitFor({ state: 'hidden' }); await page.getByRole('main').getByText(prefix, { exact: true }).first().waitFor();
  });
  await run('User form save and list refresh', async () => {
    const email = `qa-ui-${Date.now()}@audit.test`;
    await page.goto('/users'); await page.getByRole('button', { name: 'Add User', exact: true }).click();
    const dialog = page.getByRole('dialog');
    for (const [label, value] of Object.entries({ 'First Name': 'QA', 'Last Name': 'UI', 'Email': email, 'Password': 'SyntheticOnly123!' })) await dialog.getByLabel(label, { exact: true }).fill(value);
    await dialog.getByRole('combobox').click(); await page.getByRole('option', { name: 'User', exact: true }).click();
    const response = page.waitForResponse(r => r.url().endsWith('/api/users') && r.request().method() === 'POST');
    await dialog.getByRole('button', { name: 'Create User', exact: true }).click(); const r = await response; assert.equal(r.status(), 201, await r.text());
    created.push(`/api/users/${(await r.json()).id}`);
    await dialog.waitFor({ state: 'hidden' }); await page.getByRole('main').getByText(email, { exact: true }).first().waitFor();
  });
  await run('Training module form', async () => {
    await page.goto('/admin/training'); await page.getByRole('button', { name: 'Create Module', exact: true }).click();
    const dialog = page.getByRole('dialog');
    await dialog.locator('#title').fill(prefix); await dialog.locator('#description').fill('Synthetic module'); await dialog.locator('#videoUrl').fill('https://example.com/synthetic.mp4');
    const response = page.waitForResponse(r => r.url().endsWith('/api/admin/training-modules') && r.request().method() === 'POST');
    await dialog.getByRole('button', { name: 'Create Module', exact: true }).click();
    const r = await response; if (r.status() === 201) created.push(`/api/admin/training-modules/${(await r.json()).module.id}`);
    assert.equal(r.status(), 201, await r.text());
  });
  await run('Quiz creation form', async () => {
    await page.goto('/admin/quizzes'); await page.getByRole('button', { name: 'Create Quiz', exact: true }).click();
    const dialog = page.getByRole('dialog');
    await dialog.getByPlaceholder('e.g., Phishing Awareness Quiz').fill(prefix); await dialog.getByPlaceholder('What this quiz covers...').fill('Synthetic quiz');
    const response = page.waitForResponse(r => r.url().endsWith('/api/admin/quizzes') && r.request().method() === 'POST');
    await dialog.getByRole('button', { name: 'Create Quiz', exact: true }).click();
    const r = await response; if (r.status() === 201) created.push(`/api/admin/quizzes/${(await r.json()).quiz.id}`);
    assert.equal(r.status(), 201, await r.text());
  });
  await run('Appearance and session timeout persist after reload', async () => {
    await page.goto('/settings'); await page.getByRole('tab', { name: 'Appearance', exact: true }).click();
    const toggle = page.getByRole('switch', { name: 'Dark Mode', exact: true }); const before = await toggle.getAttribute('aria-checked'); await toggle.click();
    await page.reload(); await page.getByRole('tab', { name: 'Appearance', exact: true }).click(); assert.notEqual(await toggle.getAttribute('aria-checked'), before);
    await page.getByRole('tab', { name: 'Account Security', exact: true }).click();
    await page.getByLabel('Session Timeout (minutes)', { exact: true }).fill('15');
    await page.reload(); assert.equal(await page.getByLabel('Session Timeout (minutes)', { exact: true }).inputValue(), '15');
  });
  for (const [path, button] of [['/admin/content/videos', 'Add New Video'], ['/admin/content/mcqs', 'Add New MCQ']]) {
    await run(`${button} is usable`, async () => { await page.goto(path); assert.equal(await page.getByRole('button', { name: button, exact: true }).isEnabled(), true, 'Creation button is disabled; screen is a placeholder'); });
  }
  await run('Organization admin Users access', async () => {
    const org = await browser.newContext({ baseURL: base });
    try {
      assert.ok((await org.request.post('/api/login', { data: { email: 'orgadmin.1@audit.test', password } })).ok());
      const p = await org.newPage(); await p.goto('/org-admin/users');
      await p.getByRole('main').waitFor();
      assert.equal(await p.getByText("You don't have permission to view users.", { exact: true }).count(), 0, 'Organization admin is denied Users access');
    } finally { await org.close(); }
  });
} finally {
  for (const path of created.reverse()) await context.request.delete(path);
  await browser.close();
  const suffix = process.env.QA_UI_AREA ? '-' + process.env.QA_UI_AREA.replace(/[^a-z0-9]/gi, '-') : '';
  writeFileSync(`logs/feature-cycle/ui-forms${suffix}.json`, JSON.stringify(results, null, 2));
  process.exitCode = results.some(result => result.status === 'FAIL') ? 1 : 0;
}
