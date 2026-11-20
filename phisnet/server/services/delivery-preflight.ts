import type { PoolClient } from 'pg';

export async function domainReadiness(client:PoolClient,organizationId:number,sender:string,recipients:{email:string}[]) {
  const required=[...new Set([sender.split('@')[1],...recipients.map(target=>target.email.split('@')[1])].map(value=>(value||'').toLowerCase()))];
  const {rows}=await client.query("SELECT domain FROM verified_domains WHERE organization_id=$1 AND verified_at>=now()-interval '90 days'",[organizationId]);
  const verified=new Set(rows.map(row=>row.domain));const missing=required.filter(value=>!verified.has(value));
  const enforced=process.env.MAIL_TRANSPORT!=='sink'&&(process.env.NODE_ENV==='production'||process.env.ENFORCE_VERIFIED_DOMAINS==='true');
  return {enforced,missing,ready:!enforced||missing.length===0};
}
