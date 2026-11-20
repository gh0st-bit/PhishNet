// Convert a tenant wall-clock time using IANA timezone rules, including DST changes.
function wallTime(date:Date,zone:string){
 const p=new Intl.DateTimeFormat('en-CA',{timeZone:zone,year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',second:'2-digit',hourCycle:'h23'}).formatToParts(date);
 const n=(k:string)=>Number(p.find(v=>v.type===k)!.value);
 return Date.UTC(n('year'),n('month')-1,n('day'),n('hour'),n('minute'),n('second'));
}
export function nextReportRun(cadence:string,time:string,zone='UTC',after=new Date(),anchor?:Date):Date {
 if(!['daily','weekly','monthly'].includes(cadence)||!/^([01]\d|2[0-3]):[0-5]\d$/.test(time))throw new Error('Invalid report schedule');
 const [hours,minutes]=time.split(':').map(Number);
 const local=new Date(wallTime(anchor||after,zone));local.setUTCHours(hours,minutes,0,0);
 for(let i=0;i<400;i++){
   const desired=local.getTime();let utc=desired;
   // Iteration resolves the UTC offset; a nonexistent spring-forward time runs after the gap.
   for(let j=0;j<3;j++)utc+=desired-wallTime(new Date(utc),zone);
   const candidate=new Date(utc);
   if(candidate>after)return candidate;
   if(cadence==='monthly'){const day=local.getUTCDate();local.setUTCDate(1);local.setUTCMonth(local.getUTCMonth()+1);const end=new Date(Date.UTC(local.getUTCFullYear(),local.getUTCMonth()+1,0)).getUTCDate();local.setUTCDate(Math.min(day,end));}
   else local.setUTCDate(local.getUTCDate()+(cadence==='weekly'?7:1));
 }
 throw new Error('Unable to calculate next report occurrence');
}
