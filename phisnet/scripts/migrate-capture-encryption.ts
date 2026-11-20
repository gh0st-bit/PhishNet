import { pool } from '../server/db';
import { SecretsService } from '../server/services/secrets.service';
import { randomBytes } from 'node:crypto';

// Run only after a verified backup and the runtime migrations. Never print values.
async function migrate() {
  if (Buffer.from(process.env.MASTER_ENCRYPTION_KEY || '', 'base64').length !== 32) throw new Error('Valid master key required');
  const { rows: organizations } = await pool.query('SELECT id FROM organizations WHERE encryption_key IS NULL');
  for (const org of organizations) await pool.query('UPDATE organizations SET encryption_key=$2 WHERE id=$1 AND encryption_key IS NULL',[org.id,randomBytes(32).toString('base64')]);
  let cursor = 0, migrated = 0;
  while (true) {
    const { rows } = await pool.query('SELECT id,organization_id,password FROM credential_captures WHERE id>$1 ORDER BY id LIMIT 100',[cursor]);
    if (!rows.length) break;
    for (const row of rows) {
      cursor=row.id;
      if (!row.password || SecretsService.isEncrypted(row.password)) continue;
      const encrypted=await SecretsService.encrypt(row.organization_id,row.password);
      await pool.query('UPDATE credential_captures SET password=$2 WHERE id=$1 AND password=$3',[row.id,encrypted,row.password]);
      migrated++;
    }
  }
  console.log('Encrypted capture values:',migrated);
}
migrate().catch(() => { console.error('Capture migration failed; inspect configuration and retry.'); process.exitCode=1; }).finally(()=>pool.end());
