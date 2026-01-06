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
    console.log('🔍 Checking database schema...\n');
    
    // Check users table structure
    const usersColumns = await pool.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'users'
      ORDER BY ordinal_position
    `);
    
    console.log('📋 Users Table Columns:');
    console.table(usersColumns.rows);
    
    // Check roles table structure
    const rolesColumns = await pool.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'roles'
      ORDER BY ordinal_position
    `);
    
    console.log('\n📋 Roles Table Columns:');
    console.table(rolesColumns.rows);
    
    // Count users
    const userCount = await pool.query('SELECT COUNT(*) FROM users');
    console.log(`\n👥 Total Users: ${userCount.rows[0].count}`);
    
    // Get all users
    const allUsers = await pool.query('SELECT id, email, name FROM users LIMIT 10');
    console.log('\n📋 All Users:');
    console.table(allUsers.rows);
    
    await pool.end();
  } catch (err) {
    console.error('❌ Error:', err.message);
    await pool.end();
    process.exit(1);
  }
})();
