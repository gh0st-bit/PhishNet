import { readFileSync, readdirSync, writeFileSync, mkdirSync } from 'node:fs';
const password=readFileSync('.env.audit.accounts','utf8').trim().split('=')[1];
const base='http://localhost:5000';
const routes=new Set();
for (const file of ['server/routes.ts',...readdirSync('server/routes').filter(f=>f.endsWith('.ts')).map(f=>'server/routes/'+f)]) {
  const text=readFileSync(file,'utf8');
  for (const match of text.matchAll(/app\.get\(["'](\/api\/[^"':?]+)["']/g)) routes.add(match[1]);
  const prefix=file.endsWith('employee-portal.ts')?'/api/employee':file.endsWith('admin-portal.ts')?'/api/admin':null;
  if (prefix) for (const match of text.matchAll(/router\.get\(["'](\/[^"':?]+)["']/g)) routes.add(prefix+match[1]);
}
const outcomes=[];
for (const email of ['admin.1@audit.test','orgadmin.1@audit.test','user.1@audit.test']) {
  const login=await fetch(base+'/api/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email,password})});
  if (!login.ok) throw new Error('Audit login failed: '+email);
  const cookie=login.headers.getSetCookie().map(v=>v.split(';')[0]).join('; ');
  for (const path of [...routes].sort()) {
    if (path.startsWith('/api/debug') || path.startsWith('/api/auth/')) continue;
    try {
      const response=await fetch(base+path,{headers:{cookie},signal:AbortSignal.timeout(15000)});
      outcomes.push({role:email.split('.')[0],path,status:response.status,type:response.headers.get('content-type')});
      await response.arrayBuffer();
    } catch {outcomes.push({role:email.split('.')[0],path,status:0});}
  }
}
mkdirSync('logs',{recursive:true});
writeFileSync('logs/api-audit.json',JSON.stringify(outcomes,null,2));
console.log('Read-only API probes:',outcomes.length);
console.log('Server failures:',outcomes.filter(row=>row.status===0 || row.status>=500));
console.log('Status counts:',outcomes.reduce((acc,row)=>{acc[row.status]=(acc[row.status]||0)+1;return acc;},{}));
