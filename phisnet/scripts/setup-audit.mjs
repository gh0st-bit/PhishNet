import 'dotenv/config';
import pg from 'pg';
import { randomBytes } from 'node:crypto';
import { writeFileSync, existsSync, readFileSync } from 'node:fs';

// Never seed or migrate the developer's configured database.
const database = 'phishnet_audit';
// A copied audit env file can contain role passwords from another PC. Always
// recover the administrator connection from this machine's root .env instead.
const source = new URL(process.env.DATABASE_URL || '');
const client = new pg.Client({ connectionString: source.toString() });
await client.connect();
try {
  const found = await client.query('SELECT 1 FROM pg_database WHERE datname=$1', [database]);
  if (!found.rowCount) await client.query('CREATE DATABASE phishnet_audit');
} finally { await client.end(); }
source.pathname = '/' + database;
// Reconcile the local audit logins on every setup. This only touches the
// isolated audit role names and never drops or truncates a database.
const webPassword=randomBytes(32).toString('hex');
const controlPassword=randomBytes(32).toString('hex');
const quoted=value=>`'${value.replaceAll("'","''")}'`;
let previousAuditEnv={};
if(existsSync('.env.audit')){
 const {parse}=await import('dotenv');
 previousAuditEnv=parse(readFileSync('.env.audit','utf8'));
}
const isolatedAdmin=new pg.Client({connectionString:source.toString()});
await isolatedAdmin.connect();
try{
 await isolatedAdmin.query('BEGIN');
 for(const role of ['phishnet_audit_web','phishnet_audit_control']){
   if(!(await isolatedAdmin.query('SELECT 1 FROM pg_roles WHERE rolname=$1',[role])).rowCount)
     await isolatedAdmin.query(`CREATE ROLE ${role} NOINHERIT`);
 }
 if(!(await isolatedAdmin.query("SELECT 1 FROM pg_roles WHERE rolname='phishnet_tenant'")).rowCount)
   await isolatedAdmin.query('CREATE ROLE phishnet_tenant NOLOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOBYPASSRLS');
 await isolatedAdmin.query(`ALTER ROLE phishnet_audit_web LOGIN PASSWORD ${quoted(webPassword)} NOSUPERUSER NOBYPASSRLS NOCREATEDB NOCREATEROLE NOINHERIT`);
 await isolatedAdmin.query(`ALTER ROLE phishnet_audit_control LOGIN PASSWORD ${quoted(controlPassword)} NOSUPERUSER BYPASSRLS NOCREATEDB NOCREATEROLE NOINHERIT`);
 await isolatedAdmin.query('GRANT phishnet_tenant TO phishnet_audit_web');
 await isolatedAdmin.query('GRANT USAGE ON SCHEMA public TO phishnet_audit_control');
 await isolatedAdmin.query('GRANT SELECT,INSERT,UPDATE,DELETE ON ALL TABLES IN SCHEMA public TO phishnet_audit_control');
 await isolatedAdmin.query('GRANT USAGE,SELECT ON ALL SEQUENCES IN SCHEMA public TO phishnet_audit_control');
 await isolatedAdmin.query('ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT,INSERT,UPDATE,DELETE ON TABLES TO phishnet_audit_control');
 await isolatedAdmin.query('ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT USAGE,SELECT ON SEQUENCES TO phishnet_audit_control');
 await isolatedAdmin.query('COMMIT');
}catch(error){await isolatedAdmin.query('ROLLBACK');throw error;}finally{await isolatedAdmin.end();}
const runtime=new URL(source);runtime.username='phishnet_audit_web';runtime.password=webPassword;
const control=new URL(source);control.username='phishnet_audit_control';control.password=controlPassword;
writeFileSync('.env.audit', [
  `DATABASE_URL=${runtime}`, `CONTROL_DATABASE_URL=${control}`, `MIGRATION_DATABASE_URL=${source}`,
  `DB_HOST=${source.hostname}`, `DB_PORT=${source.port || 5432}`,
  `DB_NAME=${database}`, `DB_USER=phishnet_audit_web`, `DB_PASSWORD=${webPassword}`,
  `SESSION_SECRET=${previousAuditEnv.SESSION_SECRET||randomBytes(48).toString('hex')}`,
  `MASTER_ENCRYPTION_KEY=${Buffer.from(previousAuditEnv.MASTER_ENCRYPTION_KEY||'','base64').length===32?previousAuditEnv.MASTER_ENCRYPTION_KEY:randomBytes(32).toString('base64')}`,
  'NODE_ENV=development', 'HOST=127.0.0.1', 'PORT=5000', 'APP_BASE_URL=http://localhost:5000',
  'CAMPAIGN_SCHEDULER_ENABLED=false', 'THREAT_FEED_ENABLED=false', 'DATA_RETENTION_ENABLED=false',
  'REPORT_SCHEDULER_ENABLED=false', 'SMTP_HOST=127.0.0.1', 'SMTP_PORT=1025', 'SMTP_USER=', 'SMTP_PASS=',
  'MAIL_TRANSPORT=sink', 'PWNED_PASSWORDS_ENABLED=false', 'CAPTURE_RETENTION_DAYS=7', ''
].join('\n'), { mode: 0o600 });
const isolated = new pg.Client({ connectionString: source.toString() });
await isolated.connect();
try {
  if (!(await isolated.query("SELECT to_regclass('public.users') AS users")).rows[0].users) {
    await isolated.query('BEGIN');
    await isolated.query(readFileSync('migrations/0000_melodic_argent.sql', 'utf8'));
    await isolated.query('COMMIT');
  }
} catch (error) { await isolated.query('ROLLBACK'); throw error; }
finally { await isolated.end(); }
console.log('Isolated baseline ready. Run npm run audit:seed, then npm run dev:audit.');
