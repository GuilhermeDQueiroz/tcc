import test from 'node:test';
import {strategicDefaultPeriod} from '../shared/strategic-period.js';
import assert from 'node:assert/strict';
import {buildLogisticsDashboard} from '../api-server/domain/logistics.js';
import {createApp} from '../api-server/app.js';
import {backlogState} from '../api-server/domain/logistics-backlog.js';
import {buildOpenDashboard} from '../api-server/domain/open.js';

const module=await import('../api-server/domain/strategic.js').catch(()=>({}));
const build=options=>{assert.equal(typeof module.buildStrategicDashboard,'function','strategic calculation must be available');return module.buildStrategicDashboard(options);};
const items=[
 {pedido_id:1,item_id:11,produto_id:1,empresa_id:1,cliente:'A',status_erp:'LOGÍSTICA',uf:'SP',cidade:'São Paulo',tipo_entrega:'ENTREGA',emissao:'2026-08-01',quantidade_aberta:10,quantidade_alocada:6,quantidade_sem_carga:4,valor_aberto:200,valor_unitario:20,peso_unitario:5,cubagem_unitaria:1},
 {pedido_id:2,item_id:22,produto_id:2,empresa_id:1,cliente:'B',status_erp:'DOCUMENTO EM CARGA',uf:'MG',cidade:'Belo Horizonte',tipo_entrega:'RETIRA',emissao:'2026-09-01',quantidade_aberta:2,quantidade_alocada:2,quantidade_sem_carga:0,valor_aberto:40,valor_unitario:20,peso_unitario:10,cubagem_unitaria:1},
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
const options={logistics:logistics(),billingRows,publication,filters:{billingRange:['2025-10-01','2026-09-30']}};
const metric=(data,id)=>data.metrics.find(metric=>metric.id===id).value;

test('overview defers the dimensional table while preserving the cards and monthly analysis',()=>{
 const full=build(options),overview=build({...options,includeAnalysis:false});
 assert.deepEqual(overview.metrics,full.metrics);
 assert.deepEqual(overview.financial.monthlyTable,full.financial.monthlyTable);
 assert.deepEqual(overview.analysis.options,full.analysis.options);
 assert.equal(overview.analysis.deferred,true);
 assert.deepEqual(overview.analysis.table.rows,[]);
 assert.ok(full.analysis.table.rows.length);
});

test('volume card averages monthly totals and ticket divides revenue by units rather than orders or monthly tickets',()=>{
 const rows=[
  {...billingRows[1],DT_FATURA_DATE:'2026-08-15',VALOR_FATURADO_CLEAN:1000,QUANTIDADE_FATURADA_CLEAN:10,VOLUME_M3_FATURADO_CLEAN:20},
  {...billingRows[2],DT_FATURA_DATE:'2026-09-30',VALOR_FATURADO_CLEAN:9000,QUANTIDADE_FATURADA_CLEAN:30,VOLUME_M3_FATURADO_CLEAN:60},
 ];
 const data=build({...options,billingRows:rows,filters:{billingRange:['2026-08-01','2026-09-30']}});
 assert.equal(metric(data,'strategic.monthlyVolume'),40);assert.equal(metric(data,'strategic.ticket'),250);
 assert.notEqual(metric(data,'strategic.ticket'),200,'not the mean of monthly unit prices 100 and 300');
 assert.deepEqual(data.series.find(series=>series.id==='strategic.ticket').rows.map(row=>row.value),[100,300]);
 assert.equal(data.financial.monthlyTable.total.ticket,250);assert.equal(data.analysis.table.total.ticket,250);
 assert.equal(data.metrics.some(metric=>metric.id==='strategic.tonnage'),false);
 assert.equal(data.metrics.some(metric=>metric.label.toLowerCase().includes('média')),false);
 const missing=build({...options,billingRows:rows.map(row=>({...row,VOLUME_M3_FATURADO_CLEAN:null,QUANTIDADE_FATURADA_CLEAN:0}))});
 assert.equal(metric(missing,'strategic.monthlyVolume'),null);assert.equal(metric(missing,'strategic.ticket'),null);
});

test('annual comparisons align equivalent windows, accumulate amounts and weight revenue per tonne',()=>{
 const row=(date,value,weight,extra={})=>({...billingRows[1],DT_FATURA_DATE:date,DATA_EMISSAO_PEDIDO_DATE:date,VALOR_FATURADO_CLEAN:value,PESO_FATURADO_CLEAN:weight,GRUPO_CLIENTE:'Group',...extra});
 const rows=[row('2025-01-01',100,10,{UF:'CE'}),row('2025-02-28',300,30),row('2026-01-01',200,10),row('2026-02-28',600,30)];
 const data=build({...options,billingRows:rows,filters:{billingRange:['2026-01-01','2026-02-28']}});
 const {comparison,monthlyTable}=data.financial;
 assert.equal(comparison.start,'2026-01-01');assert.equal(comparison.previousStart,'2025-01-01');assert.equal(comparison.revenueChange,100);
 const monthly=data.series.find(series=>series.id==='strategic.annualMonthly');
 assert.deepEqual(monthly.rows.map(row=>[row.previous,row.current]),[[100,200],[300,600]]);
 const cumulative=data.series.find(series=>series.id==='strategic.annualCumulative');
 assert.deepEqual(cumulative.rows.map(row=>[row.previousAccumulated,row.currentAccumulated]),[[100,200],[400,800]]);
 const tonne=data.series.find(series=>series.id==='strategic.annualRevenueTon');
 assert.equal(tonne.rows.at(-1).currentRevenueTon,20000);assert.equal(tonne.rows.at(-1).previousRevenueTon,10000);
 assert.equal(monthlyTable.rows[0].difference,100);assert.equal(monthlyTable.total.difference,400);
 assert.equal(data.analysis.table.rows.find(row=>row.label==='CE').difference,-100,'previous-only dimension remains visible');
 const sums=data.analysis.table.rows.reduce((total,row)=>total+row.difference,0);assert.equal(sums,data.analysis.table.total.difference);
 const noPrevious=build({...options,billingRows:rows.filter(row=>row.DT_FATURA_DATE.startsWith('2026'))});
 assert.equal(noPrevious.financial.comparison.available,false);assert.deepEqual(noPrevious.financial.annualSeries[0].rows,[]);
 assert.equal(noPrevious.financial.monthlyTable.total.difference,null);
});

test('January and dimensional annual variance use the published 2025 extract coverage',()=>{
 const row=(date,value,UF)=>({...billingRows[1],DT_FATURA_DATE:date,DATA_EMISSAO_PEDIDO_DATE:date,VALOR_FATURADO_CLEAN:value,UF});
 const data=build({...options,billingRows:[row('2025-01-06',100,'CE'),row('2026-01-06',200,'MG')],filters:{billingRange:['2025-01-01','2026-01-31']}});
 const january=data.financial.monthlyTable.rows.find(entry=>entry.period==='2026-01-01');
 assert.equal(january.difference,100,'the first invoice on 6 January does not make 1–5 January uncovered');
 assert.equal(data.financial.monthlyTable.total.difference,100,'the monthly total uses the comparable annual window');
 assert.equal(data.analysis.table.total.difference,100,'annual variance compares January 2026 with January 2025');
 assert.equal(data.analysis.table.rows.find(entry=>entry.label==='MG').difference,200);
 assert.equal(data.analysis.table.rows.find(entry=>entry.label==='CE').difference,-100);
});

test('billing map respects dates and filters, preserves missing UF amounts and is independent of analysis dimension',()=>{
 const rows=[
  {...billingRows[1],UF:' sp ',VALOR_FATURADO_CLEAN:100},
  {...billingRows[2],UF:'MG',VALOR_FATURADO_CLEAN:200},
  {...billingRows[3],UF:null,VALOR_FATURADO_CLEAN:40},
  {...billingRows[4],UF:'XX',VALOR_FATURADO_CLEAN:60},
  billingRows[0],billingRows[5],
 ];
 const filters={billingRange:['2026-08-01','2026-09-30']};
 const data=build({...options,billingRows:rows,filters,dimension:'CIDADE'});
 const map=data.financial.geography;
 assert.equal(map.type,'map');assert.equal(map.title,'MAPA DE FATURAMENTO');
 assert.deepEqual(map.rows,[{UF:'MG',value:200,records:1},{UF:'SP',value:100,records:1}]);
 assert.deepEqual(map.unmapped,{records:2,value:100});
 assert.equal(map.rows.reduce((sum,row)=>sum+row.value,0)+map.unmapped.value,data.financial.monthlyTable.total.value);
 const filtered=build({...options,billingRows:rows,filters:{...filters,dimensions:{UF:['MG']}}});
 assert.deepEqual(filtered.financial.geography.rows,[{UF:'MG',value:200,records:1}]);
 assert.equal(filtered.financial.geography.unmapped.records,0);
 const missing=build({...options,billingRows:[{...billingRows[1],VALOR_FATURADO_CLEAN:null}]});
 assert.equal(missing.financial.geography.rows[0].value,null);
});

test('heatmap preserves outside-period gaps and recalculates distinct orders for selected cells',()=>{
 const rows=[{...billingRows[1],DT_FATURA_DATE:'2026-08-01',GRUPO_CLIENTE:'G'},
  {...billingRows[1],DT_FATURA_DATE:'2026-08-20',GRUPO_CLIENTE:'G'},
  {...billingRows[2],DT_FATURA_DATE:'2026-09-30',GRUPO_CLIENTE:'G'}];
 const data=build({...options,billingRows:rows,filters:{billingRange:['2026-08-01','2026-09-30']},heatmapMetric:'orders'});
 const cells=data.financial.heatmap.rows[0];assert.equal(cells.month_8,1);assert.equal(cells.month_9,1);assert.equal(cells.month_7,null);assert.equal(cells.month_10,null);
 const byState=build({...options,billingRows:rows,heatmapDimension:'UF',heatmapMetric:'weight'});
 assert.equal(byState.financial.heatmap.rows[0].dimension,'SP');assert.equal(byState.financial.heatmap.rows[0].month_8,.2);
 assert.ok(data.analysis.options.some(option=>option.id==='STATUS'));assert.ok(data.analysis.options.some(option=>option.id==='FAMILIA'));
});

test('monthly production averages include empty months and count invoices only once per order and group within a month',()=>{
 const rows=billingRows.map(row=>({...row,CODIGO_PEDIDO:'same-order',GRUPO_CLIENTE:'same-group'}));
 const data=build({...options,billingRows:rows,filters:{billingRange:['2026-08-01','2026-09-30']}});
 assert.equal(data.metrics.find(metric=>metric.id==='strategic.tonnage'),undefined);assert.equal(metric(data,'strategic.monthlyTonnage'),.5);
 assert.equal(metric(data,'strategic.monthlyQuantity'),2);
 assert.equal(metric(data,'strategic.monthlyOrders'),1);assert.equal(metric(data,'strategic.monthlyGroups'),1);
 assert.equal(metric(data,'strategic.revenueTon'),2700,'the revenue-per-ton card uses total billing divided by total tonnes');
 assert.equal(data.meta.history.months,2);
 assert.deepEqual(data.series.find(series=>series.id==='strategic.orders').rows.map(row=>row.value),[1,1]);
 const fullWindow=build({...options,billingRows:rows});
 assert.equal(metric(fullWindow,'strategic.monthlyOrders'),2/12,'the ten months without records remain in the denominator');
 assert.equal(metric(fullWindow,'strategic.monthlyQuantity'),4/12);
 const missing=build({...options,billingRows:rows.map(row=>({...row,GRUPO_CLIENTE:null,QUANTIDADE_FATURADA_CLEAN:null})),filters:{billingRange:['2026-08-01','2026-09-30']}});
 assert.equal(metric(missing,'strategic.monthlyQuantity'),null);assert.equal(metric(missing,'strategic.monthlyGroups'),null);
});

test('strategic evolutions use light green and revenue per tonne matches the monthly table',()=>{
 const data=build({...options,filters:{billingRange:['2026-08-01','2026-09-30']}});
 for(const id of ['service','otif','outflow','tonnage','quantity','orders','groups','ticket','revenueTon']){
  const series=data.series.find(item=>item.id==='strategic.'+id);
  assert.equal(series?.color,'#8BC53F',id);
  assert.equal(series?.singleColor,true,id);
 }
 for(const id of ['annualMonthly','annualCumulative','annualRevenueTon'])assert.deepEqual(data.series.find(item=>item.id==='strategic.'+id)?.colors,['#C69214','#8BC53F']);
 const monthly=data.financial.monthlyTable.rows;
 assert.deepEqual(data.series.find(item=>item.id==='strategic.revenueTon').rows.map(row=>row.value),monthly.map(row=>row.revenueTon));
 assert.equal(data.metrics.find(item=>item.id==='strategic.revenueTon').value,data.financial.monthlyTable.total.revenueTon);
});

test('dimension totals recompute distinct monthly counts and weighted ratios instead of adding overlapping groups',()=>{
 const rows=billingRows.map(row=>({...row,CODIGO_PEDIDO:'same-order',GRUPO_CLIENTE:'same-group'}));
 const data=build({...options,billingRows:rows,filters:{billingRange:['2026-08-01','2026-09-30']}});
 const table=data.analysis.table;
 assert.equal(table.total.value,2700);assert.equal(table.rows.reduce((sum,row)=>sum+row.value,0),2700);
 assert.equal(table.total.ordersMonthly,1);assert.equal(table.total.groupsMonthly,1);
 assert.equal(table.rows.reduce((sum,row)=>sum+row.ordersMonthly,0),1.5,'an order billed to two states may appear in both rows');
 assert.equal(table.total.revenueKg,2.7);assert.equal(table.total.quantityMonthly,2);
 const byGroup=build({...options,billingRows:rows,dimension:'GRUPO_CLIENTE'});
 assert.equal(byGroup.analysis.dimension,'GRUPO_CLIENTE');assert.equal(byGroup.analysis.table.rows.length,1);
 assert.equal(byGroup.metrics.find(metric=>metric.id==='strategic.revenueTon').value,2700);
 assert.equal(byGroup.meta.history.totals.value,data.meta.history.totals.value);
});

test('open-order general coverage uses the whole portfolio and its own color rather than the logistics subset',()=>{
 const rows=[{CODIGO_PEDIDO:1,DATA_EMISSAO_PEDIDO_DATE:'2026-09-01',VALOR_EM_ABERTO_CLEAN:150,STATUS:'LOGÍSTICA'},
  {CODIGO_PEDIDO:2,DATA_EMISSAO_PEDIDO_DATE:'2026-09-01',VALOR_EM_ABERTO_CLEAN:170,STATUS:'EM PRODUÇÃO'}];
 const dashboard=buildOpenDashboard({rows,referenceDate:'2026-09-30',dailyAverage:10});
 const card=dashboard.metrics.find(metric=>metric.id==='abertos.resumo.backlogGeneral');
 assert.equal(card.value,32);assert.equal(card.label,'Backlog');
 assert.deepEqual(card.status,{tone:'good',label:'Ideal'});
 assert.equal(card.supplementary,undefined);assert.equal(card.label,'Backlog');
 assert.equal(dashboard.metrics.find(metric=>metric.id==='abertos.resumo.backlogReal').value,15);
 const unavailable=buildOpenDashboard({rows,referenceDate:'2026-09-30',dailyAverage:0}).metrics.find(metric=>metric.id==='abertos.resumo.backlogGeneral');
 assert.equal(unavailable.value,null);assert.equal(unavailable.status.tone,'neutral');
});

test('logistics backlog selects billable ERP statuses without repeating orders allocated to multiple loads',()=>{
 const rows=[
  {...items[0],status_erp:'Documento em Carga'},
  {...items[1],status_erp:'Logística'},
  {...items[1],pedido_id:3,item_id:33,status_erp:'DOCUMENTO FATURADO PARCIAL'},
  {...items[1],pedido_id:4,item_id:44,status_erp:'DOCUMENTO LIBERADO'},
  {...items[1],pedido_id:5,item_id:55,status_erp:'EM PRODUÇÃO'},
  {...items[1],pedido_id:6,item_id:66,status_erp:null},
 ];
 const extraLink={...allocations[0],alocacao_id:3,carga_id:7,quantidade_aberta:1};
 const balance=buildLogisticsDashboard({execution:{id:'loads-a',data_referencia:'2026-09-30'},items:rows,allocations:[...allocations,extraLink]});
 const data=build({...options,logistics:balance});
 assert.equal(data.meta.backlog.realValue,320);assert.equal(data.meta.backlog.generalValue,undefined);
 assert.equal(data.meta.backlog.orders,4);
 assert.equal(metric(data,'strategic.backlogReal'),320/30);
 assert.equal(data.meta.backlog.generalDays,undefined);
 assert.equal(data.metrics[0].supplementary,undefined);assert.equal(metric(data,'strategic.portfolioValue'),320);
 assert.deepEqual(data.metrics[0].status,{tone:'critical',label:'Crítico (baixo demais)'});
 const later=build({...options,logistics:balance,filters:{billingRange:['2026-09-01','2026-09-30']}});
 assert.equal(later.meta.backlog.dailyAverage,data.meta.backlog.dailyAverage);
 assert.equal(later.metrics[0].value,data.metrics[0].value);
 const incomplete=structuredClone(balance);incomplete.tables[0].rows.find(row=>row.pedido_id==='5').valor_aberto='Não disponível';incomplete.meta.measures.valor_aberto.missing=1;
 const partial=build({...options,logistics:incomplete});
 assert.equal(partial.meta.backlog.realValue,320);assert.equal(partial.meta.backlog.generalDays,undefined);
});

test('logistics backlog uses every legacy color boundary and keeps absent rates neutral',()=>{
 for(const [days,tone,label] of [[0,'critical','Crítico (baixo demais)'],[14.999,'critical','Crítico (baixo demais)'],[15,'warning','Atenção (baixo)'],[24.999,'warning','Atenção (baixo)'],[25,'good','Ideal'],[34.999,'good','Ideal'],[35,'warning','Atenção (alto)'],[44.999,'warning','Atenção (alto)'],[45,'critical','Crítico (alto demais)'],[null,'neutral','Indisponível']])assert.deepEqual(backlogState(days),{tone,label});
 const data=build({...options,billingRows:[]});
 assert.equal(data.meta.backlog.realDays,null);assert.equal(data.meta.backlog.generalDays,undefined);
 assert.equal(data.metrics[0].status.tone,'neutral');
});

test('strategic view keeps the published balance distinct from a twelve-month billing window',()=>{
 const data=build(options);
 assert.equal(data.metrics.length,13);
 assert.equal(new Set(data.metrics.map(card=>card.id)).size,13);assert.equal(metric(data,'strategic.portfolioValue'),240);
 assert.equal(logistics().metrics.find(card=>card.id==='logistica.loads').label,'Cargas em aberto');
 assert.equal(logistics().metrics.find(card=>card.id==='logistica.loads').value,2);
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
 const deliverySeries=data.series.find(series=>series.id==='strategic.delivery');
 assert.equal(deliverySeries.title,'TIPO DE ENTREGA');
 assert.deepEqual(deliverySeries.metricOptions,{value:'value',weightKg:'weightKg'});
 assert.deepEqual(delivery.map(row=>row.weightKg),[400,600]);
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
 assert.equal(data.meta.backlog.orders,0);assert.equal(data.meta.history.records,0);
 assert.equal(data.meta.backlog.state.tone,'neutral');
 assert.ok(data.series.find(series=>series.id==='strategic.service').rows.every(row=>row.value===null));
 const missingPrice=logistics();missingPrice.tables[0].rows[0].valor_aberto='Não disponível';missingPrice.meta.measures.valor_aberto.missing=1;
 const missing=build({...options,logistics:missingPrice});
 assert.equal(metric(missing,'strategic.backlogReal'),null);assert.equal(missing.meta.backlog.generalDays,undefined);
});

test('billing dates restrict only history and common dimensions restrict both populations',()=>{
 const data=build({...options,logistics:logistics({uf:['SP']}),filters:{dimensions:{UF:['SP']},billingRange:['2026-09-01','2026-09-30']}});
 assert.equal(data.meta.backlog.orders,1);assert.equal(data.meta.backlog.realValue,200);
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
  for(const query of ['?section=details','?section=analysis&section=analysis','?granularity=year','?dimension=invalid','?heatmapDimension=invalid','?heatmapMetric=invalid','?heatmapMetric=orders&heatmapMetric=value','?dimension=UF&dimension=CIDADE','?filters='+encodeURIComponent(JSON.stringify({dimensions:{CONSULTOR:['A']}})),'?filters='+encodeURIComponent(JSON.stringify({billingRange:['2026-09-31','2026-10-01']})),'?invented=1'])assert.equal((await fetch(base+query)).status,400);
 }finally{await new Promise(resolve=>server.close(resolve));}
});

