import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {PostgresRepository,buildProjection,buildWhere,normalizeRows} from '../api-server/repositories/postgres.js';

test('partial detail projection preserves the SQL-computed real customer label',()=>{
  const original=JSON.parse(fs.readFileSync(new URL('../.local/normalized-emitidos.json',import.meta.url),'utf8'))[0];
  const normalized=normalizeRows([{CLIENTE:original.CLIENTE}],'emitidos','2026-10-01');
  assert.equal(normalized[0].CLIENTE,original.CLIENTE);
});
test('DW projection obeys source names and parameterizes categorical inputs',()=>{
  const sql=buildProjection('emitidos');assert.match(sql,/valor_emitido_tratado.*VALOR_EMITIDO_CLEAN/);
  assert.match(sql,/data_emissao_pedido_tratada.*DATA_EMISSAO_PEDIDO_DATE/);
  const query=buildWhere('emitidos',{dimensions:{UF:["' OR 1=1 --"]},emissionRange:['2026-08-01','2026-08-31']},'2026-10-01');
  assert.ok(!query.text.includes('OR 1=1'));assert.ok(query.values.some(v=>Array.isArray(v)&&v[0]==="' OR 1=1 --"));
  assert.match(query.text,/ANY\(\$\d+\)/);assert.ok(query.text.includes('::date'));
  assert.deepEqual(normalizeRows([], 'emitidos','2026-10-01'),[]);
});
test('search area publishes real context before paginated details are requested',async()=>{
 const rows=JSON.parse(fs.readFileSync(new URL('../.local/normalized-emitidos.json',import.meta.url),'utf8'));
 const repository=new PostgresRepository(null);
 repository.snapshot=async()=>({version:'2647add2-e8fe-4c70-a6b5-96d2b0d67d6d',source:'firebird/apache-hop',frames:{emitidos:rows},publishedAt:'2026-10-01'});
 const response=await repository.getDashboard({area:'emitidos',filters:{},referenceDate:'2026-10-01'},'pesquisa');
 assert.equal(response.meta.records,rows.length);assert.equal(response.tab,'pesquisa');
});
test('emission quantities retain original mapping instead of fabricating a billed measure',()=>{
  const original=JSON.parse(fs.readFileSync(new URL('../.local/normalized-emitidos.json',import.meta.url),'utf8')).slice(0,3);
  const input=structuredClone(original);input.forEach(r=>{delete r.QUANTIDADE_FATURADA_CLEAN;});
  const normalized=normalizeRows(input,'emitidos','2026-10-01');
  normalized.forEach((r,i)=>assert.equal(r.QUANTIDADE_FATURADA_CLEAN,original[i].QUANTIDADE_FATURADA_CLEAN));
});

test('dimension options coalesce real derivation and remain isolated by publication, area and date',async()=>{
 const original=JSON.parse(fs.readFileSync(new URL('../.local/normalized-faturados.json',import.meta.url),'utf8'));
 let reads=0,version='2647add2-e8fe-4c70-a6b5-96d2b0d67d6d';
 const rows=original.map((row,index)=>index?row:new Proxy(row,{get(target,key){if(key==='UF')reads++;return target[key];}}));
 const repository=new PostgresRepository(null);
 repository.snapshot=async(referenceDate,area)=>({version,frames:{[area]:rows}});
 const context={area:'faturados',referenceDate:'2026-10-01',filters:{}};
 const [first,second]=await Promise.all([repository.getDimensions(context),repository.getDimensions(context)]);
 assert.equal(first,second,'concurrent callers share one derived option payload');assert.equal(reads,1);
 assert.equal((await repository.getDimensions({...context,filters:{search:'unused-for-option-domain'}})),first);assert.equal(reads,1);
 assert.deepEqual(first.dimensions.UF,[...new Set(original.map(row=>row.UF).filter(value=>value!=null&&value!==''))].sort());
 version='f8b582ff-b782-4dff-bac5-17e092210a4c';
 const next=await repository.getDimensions(context);assert.notEqual(next,first);assert.equal(next.dataVersion,version);assert.equal(reads,2);
 await repository.getDimensions({...context,referenceDate:'2026-10-02'});assert.equal(reads,3);
 await repository.getDimensions({...context,area:'emitidos'});assert.equal(reads,4);
});

test('immutable snapshot and dimension caches survive a fifteen-minute session and expire after thirty minutes',async()=>{
 const rows=JSON.parse(fs.readFileSync(new URL('../.local/normalized-faturados.json',import.meta.url),'utf8'));
 const repository=new PostgresRepository(null),now=Date.now;
 let time=now(),loads=0;
 Date.now=()=>time;
 try{
   const load=()=>{loads++;return {version:'2647add2-e8fe-4c70-a6b5-96d2b0d67d6d',frames:{faturados:rows}};};
   const snapshot=await repository.snapshots.get('published-real-frames',load);
   repository.snapshot=async()=>repository.snapshots.get('published-real-frames',load);
   const context={area:'faturados',referenceDate:'2026-10-01'};
   const first=await repository.getDimensions(context);
   time+=15*60*1000;
   assert.equal(await repository.snapshots.get('published-real-frames',load),snapshot);
   assert.equal(await repository.getDimensions(context),first);assert.equal(loads,1);
   time+=16*60*1000;
   assert.notEqual(await repository.getDimensions(context),first);assert.equal(loads,2);
 }finally{Date.now=now;}
});
