import fs from 'fs';
import { Pool } from 'pg';
import path from 'path';

const backupFile = path.join(process.cwd(), 'backups', 'phishnet_backup_2025-12-10_18-36-37.sql');

// First, create database using default postgres connection
const adminPool = new Pool({
  user: 'postgres',
  password: 'kali',
  host: 'localhost',
  port: 5432,
  database: 'postgres'
});

(async () => {
  try {
    console.log('Creating database...');
    await adminPool.query('CREATE DATABASE phishnet');
    console.log('Database created!');
    await adminPool.end();

      const dbPool = new Pool({
        user: 'postgres',
        password: 'kali',
        host: 'localhost',
        port: 5432,
        database: 'phishnet'
      });

    const sql = fs.readFileSync(backupFile, 'utf8');
    await dbPool.query(sql);
    
    console.log('✅ Database restored successfully!');
    
    // Query for admin users
    const result = await dbPool.query(`
      SELECT u.id, u.email, u.name, r.type as role
      FROM users u
      LEFT JOIN roles r ON u.role_id = r.id
      WHERE r.type = 'admin' OR u.role_id IN (SELECT id FROM roles WHERE type = 'admin')
      LIMIT 10
    `);
    
    console.log('\n📋 Admin Users:');
    console.table(result.rows);
    
    await dbPool.end();
  } catch (err) {
    if (err.message.includes('already exists')) {
      console.log('Database already exists, connecting to restore...');
      
      const dbPool = new Pool({
        user: 'postgres',
        password: 'kali',
        host: 'localhost',
        port: 5432,
        database: 'phishnet'
      });

      try {
        const sql = fs.readFileSync(backupFile, 'utf8');
        await dbPool.query(sql);
        
        console.log('✅ Database restored successfully!');
        
        // Query for admin users
        const result = await dbPool.query(`
          SELECT u.id, u.email, u.name, r.type as role
          FROM users u
          LEFT JOIN roles r ON u.role_id = r.id
          WHERE r.type = 'admin' OR u.role_id IN (SELECT id FROM roles WHERE type = 'admin')
          LIMIT 10
        `);
        
        console.log('\n📋 Admin Users:');
        console.table(result.rows);
        
        await dbPool.end();
      } catch (restoreErr) {
        console.error('Restore error:', restoreErr.message);
        await dbPool.end();
      }
    } else {
      console.error('Error:', err.message);
    }
    await adminPool.end();
  }
})();
