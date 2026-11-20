import { pool } from '../db';
import {labEnabled} from './local-lab';

export async function claimDispatch() {
  const localFilter=labEnabled()?" AND EXISTS(SELECT 1 FROM smtp_profiles s WHERE s.id=c.smtp_profile_id AND s.delivery_mode='local_inbox')":'';
  const client=await pool.connect();
  try {
    await client.query('BEGIN');
    const {rows:[tenant]}=await client.query(`SELECT l.organization_id,l.per_minute FROM organization_delivery_limits l
      WHERE l.next_allowed_at<=now()
      AND (SELECT count(*) FROM campaign_dispatch busy WHERE busy.organization_id=l.organization_id AND busy.state='sending')<l.max_concurrent
      AND EXISTS(SELECT 1 FROM campaign_dispatch d JOIN campaigns c ON c.id=d.campaign_id WHERE d.organization_id=l.organization_id
        AND d.state='queued' AND d.available_at<=now() AND c.status='Active' ${localFilter})
      ORDER BY l.last_claimed_at NULLS FIRST,l.organization_id LIMIT 1 FOR UPDATE OF l SKIP LOCKED`);
    if(!tenant){await client.query('COMMIT');return null;}
    const {rows:[job]}=await client.query(`UPDATE campaign_dispatch SET state='sending',locked_at=now(),attempts=attempts+1,updated_at=now()
      WHERE id=(SELECT d.id FROM campaign_dispatch d JOIN campaigns c ON c.id=d.campaign_id WHERE d.organization_id=$1
        AND d.state='queued' AND d.available_at<=now() AND c.status='Active' ${localFilter}
        ORDER BY d.available_at,d.id FOR UPDATE OF d SKIP LOCKED LIMIT 1) RETURNING *`,[tenant.organization_id]);
    await client.query("UPDATE organization_delivery_limits SET next_allowed_at=now()+($2*interval '1 millisecond'),last_claimed_at=now() WHERE organization_id=$1",[tenant.organization_id,60000/tenant.per_minute]);
    await client.query('COMMIT');return job||null;
  }catch(error){await client.query('ROLLBACK');throw error;}
  finally{client.release();}
}
