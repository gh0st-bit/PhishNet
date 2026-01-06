import { Pool } from 'pg';
import { scrypt, randomBytes } from 'crypto';
import { promisify } from 'util';

const scryptAsync = promisify(scrypt);

const pool = new Pool({
  user: 'postgres',
  password: 'kali',
  host: 'localhost',
  port: 5432,
  database: 'phishnet'
});

const email = 'admin@phishnet.com';
const newPassword = 'NewPass@123';

async function hashPassword(password) {
  const salt = randomBytes(32).toString("hex");
  const buf = await scryptAsync(password, salt, 64);
  return `${buf.toString("hex")}.${salt}`;
}

(async () => {
  try {
    console.log(`🔍 Looking for user: ${email}...\n`);
    
    // Check if user exists
    const userCheck = await pool.query('SELECT id, email, first_name, last_name, is_admin FROM users WHERE email = $1', [email]);
    
    if (userCheck.rows.length === 0) {
      console.log(`❌ User ${email} not found in database`);
      console.log('\n📋 Available users:');
      const allUsers = await pool.query('SELECT id, email, first_name, last_name, is_admin FROM users ORDER BY id');
      console.table(allUsers.rows);
      await pool.end();
      return;
    }
    
    console.log('✅ User found:');
    console.table(userCheck.rows);
    
    // Hash the new password
    console.log(`\n🔐 Hashing new password...`);
    const hashedPassword = await hashPassword(newPassword);
    
    // Update the password
    console.log(`\n📝 Updating password...`);
    await pool.query('UPDATE users SET password = $1, updated_at = NOW() WHERE email = $2', [hashedPassword, email]);
    
    console.log(`\n✅ Password successfully reset for ${email}`);
    console.log(`   New password: ${newPassword}`);
    
    await pool.end();
  } catch (err) {
    console.error('❌ Error:', err.message);
    await pool.end();
    process.exit(1);
  }
})();
