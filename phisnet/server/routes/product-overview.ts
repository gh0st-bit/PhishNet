import {outcomeEvents,outcomeRecords} from '../services/outcome-records';
import type {Express} from 'express';
import {isAuthenticated,hasOrganization,isAdminOrOrgAdmin} from '../auth';
import {pool} from '../db';
import {appRole} from '@shared/access-control';

export async function overview(org:number,days:number,dataset:string) {
  const args=[org,days,dataset];
  const period="(($2::int=0 OR c.created_at>=now()-($2::int*interval '1 day')) AND ($3='all' OR c.dataset=$3))";
  const [campaigns,signals,learning,groups,setup,recent,trends,repeats,workspace]=await Promise.all([
    pool.query(`SELECT count(*)::int AS total,count(*) FILTER(WHERE status='Active')::int AS active,count(*) FILTER(WHERE status='Draft')::int AS drafts FROM campaigns c WHERE organization_id=$1 AND ${period}`,args),
    pool.query(`SELECT count(*) FILTER(WHERE r.sent)::int AS sent,count(*) FILTER(WHERE r.sent AND r.opened)::int AS opened,count(*) FILTER(WHERE r.sent AND r.clicked)::int AS clicked,count(*) FILTER(WHERE r.sent AND r.submitted)::int AS submitted,count(*) FILTER(WHERE r.sent AND r.reported)::int AS reported,
      count(*) FILTER(WHERE r.sent AND r.reported AND r.sent_at IS NOT NULL AND r.reported_at>=r.sent_at AT TIME ZONE current_setting('TimeZone'))::int AS report_timing_samples,
      percentile_cont(0.5) WITHIN GROUP(ORDER BY EXTRACT(EPOCH FROM (r.reported_at-(r.sent_at AT TIME ZONE current_setting('TimeZone'))))) FILTER(WHERE r.sent AND r.reported AND r.sent_at IS NOT NULL AND r.reported_at>=r.sent_at AT TIME ZONE current_setting('TimeZone')) AS median_report_seconds
      FROM campaign_results r JOIN campaigns c ON c.id=r.campaign_id WHERE c.organization_id=$1 AND ${period}`,args),
    pool.query(`SELECT sum(assigned)::int AS assigned,sum(completed)::int AS completed,sum(overdue)::int AS overdue FROM (
      SELECT count(*) AS assigned,count(*) FILTER(WHERE p.status='completed') AS completed,count(*) FILTER(WHERE p.status<>'completed' AND p.due_date<now()) AS overdue FROM training_progress p JOIN training_modules m ON m.id=p.module_id WHERE m.organization_id=$1
      UNION ALL SELECT count(*),count(*) FILTER(WHERE completed_at IS NOT NULL),count(*) FILTER(WHERE completed_at IS NULL AND due_at<now()) FROM learning_path_assignments WHERE organization_id=$1) s`,[org]),
    pool.query(`SELECT g.id,g.name,count(r.id) FILTER(WHERE r.sent)::int AS sent,count(r.id) FILTER(WHERE r.sent AND r.clicked)::int AS clicked,count(r.id) FILTER(WHERE r.sent AND r.reported)::int AS reported FROM groups g LEFT JOIN campaigns c ON c.target_group_id=g.id AND ${period} LEFT JOIN campaign_results r ON r.campaign_id=c.id WHERE g.organization_id=$1 GROUP BY g.id,g.name ORDER BY g.name LIMIT 100`,args),
    pool.query(`SELECT (SELECT count(*)::int FROM groups WHERE organization_id=$1) AS audiences,(SELECT count(*)::int FROM smtp_profiles WHERE organization_id=$1) AS senders,(SELECT count(*)::int FROM email_templates WHERE organization_id=$1) AS templates,(SELECT count(*)::int FROM landing_pages WHERE organization_id=$1) AS landing_pages,(SELECT count(*)::int FROM users WHERE organization_id=$1 AND is_active) AS users`,[org]),
    pool.query(`SELECT c.id,c.name,c.status,c.created_at FROM campaigns c WHERE c.organization_id=$1 AND ${period} ORDER BY c.created_at DESC,c.id DESC LIMIT 8`,args),
    pool.query(`SELECT to_char(date_trunc('week',c.created_at),'YYYY-MM-DD') AS week,count(r.id) FILTER(WHERE r.sent)::int AS accepted,count(r.id) FILTER(WHERE r.sent AND r.clicked)::int AS clicked,count(r.id) FILTER(WHERE r.sent AND r.reported)::int AS reported FROM campaigns c LEFT JOIN campaign_results r ON r.campaign_id=c.id WHERE c.organization_id=$1 AND ${period} GROUP BY 1 ORDER BY 1`,args),
    pool.query(`SELECT count(*)::int AS repeat_clickers FROM (SELECT lower(t.email) FROM campaign_results r JOIN campaigns c ON c.id=r.campaign_id JOIN targets t ON t.id=r.target_id WHERE c.organization_id=$1 AND ${period} AND r.sent AND r.clicked GROUP BY lower(t.email) HAVING count(DISTINCT c.id)>1) x`,args),
    pool.query(`SELECT name,COALESCE((preferences->>'demonstration')::boolean,false) AS demonstration FROM organizations WHERE id=$1`,[org]),
  ]);
  const metrics=signals.rows[0];
  return {organizationId:org,organizationName:workspace.rows[0]?.name,demonstration:workspace.rows[0]?.demonstration||dataset==='demo',days,dataset,campaigns:campaigns.rows[0],signals:metrics,learning:learning.rows[0],groups:groups.rows,setup:setup.rows[0],recent:recent.rows,
    trends:trends.rows.map(row=>({...row,clickRate:row.accepted?Math.round(row.clicked/row.accepted*1000)/10:null,reportRate:row.accepted?Math.round(row.reported/row.accepted*1000)/10:null})),repeatClickers:repeats.rows[0].repeat_clickers,
    definitions:{denominator:'Accepted campaign-recipient pairs, not confirmed inbox delivery.',period:'Campaigns created in the selected period; trends use campaign-creation week.',learning:'Current organization learning, outside the campaign date filter.',reportTiming:'Median seconds from accepted send to first recorded report. Missing or negative intervals excluded; legacy send timestamps interpreted in the database timezone.',repeat:'Recipients matched by case-insensitive email with clicks in more than one campaign during this period.'},
    rates:{click:metrics.sent?Math.round(metrics.clicked/metrics.sent*1000)/10:null,report:metrics.sent?Math.round(metrics.reported/metrics.sent*1000)/10:null},
    generatedAt:new Date().toISOString()};
}
export function overviewRows(data:Awaited<ReturnType<typeof overview>>) {
  return [['Metric','Value'],['Data provenance',data.demonstration?'Sample data':data.dataset==='all'?'All records; may include demonstration campaigns':'Customer records'],['Organization',data.organizationName],['Organization ID',data.organizationId],['Campaign window (days; 0 = all)',data.days],['Dataset',data.dataset],['Generated at',data.generatedAt],
    ...Object.entries(data.campaigns).map(([k,v])=>['Campaigns: '+k,v]),...Object.entries(data.signals).map(([k,v])=>[k,v]),...Object.entries(data.learning).map(([k,v])=>['Current learning: '+k,v]),['Click rate (%)',data.rates.click??'Unavailable'],['Report rate (%)',data.rates.report??'Unavailable'],['Repeat clickers',data.repeatClickers],
    ...Object.entries(data.definitions).map(([k,v])=>['Definition: '+k,v]),['Week','Accepted','Clicked','Reported'],...data.trends.map(t=>[t.week,t.accepted,t.clicked,t.reported])];
}
export function registerProductOverview(app:Express) {
  app.get('/api/workspace',isAuthenticated,hasOrganization,async(req,res)=>{
    const {rows:[workspace]}=await pool.query("SELECT name,COALESCE((preferences->>'demonstration')::boolean,false) AS demonstration FROM organizations WHERE id=$1",[req.user!.organizationId]);
    res.json(workspace);
  });
  app.get('/api/dashboard/overview/records',isAuthenticated,hasOrganization,isAdminOrOrgAdmin,async(req,res)=>{
    const days=Number(req.query.days??30),dataset=String(req.query.dataset||'customer'),event=String(req.query.event||'sent'),page=Number(req.query.page??1);
    if(![0,7,30,90].includes(days)||!['all','customer','demo'].includes(dataset)||!(outcomeEvents as readonly string[]).includes(event)||!Number.isSafeInteger(page)||page<1||page>10000)return res.status(400).json({message:'Invalid outcome filters'});
    res.json(await outcomeRecords(req.user!.organizationId,days,dataset,event,page));
  });
  for(const csv of [false,true])app.get(csv?'/api/dashboard/overview/export':'/api/dashboard/overview',isAuthenticated,hasOrganization,isAdminOrOrgAdmin,async(req,res)=>{
    if(appRole(req.user)==='User')return res.status(403).json({message:'Management dashboard required'});
    const days=Number(req.query.days??30);if(![0,7,30,90].includes(days))return res.status(400).json({message:'Choose 7, 30, 90 or all days'});
    const dataset=String(req.query.dataset||'customer');if(!['all','customer','demo'].includes(dataset))return res.status(400).json({message:'Choose all, customer or demo data'});
    const data=await overview(req.user!.organizationId,days,dataset);
    if(!csv)return res.json(data);
    res.attachment(data.demonstration?'phishnet-sample-overview.csv':'phishnet-overview.csv').type('text/csv').send(overviewRows(data).map(r=>r.map(v=>'"'+String(v??'').replaceAll('"','""').replace(/^[=+@-]/,"'$&")+'"').join(',')).join('\r\n'));
  });
}
