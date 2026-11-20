import 'dotenv/config';
import pg from 'pg';
import { readFileSync } from 'node:fs';
const name='phishnet_audit_verify';
const url=new URL(process.env.DATABASE_URL);
const admin=new pg.Client({connectionString:url.toString()});
await admin.connect();
try {
  if ((await admin.query('SELECT 1 FROM pg_database WHERE datname=$1',[name])).rowCount) {
    if (!process.argv.includes('--recover-empty')) throw new Error('Verification database already exists; refusing to overwrite it');
    const inspectionUrl=new URL(url);inspectionUrl.pathname='/'+name;
    const inspection=new pg.Client({connectionString:inspectionUrl.toString()});await inspection.connect();
    const count=(await inspection.query("SELECT count(*)::int AS count FROM pg_tables WHERE schemaname='public'")).rows[0].count;
    await inspection.end();
    if(count) throw new Error('Verification database contains tables; refusing recovery');
    await admin.query('DROP DATABASE phishnet_audit_verify');
  }
  await admin.query('CREATE DATABASE phishnet_audit_verify');
  url.pathname='/'+name;
  const isolated=new pg.Client({connectionString:url.toString()});
  await isolated.connect();
  try {
    await isolated.query('BEGIN');
    for (const file of ['0000_melodic_argent.sql','0001_runtime_foundation.sql','0002_campaign_dispatch.sql','0003_capture_analysis.sql', '0004_tenant_constraints.sql', '0005_row_security.sql', '0006_campaign_automation.sql', '0007_delivery_controls.sql', '0008_security_completion.sql', '0009_private_assets.sql', '0010_operations.sql', '0011_tenant_preferences.sql']) await isolated.query(readFileSync('migrations/'+file,'utf8'));
    await isolated.query('COMMIT');
    console.log('Empty-database bootstrap verified.');
  } finally {await isolated.end(); await admin.query('DROP DATABASE phishnet_audit_verify');}
} finally {await admin.end();}
