
import { readFile } from 'node:fs/promises';
import { migrateRuntime, migrationPool as pool } from './migrate-runtime';

async function bootstrap() {
  const client=await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query("SELECT pg_advisory_xact_lock(hashtext('phishnet-schema-bootstrap'))");
    const {rows:[tables]}=await client.query("SELECT count(*)::int AS count FROM pg_tables WHERE schemaname='public'");
    if (tables.count === 0) {
      await client.query(await readFile(new URL('../migrations/0000_melodic_argent.sql',import.meta.url),'utf8'));
    } else if (!(await client.query("SELECT to_regclass('public.users') AS users")).rows[0].users) {
      throw new Error('Database is not empty and has no PhishNet users table; refusing bootstrap');
    }
    await client.query('COMMIT');
  } catch(error) {await client.query('ROLLBACK');throw error;}
  finally {client.release();}
  await migrateRuntime();
  console.log('Schema bootstrap and runtime migrations complete. No accounts were seeded.');
}
bootstrap().catch(error=>{console.error(error.message);process.exitCode=1;}).finally(()=>pool.end());
