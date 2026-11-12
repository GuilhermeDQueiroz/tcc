import test from 'node:test';
import assert from 'node:assert/strict';
import {PostgresRepository} from '../api-server/repositories/postgres.js';
import {StrategicRepository} from '../api-server/repositories/strategic.js';
import {AftersalesRepository} from '../api-server/repositories/posvenda.js';
import {logisticsPayload} from '../api-server/presentation/logistics.js';
import {filterRows} from '../api-server/domain/filters.js';

test('unfiltered rows keep their population and array isolation, including date-ignored analyses',()=>{
 const rows=[{UF:'MG',DT_FATURA_DATE:'2026-01-01'},{UF:'SP',DT_FATURA_DATE:'2026-09-01'}];
 const plain=filterRows(rows);
 assert.deepEqual(plain,rows);assert.notEqual(plain,rows);
 assert.deepEqual(filterRows(rows,{dimensions:{UF:[]},billingRange:['2026-08-01','2026-08-31']},{ignoreDates:true}),rows);
 assert.deepEqual(filterRows(rows,{billingRange:['2026-08-01','2026-09-30']}),[rows[1]]);
});

test('prepared row filters retain combined dimension, date, amount and search conditions',()=>{
 const rows=[
  {UF:'MG',DT_FATURA_DATE:'2026-08-15',VALOR_FATURADO_CLEAN:120,CLIENTE:'Cliente Azul'},
  {UF:'MG',DT_FATURA_DATE:'2026-07-15',VALOR_FATURADO_CLEAN:120,CLIENTE:'Cliente Azul'},
  {UF:'MG',DT_FATURA_DATE:'2026-08-15',VALOR_FATURADO_CLEAN:50,CLIENTE:'Cliente Azul'},
  {UF:'SP',DT_FATURA_DATE:'2026-08-15',VALOR_FATURADO_CLEAN:120,CLIENTE:'Cliente Azul'},
 ];
 assert.deepEqual(filterRows(rows,{dimensions:{UF:['MG']},billingRange:['2026-08-01','2026-08-31'],value:{operator:'>=',value:100},search:'azul'}),[rows[0]]);
});

test('dimension date ranges use the earliest and latest valid dates without sorting the population',async()=>{
 const rows=[
  {DATA_EMISSAO_PEDIDO_DATE:'2026-08-15',DT_FATURA_DATE:'2026-09-10'},
  {DATA_EMISSAO_PEDIDO_DATE:'2026-01-03',DT_FATURA_DATE:null},
  {DATA_EMISSAO_PEDIDO_DATE:null,DT_FATURA_DATE:'2026-02-20'},
  {DATA_EMISSAO_PEDIDO_DATE:'2026-07-01',DT_FATURA_DATE:'2026-11-01'},
 ];
 const repository=new PostgresRepository(null);
 repository.getVersion=async()=> 'v1';
 repository.snapshot=async()=>({version:'v1',frames:{faturados:rows}});
 const result=await repository.getDimensions({area:'faturados',referenceDate:'2026-11-09'});
 assert.deepEqual(result.dates,{emission:['2026-01-03','2026-08-15'],billing:['2026-02-20','2026-11-01']});
});

test('derived commercial payloads and dimensions survive raw snapshot eviction but never hide an outage',async()=>{
 let version='a',loads=0,available=true;
 const repository=new PostgresRepository(null);
 repository.getVersion=async()=>{if(!available)throw new Error('unavailable');return version;};
 repository.snapshot=async(referenceDate,area)=>{loads++;return {version,frames:{[area]:[]}};};
 const context={area:'faturados',referenceDate:'2026-09-30',filters:{}};
 const first=await repository.getDashboard(context,'pesquisa');
 const dimensions=await repository.getDimensions(context);
 assert.equal(loads,2);
 repository.snapshots.clear();
 assert.equal(await repository.getDashboard(context,'pesquisa'),first);
 assert.equal(await repository.getDimensions(context),dimensions);
 assert.equal(loads,2,'cache hits must not need the bulk source');
 version='b';
 assert.equal((await repository.getDashboard(context,'pesquisa')).dataVersion,'b');
 assert.equal((await repository.getDimensions(context)).dataVersion,'b');
 assert.equal(loads,4);
 available=false;
 await assert.rejects(repository.getDashboard(context,'pesquisa'),/unavailable/);
 await assert.rejects(repository.getDimensions(context),/unavailable/);
});

