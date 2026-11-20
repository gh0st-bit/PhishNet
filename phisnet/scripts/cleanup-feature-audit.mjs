import { readFileSync, writeFileSync } from 'node:fs';
import { parse } from 'dotenv';
import pg from 'pg';
const env = parse(readFileSync('.env.audit'));
const url = new URL(env.CONTROL_DATABASE_URL);
if (url.pathname !== '/phishnet_audit' || !['localhost', '127.0.0.1'].includes(url.hostname) || env.MAIL_TRANSPORT !== 'sink') throw new Error('Cleanup restricted to local audit fixtures');
const client = new pg.Client({ connectionString: url.toString() });
const results = [];
await client.connect();
try {
  await client.query('BEGIN');
  // Match only timestamped fixture names emitted by this audit, including
  // records left behind if a previous audit process was interrupted.
  const pattern = '^(QA cycle|QA UI) [0-9]{13}( edited)?$';
  for (const [table, column] of [['campaigns', 'name'], ['groups', 'name'], ['email_templates', 'name'], ['landing_pages', 'name'], ['smtp_profiles', 'name'], ['quizzes', 'title'], ['training_modules', 'title'], ['articles', 'title'], ['flashcard_decks', 'title'], ['badges', 'name'], ['organizations', 'name']]) {
    const found = await client.query(`SELECT id,${column} AS name FROM ${table} WHERE ${column} ~ $1`, [pattern]);
    for (const row of found.rows) {
      await client.query(`DELETE FROM ${table} WHERE id=$1 AND ${column}=$2`, [row.id, row.name]);
      results.push({ table, id: row.id, name: row.name });
    }
  }
  const users = await client.query("DELETE FROM users WHERE email ~ '^qa-(user|ui)-[0-9]{13}@audit[.]test$' RETURNING id,email");
  results.push(...users.rows.map(row => ({ table: 'users', ...row })));
  await client.query('COMMIT');
  writeFileSync('logs/feature-cycle/cleanup.json', JSON.stringify(results, null, 2));
  console.log('Removed leftover synthetic fixtures:', results.length);
} catch (error) { await client.query('ROLLBACK'); throw error; }
finally { await client.end(); }
