import { parse } from 'dotenv';
import { readFileSync,writeFileSync,mkdirSync,existsSync,unlinkSync } from 'node:fs';
import { randomBytes,createCipheriv,createDecipheriv } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import pg from 'pg';
import path from 'node:path';

const config=parse(readFileSync('.env.audit'));
const source=new URL(config.MIGRATION_DATABASE_URL||config.CONTROL_DATABASE_URL||config.DATABASE_URL);
if(source.pathname!=='/phishnet_audit')throw new Error('Restore drills are restricted to the isolated audit database');
const restoredName='phishnet_audit_restore';
const keyFile='.env.audit.backup-key';
const key=existsSync(keyFile)?Buffer.from(readFileSync(keyFile,'utf8').trim(),'base64'):randomBytes(32);
if(key.length!==32)throw new Error('Backup encryption key must be 32 bytes');
if(!existsSync(keyFile))writeFileSync(keyFile,key.toString('base64'),{mode:0o600});
const directory=path.resolve('backups/audit-drills');mkdirSync(directory,{recursive:true});
const name='audit-'+Date.now();const plaintext=path.join(directory,name+'.dump');const encrypted=plaintext+'.enc';const decrypted=plaintext+'.restored';
const env={...process.env,PGHOST:source.hostname,PGPORT:source.port||'5432',PGUSER:decodeURIComponent(source.username),PGPASSWORD:decodeURIComponent(source.password),PGDATABASE:'phishnet_audit'};
const admin=new pg.Client({connectionString:source.toString()});await admin.connect();
let created=false;const started=Date.now();
const run=(binary,args,environment=env)=>{const result=spawnSync(binary,args,{env:environment,encoding:'utf8',windowsHide:true});if(result.status!==0)throw new Error(`${binary} failed: ${result.error?.code||result.stderr?.slice(0,300)||result.status}`);};
try {
  if((await admin.query('SELECT 1 FROM pg_database WHERE datname=$1',[restoredName])).rowCount)throw new Error('Restore target already exists; refusing to overwrite it');
  await admin.query('BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY');
  const snapshot=(await admin.query('SELECT pg_export_snapshot() AS id')).rows[0].id;
  const tables=(await admin.query("SELECT tablename FROM pg_tables WHERE schemaname='public' ORDER BY tablename")).rows.map(row=>row.tablename);
  const expected={};for(const table of tables)expected[table]=(await admin.query('SELECT count(*)::int AS n FROM "'+table.replaceAll('"','""')+'"')).rows[0].n;
  run('pg_dump',['--format=custom','--no-owner','--no-acl','--snapshot='+snapshot,'--file='+plaintext]);
  await admin.query('COMMIT');
  const iv=randomBytes(12);const cipher=createCipheriv('aes-256-gcm',key,iv);
  const ciphertext=Buffer.concat([cipher.update(readFileSync(plaintext)),cipher.final()]);
  writeFileSync(encrypted,Buffer.concat([Buffer.from('PNB1'),iv,cipher.getAuthTag(),ciphertext]));
  const envelope=readFileSync(encrypted);const decipher=createDecipheriv('aes-256-gcm',key,envelope.subarray(4,16));decipher.setAuthTag(envelope.subarray(16,32));
  writeFileSync(decrypted,Buffer.concat([decipher.update(envelope.subarray(32)),decipher.final()]));
  await admin.query('CREATE DATABASE phishnet_audit_restore');created=true;
  run('pg_restore',['--no-owner','--no-acl','--exit-on-error','--dbname='+restoredName,decrypted],{...env,PGDATABASE:restoredName});
  const target=new URL(source);target.pathname='/'+restoredName;const client=new pg.Client({connectionString:target.toString()});await client.connect();
  try{for(const table of tables){const actual=(await client.query('SELECT count(*)::int AS n FROM "'+table.replaceAll('"','""')+'"')).rows[0].n;if(actual!==expected[table])throw new Error('Restored row count differs for '+table);}}
  finally{await client.end();}
  const report={verified:true,tables:tables.length,seconds:(Date.now()-started)/1000,encryptedBackup:encrypted,snapshotConsistency:true,offHostVerified:false};
  mkdirSync('logs',{recursive:true});writeFileSync('logs/restore-drill.json',JSON.stringify(report,null,2));console.log(report);
}finally{
  try{await admin.query('ROLLBACK');}catch{}
  if(created)await admin.query('DROP DATABASE phishnet_audit_restore');
  await admin.end();
  for(const file of [plaintext,decrypted])if(existsSync(file))unlinkSync(file);
}
