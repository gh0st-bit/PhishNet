import { Pool } from 'pg';

const pool = new Pool({
  user: 'postgres',
  password: 'kali',
  host: 'localhost',
  port: 5432,
  database: 'phishnet'
});

(async () => {
  try {
    console.log('🔍 Querying admin users from database...\n');
    
    const result = await pool.query(`
      SELECT 
        id, 
        email, 
        first_name,
        last_name,
        is_admin,
        is_active,
        created_at
      FROM users
      WHERE is_admin = true
      ORDER BY created_at DESC
    `);
    
    if (result.rows.length === 0) {
      console.log('❌ No admin users found in the database');
    } else {
      console.log(`✅ Found ${result.rows.length} admin user(s):\n`);
      console.table(result.rows);
    }
    
    // Also show all users
    const allUsers = await pool.query('SELECT id, email, first_name, last_name, is_admin FROM users');
    console.log(`\n📊 Total users in database: ${allUsers.rows.length}`);
    
    if (allUsers.rows.length > 0) {
      console.log('\n📋 All Users:');
      console.table(allUsers.rows);
    }
    
    await pool.end();
  } catch (err) {
    console.error('❌ Error:', err.message);
    await pool.end();
    process.exit(1);
  }
})();
