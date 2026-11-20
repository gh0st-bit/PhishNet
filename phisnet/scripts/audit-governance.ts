import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { writeFileSync } from 'node:fs';
import { pool } from '../server/db';
import SecretsService from '../server/services/secrets.service';

const base = 'http://localhost:5000';
const results: { area: string; status: string; detail?: string }[] = [];
const name = `QA governance ${randomUUID()}`;
const email = `qa-governance-${randomUUID()}@audit.test`;
let orgId: number | undefined, userId: number | undefined, cookie = '';
async function check(area: string, fn: () => Promise<void>) {
  try { await fn(); results.push({ area, status: 'PASS' }); console.log('PASS', area); }
  catch (error: any) { results.push({ area, status: 'FAIL', detail: error.message }); console.log('FAIL', area, error.message); }
}
async function request(path: string, method = 'GET', body?: unknown, session = cookie) {
  return fetch(base + path, { method, headers: { 'Content-Type': 'application/json', cookie: session }, body: body === undefined ? undefined : JSON.stringify(body), redirect: 'manual' });
}
try {
  assert.equal((await pool.query('SELECT current_database() AS name')).rows[0].name, 'phishnet_audit');
  await check('Registration, email verification and new tenant login', async () => {
    const created = await request('/api/register', 'POST', { email, firstName: 'QA', lastName: 'Governance', password: 'QaCycle123!Test', organizationName: name });
    assert.equal(created.status, 201, await created.text());
    const { rows: [user] } = await pool.query('SELECT id,organization_id,email_verification_token FROM users WHERE email=$1', [email]);
    userId = user.id; orgId = user.organization_id;
    const verified = await request(`/api/verify-email?token=${encodeURIComponent(user.email_verification_token)}`);
    assert.ok([200, 302].includes(verified.status), `Verification HTTP ${verified.status}`);
    const login = await request('/api/login', 'POST', { email, password: 'QaCycle123!Test' }); assert.equal(login.status, 200, await login.text());
    cookie = login.headers.getSetCookie().map(v => v.split(';')[0]).join('; ');
    // This disposable tenant is used to exercise admin governance without
    // changing Audit Alpha/Beta security settings or their encryption keys.
    await pool.query('UPDATE users SET is_admin=true WHERE id=$1', [userId]);
  });
  if (orgId && userId) {
    await check('Password recovery, reset and new-password login', async () => {
      const recovery = await request('/api/forgot-password', 'POST', { email }); assert.equal(recovery.status, 200);
      const { rows: [token] } = await pool.query('SELECT token FROM password_reset_tokens WHERE user_id=$1 ORDER BY id DESC LIMIT 1', [userId]);
      const reset = await request('/api/reset-password', 'POST', { token: token.token, password: 'ResetCycle123!' }); assert.equal(reset.status, 200, await reset.text());
      const login = await request('/api/login', 'POST', { email, password: 'ResetCycle123!' }); assert.equal(login.status, 200, await login.text());
      cookie = login.headers.getSetCookie().map(v => v.split(';')[0]).join('; ');
    });
    await check('SSO configuration save, read and delete', async () => {
      const config = { provider: 'saml', enabled: false, entityId: 'urn:qa:audit', ssoUrl: 'https://idp.invalid/sso', certificate: 'SYNTHETIC CERTIFICATE' };
      const saved = await request('/api/sso/config', 'PUT', config); assert.equal(saved.status, 200, await saved.text());
      const response = await request('/api/sso/config'); const read = await response.json(); assert.equal(read.entityId, config.entityId); assert.equal(read.certificate, undefined);
      assert.equal((await request('/api/sso/config', 'DELETE')).status, 200);
    });
    await check('Disabled key rotation preserves existing encrypted data', async () => {
      const value = await SecretsService.encrypt(orgId!, 'Synthetic secret for rotation audit');
      assert.equal(await SecretsService.decrypt(orgId!, value), 'Synthetic secret for rotation audit');
      const rotated = await request('/api/secrets/rotate', 'POST', {}); assert.equal(rotated.status, 409);
      assert.equal(await SecretsService.decrypt(orgId!, value), 'Synthetic secret for rotation audit');
    });
    await check('Enrollment acceptance creates an employee who can sign in', async () => {
      const employeeEmail = `qa-invite-${randomUUID()}@audit.test`;
      const invited = await request('/api/admin/enroll/invite', 'POST', { email: employeeEmail });
      assert.equal(invited.status, 201); const data = await invited.json(); assert.equal(data.successCount, 1);
      const form = await request(`/api/enroll/accept?token=${encodeURIComponent(data.success[0].token)}`); assert.equal(form.status, 200);
      const accepted = await request('/api/enroll/accept', 'POST', { token: data.success[0].token, firstName: 'QA', lastName: 'Invited', password: 'QaCycle123!Test' });
      assert.ok([200, 302].includes(accepted.status), `Accept HTTP ${accepted.status}: ${await accepted.text()}`);
      const login = await request('/api/login', 'POST', { email: employeeEmail, password: 'QaCycle123!Test' }); assert.equal(login.status, 200, await login.text());
    });
  }
} finally {
  if (orgId) {
    await pool.query('DELETE FROM audit_logs WHERE organization_id=$1', [orgId]);
    await pool.query('DELETE FROM organizations WHERE id=$1', [orgId]);
  }
  await pool.end();
  writeFileSync('logs/feature-cycle/governance.json', JSON.stringify(results, null, 2));
  process.exitCode = results.some(result => result.status === 'FAIL') ? 1 : 0;
}
