import test from 'node:test';
import assert from 'node:assert/strict';
import {buildLogisticsDashboard} from '../api-server/domain/logistics.js';
import {createApp} from '../api-server/app.js';

const module=await import('../api-server/domain/strategic.js').catch(()=>({}));
const build=options=>{assert.equal(typeof module.buildStrategicDashboard,'function','strategic calculation must be available');return module.buildStrategicDashboard(options);};
const items=[
 {pedido_id:1,item_id:11,produto_id:1,empresa_id:1,cliente:'A',uf:'SP',cidade:'São Paulo',tipo_entrega:'ENTREGA',emissao:'2026-08-01',quantidade_aberta:10,quantidade_alocada:6,quantidade_sem_carga:4,valor_aberto:200,valor_unitario:20,peso_unitario:5,cubagem_unitaria:1},
 {pedido_id:2,item_id:22,produto_id:2,empresa_id:1,cliente:'B',uf:'MG',cidade:'Belo Horizonte',tipo_entrega:'RETIRA',emissao:'2026-09-01',quantidade_aberta:2,quantidade_alocada:2,quantidade_sem_carga:0,valor_aberto:40,valor_unitario:20,peso_unitario:10,cubagem_unitaria:1},
];
const allocations=[{alocacao_id:1,carga_id:5,pedido_id:1,item_id:11,empresa_id:1,quantidade_aberta:6},{alocacao_id:2,carga_id:6,pedido_id:2,item_id:22,empresa_id:1,quantidade_aberta:2}];
const logistics=filters=>buildLogisticsDashboard({execution:{id:'loads-a',data_referencia:'2026-09-30',fim:'2026-10-01'},items,allocations,filters});
const billingRows=[
 ['2025-09-30',100000,10000,100,0,'SP','ENTREGA'],
 ['2026-08-15',900,100,10,1,'SP','ENTREGA'],
 ['2026-09-02',900,300,20,0,'SP','ENTREGA'],
 ['2026-09-03',900,600,30,1,'MG','RETIRA'],
 ['2026-09-04',0,0,40,0,'MG','RETIRA'],
 ['2026-10-01',100000,10000,100,0,'SP','ENTREGA'],
].map(([date,value,weight,service,onTime,UF,TIPO_ENTREGA],index)=>({DT_FATURA_DATE:date,DATA_EMISSAO_PEDIDO_DATE:'2026-08-01',DT_PREVISAO_FATURAMENTO_DATE:index===4?null:date,CODIGO_PEDIDO:index+1,VALOR_FATURADO_CLEAN:value,PESO_FATURADO_CLEAN:weight,QUANTIDADE_FATURADA_CLEAN:1,VOLUME_M3_FATURADO_CLEAN:1,NIVEL_DE_SERVICO_CLEAN:service,ON_TIME_CLEAN:onTime,UF,TIPO_ENTREGA}));
const publication={version:'billing-a',publishedAt:'2026-10-01',source:'firebird/apache-hop'};
const options={logistics:logistics(),billingRows,publication};
const metric=(data,id)=>data.metrics.find(metric=>metric.id===id).value;

test('strategic view keeps the published balance distinct from a twelve-month billing window',()=>{
 const data=build(options);
 assert.equal(data.metrics.length,7);
 assert.equal(metric(data,'strategic.loads'),2);
 assert.equal(metric(data,'strategic.valueLoad'),160);
 assert.equal(metric(data,'strategic.weightKg'),70);
 assert.equal(metric(data,'strategic.orders30'),1);
 assert.equal(metric(data,'strategic.backlogReal'),8);
 assert.equal(metric(data,'strategic.serviceDays'),25);
 assert.equal(metric(data,'strategic.otif'),50);
 assert.equal(data.meta.history.start,'2025-10-01');assert.equal(data.meta.history.end,'2026-09-30');
 assert.equal(data.meta.history.records,4);assert.equal(data.meta.history.forecastCoverage,75);
 assert.equal(data.meta.publications.logistics.version,'loads-a');assert.equal(data.meta.publications.billing.version,'billing-a');
 const service=data.series.find(series=>series.id==='strategic.service').rows;
 assert.equal(service.length,12);assert.equal(service[0].value,null);assert.equal(service.at(-2).value,10);assert.equal(service.at(-1).value,30);
 const delivery=data.series.find(series=>series.id==='strategic.delivery').rows;
 assert.deepEqual(delivery.map(row=>[row.type,row.value]),[['ENTREGA',1800],['RETIRA',900]]);
 assert.equal(data.tables,undefined,'compact response must not duplicate detailed orders or invoice records');
});

