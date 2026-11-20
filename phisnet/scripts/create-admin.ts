// One-time production bootstrap: creates the first organization and its platform administrator.
// Refuses to run if any platform administrator already exists. The password is read from the
// ADMIN_PASSWORD environment variable and is never printed. MFA setup is enforced at first sign-in
// (production requires it for Admin and OrgAdmin accounts).
import { randomBytes, scrypt } from 'node:crypto';
import { promisify } from 'node:util';
import { migrationPool as pool } from './migrate-runtime';

const scryptAsync = promisify(scrypt);

async function createAdmin() {
  const email = (process.env.ADMIN_EMAIL || '').trim().toLowerCase();
  const firstName = (process.env.ADMIN_FIRST_NAME || '').trim();
  const lastName = (process.env.ADMIN_LAST_NAME || '').trim();
  const orgName = (process.env.ADMIN_ORGANIZATION || '').trim();
  const password = process.env.ADMIN_PASSWORD || '';
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error('Set ADMIN_EMAIL to a valid address');
  if (!firstName || !lastName) throw new Error('Set ADMIN_FIRST_NAME and ADMIN_LAST_NAME');
  if (!orgName || orgName.length > 200) throw new Error('Set ADMIN_ORGANIZATION (1 to 200 characters)');
  if (password.length < 12) throw new Error('ADMIN_PASSWORD must be at least 12 characters');

  const salt = randomBytes(16).toString('hex');
  const hash = `${((await scryptAsync(password, salt, 64)) as Buffer).toString('hex')}.${salt}`;

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query("SELECT pg_advisory_xact_lock(hashtext('phishnet-admin-bootstrap'))");
    if (!(await client.query("SELECT to_regclass('public.users') AS t")).rows[0].t) throw new Error('Run the migrate step first');
    if ((await client.query('SELECT 1 FROM users WHERE is_admin LIMIT 1')).rowCount) throw new Error('A platform administrator already exists; refusing to create another');
    if ((await client.query('SELECT 1 FROM users WHERE lower(email)=$1', [email])).rowCount) throw new Error('That email is already registered');
    const { rows: [role] } = await client.query("SELECT id FROM roles WHERE name='Admin'");
    if (!role) throw new Error('Default roles are missing; run the migrate step first');
    let { rows: [org] } = await client.query('SELECT id FROM organizations WHERE lower(name)=lower($1)', [orgName]);
    if (!org) ({ rows: [org] } = await client.query('INSERT INTO organizations(name,encryption_key) VALUES($1,$2) RETURNING id', [orgName, randomBytes(32).toString('base64')]));
    const { rows: [user] } = await client.query(
      `INSERT INTO users(email,password,first_name,last_name,organization_id,organization_name,is_admin,email_verified)
       VALUES($1,$2,$3,$4,$5,$6,true,true) RETURNING id`,
      [email, hash, firstName, lastName, org.id, orgName]);
    await client.query('INSERT INTO user_roles(user_id,role_id) VALUES($1,$2)', [user.id, role.id]);
    await client.query('COMMIT');
    console.log(`Platform administrator created for ${email}. Sign in to finish MFA setup.`);
  } catch (error) { await client.query('ROLLBACK'); throw error; }
  finally { client.release(); }
}

createAdmin().catch(error => { console.error(error.message); process.exitCode = 1; }).finally(() => pool.end());
