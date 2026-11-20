import { createHmac } from 'node:crypto';
import type { Store,Options } from 'express-rate-limit';
import { controlPool } from '../db';

export class PostgresRateLimitStore implements Store {
 readonly localKeys=false;private windowMs=900000;
 constructor(readonly prefix:string){}
 init(options:Options){this.windowMs=options.windowMs;}
 private hash(key:string){return createHmac('sha256',process.env.SESSION_SECRET!).update(key).digest('hex');}
 async increment(key:string){
   const {rows:[row]}=await controlPool.query(`INSERT INTO rate_limit_counters(bucket,key_hash,reset_at) VALUES($1,$2,now()+($3*interval '1 millisecond'))
    ON CONFLICT(bucket,key_hash) DO UPDATE SET hits=CASE WHEN rate_limit_counters.reset_at<=now() THEN 1 ELSE rate_limit_counters.hits+1 END,
    reset_at=CASE WHEN rate_limit_counters.reset_at<=now() THEN excluded.reset_at ELSE rate_limit_counters.reset_at END RETURNING hits,reset_at`,[this.prefix,this.hash(key),this.windowMs]);
   return {totalHits:row.hits,resetTime:new Date(row.reset_at)};
 }
 async decrement(key:string){await controlPool.query('UPDATE rate_limit_counters SET hits=greatest(0,hits-1) WHERE bucket=$1 AND key_hash=$2',[this.prefix,this.hash(key)]);}
 async resetKey(key:string){await controlPool.query('DELETE FROM rate_limit_counters WHERE bucket=$1 AND key_hash=$2',[this.prefix,this.hash(key)]);}
}
