import 'dotenv/config';
import { Pool } from 'pg';
import { drizzle } from 'drizzle-orm/node-postgres';
import * as schema from '@shared/schema';
import { scopedPool } from './tenant-pool';
if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is required');
const options={ max:Number(process.env.DB_POOL_MAX || 10),connectionTimeoutMillis:5000,idleTimeoutMillis:30000,application_name:'phishnet' };
export const controlPool=new Pool({ ...options,connectionString:process.env.CONTROL_DATABASE_URL || process.env.DATABASE_URL });
export const tenantPool=new Pool({ ...options,connectionString:process.env.DATABASE_URL });
for (const connection of [controlPool,tenantPool]) connection.on('error',error=>console.error('Database pool error',error.name));
export const pool=scopedPool(controlPool,tenantPool);
export const db=drizzle(pool,{schema});

export async function validateDatabaseRoles(production:boolean) {
  const {rows:[tenantRole]}=await controlPool.query("SELECT rolsuper,rolbypassrls FROM pg_roles WHERE rolname='phishnet_tenant'");
  if(!tenantRole||tenantRole.rolsuper||tenantRole.rolbypassrls)throw new Error('Run row security migrations before starting the application');
  if(production) {
    for(const [name,connection] of [['runtime',tenantPool],['control',controlPool]] as const) {
      const {rows:[role]}=await connection.query("SELECT r.rolsuper,EXISTS(SELECT 1 FROM pg_tables WHERE schemaname='public' AND tableowner=current_user) AS owns_tables FROM pg_roles r WHERE rolname=current_user");
      if(role.rolsuper||role.owns_tables)throw new Error(`Production ${name} connection must be a non-owner, non-superuser login`);
    }
  }
}
