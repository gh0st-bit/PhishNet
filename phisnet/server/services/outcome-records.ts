import {pool} from '../db';
export const outcomeEvents=['campaigns','sent','clicked','reported','submitted','completed','overdue','repeat_clickers','timed_report'] as const;
export async function outcomeRecords(org:number,days:number,dataset:string,event:string,page:number){
  if(!(outcomeEvents as readonly string[]).includes(event))throw Object.assign(new Error('Invalid outcome'),{status:400});
  const period="(($2::int=0 OR c.created_at>=now()-($2::int*interval '1 day')) AND ($3='all' OR c.dataset=$3))";
  let query:string,args:any[]=[org,days,dataset,(page-1)*25];
  if(event==='completed'||event==='overdue'){
    const moduleFilter=event==='completed'?"p.status='completed'":"p.status<>'completed' AND p.due_date<now()";
    const pathFilter=event==='completed'?"a.completed_at IS NOT NULL":"a.completed_at IS NULL AND a.due_at<now()";
    query=`WITH matches AS (
      SELECT 'module' AS kind,m.id AS record_id,NULL::int AS campaign_id,m.title AS campaign,u.email,p.status FROM training_progress p JOIN training_modules m ON m.id=p.module_id JOIN users u ON u.id=p.user_id WHERE m.organization_id=$1 AND u.organization_id=$1 AND ${moduleFilter}
      UNION ALL SELECT 'path',a.id,NULL::int,a.content_snapshot->>'name',u.email,CASE WHEN a.completed_at IS NULL THEN 'assigned' ELSE 'completed' END FROM learning_path_assignments a JOIN users u ON u.id=a.user_id WHERE a.organization_id=$1 AND ${pathFilter}
    ) SELECT *,count(*) OVER()::int AS total FROM matches ORDER BY email,kind,record_id LIMIT 25 OFFSET $2`;
    args=[org,(page-1)*25];
  }else if(event==='campaigns'){
    query=`SELECT c.id AS campaign_id,c.name AS campaign,'' AS email,c.status,count(*) OVER()::int AS total FROM campaigns c WHERE c.organization_id=$1 AND ${period} ORDER BY c.id DESC LIMIT 25 OFFSET $4`;
  }else if(event==='repeat_clickers'){
    query=`WITH matches AS (SELECT min(c.id) AS campaign_id,'Repeated click observations' AS campaign,lower(t.email) AS email,count(DISTINCT c.id)::text || ' campaigns' AS status FROM campaign_results r JOIN campaigns c ON c.id=r.campaign_id JOIN targets t ON t.id=r.target_id WHERE c.organization_id=$1 AND ${period} AND r.sent AND r.clicked GROUP BY lower(t.email) HAVING count(DISTINCT c.id)>1) SELECT *,count(*) OVER()::int AS total FROM matches ORDER BY email LIMIT 25 OFFSET $4`;
  }else{
    const filter=event==='timed_report'?"r.reported AND r.sent_at IS NOT NULL AND r.reported_at>=r.sent_at AT TIME ZONE current_setting('TimeZone')":`r.${event}`;
    query=`SELECT c.id AS campaign_id,c.name AS campaign,t.email,r.status,r.sent_at,r.clicked_at,r.reported_at,CASE WHEN r.reported_at>=r.sent_at AT TIME ZONE current_setting('TimeZone') THEN EXTRACT(EPOCH FROM (r.reported_at-(r.sent_at AT TIME ZONE current_setting('TimeZone')))) END AS report_seconds,count(*) OVER()::int AS total FROM campaign_results r JOIN campaigns c ON c.id=r.campaign_id JOIN targets t ON t.id=r.target_id WHERE c.organization_id=$1 AND ${period} AND r.sent AND ${filter} ORDER BY c.id DESC,r.id DESC LIMIT 25 OFFSET $4`;
  }
  const {rows}=await pool.query(query,args);
  return {records:rows,page,total:rows[0]?.total||0};
}