test('strategic HTTP applies shared dimensions and preserves an empty period beyond published coverage',async()=>{
 const repository={async getVersion(){return publication.version;},async snapshot(){return {...publication,frames:{faturados:billingRows}};}};
 const logisticsRepository={async snapshot(){return {execution:{id:'loads-a',data_referencia:'2026-09-30'},items,allocations};}};
 const app=createApp({repository,logisticsRepository});
 const server=app.listen(0,'127.0.0.1');await new Promise(resolve=>server.once('listening',resolve));
 try{
  const base=`http://127.0.0.1:${server.address().port}/api/v1/logistica/estrategico?filters=`;
  const filtered=await fetch(base+encodeURIComponent(JSON.stringify({dimensions:{UF:['SP']},billingRange:['2026-09-01','2026-09-30']})));
  assert.equal(filtered.status,200);const body=await filtered.json();
  assert.equal(body.meta.backlog.orders,1);assert.equal(metric(body,'strategic.serviceDays'),20);
  assert.equal(body.meta.publications.billing.version,'billing-a');assert.equal(body.meta.publications.logistics.version,'loads-a');
  const empty=await fetch(base+encodeURIComponent(JSON.stringify({billingRange:['2026-11-01','2026-11-30']}))).then(response=>response.json());assert.equal(empty.meta.history.start,'2026-11-01');assert.equal(empty.meta.history.end,'2026-11-30');assert.equal(empty.meta.history.records,0);
 }finally{await new Promise(resolve=>server.close(resolve));}
});

