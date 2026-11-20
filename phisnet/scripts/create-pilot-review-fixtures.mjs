import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
const review=JSON.parse(readFileSync('logs/role-review/accounts.json')),base='http://localhost:5000';
const login=await fetch(base+'/api/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email:review.accounts.owner.email,password:review.password})});if(!login.ok)throw new Error('QA owner login failed');
const cookie=login.headers.getSetCookie().map(v=>v.split(';')[0]).join('; ');
async function request(path,method='GET',body){const response=await fetch(base+path,{method,headers:{cookie,Origin:base,'Content-Type':'application/json'},body:body===undefined?undefined:JSON.stringify(body)});if(!response.ok)throw new Error('Review fixture request failed: '+path+' '+response.status);return response.json();}
const before=await request('/api/dashboard/overview?days=0'),content=await request('/api/pilot/starter-content/install','POST',{}),teams=await request('/api/pilot/teams');
let team=teams.find(t=>t.name==='QA Review Pilot Team');if(!team)team=await request('/api/pilot/teams','POST',{name:'QA Review Pilot Team',members:[review.accounts.employee.id],managers:[review.accounts.manager.id]});
const paths=await request('/api/pilot/learning-paths');let path=paths.find(p=>p.name==='QA Starter Awareness Path');
if(!path)path=await request('/api/pilot/learning-paths','POST',{name:'QA Starter Awareness Path',steps:content.modules.map(id=>({kind:'module',id}))});
const assignment=await request(`/api/pilot/learning-paths/${path.id}/assign`,'POST',{userIds:[review.accounts.employee.id],dueDays:14});
const after=await request('/api/dashboard/overview?days=0');if(after.campaigns.total!==before.campaigns.total)throw new Error('Unexpected campaign count change');
const proof={at:new Date().toISOString(),team,path,content,assignment,accounts:{owner:review.accounts.owner.email,manager:review.accounts.manager.email,employee:review.accounts.employee.email},simulationCreated:false};mkdirSync('logs/pilot',{recursive:true});writeFileSync('logs/pilot/review-fixtures.json',JSON.stringify(proof,null,2));console.log(JSON.stringify({teamId:team.id,pathId:path.id,lessons:content.modules.length,scenarios:content.templates.length,newAssignments:assignment.assigned,simulationCreated:false}));
