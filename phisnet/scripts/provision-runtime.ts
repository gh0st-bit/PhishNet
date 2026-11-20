import { migrationPool } from './migrate-runtime';

async function provision(){
 const web=process.env.WEB_DB_PASSWORD,control=process.env.CONTROL_DB_PASSWORD;
 if(!web||!control||web===control||![web,control].every(v=>/^[a-zA-Z0-9_-]{32,128}$/.test(v)))throw new Error('Provide independent WEB_DB_PASSWORD and CONTROL_DB_PASSWORD (32 to 128 URL-safe characters)');
 const client=await migrationPool.connect();
 try{
   await client.query('BEGIN');
   for(const role of ['phishnet_web','phishnet_control'])if(!(await client.query('SELECT 1 FROM pg_roles WHERE rolname=$1',[role])).rowCount)await client.query(`CREATE ROLE ${role} LOGIN`);
   // Passwords are restricted above; no secret is printed or accepted as a SQL identifier.
   await client.query(`ALTER ROLE phishnet_web NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS PASSWORD '${web}'`);
   await client.query(`ALTER ROLE phishnet_control NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION BYPASSRLS PASSWORD '${control}'`);
   await client.query('GRANT phishnet_tenant TO phishnet_web');
   await client.query('REVOKE CREATE ON SCHEMA public FROM PUBLIC');
   await client.query('GRANT USAGE ON SCHEMA public TO phishnet_web,phishnet_control');
   await client.query('GRANT SELECT,INSERT,UPDATE,DELETE ON ALL TABLES IN SCHEMA public TO phishnet_control');
   await client.query('GRANT USAGE,SELECT ON ALL SEQUENCES IN SCHEMA public TO phishnet_control');
   await client.query('ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT,INSERT,UPDATE,DELETE ON TABLES TO phishnet_control');
   await client.query('ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT USAGE,SELECT ON SEQUENCES TO phishnet_control');
   await client.query('COMMIT');console.log('Runtime roles provisioned. Runtime logins cannot create schema objects.');
 }catch(error){await client.query('ROLLBACK');throw error;}finally{client.release();}
}
provision().catch(error=>{console.error(error.message);process.exitCode=1;}).finally(()=>migrationPool.end());
