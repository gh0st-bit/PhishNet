import type {Express,Request} from 'express';
import {isAuthenticated,hasOrganization} from '../auth';
import {pool} from '../db';
import {appRole} from '@shared/access-control';
import {labEnabled} from '../services/local-lab';
import {trackingToken} from '../services/tracking-token';
import {enqueueCampaign} from '../services/campaign-dispatch';
import {z} from 'zod';
import sanitizeHtml from 'sanitize-html';

async function message(req:Request) {
  const id=Number(req.params.id);if(!Number.isSafeInteger(id)||id<1)return null;
  const {rows:[row]}=await pool.query(`SELECT m.*,c.status,c.name AS campaign_name,r.sent AS delivery_accepted,r.reported FROM simulation_mailbox m JOIN campaigns c ON c.id=m.campaign_id JOIN campaign_results r ON r.campaign_id=m.campaign_id AND r.target_id=m.target_id
    WHERE m.id=$1 AND m.organization_id=$2 AND ($3::boolean OR lower(m.recipient_email)=lower($4))`,[id,req.user!.organizationId,['Admin','OrgAdmin'].includes(appRole(req.user)),req.user!.email]);
  return row;
}
export function registerLocalLab(app:Express) {
  app.get('/api/lab/status',isAuthenticated,(_req,res)=>res.json({enabled:labEnabled(),transport:'local inbox',outboundEmail:false,baseUrl:labEnabled()?process.env.APP_BASE_URL:undefined}));
  app.use('/api/lab',isAuthenticated,hasOrganization,(_req,res,next)=>labEnabled()?next():res.status(404).json({message:'Start the local lab to use the simulation inbox'}));
  app.get('/api/lab/recipients',async(req,res)=>{
    if(!['Admin','OrgAdmin'].includes(appRole(req.user)))return res.status(403).json({message:'Campaign management required'});
    const {rows}=await pool.query('SELECT id,email,first_name,last_name FROM users WHERE organization_id=$1 AND is_active ORDER BY email',[req.user!.organizationId]);res.json(rows);
  });
  app.get('/api/lab/messages',async(req,res)=>{
    const {rows}=await pool.query(`SELECT m.id,m.subject,m.recipient_email,m.sender_email,m.received_at,m.opened_at,m.campaign_id,c.name AS campaign_name,r.reported,r.sent AS delivery_accepted FROM simulation_mailbox m JOIN campaigns c ON c.id=m.campaign_id JOIN campaign_results r ON r.campaign_id=m.campaign_id AND r.target_id=m.target_id
      WHERE m.organization_id=$1 AND ($2::boolean OR lower(m.recipient_email)=lower($3)) ORDER BY m.id DESC LIMIT 100`,[req.user!.organizationId,['Admin','OrgAdmin'].includes(appRole(req.user)),req.user!.email]);res.json(rows);
  });
  app.get('/api/lab/messages/:id',async(req,res)=>{
    const row=await message(req);if(!row)return res.status(404).json({message:'Message not found'});
    const html=sanitizeHtml(row.html_content,{allowedTags:['p','div','span','strong','b','em','i','h1','h2','h3','ul','ol','li','br','a'],allowedAttributes:{},disallowedTagsMode:'discard'});
    res.json({...row,html_content:html,simulationUrl:`/l/${row.campaign_id}/${row.target_id}?token=${trackingToken(row.campaign_id,row.target_id)}`});
  });
  app.post('/api/lab/messages/:id/:action',async(req,res)=>{
    const row=await message(req);if(!row)return res.status(404).json({message:'Message not found'});
    if(!['open','report'].includes(req.params.action))return res.status(404).json({message:'Action not found'});
    if(row.status!=='Active'||!row.delivery_accepted)return res.status(409).json({message:'This campaign is no longer active or delivery is not yet accepted'});
    const own=String(row.recipient_email).toLowerCase()===req.user!.email.toLowerCase();
    if(!own)return res.status(403).json({message:'Only the recipient can record message actions. Use Preview to inspect another mailbox.'});
    const client=await pool.connect();
    try{
      await client.query('BEGIN');
      const report=req.params.action==='report';
      const updated=await client.query(report?`UPDATE campaign_results SET reported=true,reported_at=now(),updated_at=now() WHERE campaign_id=$1 AND target_id=$2 AND reported=false RETURNING id`:`UPDATE campaign_results SET opened=true,opened_at=now(),status=CASE WHEN submitted THEN 'submitted' WHEN clicked THEN 'clicked' ELSE 'opened' END,updated_at=now() WHERE campaign_id=$1 AND target_id=$2 AND opened=false RETURNING id`,[row.campaign_id,row.target_id]);
      if(!report)await client.query('UPDATE simulation_mailbox SET opened_at=COALESCE(opened_at,now()) WHERE id=$1',[row.id]);
      if(updated.rowCount)await client.query('INSERT INTO campaign_events(organization_id,campaign_id,target_id,event_type,suspected_automated) VALUES($1,$2,$3,$4,false)',[row.organization_id,row.campaign_id,row.target_id,report?'reported':'opened']);
      await client.query('COMMIT');res.json({success:true});
    }catch(error){await client.query('ROLLBACK');throw error;}finally{client.release();}
  });
  app.get('/api/lab/messages/:id/attachment',async(req,res)=>{
    const row=await message(req);if(!row)return res.status(404).json({message:'Message not found'});
    if(row.status!=='Active'||!row.delivery_accepted)return res.status(409).json({message:'This campaign is no longer active'});
    if(row.recipient_email.toLowerCase()!==req.user!.email.toLowerCase())return res.status(403).json({message:'Only the recipient can download the training attachment'});
    await pool.query(`INSERT INTO campaign_events(organization_id,campaign_id,target_id,event_type,suspected_automated) SELECT $1,$2,$3,'attachment_downloaded',false WHERE NOT EXISTS(SELECT 1 FROM campaign_events WHERE campaign_id=$2 AND target_id=$3 AND event_type='attachment_downloaded')`,[row.organization_id,row.campaign_id,row.target_id]);
    res.setHeader('Content-Disposition','attachment; filename="phishnet-training.txt"');res.type('text/plain').send('PhishNet local training attachment\r\nThis is a harmless text file. No executable code, macros or malware are included.\r\nDownloading an attachment does not prove that code was executed.\r\n');
  });
  app.post('/api/lab/campaigns',async(req,res)=>{
    if(!['Admin','OrgAdmin'].includes(appRole(req.user)))return res.status(403).json({message:'Campaign management required'});
    const parsed=z.object({name:z.string().trim().min(1).max(100),userIds:z.array(z.number().int().positive()).min(1).max(20)}).safeParse(req.body);
    if(!parsed.success)return res.status(400).json({message:'Enter a campaign name and choose 1 to 20 local recipients'});
    const org=req.user!.organizationId,ids=[...new Set(parsed.data.userIds)];
    const {rows:users}=await pool.query('SELECT id,email,first_name,last_name FROM users WHERE organization_id=$1 AND id=ANY($2::integer[]) AND is_active',[org,ids]);
    if(users.length!==ids.length)return res.status(400).json({message:'Recipients must be active users in your organization'});
    const client=await pool.connect();let campaignId:number;
    try{
      await client.query('BEGIN');
      const name=parsed.data.name;
      const {rows:[group]}=await client.query('INSERT INTO groups(name,description,organization_id) VALUES($1,$2,$3) RETURNING id',[name+' audience','Local demonstration recipients',org]);
      for(const user of users)await client.query('INSERT INTO targets(first_name,last_name,email,group_id,organization_id) VALUES($1,$2,$3,$4,$5)',[user.first_name,user.last_name,user.email,group.id,org]);
      const {rows:[sender]}=await client.query(`INSERT INTO smtp_profiles(name,delivery_mode,host,port,username,password,from_email,from_name,organization_id) VALUES($1,'local_inbox','localhost',1025,'local-lab','','training@phishnet.test','PhishNet Training',$2) RETURNING id`,[name+' local sender',org]);
      const {rows:[template]}=await client.query(`INSERT INTO email_templates(name,subject,html_content,sender_name,sender_email,organization_id) VALUES($1,$2,$3,'PhishNet Training','training@phishnet.test',$4) RETURNING id`,[name+' template','Local awareness exercise', '<h2>Local awareness exercise</h2><p>Hello {{FirstName}}, this is a controlled training message.</p><p><a href="{{TrackingURL}}">Review the training notice</a></p><p>Use the local inbox controls to report the message or download a harmless training attachment.</p>',org]);
      const {rows:[landing]}=await client.query(`INSERT INTO landing_pages(name,html_content,capture_data,capture_passwords,organization_id) VALUES($1,$2,true,false,$3) RETURNING id`,[name+' training page','<h1>PhishNet training notice</h1><p>This is a local simulation. Do not enter real passwords.</p><form><label>Training code <input name="trainingCode" placeholder="DEMO" required></label><button type="submit">Complete simulation</button></form>',org]);
      const {rows:[campaign]}=await client.query(`INSERT INTO campaigns(name,target_group_id,smtp_profile_id,email_template_id,landing_page_id,organization_id,created_by_id,dataset,end_date) VALUES($1,$2,$3,$4,$5,$6,$7,'demo',now()+interval '7 days') RETURNING id`,[name,group.id,sender.id,template.id,landing.id,org,req.user!.id]);campaignId=campaign.id;
      await client.query('COMMIT');
    }catch(error){await client.query('ROLLBACK');throw error;}finally{client.release();}
    const queued=await enqueueCampaign(campaignId,org);
    res.status(202).json({campaignId,...queued,message:'Queued for the local delivery worker. No external email will be sent.'});
  });
}
