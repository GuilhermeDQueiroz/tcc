import test from 'node:test';
import assert from 'node:assert/strict';
import {LogisticsRepository} from '../api-server/repositories/logistics.js';

// Empty query results test transaction/cache mechanics; UI equivalence uses the
// real publication in scripts/benchmark-logistica.mjs and the browser suite.
function database(){
 const state={version:'publication-a',available:true,itemReads:0,allocationReads:0,released:0,rollbacks:0,failOnce:false};
 const pool={async connect(){return {
  async query(sql){
   if(sql.includes('to_regclass'))return {rows:[{available:state.available}]};
   if(sql.includes('JOIN logistica.execucao'))return {rows:[{id:state.version,data_inicio:'2026-01-01',data_referencia:'2026-09-30'}]};
   if(sql.includes('FROM logistica.item_pedido'))state.itemReads++;
   if(sql.includes('FROM logistica.alocacao')){
    state.allocationReads++;
    if(state.failOnce){state.failOnce=false;throw new Error('read failed');}
   }
   if(sql==='ROLLBACK')state.rollbacks++;
   return {rows:[]};
  },
  release(){state.released++;},
 };}};
 return {state,repository:new LogisticsRepository(pool,{readLocations:async()=>({version:'',entries:{}})})};
}

test('logistics shares bulk reads, isolates filters and switches immediately to a new publication',async()=>{
 const {state,repository}=database();
 const [first,second]=await Promise.all([repository.getDashboard(),repository.getDashboard()]);
 assert.equal(first,second);assert.equal(state.itemReads,1);assert.equal(state.allocationReads,1);
 const filtered=await repository.getDashboard({uf:'MG'});
 assert.notEqual(filtered,first);assert.equal(state.itemReads,1);
 state.version='publication-b';
 const next=await repository.getDashboard();
 assert.equal(next.dataVersion,'publication-b');assert.notEqual(next,first);
 assert.equal(state.itemReads,2);assert.equal(state.allocationReads,2);assert.equal(state.released,4);
 state.available=false;
 await assert.rejects(repository.getDashboard(),error=>error.status===409);
 assert.equal(state.rollbacks,1);assert.equal(state.released,5);
});

test('updating the CEP cache refreshes a same-publication dashboard immediately',async()=>{
 let cache={version:'',entries:{}};
 const item={item_id:1,pedido_id:7,empresa_id:1,emissao:'2026-09-01',cep:'01001000',uf:'SP',cidade:'São Paulo',latitude:null,longitude:null,quantidade_aberta:10,quantidade_alocada:0,quantidade_sem_carga:10,valor_aberto:100,peso_unitario:1,cubagem_unitaria:1};
 const pool={async connect(){return {async query(sql){
  if(sql.includes('to_regclass'))return {rows:[{available:true}]};
  if(sql.includes('JOIN logistica.execucao'))return {rows:[{id:'same',data_inicio:'2026-01-01',data_referencia:'2026-09-30'}]};
  if(sql.includes('FROM logistica.item_pedido'))return {rows:[item]};
  return {rows:[]};
 },release(){}};}};
 const repository=new LogisticsRepository(pool,{readLocations:async()=>cache});
 const first=await repository.getDashboard();assert.equal(first.tables[0].rows[0].latitude,null);
 cache={version:'updated',entries:{'01001000':{cep:'01001000',state:'SP',city:'São Paulo',status:'ok',checkedAt:new Date().toISOString(),location:{coordinates:{latitude:-23.55,longitude:-46.63}}}}};
 const second=await repository.getDashboard();
 assert.notEqual(second.dataVersion,first.dataVersion);assert.equal(second.tables[0].rows[0].latitude,-23.55);assert.equal(second.tables[0].rows[0].geo_origin,'CEP');
 assert.deepEqual(second.metrics,first.metrics);assert.equal(item.latitude,null);
});

test('failed bulk reads roll back, release the connection and can be retried',async()=>{
 const {state,repository}=database();state.failOnce=true;
 await assert.rejects(repository.getDashboard(),/read failed/);
 assert.equal(state.rollbacks,1);assert.equal(state.released,1);
 const data=await repository.getDashboard();
 assert.equal(data.dataVersion,state.version);assert.equal(state.itemReads,2);assert.equal(state.released,2);
});
