import pg from 'pg';
const { Pool } = pg;

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://postgres:kali@localhost:5432/phishnet'
});

async function run() {
  try {
    const res = await pool.query(`SELECT column_name, data_type, is_nullable, column_default
                                  FROM information_schema.columns
                                  WHERE table_name = 'user_invites'
                                  ORDER BY ordinal_position`);
    console.log('Columns in user_invites:');
    for (const r of res.rows) {
      console.log(`${r.column_name} | ${r.data_type} | nullable=${r.is_nullable} | default=${r.column_default}`);
    }
    const roleType = res.rows.find(r => r.column_name === 'role_type');
    if (roleType) {
      console.log('\n✅ role_type column present.');
    } else {
      console.log('\n❌ role_type column NOT found.');
      process.exitCode = 1;
    }
  } catch (e) {
    console.error('Error checking schema:', e);
    process.exitCode = 1;
  } finally {
    await pool.end();
  }
}
run();
