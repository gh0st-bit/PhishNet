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
    console.log('🔍 Querying admin users...\n');
    
    const result = await pool.query(`
      SELECT 
        u.id, 
        u.email, 
        u.name,
        u.role_id,
        r.type as role
      FROM users u
      LEFT JOIN roles r ON u.role_id = r.id
      ORDER BY u.created_at DESC
      LIMIT 20
    `);
    
    if (result.rows.length === 0) {
      console.log('❌ No users found in database');
    } else {
      console.log('📋 Users from Database:\n');
      console.table(result.rows);
      
      const adminUsers = result.rows.filter(u => u.role === 'admin');
      console.log(`\n👤 Admin Users Count: ${adminUsers.length}`);
      if (adminUsers.length > 0) {
        console.log('Admin Users:');
        console.table(adminUsers);
      }
    }
    
    await pool.end();
  } catch (err) {
    console.error('❌ Error:', err.message);
    await pool.end();
    process.exit(1);
  }
})();
