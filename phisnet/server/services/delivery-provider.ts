import type { SmtpProfile } from '@shared/schema';
import { createTransport } from './email-service';
import { pool } from '../db';
import { labEnabled } from './local-lab';

export interface SimulationMessage { to:string;html:string;subject:string;messageId:string;campaignId:number;targetId:number;organizationId:number }
export async function sendSimulation(profile:SmtpProfile,message:SimulationMessage) {
  if(labEnabled()) {
    await pool.query(`INSERT INTO simulation_mailbox(organization_id,campaign_id,target_id,recipient_email,sender_email,subject,html_content,message_id)
      VALUES($1,$2,$3,lower($4),$5,$6,$7,$8) ON CONFLICT(message_id) DO NOTHING`,[message.organizationId,message.campaignId,message.targetId,message.to,profile.fromEmail,message.subject,message.html,message.messageId]);
    return {messageId:message.messageId};
  }
  if(profile.deliveryMode==='local_inbox')throw Object.assign(new Error('Local inbox delivery requires the isolated local lab'),{code:'PROVIDER_CONFIG'});
  if(process.env.MAIL_TRANSPORT!=='sink'&&process.env.SIMULATION_EXTERNAL_DELIVERY_ENABLED!=='true')throw Object.assign(new Error('External simulation delivery is disabled'),{code:'PROVIDER_CONFIG'});
  if(profile.deliveryMode==='managed_sendgrid' && process.env.MAIL_TRANSPORT!=='sink') {
    if(process.env.MANAGED_SIMULATIONS_APPROVED!=='true' || !process.env.MANAGED_SENDGRID_API_KEY) throw Object.assign(new Error('Managed simulation delivery is not configured and approved'),{code:'PROVIDER_CONFIG'});
    const response=await fetch('https://api.sendgrid.com/v3/mail/send',{method:'POST',signal:AbortSignal.timeout(30000),
      headers:{Authorization:`Bearer ${process.env.MANAGED_SENDGRID_API_KEY}`,'Content-Type':'application/json'},
      body:JSON.stringify({from:{email:profile.fromEmail,name:profile.fromName},personalizations:[{to:[{email:message.to}],custom_args:{phishnet_campaign:String(message.campaignId),phishnet_target:String(message.targetId),phishnet_org:String(message.organizationId)}}],subject:message.subject,content:[{type:'text/html',value:message.html}],tracking_settings:{click_tracking:{enable:false},open_tracking:{enable:false}}})});
    if(response.status!==202) throw Object.assign(new Error('Managed delivery rejected the request'),{code:response.status===429?'PROVIDER_RATE_LIMIT':response.status<500?'PROVIDER_REJECTED':'PROVIDER_UNCERTAIN',responseCode:response.status});
    return {messageId:response.headers.get('x-message-id')||message.messageId};
  }
  if(process.env.MAIL_TRANSPORT==='sink'&&process.env.SINK_LATENCY_MS)await new Promise(resolve=>setTimeout(resolve,Math.min(5000,Math.max(0,Number(process.env.SINK_LATENCY_MS)))));
  let dataStarted=false;
  const transport=await createTransport(profile,()=>{dataStarted=true;});
  try {
    const result=await transport.sendMail({from:{name:profile.fromName,address:profile.fromEmail},to:message.to,html:message.html,subject:message.subject,messageId:message.messageId,disableFileAccess:true,disableUrlAccess:true});
    if(result.rejected?.length) throw Object.assign(new Error('Recipient rejected'),{code:'EENVELOPE',responseCode:550});
    return {messageId:result.messageId};
  }catch(error:any){if(dataStarted)error.deliveryMayHaveStarted=true;throw error;}finally{transport.close();}
}
