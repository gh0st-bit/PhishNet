import { domainReadiness } from './delivery-preflight';
import {assertTemplateVariables} from './template-validation';
import { sendSimulation } from './delivery-provider';
import { claimDispatch } from './dispatch-claim';
import { resolveAudience } from './audience';
import { withinSendWindow } from './campaign-automation';
import { pool } from '../db';
import { storage } from '../storage';
import { renderTemplate, createTransport } from './email-service';
import type { SmtpProfile } from '@shared/schema';

export async function enqueueCampaign(campaignId: number, organizationId: number, activateScheduled = false) {
  if(process.env.MAIL_TRANSPORT!=='sink'&&process.env.SIMULATION_EXTERNAL_DELIVERY_ENABLED!=='true')throw Object.assign(new Error('External simulation delivery is disabled'),{status:409});
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { rows: [campaign] } = await client.query('SELECT * FROM campaigns WHERE id=$1 AND organization_id=$2 FOR UPDATE', [campaignId, organizationId]);
    if((await client.query("SELECT 1 FROM organizations WHERE id=$1 AND preferences->>'demonstration'='true'",[organizationId])).rowCount)throw Object.assign(new Error('Sample workspaces cannot send campaigns'),{status:409});
    if (!campaign) throw Object.assign(new Error('Campaign not found'), { status: 404 });
    if (campaign.status !== 'Draft' && !(activateScheduled && campaign.status === 'Scheduled' && new Date(campaign.scheduled_at) <= new Date())) throw Object.assign(new Error('Campaign has already been launched'), { status: 409 });
    const { rows: [template] } = await client.query('SELECT * FROM email_templates WHERE id=$1 AND organization_id=$2', [campaign.email_template_id, organizationId]);
    const { rows: [smtp] } = await client.query('SELECT * FROM smtp_profiles WHERE id=$1 AND organization_id=$2', [campaign.smtp_profile_id, organizationId]);
    const { rows: [landing] } = await client.query('SELECT * FROM landing_pages WHERE id=$1 AND organization_id=$2', [campaign.landing_page_id, organizationId]);
    const { rows: [group] } = await client.query('SELECT id FROM groups WHERE id=$1 AND organization_id=$2', [campaign.target_group_id, organizationId]);
    if(template?.archived_at||landing?.archived_at)throw Object.assign(new Error('Restore archived content before launching'),{status:400});
    if (!template || !smtp || !landing || !group) throw Object.assign(new Error('Campaign resources must belong to this organization'), { status: 400 });
    const recipients = await resolveAudience(client,group.id,organizationId);
    if(recipients.length>10000) throw Object.assign(new Error('Split audiences larger than 10,000 recipients into separate campaigns'),{status:400});
    const domains=await domainReadiness(client,organizationId,smtp.from_email,recipients);
    if(!domains.ready)throw Object.assign(new Error('Verify sender and recipient domains before launching: '+domains.missing.join(', ')),{status:400});
    if(smtp.delivery_mode==='managed_sendgrid' && process.env.MAIL_TRANSPORT!=='sink' && (process.env.MANAGED_SIMULATIONS_APPROVED!=='true'||!process.env.MANAGED_SENDGRID_API_KEY))throw Object.assign(new Error('Managed delivery is not configured and approved'),{status:400});
    const templateIds=[...new Set([campaign.email_template_id,...(Array.isArray(campaign.template_pool)?campaign.template_pool:[])])];
    const {rows:templates}=await client.query('SELECT * FROM email_templates WHERE id=ANY($1::integer[]) AND organization_id=$2 ORDER BY id',[templateIds,organizationId]);
    if(templates.length!==templateIds.length) throw Object.assign(new Error('All rotated templates must belong to this organization'),{status:400});
    for(const template of templates){if(template.archived_at)throw Object.assign(new Error('Restore archived templates before launching'),{status:400});assertTemplateVariables(template.html_content);}
    for(const moduleId of [campaign.training_module_id,campaign.password_training_module_id].filter(Boolean)) {
      if(!(await client.query('SELECT 1 FROM training_modules WHERE id=$1 AND organization_id=$2 AND archived_at IS NULL',[moduleId,organizationId])).rowCount) throw Object.assign(new Error('Training module must belong to this organization'),{status:400});
    }
    if((campaign.send_window_start===null)!==(campaign.send_window_end===null) || campaign.send_window_start===campaign.send_window_end && campaign.send_window_start!==null) throw Object.assign(new Error('Sending window requires different start and end times'),{status:400});
    try {new Intl.DateTimeFormat('en',{timeZone:campaign.send_timezone});}catch{throw Object.assign(new Error('Invalid sending timezone'),{status:400});}
    if (campaign.end_date && new Date(campaign.end_date) <= new Date()) throw Object.assign(new Error('Campaign end date must be in the future'), { status: 400 });
    if (campaign.scheduled_at && campaign.end_date && new Date(campaign.end_date) <= new Date(campaign.scheduled_at)) throw Object.assign(new Error('Campaign end date must follow its schedule'), { status: 400 });
    if (!recipients.length) throw Object.assign(new Error('Campaign requires at least one recipient'), { status: 400 });
    await client.query('INSERT INTO campaign_content_snapshots(campaign_id,organization_id,content) VALUES($1,$2,$3) ON CONFLICT(campaign_id) DO NOTHING',[campaignId,organizationId,JSON.stringify({templates,landing,audience:recipients.map(t=>({id:t.id,email:t.email,employeeId:t.employee_id})),dataset:campaign.dataset||'customer'})]);
    await client.query('INSERT INTO organization_delivery_limits(organization_id) VALUES($1) ON CONFLICT DO NOTHING',[organizationId]);
    for(let offset=0;offset<recipients.length;offset+=250) {
      const batch=recipients.slice(offset,offset+250).map((target,index)=> {
        const selected=templates[(offset+index)%templates.length];
        const html=renderTemplate(selected.html_content,{...target,firstName:target.first_name,lastName:target.last_name},selected,
          {...campaign,organizationId,landingPageId:landing.id},landing.id);
        return { target_id:target.id,snapshot:{to:target.email,html,subject:selected.subject,smtpProfileId:smtp.id,templateId:selected.id} };
      });
      await client.query(`INSERT INTO campaign_dispatch(campaign_id,target_id,organization_id,snapshot)
        SELECT $1,item.target_id,$2,item.snapshot FROM jsonb_to_recordset($3::jsonb) AS item(target_id integer,snapshot jsonb)
        ON CONFLICT(campaign_id,target_id) DO NOTHING`,[campaignId,organizationId,JSON.stringify(batch)]);
      await client.query(`INSERT INTO campaign_results(campaign_id,target_id,organization_id,status)
        SELECT $1,item.target_id,$2,'queued' FROM jsonb_to_recordset($3::jsonb) AS item(target_id integer,snapshot jsonb)
        ON CONFLICT(campaign_id,target_id) DO NOTHING`,[campaignId,organizationId,JSON.stringify(batch)]);
    }
    const state = campaign.scheduled_at && new Date(campaign.scheduled_at) > new Date() ? 'Scheduled' : 'Active';
    await client.query(`UPDATE campaigns SET status=$2,launched_at=COALESCE(launched_at,now()),
      next_run_at=CASE WHEN recurrence_days IS NOT NULL THEN COALESCE(next_run_at,COALESCE(scheduled_at,now())+(recurrence_days*interval '1 day')) ELSE NULL END,
      updated_at=now() WHERE id=$1`, [campaignId,state]);
    await client.query('COMMIT');
    return { queued: recipients.length, total: recipients.length };
  } catch (error) { await client.query('ROLLBACK'); throw error; }
  finally { client.release(); }
}

