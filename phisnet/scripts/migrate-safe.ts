import 'dotenv/config';
import { db } from '../server/db';
import { sql } from 'drizzle-orm';

async function run() {
  console.log('Applying safe migration for normalized_indicator and indexes...');

  await db.execute(sql`
    ALTER TABLE threat_intelligence
    ADD COLUMN IF NOT EXISTS normalized_indicator TEXT;
  `);

  await db.execute(sql`
    UPDATE threat_intelligence ti
    SET normalized_indicator = LOWER(
      COALESCE(NULLIF(ti.indicator, ''), NULLIF(ti.url, ''), NULLIF(ti.domain, ''))
    )
    WHERE ti.normalized_indicator IS NULL;
  `);

  await db.execute(sql`
    CREATE UNIQUE INDEX IF NOT EXISTS ux_threat_intel_normalized_indicator
    ON threat_intelligence (normalized_indicator)
    WHERE normalized_indicator IS NOT NULL;
  `);

  await db.execute(sql`
    CREATE INDEX IF NOT EXISTS ix_threat_intel_first_seen ON threat_intelligence (first_seen DESC);
  `);

  await db.execute(sql`
    CREATE INDEX IF NOT EXISTS ix_threat_intel_is_active ON threat_intelligence (is_active);
  `);

  console.log('Safe migration applied successfully.');
}

run().catch((err) => {
  console.error('Safe migration failed:', err);
  process.exit(1);
});
