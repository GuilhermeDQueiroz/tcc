import test from 'node:test';
import assert from 'node:assert/strict';
import pg from 'pg';
import {readConfig} from '../api-server/config.js';
test('PostgreSQL driver receives warm-connection retention and a longer cold handshake budget',async()=>{
  const config=readConfig({PG_HOST:'127.0.0.1',PG_PORT:'5434',PG_DATABASE:'dados',PG_USER:'runtime-environment',PG_PASSWORD:'runtime-environment'});
  const pool=new pg.Pool(config.postgres);
  try{
    assert.equal(pool.options.min,4,'retain all four connections opened before analytical work');
    assert.equal(pool.options.idleTimeoutMillis,0,'do not reopen connections during long analytical sessions');
    assert.equal(pool.options.connectionTimeoutMillis,30000,'cold handshake gets thirty seconds');
    assert.equal(pool.options.max,4);assert.equal(pool.options.statement_timeout,60000);
    assert.equal(pool.totalCount,0,'minimum retention does not create connections before the first request');
  }finally{await pool.end();}
});
