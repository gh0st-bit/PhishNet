import { parse } from 'dotenv';
import pg from 'pg';
import { randomBytes } from 'node:crypto';
import { readFileSync,writeFileSync } from 'node:fs';

const env=parse(readFileSync('.env.audit'));
const control=env.MIGRATION_DATABASE_URL || env.CONTROL_DATABASE_URL || env.DATABASE_URL;
if(new URL(control).pathname!=='/phishnet_audit') throw new Error('Only the audit database may be provisioned by this helper');
const client=new pg.Client({connectionString:control});
await client.connect();
try {
  await client.query('BEGIN');
  if(!(await client.query("SELECT 1 FROM pg_roles WHERE rolname='phishnet_audit_web'")).rowCount) await client.query('CREATE ROLE phishnet_audit_web NOINHERIT');
  const password=randomBytes(32).toString('hex');
  await client.query(`ALTER ROLE phishnet_audit_web LOGIN PASSWORD '${password}' NOSUPERUSER NOBYPASSRLS NOCREATEDB NOCREATEROLE NOINHERIT`);
  await client.query('GRANT phishnet_tenant TO phishnet_audit_web');
  if(!(await client.query("SELECT 1 FROM pg_roles WHERE rolname='phishnet_audit_control'")).rowCount)await client.query('CREATE ROLE phishnet_audit_control NOINHERIT');
  const controlPassword=randomBytes(32).toString('hex');
  await client.query(`ALTER ROLE phishnet_audit_control LOGIN PASSWORD '${controlPassword}' NOSUPERUSER BYPASSRLS NOCREATEDB NOCREATEROLE NOINHERIT`);
  await client.query('GRANT USAGE ON SCHEMA public TO phishnet_audit_control');
  await client.query('GRANT SELECT,INSERT,UPDATE,DELETE ON ALL TABLES IN SCHEMA public TO phishnet_audit_control');
  await client.query('GRANT USAGE,SELECT ON ALL SEQUENCES IN SCHEMA public TO phishnet_audit_control');
  await client.query('ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT,INSERT,UPDATE,DELETE ON TABLES TO phishnet_audit_control');
  await client.query('ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT USAGE,SELECT ON SEQUENCES TO phishnet_audit_control');
  await client.query('COMMIT');
  const controlUrl=new URL(control);controlUrl.username='phishnet_audit_control';controlUrl.password=controlPassword;
  const restricted=new URL(control);restricted.username='phishnet_audit_web';restricted.password=password;
  env.DATABASE_URL=restricted.toString();env.CONTROL_DATABASE_URL=controlUrl.toString();env.MIGRATION_DATABASE_URL=control;
  writeFileSync('.env.audit',Object.entries(env).map(([key,value])=>`${key}=${value}`).join('\n')+'\n',{mode:0o600});
  console.log('Audit requests now connect as a non-owner runtime login. Control credentials were preserved separately.');
} catch(error){await client.query('ROLLBACK');throw error;}
finally {await client.end();}
