import {randomBytes} from 'node:crypto';
import {writeFileSync} from 'node:fs';
if(process.env.CI!=='true')throw new Error('CI-only environment generator');
const database=process.env.CI_DATABASE_URL||'postgres://postgres:postgres@127.0.0.1:5432/phishnet_audit';
if(new URL(database).pathname!=='/phishnet_audit')throw new Error('CI requires phishnet_audit');
const values={DATABASE_URL:database,CONTROL_DATABASE_URL:database,MIGRATION_DATABASE_URL:database,SESSION_SECRET:randomBytes(48).toString('hex'),MASTER_ENCRYPTION_KEY:randomBytes(32).toString('base64'),NODE_ENV:'development',MAIL_TRANSPORT:'sink',APP_BASE_URL:'http://localhost:5000',HOST:'127.0.0.1',PORT:'5000',VITE_API_URL:'',WORKER_DELIVERY_PAUSED:'true',SIMULATION_EXTERNAL_DELIVERY_ENABLED:'false',SECRET_ROTATION_ENABLED:'false'};
writeFileSync('.env.audit',Object.entries(values).map(([k,v])=>`${k}=${v}`).join('\n')+'\n',{flag:'wx',mode:0o600});
console.log('Created isolated ephemeral CI configuration. Secrets were not printed.');
