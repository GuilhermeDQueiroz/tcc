// Read-only verification of startup warming against the project's real database.
import fs from 'node:fs';
import assert from 'node:assert/strict';
import pg from 'pg';
import {readConfig} from '../api-server/config.js';
import {warmPool} from '../api-server/pool.js';
const config=readConfig({...process.env,PG_HOST:process.env.PG_HOST || '127.0.0.1',PG_PORT:process.env.PG_PORT || '5434',PG_DATABASE:'dados'});
const pool=new pg.Pool(config.postgres);
async function backendIds(){
  const clients=await Promise.all(Array.from({length:config.postgres.max},()=>pool.connect()));
  try{return (await Promise.all(clients.map(client=>client.query('select pg_backend_pid() as pid')))).map(result=>result.rows[0].pid).sort((a,b)=>a-b);}
  finally{clients.forEach(client=>client.release());}
}
try{
  await warmPool(pool);
  assert.equal(pool.totalCount,4);assert.equal(pool.idleCount,4);
  const before=await backendIds();assert.equal(new Set(before).size,4);
  await new Promise(resolve=>setTimeout(resolve,11000));
  const after=await backendIds();assert.deepEqual(after,before);
  const result={complete:true,verifiedAt:new Date().toISOString(),database:config.postgres.database,port:config.postgres.port,max:config.postgres.max,min:config.postgres.min,idleTimeoutMillis:config.postgres.idleTimeoutMillis,connectionTimeoutMillis:config.postgres.connectionTimeoutMillis,statementTimeoutMillis:config.postgres.statement_timeout,before,after,waitMilliseconds:11000,readOnly:true};
  fs.writeFileSync('.local/pool-warm-verification.json',JSON.stringify(result,null,2));
  console.log('Four real backends warmed and reused after eleven seconds.');
}finally{await pool.end();}
