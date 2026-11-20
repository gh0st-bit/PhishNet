import { databaseScope } from './database-context';
import { randomUUID,timingSafeEqual } from 'node:crypto';
import type { Express,RequestHandler } from 'express';
import { pool } from './db';
import { isAuthenticated } from './auth';

const buckets=[.05,.1,.25,.5,1,2.5,5,10];
const samples=new Map<string,{count:number;sum:number;errors:number;buckets:number[]}>();
export const observeRequests:RequestHandler=(req,res,next)=>{
 const id=randomUUID();res.setHeader('X-Request-ID',id);res.locals.requestId=id;const start=performance.now();
 res.on('finish',()=>{
   if(!req.path.startsWith('/api'))return;
   const route=typeof req.route?.path==='string'?req.route.path:'unmatched';
   const key=`${req.method} ${route}`;if(!samples.has(key)&&samples.size>=300)return;
   const row=samples.get(key)||{count:0,sum:0,errors:0,buckets:buckets.map(()=>0)};
   const elapsed=(performance.now()-start)/1000;row.count++;row.sum+=elapsed;row.errors+=Number(res.statusCode>=500);buckets.forEach((limit,i)=>{if(elapsed<=limit)row.buckets[i]++;});samples.set(key,row);
   if(process.env.HTTP_LOG_ENABLED!=='false')console.log(JSON.stringify({event:'http_request',requestId:id,method:req.method,route,status:res.statusCode,durationMs:Math.round(elapsed*1000)}));
 });next();
};
export async function operationalStatus(){
 const {rows:[dispatch]}=await pool.query(`SELECT count(*) FILTER(WHERE state='queued')::int AS queued,count(*) FILTER(WHERE state='failed')::int AS failed,count(*) FILTER(WHERE state='ambiguous')::int AS ambiguous,
 coalesce(extract(epoch FROM (now()-min(created_at) FILTER(WHERE state='queued'))),0)::float AS oldest_queue_seconds FROM campaign_dispatch`);
 const {rows:[workers]}=await pool.query("SELECT count(*) FILTER(WHERE last_seen_at>now()-interval '90 seconds')::int AS active FROM worker_heartbeats");
 const {rows:[reports]}=await pool.query("SELECT count(*) FILTER(WHERE state='queued')::int AS queued,count(*) FILTER(WHERE state IN ('failed','ambiguous'))::int AS attention FROM report_runs");
 return {dispatch,workers,reports,memoryBytes:process.memoryUsage().rss,uptimeSeconds:Math.floor(process.uptime())};
}
export function registerOperations(app:Express){
 app.get('/api/admin/operations',isAuthenticated,async(req,res)=>{
   if(!req.user?.isAdmin)return res.status(403).json({message:'Platform administrator required'});
   res.setHeader('Cache-Control','no-store');res.json(await operationalStatus());
 });
 app.get('/metrics',async(req,res)=>{
   const expected=process.env.METRICS_TOKEN;const provided=(req.get('authorization')||'').replace(/^Bearer /,'');
   if(!expected||expected.length<32||provided.length!==expected.length||!timingSafeEqual(Buffer.from(expected),Buffer.from(provided)))return res.sendStatus(404);
   const status=await databaseScope.run({organizationId:0,userId:0,system:true},()=>operationalStatus());const lines=['# TYPE phishnet_http_duration_seconds histogram'];
   for(const [key,row]of samples){const split=key.indexOf(' ');const labels=`method=${JSON.stringify(key.slice(0,split))},route=${JSON.stringify(key.slice(split+1))}`;
     buckets.forEach((value,i)=>lines.push(`phishnet_http_duration_seconds_bucket{${labels},le="${value}"} ${row.buckets[i]}`));
     lines.push(`phishnet_http_duration_seconds_bucket{${labels},le="+Inf"} ${row.count}`,`phishnet_http_duration_seconds_count{${labels}} ${row.count}`,`phishnet_http_duration_seconds_sum{${labels}} ${row.sum}`,`phishnet_http_errors_total{${labels}} ${row.errors}`);
   }
   lines.push(`phishnet_dispatch_queued ${status.dispatch.queued}`,`phishnet_dispatch_ambiguous ${status.dispatch.ambiguous}`,`phishnet_dispatch_failed ${status.dispatch.failed}`,`phishnet_queue_oldest_seconds ${status.dispatch.oldest_queue_seconds}`,`phishnet_workers_active ${status.workers.active}`,`phishnet_report_attention ${status.reports.attention}`,`phishnet_process_memory_bytes ${status.memoryBytes}`);
   res.type('text/plain; version=0.0.4').send(lines.join('\n')+'\n');
 });
}
