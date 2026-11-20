import type { Request } from 'express';
import { pool } from '../db';

export function suspectedAutomation(userAgent:string) {
  return /googleimageproxy|proofpoint|barracuda|safelinks|urlscan|headless|crawler|\bbot\b|microsoft.*preview/i.test(userAgent);
}
export async function saveTrackingEvent(req:Request,campaignId:number,targetId:number,event:string) {
  const automated=suspectedAutomation(req.get('user-agent')||'');
  await pool.query(`INSERT INTO campaign_events(organization_id,campaign_id,target_id,event_type,suspected_automated)
    SELECT organization_id,id,$2,$3,$4 FROM campaigns WHERE id=$1`,[campaignId,targetId,event,automated]);
  return automated;
}
