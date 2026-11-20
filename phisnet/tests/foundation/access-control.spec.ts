import { test } from 'node:test';
import assert from 'node:assert/strict';
import { appRole, can, homeFor, notificationDestination } from '../../shared/access-control';
import {privateAddress,labEnabled} from '../../server/services/local-lab';

test('local lab accepts only private socket addresses and rejects public or malformed addresses',()=>{
  for(const address of ['127.0.0.1','::1','::ffff:192.168.100.20','10.1.2.3','172.16.0.1','172.31.255.254'])assert.equal(privateAddress(address),true,address);
  for(const address of ['8.8.8.8','172.15.1.1','172.32.1.1','192.169.1.1','192.168.1.999','','localhost','unknown'])assert.equal(privateAddress(address),false,address);
});

test('local lab requires explicit opt-in, audit database, sink and nonproduction runtime',()=>{
 const keys=['LOCAL_MAILBOX_ENABLED','MAIL_TRANSPORT','NODE_ENV','DATABASE_URL'];const previous=Object.fromEntries(keys.map(key=>[key,process.env[key]]));
 try{
  Object.assign(process.env,{LOCAL_MAILBOX_ENABLED:'true',MAIL_TRANSPORT:'sink',NODE_ENV:'development',DATABASE_URL:'postgres://localhost/phishnet_audit'});assert.equal(labEnabled(),true);
  for(const [key,value]of [['LOCAL_MAILBOX_ENABLED','false'],['MAIL_TRANSPORT','smtp'],['NODE_ENV','production'],['DATABASE_URL','postgres://localhost/phishnet']]){const old=process.env[key];process.env[key]=value;assert.equal(labEnabled(),false,key);process.env[key]=old;}
 }finally{for(const key of keys){if(previous[key]===undefined)delete process.env[key];else process.env[key]=previous[key];}}
});

test('role precedence and homes agree for flag-based and role-based administrators',()=>{
  assert.equal(appRole({roles:['Admin']}),'Admin');assert.equal(homeFor({roles:['Admin']}),'/');
  assert.equal(appRole({isAdmin:true,roles:['User']}),'Admin');
  assert.equal(homeFor({roles:['Manager']}),'/manager');assert.equal(homeFor({roles:['User']}),'/employee');
});
test('role permissions separate employee, manager, tenant and platform administration',()=>{
  assert.equal(can({roles:['User']},'campaigns:view'),false);
  assert.equal(can({roles:['Manager']},'campaigns:launch'),false);
  assert.equal(can({roles:['Manager']},'users:edit'),false);
  assert.equal(can({roles:['OrgAdmin']},'users:create'),true);
  assert.equal(can({roles:['OrgAdmin']},'system:admin'),false);
  assert.equal(can({roles:['Admin']},'system:admin'),true);
});
test('legacy and normalized campaign notifications retain their destination ID',()=>{
  for(const url of ['/campaigns/42','/org-admin/campaigns?campaign=42']){
    assert.equal(notificationDestination({type:'campaign_created',actionUrl:url},{roles:['OrgAdmin']}),'/org-admin/campaigns?campaign=42');
    assert.equal(notificationDestination({type:'campaign_created',actionUrl:url},{roles:['Admin']}),'/campaigns?campaign=42');
  }
});
test('content notifications open the item for the recipient role',()=>{
  assert.equal(notificationDestination({type:'article',metadata:{articleId:9}},{roles:['User']}),'/employee/articles/9');
  assert.equal(notificationDestination({type:'article',metadata:{articleId:9}},{roles:['OrgAdmin']}),'/admin/content/articles?preview=9');
  assert.equal(notificationDestination({type:'flashcard',metadata:{deckId:8}},{roles:['User']}),'/employee/flashcards?deck=8');
  assert.equal(notificationDestination({type:'flashcard',metadata:{deckId:8}},{roles:['Admin']}),'/admin/content/flashcards?deck=8');
});
test('enrollment, reports and security notifications use supported pages',()=>{
  assert.equal(notificationDestination({type:'invite_accepted',actionUrl:'/admin/enroll'},{roles:['OrgAdmin']}),'/org-admin/enrollment');
  assert.equal(notificationDestination({type:'weekly_report'},{roles:['Manager']}),'/manager');
  assert.equal(notificationDestination({type:'password_changed'},{roles:['User']}),'/settings');
  assert.equal(notificationDestination({type:'campaign_created',metadata:{campaignId:1}},{roles:['User']}),'/employee');
});
test('unrecognized or external notification destinations cannot navigate off-site',()=>{
  for(const actionUrl of ['https://example.com','//example.com','javascript:alert(1)','/missing-page','/\\example.com']){
    assert.equal(notificationDestination({actionUrl},{roles:['User']}),'/employee');
  }
});