test('service and OTIF cards use record-weighted totals rather than an average of monthly means',()=>{
 const data=build(options);
 assert.notEqual(metric(data,'strategic.serviceDays'),20);
 assert.notEqual(metric(data,'strategic.otif'),(100+100/3)/2);
 const september=data.series.find(series=>series.id==='strategic.otif').rows.at(-1);
 assert.ok(Math.abs(september.value-100/3)<.00001);
 assert.equal(september.records,3);
 assert.equal(september.withForecast,2);
});

test('tonnage changes calendar grain without changing the population or totals',()=>{
 for(const granularity of ['month','week','day']){
  const data=build({...options,granularity});
  const tons=data.series.find(series=>series.id==='strategic.tonnage');
  assert.ok(Math.abs(tons.rows.reduce((total,row)=>total+(row.value??0),0)-1)<.00001);
  assert.equal(metric(data,'strategic.serviceDays'),25);
 }
 const weekly=build({...options,granularity:'week'}).series.find(series=>series.id==='strategic.tonnage').rows;
 assert.ok(weekly.some(row=>row.period==='2026-08-31'&&Math.abs(row.value-.9)<.00001),'weeks start on Monday and span month boundaries');
});

test('empty or unmeasured populations display unavailable ratios instead of invented zero performance',()=>{
 const data=build({...options,logistics:logistics({uf:'XX'}),billingRows:[]});
 for(const key of ['strategic.backlogReal','strategic.serviceDays','strategic.otif'])assert.equal(metric(data,key),null);
 assert.equal(metric(data,'strategic.loads'),0);assert.equal(data.meta.history.records,0);
 assert.ok(data.series.find(series=>series.id==='strategic.service').rows.every(row=>row.value===null));
 const missingWeight=logistics();missingWeight.meta.measures.peso_aberto.missing=1;
 assert.equal(metric(build({...options,logistics:missingWeight}),'strategic.weightKg'),null);
});

test('billing dates restrict only history and common dimensions restrict both populations',()=>{
 const data=build({...options,logistics:logistics({uf:['SP']}),filters:{dimensions:{UF:['SP']},billingRange:['2026-09-01','2026-09-30']}});
 assert.equal(metric(data,'strategic.loads'),1);assert.equal(metric(data,'strategic.valueLoad'),120);
 assert.equal(data.meta.history.records,1);assert.equal(metric(data,'strategic.serviceDays'),20);
 assert.equal(metric(data,'strategic.otif'),0);
 // Backlog keeps the full trailing 90-day rate, independent of the display window.
 assert.equal(metric(data,'strategic.backlogReal'),10);
 assert.ok(data.options.UF.includes('MG'),'options must survive a narrow cut');
});

test('strategic HTTP validates dimensions and calendar grain before reading published sources',async()=>{
 const app=createApp({repository:{},logisticsRepository:{}});
 const server=app.listen(0,'127.0.0.1');await new Promise(resolve=>server.once('listening',resolve));
 try{
  const base=`http://127.0.0.1:${server.address().port}/api/v1/logistica/estrategico`;
  for(const query of ['?granularity=year','?filters='+encodeURIComponent(JSON.stringify({dimensions:{CONSULTOR:['A']}})),'?filters='+encodeURIComponent(JSON.stringify({billingRange:['2026-09-31','2026-10-01']})),'?invented=1'])assert.equal((await fetch(base+query)).status,400);
 }finally{await new Promise(resolve=>server.close(resolve));}
});

test('strategic HTTP applies shared dimensions to both publications and rejects a period beyond published coverage',async()=>{
 const repository={async snapshot(){return {...publication,frames:{faturados:billingRows}};}};
 const logisticsRepository={async snapshot(){return {execution:{id:'loads-a',data_referencia:'2026-09-30'},items,allocations};}};
 const app=createApp({repository,logisticsRepository});
 const server=app.listen(0,'127.0.0.1');await new Promise(resolve=>server.once('listening',resolve));
 try{
  const base=`http://127.0.0.1:${server.address().port}/api/v1/logistica/estrategico?filters=`;
  const filtered=await fetch(base+encodeURIComponent(JSON.stringify({dimensions:{UF:['SP']},billingRange:['2026-09-01','2026-09-30']})));
  assert.equal(filtered.status,200);const body=await filtered.json();
  assert.equal(metric(body,'strategic.loads'),1);assert.equal(metric(body,'strategic.serviceDays'),20);
  assert.equal(body.meta.publications.billing.version,'billing-a');assert.equal(body.meta.publications.logistics.version,'loads-a');
  assert.equal((await fetch(base+encodeURIComponent(JSON.stringify({billingRange:['2026-11-01','2026-11-30']})))).status,400);
 }finally{await new Promise(resolve=>server.close(resolve));}
});

