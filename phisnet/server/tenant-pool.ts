import type { Pool, PoolClient } from 'pg';
import { databaseScope, type DatabaseScope } from './database-context';

async function begin(client: PoolClient, scope: DatabaseScope, statement = 'BEGIN') {
  await client.query(statement);
  await client.query('SET LOCAL ROLE phishnet_tenant');
  await client.query("SELECT set_config('app.organization_id',$1,true),set_config('app.user_id',$2,true)", [String(scope.organizationId),String(scope.userId)]);
}

// Preserve pg's promise and callback query contracts for Drizzle and existing code.
export function scopedPool(control: Pool, restricted: Pool): Pool {
  const query = (scope: DatabaseScope, args: any[]) => {
    const callback = typeof args.at(-1) === 'function' ? args.pop() : null;
    const result = (async () => {
      const client = await restricted.connect();
      try {
        await begin(client,scope);
        const value = await (client.query as any)(...args);
        await client.query('COMMIT');
        return value;
      } catch (error) { await client.query('ROLLBACK'); throw error; }
      finally { client.release(); }
    })();
    if (callback) { void result.then(value => callback(null,value), error => callback(error)); return; }
    return result;
  };
  const connect = async (scope: DatabaseScope) => {
    const client = await restricted.connect();
    const originalQuery = client.query.bind(client);
    let active = false;
    let released = false;
    const wrapped = new Proxy(client, {
      get(target,key) {
        if (key === 'query') return async (...args: any[]) => {
          const statement = typeof args[0] === 'string' ? args[0] : args[0]?.text || '';
          if (/^\s*begin\b/i.test(statement)) {
            if (active) throw new Error('Transaction already active');
            active=true; await begin(client,scope,statement);
            return { rows: [], rowCount: null };
          }
          if (!active) throw new Error('Scoped connections require an explicit transaction');
          const value = await (originalQuery as any)(...args);
          if (/^\s*(commit|rollback)(?:\s*;?\s*)$/i.test(statement)) active=false;
          return value;
        };
        if (key === 'release') return (error?: Error) => {
          if (released) return;
          released=true;
          // Never return an unfinished transaction to the pool.
          if (active) void originalQuery('ROLLBACK').then(()=>client.release(error),()=>client.release(true));
          else client.release(error);
        };
        return Reflect.get(target,key,target);
      },
    });
    return wrapped;
  };
  return new Proxy(control, {
    get(target,key) {
      if (key === 'end') return () => Promise.all([control.end(),restricted.end()]).then(()=>undefined);
      if (key === 'query') return (...args: any[]) => {
        const scope=databaseScope.getStore();
        return !scope || scope.system ? (control.query as any)(...args) : query(scope,args);
      };
      if (key === 'connect') return (callback?: any) => {
        const scope=databaseScope.getStore();
        if (!scope || scope.system) return callback ? control.connect(callback) : control.connect();
        const result=connect(scope);
        if (callback) { void result.then(client=>callback(null,client,client.release.bind(client)),error=>callback(error)); return; }
        return result;
      };
      const value=Reflect.get(target,key,target);
      return typeof value === 'function' ? value.bind(target) : value;
    },
  });
}
