import { parse } from 'dotenv';
import { readFileSync } from 'node:fs';
import { spawn } from 'node:child_process';

const env = { ...process.env, ...parse(readFileSync('.env.audit')) };
if (new URL(env.DATABASE_URL).pathname !== '/phishnet_audit' || (env.CONTROL_DATABASE_URL && new URL(env.CONTROL_DATABASE_URL).pathname !== '/phishnet_audit') || env.MAIL_TRANSPORT !== 'sink') throw new Error('Audit commands require the isolated database and mail sink');
const commands = {
  'investor-demo':['--import','tsx','scripts/prepare-investor-demo.ts'],
  'investor-demo-refresh':['--import','tsx','scripts/prepare-investor-demo.ts','--refresh'],
  governance:['--import','tsx','scripts/audit-governance.ts'],
  load:['--import','tsx','scripts/load-audit.ts'],
  'review-built': ['--import','tsx','server/index.ts'],
  review: ['--import','tsx','server/index.ts'],
  dev: ['--import','tsx','server/index.ts'], worker: ['--import','tsx','server/worker.ts'],
  lab:['--import','tsx','server/index.ts'],
  seed: ['--import','tsx','scripts/seed-audit.ts'], migrate:['--import','tsx','scripts/migrate-runtime.ts'],
  test: ['--import','tsx','--test','tests/foundation/production.spec.ts','tests/foundation/access-control.spec.ts','tests/foundation/pilot.spec.ts','tests/foundation/investor-release.spec.ts','tests/foundation/backup.spec.mjs'],
  browser:['node_modules/@playwright/test/cli.js','test'],
};
const args=commands[process.argv[2]];
if (!args) throw new Error('Expected dev, worker, seed, or test');
if(['seed','migrate'].includes(process.argv[2]) && env.MIGRATION_DATABASE_URL)env.CONTROL_DATABASE_URL=env.MIGRATION_DATABASE_URL;
if(process.argv[2]==='review-built'){env.NODE_ENV='test';env.PORT='5002';env.HOST='127.0.0.1';env.APP_BASE_URL='http://127.0.0.1:5002';env.CORS_ORIGINS='http://127.0.0.1:5002';env.WORKER_DELIVERY_PAUSED='true';env.SIMULATION_EXTERNAL_DELIVERY_ENABLED='false';env.LOCAL_MAILBOX_ENABLED='true';env.VITE_API_URL='';}
if(process.argv[2]==='review'){env.PORT='5001';env.HOST='127.0.0.1';env.APP_BASE_URL='http://127.0.0.1:5001';env.CORS_ORIGINS='http://127.0.0.1:5001';env.WORKER_DELIVERY_PAUSED='true';env.SIMULATION_EXTERNAL_DELIVERY_ENABLED='false';env.LOCAL_MAILBOX_ENABLED='true';env.VITE_API_URL='';}
if(['investor-demo','investor-demo-refresh'].includes(process.argv[2])){env.WORKER_DELIVERY_PAUSED='true'; if(env.MIGRATION_DATABASE_URL)env.CONTROL_DATABASE_URL=env.MIGRATION_DATABASE_URL;}
if(process.argv[2]==='browser'){env.E2E_PASSWORD=parse(readFileSync('.env.audit.accounts')).AUDIT_PASSWORD;env.E2E_ORG_ADMIN_EMAIL='orgadmin.1@audit.test';}
if(process.argv[2]==='lab'){
 const url=new URL(process.argv[3]||'http://localhost:5000');
 const p=url.hostname.split('.').map(Number);
 const local=url.hostname==='localhost'||p.length===4&&p.every(v=>Number.isInteger(v)&&v>=0&&v<=255)&&(p[0]===127||p[0]===10||p[0]===192&&p[1]===168||p[0]===172&&p[1]>=16&&p[1]<=31);
 if(url.protocol!=='http:'||!local||url.username||url.password||url.pathname!=='/'||url.search||url.hash)throw new Error('Local lab URL must be an HTTP localhost or private IPv4 address');
 if(!url.port)url.port='5000';
 env.WORKER_DELIVERY_PAUSED=process.env.WORKER_DELIVERY_PAUSED||'true';env.SIMULATION_EXTERNAL_DELIVERY_ENABLED='false';
 env.LOCAL_MAILBOX_ENABLED='true';env.VITE_API_URL='';env.APP_BASE_URL=url.origin;env.PORT=url.port;env.HOST=url.hostname==='localhost'||url.hostname.startsWith('127.')?'127.0.0.1':'0.0.0.0';
 env.CORS_ORIGINS=[url.origin,`http://localhost:${url.port}`,`http://127.0.0.1:${url.port}`].join(',');
 console.log(`Local simulation inbox: ${url.origin}/local-inbox (external email delivery disabled)`);
}
const runs=process.argv[2]==='lab'?[args,['--import','tsx','server/worker.ts']]:[process.argv[2]==='browser'?[...args,...process.argv.slice(3)]:args];
let stopping=false;
const children=runs.map(command=>spawn(process.execPath,command,{env,stdio:'inherit'}));
const stop=()=>{if(stopping)return;stopping=true;for(const child of children)child.kill('SIGTERM');};
for(const signal of ['SIGINT','SIGTERM'])process.on(signal,stop);
for(const child of children){child.on('error',()=>{process.exitCode=1;stop();});child.on('exit',code=>{if(code)process.exitCode=code;if(children.length>1&&!stopping){process.exitCode=code||1;stop();}});}