test('a published empty record cannot hide the absence of either real source behind cached metrics',async()=>{
 let available=true;
 const repository={async snapshot(){if(!available)throw new Error('no published source');return {...publication,frames:{faturados:billingRows}};}};
 const app=createApp({repository,logisticsRepository:{async snapshot(){return {execution:{id:'loads-a',data_referencia:'2026-09-30'},items,allocations};}},logger:{error(){}}});
 const server=app.listen(0,'127.0.0.1');await new Promise(resolve=>server.once('listening',resolve));
 try{
  const url=`http://127.0.0.1:${server.address().port}/api/v1/logistica/estrategico`;
  assert.equal((await fetch(url)).status,200);
  available=false;const response=await fetch(url);assert.equal(response.status,503);assert.equal((await response.json()).metrics,undefined);
 }finally{await new Promise(resolve=>server.close(resolve));}
});

test('delivery labels from the ERP and the DW filter the same population',async()=>{
 const actualItems=items.map(item=>({...item,tipo_entrega:item.tipo_entrega==='ENTREGA'?'Entrega':'Retirada'}));
 const execution={id:'loads-a',data_referencia:'2026-09-30'};
 const logisticsRepository={async snapshot(){return {execution,items:actualItems,allocations};},async getDashboard(filters){return buildLogisticsDashboard({execution,items:actualItems,allocations,filters});}};
 const app=createApp({repository:{async snapshot(){return {...publication,frames:{faturados:billingRows}};}},logisticsRepository});
 const server=app.listen(0,'127.0.0.1');await new Promise(resolve=>server.once('listening',resolve));
 try{
  for(const type of ['Entrega','ENTREGA']){
   const response=await fetch(`http://127.0.0.1:${server.address().port}/api/v1/logistica/estrategico?filters=`+encodeURIComponent(JSON.stringify({dimensions:{TIPO_ENTREGA:[type]}})));
   assert.equal(response.status,200);const body=await response.json();
   assert.equal(metric(body,'strategic.loads'),1);assert.equal(body.meta.history.records,2);
   assert.equal(metric(body,'strategic.valueLoad'),120);assert.equal(metric(body,'strategic.serviceDays'),15);
   assert.deepEqual(body.options.TIPO_ENTREGA,['ENTREGA','RETIRA']);
  }
 }finally{await new Promise(resolve=>server.close(resolve));}
});

test('operational priorities count distinct orders and keep overdue forecasts separate from missing dates',()=>{
 const operationalItems=[
  {...items[0],previsao_faturamento:'2026-09-29'},
  {...items[0],item_id:12,quantidade_aberta:2,quantidade_alocada:0,quantidade_sem_carga:2,valor_aberto:40,previsao_faturamento:'2026-09-29'},
  {...items[1],previsao_faturamento:'2026-09-30'},
  {...items[1],pedido_id:3,item_id:33,emissao:'2026-09-25',previsao_faturamento:null,quantidade_alocada:0,quantidade_sem_carga:2},
 ];
 const balance=buildLogisticsDashboard({execution:{id:'ops',data_referencia:'2026-09-30'},items:operationalItems,allocations});
 const data=build({...options,logistics:balance});
 assert.ok(Array.isArray(data.operationalMetrics),'overview must expose actionable balance priorities');
 const values=Object.fromEntries(data.operationalMetrics.map(metric=>[metric.id,metric.value]));
 assert.equal(values['priority.valueFree'],160);
 assert.equal(values['priority.freeOrders'],2,'two items in the same order must not duplicate its count');
 assert.equal(values['priority.overdueOrders'],1,'today and missing forecast are not overdue');
 assert.equal(values['priority.undatedOrders'],1);
});

test('missing prices remain unavailable in strategic operational priorities',()=>{
 const balance=logistics();balance.meta.measures.valor_sem_carga.missing=1;
 const data=build({...options,logistics:balance});
 assert.ok(Array.isArray(data.operationalMetrics));
 assert.equal(data.operationalMetrics.find(metric=>metric.id==='priority.valueFree').value,null);
});

test('the free-order priority includes the same minimum quantity boundary as its formation action',()=>{
 const balance=buildLogisticsDashboard({execution:{id:'boundary',data_referencia:'2026-09-30'},items:[{...items[0],quantidade_aberta:0.000001,quantidade_sem_carga:0.000001,quantidade_alocada:0}],allocations:[]});
 const data=build({...options,logistics:balance});
 assert.equal(data.operationalMetrics.find(metric=>metric.id==='priority.freeOrders').value,1);
});
