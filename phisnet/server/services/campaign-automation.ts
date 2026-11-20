import { pool } from '../db';

export async function createRecurringOccurrences() {
  const client=await pool.connect();
  try {
    await client.query('BEGIN');
    const {rows}=await client.query(`SELECT * FROM campaigns WHERE recurrence_days IS NOT NULL AND next_run_at<=now()
      AND status IN ('Active','Completed') AND (recurrence_until IS NULL OR next_run_at<=recurrence_until)
      ORDER BY next_run_at LIMIT 20 FOR UPDATE SKIP LOCKED`);
    for(const campaign of rows) {
      const duration=campaign.end_date && campaign.launched_at ? Math.max(3600000,new Date(campaign.end_date).getTime()-new Date(campaign.launched_at).getTime()) : 7*86400000;
      if(new Date(campaign.next_run_at).getTime()+duration>Date.now())await client.query(`INSERT INTO campaigns(name,status,target_group_id,smtp_profile_id,email_template_id,landing_page_id,scheduled_at,end_date,
        organization_id,created_by_id,recurrence_parent_id,training_module_id,password_training_module_id,training_due_days,template_pool,send_timezone,send_window_start,send_window_end)
        VALUES($1,'Scheduled',$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17)
        ON CONFLICT(recurrence_parent_id,scheduled_at) WHERE recurrence_parent_id IS NOT NULL DO NOTHING`,
      [`${campaign.name} - recurring`,campaign.target_group_id,campaign.smtp_profile_id,campaign.email_template_id,campaign.landing_page_id,
        campaign.next_run_at,new Date(new Date(campaign.next_run_at).getTime()+duration),campaign.organization_id,campaign.created_by_id,campaign.id,
        campaign.training_module_id,campaign.password_training_module_id,campaign.training_due_days,JSON.stringify(campaign.template_pool),campaign.send_timezone,campaign.send_window_start,campaign.send_window_end]);
      // Skip missed intervals rather than launching a backlog of old simulations.
      await client.query(`UPDATE campaigns SET next_run_at=next_run_at+
        ((floor(extract(epoch FROM (now()-next_run_at))/(recurrence_days*86400))+1)*recurrence_days*interval '1 day')
        WHERE id=$1`,[campaign.id]);
    }
    await client.query('COMMIT');return rows.length;
  }catch(error){await client.query('ROLLBACK');throw error;}
  finally{client.release();}
}

export function withinSendWindow(now:Date,timezone:string,start:number|null,end:number|null) {
  if(start===null || end===null) return true;
  const parts=new Intl.DateTimeFormat('en-GB',{timeZone:timezone,hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).formatToParts(now);
  const minutes=Number(parts.find(p=>p.type==='hour')!.value)*60+Number(parts.find(p=>p.type==='minute')!.value);
  return start<end ? minutes>=start && minutes<end : minutes>=start || minutes<end;
}
