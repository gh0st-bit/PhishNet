import {readFileSync,writeFileSync} from 'node:fs';
import {parse} from 'dotenv';
import pg from 'pg';
import assert from 'node:assert/strict';

const env=parse(readFileSync('.env.audit'));
assert.equal(new URL(env.CONTROL_DATABASE_URL).pathname,'/phishnet_audit');
const browser=JSON.parse(readFileSync('logs/investor-release/browser-built.json','utf8'));
assert.equal(browser.stats.unexpected,0);assert.equal(browser.stats.skipped,0);assert.equal(browser.stats.flaky,0);assert.ok(browser.stats.expected>=39);
const foundationBytes=readFileSync('logs/investor-release/foundation.txt');
const foundation=foundationBytes.toString(foundationBytes[0]===0xff&&foundationBytes[1]===0xfe?'utf16le':'utf8');
assert.match(foundation,/tests 55/);assert.match(foundation,/pass 55/);assert.match(foundation,/fail 0/);
const baseline=JSON.parse(readFileSync('logs/product-maturity/baseline.json','utf8'));
const demo=JSON.parse(readFileSync('logs/investor-release/demo-fixture.json','utf8'));
const client=new pg.Client({connectionString:env.CONTROL_DATABASE_URL,connectionTimeoutMillis:5000});await client.connect();
try{
  let preserved=0;
  for(const [table,ids]of Object.entries(baseline.tables)){
    assert.match(table,/^[a-z_]+$/);
    const result=await client.query(`SELECT id FROM ${table} WHERE id=ANY($1::int[])`,[ids]);assert.equal(result.rowCount,ids.length,table);preserved+=result.rowCount;
  }
  const {rows:[queue]}=await client.query('SELECT count(*)::int AS n FROM campaign_dispatch WHERE organization_id=$1',[demo.organizationId]);assert.equal(queue.n,0);
  const {rows:[sample]}=await client.query("SELECT preferences->>'demonstration' AS marker FROM organizations WHERE id=$1",[demo.organizationId]);assert.equal(sample.marker,'true');
  const {rows:migrations}=await client.query("SELECT name FROM runtime_migrations WHERE name IN ('0019_investor_release.sql','0020_content_archive.sql') ORDER BY name");assert.equal(migrations.length,2);
  const result={at:new Date().toISOString(),foundation:{passed:55,failed:0},compiledBrowser:browser.stats,baselineIdsPreserved:preserved,sampleOrganizationId:demo.organizationId,sampleDispatchJobs:queue.n,sampleMarkerPreserved:true,migrations:migrations.map(m=>m.name),manualAwardProof:'logs/investor-release/manual-award-proof.json',artifactDirectory:'logs/investor-release',remaining:['BA-23 original mobile exception root cause unconfirmed','Full manual accessibility/email-client audit','Microsoft reporting collector and live tenant/client acceptance','Production deployment, recovery and capacity acceptance']};
  writeFileSync('logs/investor-release/verification.json',JSON.stringify(result,null,2));console.log(JSON.stringify(result));
}finally{await client.end();}
