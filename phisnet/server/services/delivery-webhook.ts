import { createPublicKey,verify } from 'node:crypto';
import { pool } from '../db';
import { z } from 'zod';
import type { RequestHandler } from 'express';

export function validWebhook(body:Buffer,signature:string,timestamp:string,publicKey:string,now=Date.now()) {
  if(!/^\d+$/.test(timestamp)||Math.abs(now/1000-Number(timestamp))>300)return false;
  try {
    const key=publicKey.includes('BEGIN PUBLIC KEY')?createPublicKey(publicKey):createPublicKey({key:Buffer.from(publicKey,'base64'),format:'der',type:'spki'});
    return verify('sha256',Buffer.concat([Buffer.from(timestamp),body]),key,Buffer.from(signature,'base64'));
  }catch{return false;}
}
const events=z.array(z.object({sg_event_id:z.string().min(1).max(100),event:z.string(),email:z.string().email(),timestamp:z.coerce.number().finite().min(0).max(4102444800),
  phishnet_campaign:z.coerce.number().int().positive(),phishnet_target:z.coerce.number().int().positive(),phishnet_org:z.coerce.number().int().positive()}).passthrough()).max(1000);
export async function applyWebhookEvents(payload:unknown) {
  const parsed=events.safeParse(payload);
  if(!parsed.success)throw Object.assign(new Error('Invalid event batch'),{status:400});
  const client=await pool.connect();
  try {
    await client.query('BEGIN');let processed=0;
    for(const event of parsed.data) {
      if(!['delivered','bounce','dropped','spamreport','deferred'].includes(event.event))continue;
      const {rows:[job]}=await client.query('SELECT id,snapshot FROM campaign_dispatch WHERE campaign_id=$1 AND target_id=$2 AND organization_id=$3 FOR UPDATE',[event.phishnet_campaign,event.phishnet_target,event.phishnet_org]);
      if(!job || job.snapshot.to.toLowerCase()!==event.email.toLowerCase())continue;
      const saved=await client.query(`INSERT INTO delivery_webhook_events(event_id,organization_id,campaign_id,target_id,disposition,occurred_at)
        VALUES($1,$2,$3,$4,$5,to_timestamp($6)) ON CONFLICT DO NOTHING RETURNING event_id`,[event.sg_event_id,event.phishnet_org,event.phishnet_campaign,event.phishnet_target,event.event,event.timestamp]);
      if(!saved.rowCount)continue;
      await client.query(`UPDATE campaign_dispatch SET provider_state=CASE WHEN provider_state IN ('bounce','dropped','spamreport') OR (provider_state='delivered' AND $2='deferred') THEN provider_state ELSE $2 END,updated_at=now() WHERE id=$1`,[job.id,event.event]);
      if(['bounce','spamreport','dropped'].includes(event.event))await client.query(`INSERT INTO delivery_suppressions(organization_id,email,reason) VALUES($1,lower($2),$3) ON CONFLICT(organization_id,email) DO UPDATE SET reason=$3`,[event.phishnet_org,event.email,event.event]);
      processed++;
    }
    await client.query('COMMIT');return processed;
  }catch(error){await client.query('ROLLBACK');throw error;}
  finally{client.release();}
}
export const sendgridWebhook:RequestHandler=async(req,res)=> {
  const key=process.env.SENDGRID_WEBHOOK_PUBLIC_KEY;
  if(!key)return res.status(503).json({message:'Webhook is not configured'});
  if(!Buffer.isBuffer(req.body)||!validWebhook(req.body,req.get('X-Twilio-Email-Event-Webhook-Signature')||'',req.get('X-Twilio-Email-Event-Webhook-Timestamp')||'',key))return res.status(401).json({message:'Invalid webhook signature'});
  try {return res.json({processed:await applyWebhookEvents(JSON.parse(req.body.toString('utf8')))});}
  catch(error:any){return res.status(error instanceof SyntaxError?400:error.status||500).json({message:'Unable to process event batch'});}
};
