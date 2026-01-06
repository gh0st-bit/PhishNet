const { Pool } = require('pg');

const pool = new Pool({
  host: 'localhost',
  port: 5432,
  database: 'phishnet',
  user: 'postgres',
  password: 'kali'
});

pool.query('SELECT id, username, email, role, status FROM users WHERE role = $1 ORDER BY created_at', ['admin'], (err, res) => {
  if (err) {
    console.error('Error:', err.message);
    process.exit(1);
  } else {
    if (res.rows.length === 0) {
      console.log('No admin users found in the database.');
    } else {
      console.log('\n=== ADMIN USERS ===\n');
      console.table(res.rows);
    }
  }
  pool.end();
});
