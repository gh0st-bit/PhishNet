import 'dotenv/config';
import pg from 'pg';
const client = new pg.Client({ connectionString: process.env.DATABASE_URL, connectionTimeoutMillis: 5000 });
try {
  await client.connect();
  console.log((await client.query('SELECT current_database(), current_user, (SELECT rolcreatedb FROM pg_roles WHERE rolname=current_user) AS can_create_db')).rows);
} catch (error) { console.error({ code: error.code, message: error.message }); process.exitCode = 1; }
finally { await client.end(); }