test('partial strategic analysis matches the full selection and omits unrelated dashboard fields',async()=>{
 const repository={async getVersion(){return publication.version;},async snapshot(){return {...publication,frames:{faturados:billingRows}};}};
 const logisticsRepository={async snapshot(){return {execution:{id:'loads-a',data_referencia:'2026-09-30'},items,allocations};}};
 const server=createApp({repository,logisticsRepository}).listen(0,'127.0.0.1');await new Promise(resolve=>server.once('listening',resolve));
 try{
  const base=`http://127.0.0.1:${server.address().port}/api/v1/logistica/estrategico`;
  for(const filters of [{},{billingRange:['2026-09-01','2026-09-30'],dimensions:{UF:['SP']}},{emissionRange:['2026-08-01','2026-08-31'],dimensions:{TIPO_ENTREGA:['Entrega']}}]){
   const query='?dimension=TIPO_ENTREGA&filters='+encodeURIComponent(JSON.stringify(filters));
   const full=await fetch(base+query).then(response=>response.json()),partial=await fetch(base+query+'&section=analysis').then(response=>response.json());
   assert.deepEqual(partial.analysis,full.analysis);assert.equal(partial.dataVersion,full.dataVersion);assert.equal(partial.referenceDate,full.referenceDate);
   assert.deepEqual(Object.keys(partial).sort(),['analysis','dataVersion','referenceDate']);
  }
 }finally{await new Promise(resolve=>server.close(resolve));}
});

