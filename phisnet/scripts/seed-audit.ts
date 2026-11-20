import { randomBytes, scryptSync } from 'node:crypto';
import { writeFileSync, existsSync, readFileSync } from 'node:fs';
import { pool } from '../server/db';
import { migrateRuntime, migrationPool } from './migrate-runtime';

async function seed() {
  const { rows: [info] } = await pool.query('SELECT current_database() AS name');
  if (info.name !== 'phishnet_audit') throw new Error('Audit seed is restricted to phishnet_audit');
  await migrateRuntime();
  await migrationPool.end();
  const password = existsSync('.env.audit.accounts') ? readFileSync('.env.audit.accounts','utf8').trim().split('=')[1] : randomBytes(16).toString('hex');
  writeFileSync('.env.audit.accounts', `AUDIT_PASSWORD=${password}\n`, { mode: 0o600 });
  for (const name of ['Audit Alpha', 'Audit Beta']) {
    let { rows: [org] } = await pool.query('SELECT id FROM organizations WHERE name=$1', [name]);
    if (!org) ({ rows: [org] } = await pool.query('INSERT INTO organizations(name,encryption_key) VALUES($1,$2) RETURNING id', [name,randomBytes(32).toString('base64')]));
    for (const role of ['Admin','OrgAdmin','Manager','User']) {
      const email = `${role.toLowerCase()}.${org.id}@audit.test`;
      const salt = randomBytes(32).toString('hex');
      const hash = `${scryptSync(password,salt,64).toString('hex')}.${salt}`;
      const { rows: [user] } = await pool.query(`INSERT INTO users(email,password,first_name,last_name,organization_id,organization_name,is_admin,email_verified)
        VALUES($1,$2,$3,'Tester',$4,$5,$6,true) ON CONFLICT(email) DO UPDATE SET password=$2 RETURNING id`, [email,hash,role,org.id,name,role==='Admin']);
      await pool.query('INSERT INTO user_roles(user_id,role_id) SELECT $1,id FROM roles WHERE name=$2 AND NOT EXISTS(SELECT 1 FROM user_roles ur WHERE ur.user_id=$1 AND ur.role_id=roles.id)', [user.id,role]);
    }
  }
  console.log('Audit accounts ready for Alpha and Beta. Password is in ignored .env.audit.accounts.');
}
seed().catch(error => { console.error(error); process.exitCode=1; }).finally(() => pool.end());
