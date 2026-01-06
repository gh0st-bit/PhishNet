import fs from 'fs';
import { Pool } from 'pg';
import path from 'path';

const backupFile = path.join(process.cwd(), 'backups', 'phishnet_backup_2025-12-10_18-36-37.sql');

const pool = new Pool({
  user: 'postgres',
  password: 'kali',
  host: 'localhost',
  port: 5432,
  database: 'phishnet'
});

(async () => {
  const client = await pool.connect();
  try {
    console.log('📂 Reading backup file...');
    const sql = fs.readFileSync(backupFile, 'utf8');
    
    // Split by statements and execute each
    const statements = sql.split(';').filter(s => s.trim().length > 0);
    
    console.log(`📊 Found ${statements.length} SQL statements to execute`);
    
    let executed = 0;
    for (const statement of statements) {
      try {
        await client.query(statement);
        executed++;
        if (executed % 10 === 0) {
          process.stdout.write(`\rExecuting: ${executed}/${statements.length}`);
        }
      } catch (e) {
        // Skip errors for now
        console.error(`\n⚠️  Statement error (continuing): ${e.message.substring(0, 100)}`);
      }
    }
    
    console.log(`\n✅ Executed ${executed} statements successfully!\n`);
    
    // Now query for admin users
    console.log('🔍 Querying admin users...\n');
    
    const result = await client.query(`
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
        console.log('\n✅ Admin Users:');
        console.table(adminUsers);
      }
    }
    
  } catch (err) {
    console.error('❌ Error:', err.message);
    process.exit(1);
  } finally {
    await client.release();
    await pool.end();
  }
})();
