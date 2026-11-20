import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { parse } from 'dotenv';
import assert from 'node:assert/strict';
import { chromium } from '@playwright/test';

const env = parse(readFileSync('.env.audit'));
if (new URL(env.DATABASE_URL).pathname !== '/phishnet_audit' || env.MAIL_TRANSPORT !== 'sink') throw new Error('Requires isolated audit database and mail sink');
const base = 'http://localhost:5000';
const password = parse(readFileSync('.env.audit.accounts')).AUDIT_PASSWORD;
const prefix = `QA cycle ${Date.now()}`;
const results = [], requests = [], fixtures = {};
const cleanup = [];
mkdirSync('logs/feature-cycle', { recursive: true });
async function check(area, action, fn) {
  try { const value = await fn(); results.push({ area, action, status: 'PASS' }); console.log(`PASS ${area}: ${action}`); return value; }
  catch (error) { results.push({ area, action, status: 'FAIL', error: error.message }); console.log(`FAIL ${area}: ${action}: ${error.message}`); }
}
const browser = await chromium.launch({ channel: process.env.E2E_BROWSER_CHANNEL || 'chrome', headless: true });
const sessions = {};
async function call(role, path, method = 'GET', data, allowed = [200, 201, 202, 204]) {
  const response = await sessions[role].request.fetch(base + path, { method, data, timeout: 20000 });
  const text = await response.text();
  let body; try { body = JSON.parse(text); } catch { body = text; }
  requests.push({ role, path, method, status: response.status() });
  assert.ok(allowed.includes(response.status()), `${method} ${path}: HTTP ${response.status()} ${text.slice(0, 600)}`);
  return body;
}
function deferred(path, role = 'admin') { cleanup.unshift(() => call(role, path, 'DELETE')); }
async function ui(role, path, contains, dialogButton) {
  const page = await sessions[role].newPage();
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  page.on('response', r => { if (r.url().includes('/api/') && r.status() >= 400) errors.push(`${r.status()} ${new URL(r.url()).pathname}`); });
  try {
    await page.goto(base + path);
    await page.locator('main:visible, h1:visible, button:visible').first().waitFor({ timeout: 15000 });
    if (path === '/admin/content/mcqs' && fixtures.quiz) {
      await page.getByText(fixtures.quiz.title, {exact:true}).click();
    }
    if (!await page.getByRole('main').count()) {
      results.push({ area: 'Employee navigation layout', action: `${role} ${path}`, status: 'FAIL', error: 'Page renders outside AppLayout: sidebar/header/main are missing' });
    }
    if (contains) await page.getByText(contains, { exact: false }).first().waitFor({ timeout: 10000 });
    if (dialogButton) {
      await page.getByRole('button', { name: dialogButton, exact: true }).first().click({ timeout: 5000 });
      await page.getByRole('dialog').waitFor({ timeout: 5000 });
      assert.ok((await page.getByRole('dialog').innerText()).length > 20, 'Dialog has no content');
    }
    assert.deepEqual(errors, [], 'Browser/API errors: ' + errors.join('; '));
    return (await page.locator('body').innerText()).slice(0, 400);
  } catch (e) {
    await page.screenshot({ path: `logs/feature-cycle/${role}-${path.replace(/[^a-z0-9]/gi, '_') || 'dashboard'}.png`, fullPage: true, timeout: 5000, animations: 'disabled' }).catch(() => {});
    throw new Error(`${role} ${path}: ${e.message}`);
  } finally { await page.close(); }
}
try {
  for (const role of ['admin', 'orgadmin', 'user']) {
    sessions[role] = await browser.newContext({ baseURL: base });
    await check('Authentication', `${role} login and session`, async () => {
      const user = await call(role, '/api/login', 'POST', { email: `${role}.1@audit.test`, password });
      fixtures[role] = user;
      assert.equal((await call(role, '/api/user')).email, `${role}.1@audit.test`);
    });
  }
  const createdBy = fixtures.admin.id, organizationId = fixtures.admin.organizationId;
  const employeeId = fixtures.user.id;
  await check('Groups and recipients', 'create, edit, add recipient, CSV import and read back', async () => {
    const g = await call('admin', '/api/groups', 'POST', { name: prefix, description: 'Synthetic feature audit' }); fixtures.group = g; deferred(`/api/groups/${g.id}`);
    await call('admin', `/api/groups/${g.id}`, 'PUT', { name: prefix + ' edited', description: 'Updated' });
    const target = await call('admin', `/api/groups/${g.id}/targets`, 'POST', { email: 'qa-cycle-recipient@audit.test', firstName: 'Synthetic', lastName: 'Recipient' }); fixtures.target = target;
    const csv = await sessions.admin.request.post(`/api/groups/${g.id}/import`, { multipart: { file: { name: 'qa.csv', mimeType: 'text/csv', buffer: Buffer.from('firstName,lastName,email\nQA,Imported,qa-imported@audit.test\n') } } });
    assert.ok(csv.ok(), `CSV import: HTTP ${csv.status()} ${await csv.text()}`);
    const targets = await call('admin', `/api/groups/${g.id}/targets`); assert.ok(targets.some(t => t.email === 'qa-cycle-recipient@audit.test'));
    await ui('admin', '/groups', prefix);
    await ui('orgadmin', '/org-admin/groups', prefix);
  });
  await check('Email templates', 'create, edit and verify saved content', async () => {
    const data = { name: prefix, subject: 'Synthetic training', htmlContent: '<p>QA <a href="{{TrackingURL}}">Training</a></p>', senderName: 'QA', senderEmail: 'qa@audit.test' };
    const t = await call('admin', '/api/email-templates', 'POST', data); fixtures.template = t; deferred(`/api/email-templates/${t.id}`);
    await call('admin', `/api/email-templates/${t.id}`, 'PUT', { ...data, subject: 'Edited QA subject' });
    const saved = (await call('admin', '/api/email-templates')).find(v => v.id === t.id); assert.equal(saved.subject, 'Edited QA subject');
    await ui('admin', '/templates', prefix); await ui('orgadmin', '/org-admin/templates', prefix);
  });
  await check('Landing pages', 'create, edit and list', async () => {
    const data = { name: prefix, htmlContent: '<h1>Synthetic landing</h1>', captureCredentials: true };
    const p = await call('admin', '/api/landing-pages', 'POST', data); fixtures.landing = p; deferred(`/api/landing-pages/${p.id}`);
    await call('admin', `/api/landing-pages/${p.id}`, 'PUT', { ...data, htmlContent: '<h1>Edited synthetic landing</h1>' });
    assert.ok((await call('admin', '/api/landing-pages')).some(v => v.id === p.id));
    await ui('admin', '/landing-pages', prefix); await ui('orgadmin', '/org-admin/landing-pages', prefix);
  });
  await check('SMTP profiles', 'create, update, list and redact password', async () => {
    const p = await call('admin', '/api/smtp-profiles', 'POST', { name: prefix, host: 'localhost', port: 1025, username: 'qa', password: 'SyntheticOnly123!', fromEmail: 'qa@audit.test', fromName: 'QA' }); fixtures.smtp = p; deferred(`/api/smtp-profiles/${p.id}`);
    await call('admin', `/api/smtp-profiles/${p.id}`, 'PUT', { name: prefix + ' edited' });
    const saved = (await call('admin', '/api/smtp-profiles')).find(v => v.id === p.id); assert.equal(saved.name, prefix + ' edited'); assert.ok(!saved.password);
    await ui('admin', '/smtp-profiles', prefix); await ui('orgadmin', '/org-admin/smtp-profiles', prefix);
  });
  await check('Campaigns', 'create draft, edit, launch, pause, resume, cancel', async () => {
    assert.ok(fixtures.group && fixtures.smtp && fixtures.template && fixtures.landing, 'Prerequisite resource creation failed');
    const data = { name: prefix, targetGroupId: fixtures.group.id, smtpProfileId: fixtures.smtp.id, emailTemplateId: fixtures.template.id, landingPageId: fixtures.landing.id };
    const c = await call('admin', '/api/campaigns', 'POST', data); fixtures.campaign = c; deferred(`/api/campaigns/${c.id}`);
    await call('admin', `/api/campaigns/${c.id}`, 'PUT', { ...data, name: prefix + ' edited' });
    await ui('admin', '/campaigns', prefix); await ui('orgadmin', '/org-admin/campaigns', prefix);
    for (const action of ['launch', 'pause', 'resume', 'cancel']) await call('admin', `/api/campaigns/${c.id}/${action}`, 'POST', {});
    const saved = await call('admin', `/api/campaigns/${c.id}`); assert.equal(saved.status, 'Cancelled');
  });
  async function content(area, path, data, envelope, key) {
    let item = await check(area, 'create with the fields sent by the UI', async () => {
      const response = await call('admin', path, 'POST', data); return response[envelope] || response;
    });
    if (!item && key !== 'article' && key !== 'deck') {
      // Keep checking downstream behavior while recording the failed normal request.
      item = await check(area, 'create fixture with explicit server-managed fields (workaround)', async () => {
        const response = await call('admin', path, 'POST', { ...data, organizationId, createdBy }); return response[envelope] || response;
      });
    }
    if (item) { fixtures[key] = item; deferred(`${path}/${item.id}`); }
    return item;
  }
  const module = await content('Training/videos', '/api/admin/training-modules', { title: prefix, category: 'phishing', difficulty: 'beginner', durationMinutes: 2, videoUrl: 'https://example.com/synthetic.mp4' }, 'module', 'module');
  if (module) await check('Training assignments and employee progress', 'assign, read, complete and verify', async () => {
    await call('admin', '/api/admin/training-assignments', 'POST', { userIds: [employeeId], moduleId: module.id, dueDays: 7 });
    await call('user', `/api/employee/training/${module.id}`);
    await ui('admin', '/admin/training', prefix); await ui('user', '/employee/training', prefix);
    await call('user', `/api/employee/training/${module.id}/progress`, 'POST', { progressPercentage: 100, videoTimestamp: 120, status: 'completed' });
    const assignments = await call('admin', '/api/admin/training-assignments'); assert.ok(assignments.assignments.some(a => a.module_id === module.id && a.status === 'completed'));
  });
  await check('Videos content screen', 'created training video appears and creation control works', () => ui('admin', '/admin/content/videos', prefix));
  const quiz = await content('Quizzes/MCQs', '/api/admin/quizzes', { title: prefix, passingScore: 80, showCorrectAnswers: true }, 'quiz', 'quiz');
  if (quiz) await check('Quiz questions and employee attempts', 'add question, publish, answer correctly and verify score', async () => {
    const data = { questionText: 'Should suspicious links be reported?', questionType: 'multiple_choice', options: ['Yes', 'No'], correctAnswer: 'Yes', points: 10 };
    let question = await check('Quiz questions', 'create with UI fields', async () => (await call('admin', `/api/admin/quizzes/${quiz.id}/questions`, 'POST', data)).question);
    if (!question) question = (await call('admin', `/api/admin/quizzes/${quiz.id}/questions`, 'POST', { ...data, quizId: quiz.id })).question;
    await call('admin', `/api/admin/quizzes/${quiz.id}/publish`, 'PATCH', { published: true });
    await ui('admin', '/admin/quizzes', prefix); await ui('user', '/employee/quizzes', prefix);
    const attempt = await call('user', `/api/employee/quizzes/${quiz.id}/submit`, 'POST', { answers: { [question.id]: 'Yes' }, startedAt: new Date(Date.now() - 5000).toISOString() });
    assert.ok(JSON.stringify(attempt).includes('100'), 'Correct answer did not produce 100%');
    await call('user', '/api/employee/certificates');
  });
  await check('MCQ content screen', 'created quiz question is available', () => ui('admin', '/admin/content/mcqs', 'Should suspicious links be reported?'));
  const badge = await content('Badges', '/api/admin/badges', { name: prefix, category: 'milestone', criteria: { type: 'quizzes_completed', count: 1 }, rarity: 'common', pointsAwarded: 5 }, 'badge', 'badge');
  if (badge) await check('Badges', 'edit, publish and employee listing', async () => {
    await call('admin', `/api/admin/badges/${badge.id}`, 'PUT', { name: prefix + ' edited' });
    await call('admin', `/api/admin/badges/${badge.id}/publish`, 'PATCH', { published: true });
    await ui('admin', '/admin/badges', prefix); await call('user', '/api/employee/badges'); await ui('user', '/employee/badges');
  });
  const article = await content('Articles', '/api/admin/articles', { title: prefix, content: '<p>Synthetic phishing awareness article.</p>', category: 'phishing', readTimeMinutes: 1 }, 'article', 'article');
  if (article) await check('Articles', 'edit, publish, employee detail and notification', async () => {
    await call('admin', `/api/admin/articles/${article.id}`, 'PUT', { title: prefix + ' edited' });
    await call('admin', `/api/admin/articles/${article.id}/publish`, 'PATCH', { published: true });
    await call('user', `/api/employee/articles/${article.id}`);
    await ui('admin', '/admin/content/articles', prefix); await ui('user', '/employee/articles', prefix); await ui('user', `/employee/articles/${article.id}`, prefix);
  });
  const deck = await content('Flashcards', '/api/admin/flashcard-decks', { title: prefix, category: 'phishing', description: 'Synthetic flashcards' }, 'deck', 'deck');
  if (deck) await check('Flashcards', 'add/edit card, publish and employee read', async () => {
    const response = await call('admin', `/api/admin/flashcard-decks/${deck.id}/cards`, 'POST', { frontContent: 'What is phishing?', backContent: 'A deceptive attempt to obtain information.' });
    const card = response.card || response.flashcard || response;
    await call('admin', `/api/admin/flashcards/${card.id}`, 'PUT', { backContent: 'Report suspicious messages.' });
    await call('admin', `/api/admin/flashcard-decks/${deck.id}/publish`, 'PATCH', { published: true });
    await call('user', `/api/employee/flashcard-decks/${deck.id}/cards`);
    await ui('admin', '/admin/content/flashcards', prefix); await ui('user', '/employee/flashcards', prefix);
  });
  await check('Report schedules', 'create, edit, list and delete', async () => {
    const schedule = await call('admin', '/api/reports/schedules', 'POST', { type: 'executive', cadence: 'weekly', timeOfDay: '09:00', timezone: 'Asia/Karachi', recipients: 'qa@audit.test', enabled: false }); deferred(`/api/reports/schedules/${schedule.id}`);
    await call('admin', `/api/reports/schedules/${schedule.id}`, 'PUT', { timeOfDay: '10:00' });
    assert.ok((await call('admin', '/api/reports/schedules')).some(s => s.id === schedule.id)); await ui('admin', '/report-schedules');
  });
  await check('Reports', 'data and PDF/CSV/XLSX export/download', async () => {
    await call('admin', '/api/reports/data');
    for (const format of ['pdf', 'csv', 'xlsx']) {
      const output = await call('admin', '/api/reports/export', 'POST', { type: 'comprehensive', format });
      const url = output.downloadUrl || output.url; assert.ok(url, `No download URL for ${format}: ${JSON.stringify(output)}`);
      const download = await sessions.admin.request.get(url); assert.ok(download.ok(), `Download ${format}: ${download.status()}`); assert.ok((await download.body()).length > 20);
    }
    await ui('admin', '/reports'); await ui('orgadmin', '/org-admin/reports');
  });
  await check('Enrollment', 'invite, list, resend and revoke', async () => {
    const r = await call('admin', '/api/admin/enroll/invite', 'POST', { emails: [`qa-${Date.now()}@audit.test`] });
    assert.equal(r.successCount, 1, JSON.stringify(r)); const id = r.success[0].id; deferred(`/api/admin/enroll/invites/${id}`);
    await call('admin', `/api/admin/enroll/invites/${id}/resend`, 'POST', {}); await call('admin', '/api/admin/enroll/invites'); await ui('admin', '/enrollment'); await ui('orgadmin', '/org-admin/enrollment');
  });
  await check('Users', 'create, edit and verify login', async () => {
    const email = `qa-user-${Date.now()}@audit.test`;
    const user = await call('admin', '/api/users', 'POST', { firstName: 'QA', lastName: 'Cycle', email, password: 'SyntheticOnly123!' }); deferred(`/api/users/${user.id}`);
    await call('admin', `/api/users/${user.id}`, 'PUT', { firstName: 'EditedQA', lastName: 'Cycle', email, isActive: true });
    const context = await browser.newContext({ baseURL: base });
    try {
      const r = await context.request.post('/api/login', { data: { email, password: 'SyntheticOnly123!' } }); assert.ok(r.ok(), `New user login: ${r.status()} ${await r.text()}`);
      await check('Profile and password', 'update profile and change password on a disposable user', async () => {
        const profile = await context.request.put('/api/user/profile', { data: { firstName: 'EditedQA', bio: 'Synthetic QA profile' } }); assert.ok(profile.ok());
        const change = await context.request.post('/api/user/change-password', { data: { currentPassword: 'SyntheticOnly123!', newPassword: 'ChangedOnly123!' } }); assert.ok(change.ok(), await change.text());
        const login = await context.request.post('/api/login', { data: { email, password: 'ChangedOnly123!' } }); assert.ok(login.ok(), 'Changed password did not work');
        const reset = await context.request.post('/api/forgot-password', { data: { email } }); assert.ok(reset.ok(), `Password recovery HTTP ${reset.status()}`);
      });
    } finally { await context.close(); }
    await ui('admin', '/users', 'EditedQA'); await ui('orgadmin', '/org-admin/users', 'EditedQA');
  });
  await check('Organization management', 'create, edit and list', async () => {
    const org = await call('admin', '/api/admin/organizations', 'POST', { name: prefix, dataRetentionDays: 365 }); deferred(`/api/admin/organizations/${org.id}`);
    await call('admin', `/api/admin/organizations/${org.id}`, 'PUT', { name: prefix + ' edited' });
    assert.ok((await call('admin', '/api/admin/organizations')).some(o => o.id === org.id)); await ui('admin', '/organization-management', prefix);
  });
  await check('Organization preferences', 'save, read back and restore', async () => {
    const before = await call('orgadmin', '/api/organization/preferences');
    try { const changed = { ...before, timezone: 'Asia/Karachi' }; await call('orgadmin', '/api/organization/preferences', 'PUT', changed); assert.equal((await call('orgadmin', '/api/organization/preferences')).timezone, 'Asia/Karachi'); }
    finally { await call('orgadmin', '/api/organization/preferences', 'PUT', before); }
    await ui('orgadmin', '/org-admin/settings');
  });
  await check('Governance data retention', 'save, read back and restore policy', async () => {
    const previous = await call('admin', '/api/data-retention/policy');
    try { await call('admin', '/api/data-retention/policy', 'PUT', { days: 300 }); assert.equal((await call('admin', '/api/data-retention/policy')).dataRetentionDays, 300); }
    finally { await call('admin', '/api/data-retention/policy', 'PUT', { days: previous.dataRetentionDays }); }
    await call('admin', '/api/data-retention/status');
  });
  await check('Notification preferences', 'toggle, read back and restore', async () => {
    const previous = await call('user', '/api/notifications/preferences');
    const before = previous.campaignAlerts ?? previous.campaign_alerts ?? true;
    try {
      await call('user', '/api/notifications/preferences', 'PUT', { campaignAlerts: !before });
      const after = await call('user', '/api/notifications/preferences'); assert.equal(after.campaignAlerts ?? after.campaign_alerts, !before);
    } finally { await call('user', '/api/notifications/preferences', 'PUT', { campaignAlerts: before }); }
  });
  await check('Settings appearance and session timeout', 'change theme and session timeout, reload and verify', async () => {
    const page = await sessions.user.newPage();
    try {
      await page.goto(base + '/settings');
      await page.getByRole('tab', { name: 'Appearance', exact: true }).click();
      const toggle = page.getByRole('switch', { name: 'Dark Mode', exact: true });
      const previous = await toggle.getAttribute('aria-checked'); await toggle.click();
      await page.reload(); await page.getByRole('tab', { name: 'Appearance', exact: true }).click();
      assert.notEqual(await toggle.getAttribute('aria-checked'), previous);
      await page.getByRole('tab', { name: 'Account Security', exact: true }).click();
      await page.getByLabel('Session Timeout (minutes)', { exact: true }).fill('15');
      await page.reload(); assert.equal(await page.getByLabel('Session Timeout (minutes)', { exact: true }).inputValue(), '15');
    } finally { await page.close(); }
  });
  await check('Managed delivery', 'create sink profile, register synthetic domain and inspect capabilities', async () => {
    const p = await call('orgadmin', '/api/delivery/managed-profile', 'POST', { name: prefix, fromName: 'QA', fromEmail: 'qa@audit.test' }); deferred(`/api/smtp-profiles/${p.id}`, 'orgadmin');
    await call('orgadmin', '/api/delivery/domains', 'POST', { domain: `qa-${Date.now()}.invalid` });
    const caps = await call('orgadmin', '/api/delivery/capabilities'); assert.equal(caps.testMode, true); await ui('orgadmin', '/org-admin/delivery');
  });
  await check('Notifications', 'read generated article notification, mark read and delete', async () => {
    const response = await call('user', '/api/notifications'); const list = Array.isArray(response) ? response : response.notifications;
    const notification = list.find(n => JSON.stringify(n).includes(prefix)); assert.ok(notification, 'Created article did not generate an employee notification');
    await call('user', `/api/notifications/${notification.id}/read`, 'PUT', {}); await ui('user', '/notifications', prefix); await call('user', `/api/notifications/${notification.id}`, 'DELETE');
  });
  await check('Reconnaissance', 'synthetic HTML conversion, email variations and service configuration', async () => {
    await call('admin', '/api/reconnaissance/convert', 'POST', { html: '<h1>QA heading</h1><p>Synthetic content.</p>' });
    const r = await call('admin', '/api/reconnaissance/email-variations', 'POST', { firstName: 'Synthetic', lastName: 'Person', domain: 'audit.test' }); assert.ok(r.data.count > 0);
    fixtures.serviceStatus = await call('admin', '/api/reconnaissance/service-status'); await ui('admin', '/reconnaissance');
  });
  for (const [role, paths] of Object.entries({ admin: ['/', '/admin/operations', '/organization', '/settings', '/profile', '/threat-landscape', '/audit-logs', '/admin/credential-captures'], orgadmin: ['/org-admin', '/org-admin/training-assignments'], user: ['/employee', '/employee/leaderboard', '/employee/profile'] })) {
    for (const path of paths) await check('Additional browser surfaces', `${role} ${path}`, () => ui(role, path));
  }
} finally {
  for (const remove of cleanup) await check('Cleanup', 'delete synthetic resource', remove);
  for (const context of Object.values(sessions)) await context.close();
  await browser.close();
  writeFileSync('logs/feature-cycle/results.json', JSON.stringify({ runAt: new Date().toISOString(), prefix, results, requests, serviceStatus: fixtures.serviceStatus }, null, 2));
  console.log(JSON.stringify({ passed: results.filter(r => r.status === 'PASS').length, failed: results.filter(r => r.status === 'FAIL').length, report: 'logs/feature-cycle/results.json' }));
  process.exitCode = results.some(result => result.status === 'FAIL') ? 1 : 0;
}
