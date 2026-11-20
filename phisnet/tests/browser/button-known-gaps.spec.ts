import {test,expect} from '@playwright/test';
import {readFileSync,writeFileSync} from 'node:fs';
const review=JSON.parse(readFileSync('logs/role-review/accounts.json','utf8'));
test.use({trace:'off'});
test('a published points-earned badge unlocks after the learner meets its threshold',async({browser})=>{
 const admin=await browser.newContext(),owner=await browser.newContext(),learner=await browser.newContext();let userId:number|undefined,moduleId:number|undefined,badgeId:number|undefined;
 async function post(context:any,path:string,data:any){const r=await context.request.post(path,{data});expect(r.ok(),path).toBe(true);return r.json();}
 try{
  for(const [context,actor]of [[admin,'admin'],[owner,'owner']]as const)await post(context,'/api/login',{email:review.accounts[actor].email,password:review.password});
  const roles=await(await owner.request.get('/api/roles')).json();const user=await post(owner,'/api/users',{email:'button-badge-gap-'+Date.now()+'@audit.test',firstName:'Badge',lastName:'QA',password:review.password,roleId:roles.find((r:any)=>r.name==='User').id,isActive:true});userId=user.id;
  const module=(await post(owner,'/api/admin/training-modules',{title:'Button badge gap '+Date.now(),category:'phishing',difficulty:'beginner',durationMinutes:1,transcript:'Disposable QA learning.'})).module;moduleId=module.id;
  await post(owner,'/api/admin/training-assignments',{userIds:[userId],moduleId,dueDays:7});
  const badge=(await post(admin,'/api/admin/badges',{name:'Button badge gap '+Date.now(),category:'milestone',criteria:{type:'points_earned',threshold:1},pointsAwarded:0,published:true})).badge;badgeId=badge.id;
  await post(learner,'/api/login',{email:user.email,password:review.password});await post(learner,`/api/employee/training/${moduleId}/progress`,{status:'completed',progressPercentage:100,videoTimestamp:0});
  const points=await(await learner.request.get('/api/employee/points')).json();const badges=await(await learner.request.get('/api/employee/badges')).json();const actual=badges.badges.find((b:any)=>b.id===badgeId);const detail=await(await learner.request.get('/api/employee/badges/'+badgeId)).json();
  expect(points.points.totalPoints).toBeGreaterThanOrEqual(1);expect(actual).toBeTruthy();
  writeFileSync('logs/button-audit/badge-gap.json',JSON.stringify({at:new Date().toISOString(),criterion:badge.criteria,points:points.points.totalPoints,earned:actual.earned,displayedProgress:detail.badge.progress,expectedEarned:true,temporaryUserId:userId,temporaryBadgeId:badgeId,temporaryEmployeeAndLessonRemovedAfterTest:true,badgeArchivedAfterTest:true},null,2));

  expect(actual.earned).toBe(true);expect(detail.badge.progress).toBe(100);
  expect((await admin.request.put('/api/admin/badges/'+badgeId,{data:{name:'Changed disposable badge '+Date.now()}})).ok()).toBe(true);
  expect((await admin.request.delete('/api/admin/badges/'+badgeId)).ok()).toBe(true);
  const retained=await(await learner.request.get('/api/employee/badges/'+badgeId)).json();expect(retained.badge.earned).toBe(true);expect(retained.badge.name).toBe(badge.name);
  expect((await post(admin,`/api/admin/badges/${badgeId}/restore`,{})).badge.published).toBe(false);
 }finally{if(badgeId)await admin.request.delete('/api/admin/badges/'+badgeId);if(moduleId)await owner.request.delete('/api/admin/training-modules/'+moduleId);if(userId)await owner.request.delete('/api/users/'+userId);await learner.close();await owner.close();await admin.close();}
});