// A lease lost after SMTP starts is ambiguous: retrying it could send twice.
export async function recoverDispatchLeases() {
  return pool.query(`UPDATE campaign_dispatch SET state='ambiguous',error_code='LEASE_EXPIRED',updated_at=now()
    WHERE state='sending' AND locked_at < now()-interval '2 minutes'`);
}

export async function dispatchOne() {
  const job = await claimDispatch();
  if (!job) return false;
  const {rows:[schedule]}=await pool.query('SELECT send_timezone,send_window_start,send_window_end FROM campaigns WHERE id=$1',[job.campaign_id]);
  if(!withinSendWindow(new Date(),schedule.send_timezone,schedule.send_window_start,schedule.send_window_end)) {
    await pool.query("UPDATE campaign_dispatch SET state='queued',attempts=attempts-1,available_at=now()+interval '5 minutes' WHERE id=$1",[job.id]);
    return true;
  }
  try {
    const smtp = await storage.getSmtpProfile(job.snapshot.smtpProfileId);
    if (!smtp || smtp.organizationId !== job.organization_id) throw Object.assign(new Error('Invalid SMTP profile'), { code: 'PROFILE_INVALID' });
    const { SecretsService } = await import('./secrets.service');
    const profile: SmtpProfile = { ...smtp, password: SecretsService.isEncrypted(smtp.password) ? await SecretsService.decrypt(smtp.organizationId, smtp.password) : smtp.password };
    if((await pool.query('SELECT 1 FROM delivery_suppressions WHERE organization_id=$1 AND email=lower($2)',[job.organization_id,job.snapshot.to])).rowCount) {
      await pool.query("UPDATE campaign_dispatch SET state='cancelled',provider_state='suppressed',error_code='SUPPRESSED' WHERE id=$1",[job.id]);
      return true;
    }
    const info=await sendSimulation(profile,{
      to:job.snapshot.to,html:job.snapshot.html,subject:job.snapshot.subject,
      campaignId:job.campaign_id,targetId:job.target_id,organizationId:job.organization_id,
      messageId:`<phishnet-${job.campaign_id}-${job.target_id}@${new URL(process.env.APP_BASE_URL || 'http://localhost').hostname}>`,
    });
      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        await client.query("UPDATE campaign_dispatch SET state='accepted',message_id=$2,error_code=NULL,updated_at=now() WHERE id=$1", [job.id, info.messageId]);
        await client.query(`UPDATE campaign_results SET sent=true,sent_at=COALESCE(sent_at,now()),
          status=CASE WHEN submitted THEN 'submitted' WHEN clicked THEN 'clicked' WHEN opened THEN 'opened' ELSE 'sent' END,updated_at=now()
          WHERE campaign_id=$1 AND target_id=$2 AND organization_id=$3`, [job.campaign_id, job.target_id, job.organization_id]);
        await client.query('COMMIT');
      } catch (error) { await client.query('ROLLBACK'); throw error; }
      finally { client.release(); }
  } catch (error: any) {
    const code = String(error.code || 'UNKNOWN').slice(0, 80);
    const state=deliveryFailureState(error,job.attempts);
    await pool.query(`UPDATE campaign_dispatch SET state=$2,error_code=$3,available_at=now()+($4 * interval '1 second'),updated_at=now() WHERE id=$1`,
      [job.id, state, code, 30 * 2 ** job.attempts]);
    await pool.query('UPDATE campaign_results SET status=$3,updated_at=now() WHERE campaign_id=$1 AND target_id=$2 AND sent=false', [job.campaign_id, job.target_id, state]);
  }
  return true;
}

export function deliveryFailureState(error:any,attempts:number){
 const code=String(error.code||'UNKNOWN');
 if(error.deliveryMayHaveStarted&&!error.responseCode)return 'ambiguous';
 const preDelivery=!error.deliveryMayHaveStarted&&['CONN','EHLO','HELO','AUTH','MAIL FROM','RCPT TO'].includes(error.command);
 const safeRetry=code==='PROVIDER_RATE_LIMIT'||preDelivery&&(['ECONNECTION','EDNS','EAUTH','ETLS'].includes(code)||error.responseCode>=400&&error.responseCode<500);
 const permanent=['EENVELOPE','PROFILE_INVALID','PROVIDER_CONFIG','PROVIDER_REJECTED','OAUTH_AUTH'].includes(code)||(error.responseCode>=500&&code!=='PROVIDER_UNCERTAIN');
 return safeRetry&&attempts<3?'queued':safeRetry||permanent?'failed':'ambiguous';
}
