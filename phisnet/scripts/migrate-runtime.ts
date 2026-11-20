import 'dotenv/config';
import pg from 'pg';
export const migrationPool = new pg.Pool({connectionString:process.env.MIGRATION_DATABASE_URL || (process.env.NODE_ENV==='production' ? (()=>{throw new Error('MIGRATION_DATABASE_URL is required')})() : process.env.CONTROL_DATABASE_URL || process.env.DATABASE_URL)});
import { readFile } from 'node:fs/promises';

export async function migrateRuntime() {
  const client = await migrationPool.connect();
  try {
    await client.query('BEGIN');
    await client.query("SELECT pg_advisory_xact_lock(hashtext('phishnet-runtime-migrations'))");
    await client.query('CREATE TABLE IF NOT EXISTS runtime_migrations (name text PRIMARY KEY, applied_at timestamptz NOT NULL DEFAULT now())');
    for (const name of ['0001_runtime_foundation.sql', '0002_campaign_dispatch.sql', '0003_capture_analysis.sql', '0004_tenant_constraints.sql', '0005_row_security.sql', '0006_campaign_automation.sql', '0007_delivery_controls.sql', '0008_security_completion.sql', '0009_private_assets.sql', '0010_operations.sql', '0011_tenant_preferences.sql', '0012_product_maturity.sql', '0013_local_delivery_mode.sql', '0014_smb_pilot.sql', '0015_learning_versions.sql', '0016_versioned_secrets.sql', '0017_learning_paths.sql', '0018_content_history.sql', '0019_investor_release.sql', '0020_content_archive.sql']) {
      if ((await client.query('SELECT 1 FROM runtime_migrations WHERE name=$1', [name])).rowCount) continue;
      await client.query(await readFile(new URL('../migrations/' + name, import.meta.url), 'utf8'));
      await client.query('INSERT INTO runtime_migrations(name) VALUES ($1)', [name]);
      console.log('Applied', name);
    }
    await client.query('COMMIT');
  } catch (error) { await client.query('ROLLBACK'); throw error; }
  finally { client.release(); }
}
if (process.argv[1]?.replaceAll('\\', '/').match(/\/migrate-runtime\.(ts|js)$/)) {
  migrateRuntime().catch(error => { console.error(error); process.exitCode = 1; }).finally(() => migrationPool.end());
}
