import test from 'node:test';
import assert from 'node:assert/strict';
import {AsyncCache} from '../api-server/cache.js';

test('LRU eviction keeps in-flight requests coalesced and retains recently used entries',async()=>{
 const cache=new AsyncCache({maxEntries:2});
 let resolve,calls=0;
 const slow=()=>{calls++;return new Promise(done=>{resolve=done;});};
 const first=cache.get('slow',slow);
 await Promise.resolve();
 await cache.get('a',()=>1);await cache.get('b',()=>2);
 assert.equal(await cache.get('a',()=>99),1);
 await cache.get('c',()=>3);
 assert.equal(await cache.get('a',()=>99),1,'a was touched and should survive eviction');
 const second=cache.get('slow',slow);
 resolve(4);assert.deepEqual(await Promise.all([first,second]),[4,4]);
 assert.equal(calls,1);
});

test('clearing while a request is pending prevents that request from repopulating the cache',async()=>{
 const cache=new AsyncCache();let resolve;
 const old=cache.get('key',()=>new Promise(done=>{resolve=done;}));
 await Promise.resolve();cache.clear();
 assert.equal(await cache.get('key',()=>2),2);
 resolve(1);assert.equal(await old,1);
 assert.equal(await cache.get('key',()=>3),2);
});

test('TTL starts after work completes and expiration reloads the entry',async()=>{
 const cache=new AsyncCache({ttl:100});const original=Date.now;
 let time=1000,resolve,calls=0;Date.now=()=>time;
 try{
  const pending=cache.get('key',()=>{calls++;return new Promise(done=>{resolve=done;});});
  await Promise.resolve();time=2000;resolve(1);await pending;
  time=2099;assert.equal(await cache.get('key',()=>2),1);
  time=2100;assert.equal(await cache.get('key',()=>{calls++;return 2;}),2);
  assert.equal(calls,2);
 }finally{Date.now=original;}
});
test('cache coalesces work, isolates versions, does not cache rejected load',async()=>{
  const cache=new AsyncCache({ttl:1000,maxEntries:3});let calls=0;
  const load=async()=>{calls++;return {version:'published-a'};};
  await Promise.all([cache.get('a',load),cache.get('a',load)]);assert.equal(calls,1);
  await cache.get('b',load);assert.equal(calls,2);
  await assert.rejects(cache.get('error',async()=>{throw new Error('source unavailable');}));
  assert.equal(await cache.get('error',async()=>true),true);
});
