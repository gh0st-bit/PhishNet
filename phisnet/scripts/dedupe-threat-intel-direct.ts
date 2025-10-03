import 'dotenv/config';
import { pool } from '../server/db';

async function run() {
  console.log('Starting SQL-based dedupe for threat_intelligence...');

  // Ensure normalized_indicator is populated
  await pool.query(`
    UPDATE threat_intelligence ti
    SET normalized_indicator = LOWER(
      COALESCE(NULLIF(ti.indicator, ''), NULLIF(ti.url, ''), NULLIF(ti.domain, ''))
    )
    WHERE ti.normalized_indicator IS NULL;
  `);

  // Count duplicate groups
  const dupCountRes = await pool.query(`
    SELECT COUNT(*)::int AS cnt FROM (
      SELECT normalized_indicator
      FROM threat_intelligence
      WHERE normalized_indicator IS NOT NULL
      GROUP BY normalized_indicator
      HAVING COUNT(*) > 1
    ) s;
  `);
  const dupGroups = dupCountRes.rows[0]?.cnt ?? 0;
  console.log(`Duplicate groups found: ${dupGroups}`);

  if (dupGroups === 0) {
    console.log('No duplicates to process.');
    return;
  }

  // Merge tags/description/raw into the keeper (best row) per group
  console.log('Merging metadata into keepers...');
  await pool.query(`
    WITH ranked AS (
      SELECT id, normalized_indicator, confidence, first_seen,
             ROW_NUMBER() OVER (
               PARTITION BY normalized_indicator
               ORDER BY confidence DESC NULLS LAST, first_seen DESC NULLS LAST, id ASC
             ) AS rn
      FROM threat_intelligence
      WHERE normalized_indicator IS NOT NULL
    ),
    merged AS (
      SELECT r.normalized_indicator,
             (
               SELECT to_jsonb(ARRAY(
                 SELECT DISTINCT elem FROM (
                   SELECT jsonb_array_elements_text(COALESCE(t.tags, '[]'::jsonb)) AS elem
                   FROM threat_intelligence t
                   JOIN ranked r2 ON r2.id = t.id
                   WHERE r2.normalized_indicator = r.normalized_indicator
                 ) q
               ))
             ) AS merged_tags,
             (
               SELECT t2.description FROM threat_intelligence t2
               JOIN ranked r3 ON r3.id = t2.id
               WHERE r3.normalized_indicator = r.normalized_indicator AND t2.description IS NOT NULL
               ORDER BY r3.rn ASC
               LIMIT 1
             ) AS any_description,
             (
               SELECT t3.raw_data FROM threat_intelligence t3
               JOIN ranked r4 ON r4.id = t3.id
               WHERE r4.normalized_indicator = r.normalized_indicator AND t3.raw_data IS NOT NULL
               ORDER BY r4.rn ASC
               LIMIT 1
             ) AS any_raw
      FROM ranked r
      WHERE r.rn = 1
      GROUP BY r.normalized_indicator
    )
    UPDATE threat_intelligence t
    SET tags = COALESCE(m.merged_tags, t.tags),
        description = COALESCE(t.description, m.any_description),
        raw_data = COALESCE(t.raw_data, m.any_raw)
    FROM ranked r
    JOIN merged m ON m.normalized_indicator = r.normalized_indicator
    WHERE r.rn = 1 AND t.id = r.id;
  `);

  console.log('Deleting duplicate rows, keeping best per group...');
  const deleteRes = await pool.query(`
    WITH ranked AS (
      SELECT id, normalized_indicator,
             ROW_NUMBER() OVER (
               PARTITION BY normalized_indicator
               ORDER BY confidence DESC NULLS LAST, first_seen DESC NULLS LAST, id ASC
             ) AS rn
      FROM threat_intelligence
      WHERE normalized_indicator IS NOT NULL
    )
    DELETE FROM threat_intelligence t
    USING ranked r
    WHERE t.id = r.id AND r.rn > 1;
  `);

  // @ts-ignore node-postgres returns rowCount
  const deleted = (deleteRes as any).rowCount ?? 0;
  console.log(`Deduplication complete. Deleted ${deleted} duplicate rows.`);
}

run().then(() => process.exit(0)).catch((err) => {
  console.error('SQL-based dedupe failed:', err);
  process.exit(1);
});
