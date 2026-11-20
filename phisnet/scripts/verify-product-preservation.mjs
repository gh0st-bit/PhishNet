import pg from 'pg';
import {parse} from 'dotenv';
import {readFileSync,writeFileSync} from 'node:fs';
import assert from 'node:assert/strict';
const env=parse(readFileSync('.env.audit'));
assert.equal(new URL(env.CONTROL_DATABASE_URL).pathname,'/phishnet_audit');
const baseline=JSON.parse(readFileSync('logs/product-maturity/baseline.json'));
const client=new pg.Client({connectionString:env.CONTROL_DATABASE_URL});await client.connect();
try{
 const checks=[];
 for(const [table,ids]of Object.entries(baseline.tables)){
  assert.ok(/^[a-z_]+$/.test(table));
  const {rowCount}=await client.query(`SELECT id FROM ${table} WHERE id=ANY($1::integer[])`,[ids]);
  assert.equal(rowCount,ids.length,table);checks.push({table,preservedIds:rowCount});
 }
 const result={at:new Date().toISOString(),allBaselineIdsPresent:true,checks,totalPreserved:checks.reduce((sum,c)=>sum+c.preservedIds,0)};
 writeFileSync('logs/product-maturity/final-preservation.json',JSON.stringify(result,null,2));console.log(JSON.stringify(result));
}finally{await client.end();}