test('a published empty record cannot hide the absence of either real source behind cached metrics',async()=>{
 let available=true;
 const repository={async getVersion(){if(!available)throw new Error('no published source');return publication.version;},async snapshot(){if(!available)throw new Error('no published source');return {...publication,frames:{faturados:billingRows}};}};
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
 const app=createApp({repository:{async getVersion(){return publication.version;},async snapshot(){return {...publication,frames:{faturados:billingRows}};}},logisticsRepository});
 const server=app.listen(0,'127.0.0.1');await new Promise(resolve=>server.once('listening',resolve));
 try{
  for(const type of ['Entrega','ENTREGA']){
   const response=await fetch(`http://127.0.0.1:${server.address().port}/api/v1/logistica/estrategico?filters=`+encodeURIComponent(JSON.stringify({dimensions:{TIPO_ENTREGA:[type]},billingRange:options.filters.billingRange})));
   assert.equal(response.status,200);const body=await response.json();
   assert.equal(body.meta.backlog.orders,1);assert.equal(body.meta.history.records,2);
   assert.equal(body.meta.backlog.realValue,200);assert.equal(metric(body,'strategic.serviceDays'),15);
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

test('strategic HTTP uses emitted orders from the same publication as the conversion denominator',async()=>{
 const emitted=[2,3].map(CODIGO_PEDIDO=>({CODIGO_PEDIDO,DATA_EMISSAO_PEDIDO_DATE:'2026-08-01',VALOR_EMITIDO_CLEAN:1000,PESO_EMITIDO_CLEAN:100,VOLUME_M3_EMITIDO_CLEAN:10,UF:'SP',TIPO_ENTREGA:'ENTREGA'}));
 const repository={async getVersion(){return publication.version;},async snapshot(referenceDate,area){return {...publication,frames:{faturados:billingRows,...(['strategic','strategic-analysis'].includes(area)?{emitidos:emitted}:{})}};}};
 const app=createApp({repository,logisticsRepository:{async snapshot(){return {execution:{id:'loads-a',data_referencia:'2026-09-30'},items,allocations};}}});
 const server=app.listen(0,'127.0.0.1');await new Promise(resolve=>server.once('listening',resolve));
 try{
  const response=await fetch(`http://127.0.0.1:${server.address().port}/api/v1/logistica/estrategico`);assert.equal(response.status,200);
  const data=await response.json();assert.ok(data.cohorts,'overview must include conversion based on emitted orders');
  const august=data.cohorts.rows.find(row=>row.month==='2026-08');assert.equal(august.orders,2);assert.equal(august.value,2000);
  assert.equal(august.windows[1].valuePercent,45);assert.equal(data.meta.publications.billing.version,publication.version);
 }finally{await new Promise(resolve=>server.close(resolve));}
});

test('strategic filter options retain destinations found only in emitted and still unbilled orders',()=>{
 const emissionRows=[{CODIGO_PEDIDO:99,DATA_EMISSAO_PEDIDO_DATE:'2026-08-01',VALOR_EMITIDO_CLEAN:100,PESO_EMITIDO_CLEAN:10,VOLUME_M3_EMITIDO_CLEAN:1,UF:'PR',CIDADE:'Destino somente na emissão',TIPO_ENTREGA:'Retirada'}];
 const data=build({...options,emissionRows});
 assert.ok(data.options.UF.includes('PR'),'unbilled cohort origins must be selectable');
 assert.ok(data.options.CIDADE.includes('Destino somente na emissão'));
 assert.ok(data.options.TIPO_ENTREGA.includes('RETIRA'));
 const filtered=build({...options,emissionRows,filters:{dimensions:{CIDADE:['Destino somente na emissão']}}});
 assert.equal(filtered.cohorts.rows[0].orders,1);assert.equal(filtered.cohorts.rows[0].windows[0].valuePercent,0);
});

const flowEmissions=Array.from({length:12},(_,index)=>({CODIGO_PEDIDO:index+1,DATA_EMISSAO_PEDIDO_DATE:index<10?'2026-07-01':'2026-08-01',VALOR_EMITIDO_CLEAN:100,UF:'SP',TIPO_ENTREGA:'Entrega'}));
const flowInvoice=(id,date,value,emitted=id<=10?'2026-07-01':id<=12?'2026-08-01':'2026-06-01')=>({CODIGO_PEDIDO:id,DATA_EMISSAO_PEDIDO_DATE:emitted,DT_FATURA_DATE:date,VALOR_FATURADO_CLEAN:value,QUANTIDADE_FATURADA_CLEAN:value>0?1:0,UF:'SP',TIPO_ENTREGA:'ENTREGA'});
const flowBilling=[flowInvoice(1,'2026-07-10',20),flowInvoice(1,'2026-07-20',30),flowInvoice(2,'2026-07-31',50),flowInvoice(3,'2026-08-01',100),flowInvoice(11,'2026-08-20',100),flowInvoice(99,'2026-07-15',1500),flowInvoice(100,'2026-09-30',0)];
const flowOptions={...options,emissionRows:flowEmissions,billingRows:flowBilling,filters:{billingRange:['2026-07-01','2026-08-31']}};

test('same-month conversion uses all emitted orders, weights monthly populations and counts partial invoices once',()=>{
 const data=build(flowOptions);
 assert.equal(metric(data,'strategic.sameMonthConversion'),25,'3 of 12 orders, not the 35% arithmetic mean of 20% and 50%');
 assert.equal(data.meta.flow.conversionOrders,12);
 assert.equal(data.meta.flow.convertedOrders,3,'a later-month invoice does not convert its emission month');
 assert.match(data.metrics.find(item=>item.id==='strategic.sameMonthConversion').help,/parciais/i);
});

test('outflow compares monthly revenue and intake in the same period, including billing from earlier cohorts',()=>{
 const data=build(flowOptions),flow=data.meta.flow;
 assert.equal(metric(data,'strategic.outflow'),150,'outflow must remain visible above 100%');
 assert.equal(flow.months,2);assert.equal(flow.emittedValue,1200);assert.equal(flow.billedValue,1800);
 assert.equal(flow.monthlyEmissionAverage,600);assert.equal(flow.monthlyBillingAverage,900);
 assert.equal(flow.monthly.reduce((total,row)=>total+row.emittedValue,0),flow.emittedValue);
 assert.equal(flow.monthly.reduce((total,row)=>total+row.billedValue,0),flow.billedValue);
 const evolution=data.series.find(series=>series.id==='strategic.outflow');
 assert.deepEqual(evolution.rows.map(row=>row.value),flow.monthly.map(row=>row.emittedValue>0?row.billedValue/row.emittedValue*100:null));
 const card=data.metrics.find(item=>item.id==='strategic.outflow');
 assert.equal(card.label,'Escoamento');assert.equal(card.subtitle,undefined);assert.equal(card.supplementary,undefined);
});

test('integral conversion reconciles every product and color by month end, including split invoices',()=>{
 const emission=(id,item,color,quantity)=>({...flowEmissions[0],CODIGO_PEDIDO:id,CODIGO_ITEM:item,COR:color,QUANTIDADE_EMITIDA_CLEAN:quantity});
 const invoice=(id,item,color,quantity,date='2026-07-20')=>({...flowInvoice(id,date,quantity*10),CODIGO_ITEM:item,COR:color,QUANTIDADE_FATURADA_CLEAN:quantity});
 const data=build({...flowOptions,emissionRows:[emission(1,10,'A',10),emission(2,10,'A',5),emission(2,20,'A',5),emission(3,10,'A',5),emission(3,10,'B',5),emission(4,10,'A',2),emission(4,10,'A',3),emission(5,10,'A',10)],
  billingRows:[invoice(1,10,'A',3),invoice(1,10,'A',7),invoice(2,10,'A',10),invoice(3,10,'A',10),invoice(4,10,'A',5),invoice(5,10,'A',5),invoice(5,10,'A',5,'2026-08-01'),flowInvoice(99,'2026-09-30',0)]});
 assert.equal(data.meta.flow.conversionOrders,5);
 assert.equal(data.meta.flow.convertedOrders,5);
 assert.equal(data.meta.flow.fullyConvertedOrders,2,'overbilling one SKU or color must not fill another; next-month billing stays out');
 assert.equal(data.meta.flow.fullSameMonthConversion,40);
 const card=data.metrics.find(item=>item.id==='strategic.sameMonthConversion');
 assert.equal(card.value,100);assert.equal(card.label,'Conversão');
 assert.equal(card.subtitle,undefined);assert.equal(card.supplementary,undefined);
});

test('integral conversion cannot claim completeness with missing quantities or product identity',()=>{
 const row={...flowEmissions[0],CODIGO_ITEM:10,COR:'A',QUANTIDADE_EMITIDA_CLEAN:10};
 const bill={...flowInvoice(1,'2026-07-20',100),CODIGO_ITEM:10,COR:'A',QUANTIDADE_FATURADA_CLEAN:10};
 for(const [emissionRows,billingRows] of [[[ {...row,QUANTIDADE_EMITIDA_CLEAN:null} ],[bill]],[[{...row,CODIGO_ITEM:null}],[bill]],[[row],[{...bill,QUANTIDADE_FATURADA_CLEAN:null}]]]){
  const data=build({...flowOptions,emissionRows,billingRows:[...billingRows,flowInvoice(99,'2026-09-30',0)]});
  assert.equal(data.meta.flow.fullSameMonthConversion,null);
  assert.equal(data.meta.flow.fullConversionUnknownOrders,1);
  assert.equal(metric(data,'strategic.sameMonthConversion'),100);
 }
 const empty=build({...flowOptions,emissionRows:[]});
 assert.equal(empty.meta.flow.fullSameMonthConversion,null);
});

test('flow cards share date and dimension selections without dropping a cohort invoice for a different billing destination',()=>{
 const emissionRows=[...flowEmissions,{...flowEmissions[0],CODIGO_PEDIDO:50,UF:'MG',VALOR_EMITIDO_CLEAN:999}];
 const billingRows=[...flowBilling.map(row=>row.CODIGO_PEDIDO===11?{...row,UF:'MG'}:row),{...flowInvoice(50,'2026-07-15',999),UF:'MG'}];
 const data=build({...flowOptions,emissionRows,billingRows,filters:{billingRange:['2026-07-01','2026-08-31'],dimensions:{UF:['SP']},emissionRange:['2026-08-01','2026-08-31']}});
 assert.equal(metric(data,'strategic.sameMonthConversion'),50);
 assert.equal(data.meta.flow.months,1);assert.equal(data.meta.flow.emittedValue,200);assert.equal(data.meta.flow.billedValue,100);
 assert.equal(metric(data,'strategic.outflow'),50,'the period intersects both date selections; revenue still includes older orders');
});

test('conversion waits for the emission month to close while outflow marks a partially observed period',()=>{
 const emissionRows=[{...flowEmissions[0],DATA_EMISSAO_PEDIDO_DATE:'2026-09-01'}];
 const billingRows=[flowInvoice(1,'2026-09-15',50,'2026-09-01')];
 const data=build({...options,emissionRows,billingRows,filters:{billingRange:['2026-09-01','2026-09-15']}});
 assert.equal(metric(data,'strategic.sameMonthConversion'),null);
 assert.equal(data.meta.flow.conversionOrders,0);assert.equal(data.meta.flow.partialPeriod,true);
 assert.equal(metric(data,'strategic.outflow'),50);
});

test('a partially selected first month stays out of monthly conversion but remains in monetary flow',()=>{
 const data=build({...options,emissionRows:[{...flowEmissions[0],DATA_EMISSAO_PEDIDO_DATE:'2026-07-20'}],
  billingRows:[flowInvoice(1,'2026-07-25',100,'2026-07-20'),flowInvoice(99,'2026-09-30',0)],
  filters:{billingRange:['2026-07-15','2026-08-31']}});
 assert.equal(metric(data,'strategic.sameMonthConversion'),null);
 assert.equal(data.meta.flow.conversionOrders,0);
 assert.equal(data.meta.flow.conversionStart,'2026-08-01');
 assert.equal(metric(data,'strategic.outflow'),100);
});

test('flow denominators remain unavailable for empty, disjoint and conflicting emitted populations',()=>{
 const empty=build({...flowOptions,emissionRows:[]});
 assert.equal(metric(empty,'strategic.sameMonthConversion'),null);assert.equal(metric(empty,'strategic.outflow'),null);
 const disjoint=build({...flowOptions,filters:{billingRange:['2026-07-01','2026-07-31'],emissionRange:['2026-08-01','2026-08-31']}});
 assert.equal(metric(disjoint,'strategic.sameMonthConversion'),null);assert.equal(metric(disjoint,'strategic.outflow'),null);
 const conflicting=build({...flowOptions,emissionRows:[flowEmissions[0],{...flowEmissions[0],DATA_EMISSAO_PEDIDO_DATE:'2026-06-01'}]});
 assert.equal(metric(conflicting,'strategic.sameMonthConversion'),null);assert.equal(metric(conflicting,'strategic.outflow'),null);
});


test('monthly tables show cohort conversion, outflow and kg revenue with a card-equivalent summary',()=>{
 const data=build(flowOptions),table=data.financial.monthlyTable,summary=data.financial.cardSummary.rows[0];
 assert.deepEqual(table.rows.map(row=>row.conversion),[20,50]);
 assert.deepEqual(table.rows.map(row=>row.outflow),[160,100]);
 assert.equal(table.total.conversion,25);assert.equal(table.total.outflow,150);
 for(const [column,id] of [['tonnes','monthlyTonnage'],['volume','monthlyVolume'],['quantity','monthlyQuantity'],['orders','monthlyOrders'],['groups','monthlyGroups'],['service','serviceDays'],['otif','otif'],['ticket','ticket'],['revenueTon','revenueTon'],['conversion','sameMonthConversion'],['outflow','outflow']])assert.equal(summary[column],metric(data,'strategic.'+id),column);
 const partial=build({...flowOptions,filters:{billingRange:['2026-07-15','2026-08-15']}});
 assert.ok(partial.financial.monthlyTable.rows.every(row=>row.conversion===null),'partial emission months do not become zero conversion');
 assert.equal(partial.financial.monthlyTable.total.conversion,null);
});

test('dimensional flow includes unbilled origins, attributes conversion to emission and restricts unsupported dimensions',()=>{
 const emissionRows=[...flowEmissions.map(row=>({...row,UF:row.CODIGO_PEDIDO===11?'MG':'SP'})),{...flowEmissions[0],CODIGO_PEDIDO:500,UF:'PR'}];
 const data=build({...flowOptions,emissionRows}),table=data.analysis.table;
 assert.equal(table.rows.find(row=>row.label==='MG').conversion,100,'an MG emission can convert on an SP invoice');
 assert.equal(table.rows.find(row=>row.label==='MG').outflow,0,'outflow uses destination of each event');
 assert.equal(table.rows.find(row=>row.label==='PR').conversion,0,'unbilled origins remain in the denominator and in the table');
 assert.equal(table.total.conversion,3/13*100);assert.equal(table.total.outflow,1800/1300*100);
 const unsupported=build({...flowOptions,dimension:'SUPERVISOR'});
 assert.equal(unsupported.analysis.measures.conversion,undefined);assert.equal(unsupported.analysis.table.total.outflow,undefined);
});

test('portfolio table reconciles current balance and coverage without creating historical balances',()=>{
 const data=build(options),table=data.portfolio.table;
 assert.equal(table.total.value,metric(data,'strategic.portfolioValue'));assert.equal(table.total.backlog,metric(data,'strategic.backlogReal'));
 assert.equal(table.rows.reduce((sum,row)=>sum+row.value,0),table.total.value);
 assert.equal(table.rows.reduce((sum,row)=>sum+row.dailyAverage,0),table.total.dailyAverage);
 for(const row of table.rows)assert.equal(row.backlog,row.dailyAverage>0?row.value/row.dailyAverage:null);
 assert.deepEqual(build({...options,filters:{billingRange:['2026-08-01','2026-08-31']}}).portfolio,data.portfolio);
 assert.equal(data.portfolio.referenceDate,'2026-09-30');assert.equal(data.financial.monthlyTable.columns.some(column=>column.key==='backlog'),false);
});


test('strategic calendar defaults to the previous year through today and preserves explicit selections',()=>{
 const data=build({...options,filters:{}});
 const period=strategicDefaultPeriod();assert.equal(data.meta.history.start,period.start);assert.equal(data.meta.history.end,period.end);
 const selected=build({...options,filters:{billingRange:['2024-01-01','2026-12-31']}});
 assert.equal(selected.meta.history.start,'2024-01-01');assert.equal(selected.meta.history.end,'2026-12-31');assert.equal(selected.meta.history.months,36);
 assert.equal(selected.meta.flow.conversionThrough,'2026-09-30','conversion cannot observe beyond the published reference');
 assert.equal(selected.meta.history.records,5,'future events beyond the snapshot reference remain excluded');
});


test('default calendar uses São Paulo date across UTC midnight and moves its start on New Year',()=>{
 assert.deepEqual(strategicDefaultPeriod(new Date('2026-11-10T01:30:00Z')),{start:'2025-01-01',end:'2026-11-09'});
 assert.deepEqual(strategicDefaultPeriod(new Date('2027-01-01T03:30:00Z')),{start:'2026-01-01',end:'2027-01-01'});
});
