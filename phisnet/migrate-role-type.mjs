import pg from 'pg';
const { Pool } = pg;

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://postgres:kali@localhost:5432/phishnet'
});

async function migrate() {
  try {
    console.log('Adding role_type column to user_invites table...');
    
    await pool.query(`
      ALTER TABLE user_invites 
      ADD COLUMN IF NOT EXISTS role_type TEXT DEFAULT 'Employee'
    `);
    
    console.log('Migration completed successfully!');
    console.log('roleType column added to user_invites table');
  } catch (err) {
    console.error('Migration failed:', err);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

migrate();
