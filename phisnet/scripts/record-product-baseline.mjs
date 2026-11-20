import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {parse} from 'dotenv';
import pg from 'pg';
const env=parse(readFileSync('.env.audit'));if(new URL(env.CONTROL_DATABASE_URL).pathname!=='/phishnet_audit')throw new Error('Audit database only');
const client=new pg.Client({connectionString:env.CONTROL_DATABASE_URL});await client.connect();
try{
 const data={at:new Date().toISOString(),tables:{}};
 for(const table of ['organizations','users','campaigns','groups','email_templates','landing_pages','training_modules','articles','flashcard_decks','quizzes']){
  const {rows}=await client.query(`SELECT id FROM ${table} ORDER BY id`);data.tables[table]=rows.map(row=>row.id);
 }
 mkdirSync('logs/product-maturity',{recursive:true});writeFileSync('logs/product-maturity/baseline.json',JSON.stringify(data,null,2));console.log('Recorded persistent IDs for',Object.keys(data.tables).length,'tables');
}finally{await client.end();}