test('strategic payload cache checks both publications before skipping bulk commercial reads',async()=>{
 let version='a',loads=0,available=true,logisticsAvailable=true;
 const commercial={
  async getVersion(){if(!available)throw new Error('commercial unavailable');return version;},
  async snapshot(){loads++;return {version,frames:{emitidos:[],faturados:[]}};}
 };
 const logistics={async snapshot(){if(!logisticsAvailable)throw new Error('logistics unavailable');return {execution:{id:'loads',data_referencia:'2026-09-30'},items:[],allocations:[]};}};
 const repository=new StrategicRepository(commercial,logistics);
 const first=await repository.getDashboard();
 assert.equal(await repository.getDashboard(),first);assert.equal(loads,1);
 version='b';assert.notEqual(await repository.getDashboard(),first);assert.equal(loads,2);
 available=false;await assert.rejects(repository.getDashboard(),/commercial unavailable/);
 available=true;logisticsAvailable=false;await assert.rejects(repository.getDashboard(),/logistics unavailable/);
});

test('logistics transport sends shared hierarchies once without discarding distinct trees or changing the domain',()=>{
 const rows=[{id:'order',children:[{id:'item',quantity:3}]}],distinct=[{id:'group'}];
 const source={tables:[{rows,tree:rows},{rows:[],tree:distinct}]};
 const payload=JSON.parse(JSON.stringify(logisticsPayload(source)));
 assert.equal(payload.tables[0].tree,undefined);assert.equal(payload.tables[0].treeFromRows,true);
 assert.deepEqual(payload.tables[0].rows,rows);assert.deepEqual(payload.tables[1].tree,distinct);
 assert.equal(source.tables[0].tree,rows);
});

test('aftersales page, size and CSV reuse full-population calculations and release the database before CPU work',async()=>{
 let builds=0,released=0,version='a',published=true;
 const source=Array.from({length:5},(_,i)=>({registro_id:i+1,categoria:'assistencias',documento_id:i+1,data:'2026-08-01',quantidade:2,quantidade_aberta:1,valor:20,valor_aberto:10,uf:'MG'}));
 const pool={async connect(){return {async query(sql){
  return {rows:sql.includes('to_regclass')?[{available:true}]:sql.includes('JOIN posvenda.execucao')?(published?[{id:version,data_inicio:'2026-01-01',data_referencia:'2026-09-30'}]:[]):sql.includes('FROM posvenda.registro')?source:[]};
 },release(){released++;}};}};
 const {buildAftersalesDashboard}=await import('../api-server/domain/posvenda.js');
 const repository=new AftersalesRepository(pool,{buildDashboard(input){assert.ok(released>0);builds++;return buildAftersalesDashboard(input);}});
 const first=await repository.getDashboard('assistencias',{page:1,pageSize:2});
 const second=await repository.getDashboard('assistencias',{page:2,pageSize:2});
 const details=await repository.getDashboard('assistencias',{page:2,pageSize:2,section:'details'});
 const resized=await repository.getDashboard('assistencias',{page:1,pageSize:3});
 const csv=await repository.getDashboard('assistencias',{export:'csv'});
 assert.equal(builds,1);assert.equal(first.total,5);assert.equal(first.table.rows.length,2);assert.equal(resized.table.rows.length,3);assert.equal(csv.table.rows.length,5);
 assert.equal(new Set([...first.table.rows,...second.table.rows].map(row=>row.registro_id)).size,4);
 assert.deepEqual(first.metrics,second.metrics);assert.deepEqual(first.series,second.series);
 assert.deepEqual(details.table,second.table);assert.equal(details.metrics,undefined);assert.equal(details.series,undefined);
 assert.equal(details.dataVersion,first.dataVersion);assert.equal(builds,1);
 version='b';assert.equal((await repository.getDashboard('assistencias',{})).dataVersion,'b');assert.equal(builds,2);
 published=false;await assert.rejects(repository.getDashboard('assistencias',{}),{status:409});
});
