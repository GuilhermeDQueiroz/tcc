import test from 'node:test';
import assert from 'node:assert/strict';
import {createApp} from '../api-server/app.js';
test('HTTP validates inputs and reports unavailable real source explicitly',async()=>{
  let calls=0;
  const diagnostics=[];
  const app=createApp({repository:{async getDashboard(){calls++;throw new Error('connection refused');},async getDimensions(){throw new Error('connection refused');}},settingsStore:{getMetas:async()=>({})},logger:{error:entry=>diagnostics.push(entry)}});
  const server=app.listen(0,'127.0.0.1');await new Promise(r=>server.once('listening',r));
  try{const base=`http://127.0.0.1:${server.address().port}/api/v1/bi`;
    assert.equal((await fetch(base+'/inventada/resumo')).status,400);
    assert.equal((await fetch(base+'/abertos/mensal')).status,400);
    assert.equal((await fetch(base+'/abertos/resumo?filters='+encodeURIComponent('{"value":{"operator":"sql","value":1}}'))).status,400);
    const result=await fetch(base+'/abertos/resumo');assert.equal(result.status,503);
    const body=await result.json();assert.ok(body.error);assert.equal(body.metrics,undefined);assert.equal(calls,1);
    assert.equal(diagnostics.length,1,'server failure produces diagnostic information');
    assert.equal(diagnostics[0].name,'Error');assert.equal(diagnostics[0].method,'GET');
    assert.equal(diagnostics[0].path,'/api/v1/bi/abertos/resumo');assert.ok(diagnostics[0].frames.length>0);
    assert.ok(!JSON.stringify(diagnostics).includes('connection refused'),'error messages stay out of diagnostic logs');
    assert.equal(diagnostics[0].message,undefined);
  }finally{await new Promise(r=>server.close(r));}
});

test('HTTP diagnostics classify known connection failures without logging their raw messages',async()=>{
 const messages=new Map([
   ['timeout exceeded when trying to connect','pool_acquire_timeout'],
   ['Connection terminated due to connection timeout','connection_timeout'],
   ['Connection terminated unexpectedly','connection_terminated'],
   ['database password must never reach diagnostics','unclassified']
 ]);
 let current;
 const diagnostics=[];
 const app=createApp({repository:{async getDimensions(){throw new Error(current);},pool:{totalCount:2,idleCount:1,waitingCount:0}},logger:{error:entry=>diagnostics.push(entry)}});
 const server=app.listen(0,'127.0.0.1');await new Promise(resolve=>server.once('listening',resolve));
 try{
   for(const [message,classification] of messages){
     current=message;
     assert.equal((await fetch(`http://127.0.0.1:${server.address().port}/api/v1/bi/faturados/filtros`)).status,503);
     const event=diagnostics.at(-1);assert.equal(event.classification,classification);
     assert.deepEqual(event.pool,{total:2,idle:1,waiting:0});
     assert.ok(Number.isFinite(event.memory.rss)&&Number.isFinite(event.memory.heapUsed));
     assert.ok(!JSON.stringify(event).includes(message));
   }
 }finally{await new Promise(resolve=>server.close(resolve));}
});
