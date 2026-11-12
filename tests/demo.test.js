import test from 'node:test';
import assert from 'node:assert/strict';
import {packRows,unpackRows,demoRequestKey} from '../shared/demo-snapshot.js';
import {createDemoApi} from '../src/demo/engine.js';
import {buildAftersalesDashboard} from '../api-server/domain/posvenda.js';

test('demo transport preserves relationships, order, zero, null and numeric precision',()=>{
 const rows=[{pedido:7,item:1,label:'Cliente anonimizado',amount:0,weight:null},{pedido:7,item:2,label:'Cliente anonimizado',amount:0.10000000149011612,weight:2},{pedido:8,item:3,label:'Outro cliente',amount:-1,weight:0}];
 assert.deepEqual(unpackRows(packRows(rows)),rows);
 assert.deepEqual(unpackRows(packRows([])),[]);
});
test('precomputed requests distinguish filters, measures and periods, and canonicalize frontend defaults',()=>{
 const date='2026-09-30';
 const base='/bi/abertos/resumo?chartType=table';
 assert.equal(demoRequestKey(base,date),demoRequestKey(base+'&filters=%7B%7D&referenceDate=&year=2026&month=9&dimension=UF&metric=value&backlogType=real&hierarchy=',date));
 assert.notEqual(demoRequestKey(base,date),demoRequestKey(base+'&filters='+encodeURIComponent(JSON.stringify({dimensions:{UF:['MG']}})),date));
 assert.notEqual(demoRequestKey(base,date),demoRequestKey(base+'&metric=weightKg',date));
 assert.notEqual(demoRequestKey(base,date),demoRequestKey(base+'&month=8',date));
 assert.equal(demoRequestKey('/posvenda/assistencias',date),demoRequestKey('/posvenda/assistencias?view=abertas&page=1&pageSize=20&sort=data&direction=desc&dimension=month&metric=value&granularity=month',date));
 assert.notEqual(demoRequestKey('/posvenda/assistencias',date),demoRequestKey('/posvenda/assistencias?view=emitidas',date));
});
test('offline aftersales uses production formulas, complete filtered totals, pagination and CSV',async()=>{
 // Controlled test cases, never presentation data or empirical evidence.
 const execution={id:'controlled-test',data_inicio:'2025-01-01',data_referencia:'2026-09-30',fim:'2026-10-01T12:00:00Z'};
 const make=(id,uf,extra={})=>({categoria:'assistencias',registro_id:id,documento_id:id,pedido_id:id,data:'2026-08-01',quantidade:10,quantidade_aberta:3,valor:100,valor_aberto:30,cliente:'Cliente anonimizado',produto:'Item de teste',uf,cidade:uf==='MG'?'Ubá':'São Paulo',motivo:'Reparo',previsao:'2026-09-01',...extra});
 const snapshot={execution,rows:[make(1,'MG'),make(2,'MG',{valor_aberto:0}),make(3,'SP')]};
 const loads=[];
 const api=createDemoApi({manifest:{referenceDate:execution.data_referencia,publications:{commercial:'test'}},load:async name=>{loads.push(name);assert.equal(name,'posvenda');return snapshot;}});
 const result=await api('/posvenda/assistencias?uf=MG&pageSize=1');
 const expected=buildAftersalesDashboard({...snapshot,area:'assistencias',query:{uf:'MG',page:1,pageSize:1,sort:'data',direction:'desc'}});
 assert.deepEqual(result,expected);
 assert.equal(result.total,2);assert.equal(result.table.rows.length,1);
 assert.equal(result.metrics.find(metric=>metric.id==='posvenda.value').value,30);
 const csv=await api('/posvenda/assistencias?uf=MG&pageSize=1&export=csv');
 assert.equal(csv.split('\r\n').length,3,'CSV includes the complete filtered selection');
 const historical=await api('/posvenda/assistencias?start=2026-08-01&end=2026-08-31');
 assert.equal(historical.referenceDate,'2026-09-30','a period does not reconstruct a historical balance');
 await assert.rejects(api('/posvenda/assistencias?uf=MG&pageSize=0'),/pagina/i);
 assert.ok(loads.length>0);
});
test('offline commercial refuses a different balance reference and never falls back to generated records',async()=>{
 const api=createDemoApi({manifest:{referenceDate:'2026-09-30',publications:{commercial:'test'}},load:async()=>{throw new Error('Real publication absent');}});
 await assert.rejects(api('/bi/abertos/resumo?referenceDate=2026-08-31'),/posição fixa/);
 await assert.rejects(api('/bi/abertos/resumo'),/Real publication absent/);
});
