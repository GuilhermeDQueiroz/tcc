// Independent read-only SQL oracle. Requires the project's PG_USER/PG_PASSWORD
// environment, never reads or prints credentials and never writes to the DW.
import pg from 'pg';
import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
const contract=JSON.parse(await fs.readFile(new URL('../etl/contrato-colunas-dw.json',import.meta.url),'utf8'));
const names=Object.fromEntries(contract.areas.faturados.columns.map(column=>[column.legacy,column.name]));
const column=name=>'"'+names[name].replaceAll('"','""')+'"';
const close=(actual,expected,tolerance=0.00002)=>assert.ok(Math.abs(actual-expected)<tolerance,`${actual} does not match ${expected}`);
const apiBase=process.env.API_URL||'http://127.0.0.1:3002';
const data=await fetch(apiBase+'/api/v1/logistica/estrategico').then(response=>{assert.ok(response.ok);return response.json();});
const metrics=Object.fromEntries(data.metrics.map(metric=>[metric.id,metric.value]));
const priorities=Object.fromEntries(data.operationalMetrics.map(metric=>[metric.id,metric.value]));
const pool=new pg.Pool({host:'127.0.0.1',port:5434,database:'dados',user:process.env.PG_USER,password:process.env.PG_PASSWORD,connectionTimeoutMillis:20000});
const client=await pool.connect();
try{
 await client.query('BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY');
 const exclusions=['CONSULTOR','SUPERVISOR','GRUPO_CLIENTE'].map(name=>`COALESCE(${column(name)}::text,'') NOT ILIKE '%tekdashboard%'`).join(' AND ');
 const aggregate=`count(*)::integer AS records,sum(${column('VALOR_FATURADO_CLEAN')}::double precision) AS value,sum(${column('PESO_FATURADO_CLEAN')}::real::double precision) AS weight,avg(COALESCE(${column('NIVEL_DE_SERVICO_CLEAN')},0)::real::double precision) AS service,avg(COALESCE(${column('ON_TIME_CLEAN')},0)::real::double precision)*100 AS otif,count(${column('DT_PREVISAO_FATURAMENTO_DATE')})::integer AS forecasts,sum(${column('QUANTIDADE_FATURADA_CLEAN')}::real::double precision) AS quantity,sum(${column('VOLUME_M3_FATURADO_CLEAN')}::real::double precision) AS volume,count(DISTINCT ${column('CODIGO_PEDIDO')})::integer AS orders,count(DISTINCT btrim(${column('GRUPO_CLIENTE')}::text))::integer AS groups`;
 const where=`${exclusions} AND ${column('DT_FATURA_DATE')}::date BETWEEN $1::date AND $2::date`;
 const {history,backlog,publications,flow}=data.meta;
 const logisticsVersion=publications.logistics.version.split(':')[0];
 const total=(await client.query(`SELECT ${aggregate} FROM dw.pedidos_faturados WHERE ${where}`,[history.start,history.end])).rows[0];
 assert.equal(total.records,history.records);assert.equal(total.forecasts,history.withForecast);
 close(metrics['strategic.serviceDays'],Number(total.service));close(metrics['strategic.otif'],Number(total.otif));
 const monthly=(await client.query(`SELECT date_trunc('month',${column('DT_FATURA_DATE')}::date)::date::text AS period,${aggregate} FROM dw.pedidos_faturados WHERE ${where} GROUP BY 1 ORDER BY 1`,[history.start,history.end])).rows;
 for(const month of monthly){
  const series=data.series.find(series=>series.id==='strategic.service').rows.find(row=>row.period===month.period);
  assert.equal(series.records,month.records);close(series.value,Number(month.service));
  const otif=data.series.find(series=>series.id==='strategic.otif').rows.find(row=>row.period===month.period);
  close(otif.value,Number(month.otif));
  const tonnes=data.series.find(series=>series.id==='strategic.tonnage').rows.find(row=>row.period===month.period);
  close(tonnes.value,Number(month.weight)/1000,.01);
  const revenue=data.series.find(series=>series.id==='strategic.revenueKg').rows.find(row=>row.period===month.period);
  close(revenue.value,Number(month.value)/Number(month.weight),.0001);
 }
 close(metrics['strategic.revenueKg'],Number(total.value)/Number(total.weight),.0001);
 assert.equal(metrics['strategic.tonnage'],undefined);
 close(metrics['strategic.ticket'],Number(total.value)/Number(total.quantity),.001);
 close(metrics['strategic.monthlyVolume'],Number(total.volume)/history.months,.01);
 close(metrics['strategic.monthlyTonnage'],monthly.reduce((sum,row)=>sum+Number(row.weight),0)/history.months/1000,.01);
 close(metrics['strategic.monthlyQuantity'],Number(total.quantity)/history.months,.1);
 close(metrics['strategic.monthlyOrders'],monthly.reduce((sum,row)=>sum+row.orders,0)/history.months);
 close(metrics['strategic.monthlyGroups'],monthly.reduce((sum,row)=>sum+row.groups,0)/history.months);
 for(const month of monthly)for(const [id,key] of [['quantity','quantity'],['orders','orders'],['groups','groups']])close(data.series.find(series=>series.id==='strategic.'+id).rows.find(row=>row.period===month.period).value,Number(month[key]),id==='quantity'?.1:.00001);
 close(data.analysis.table.total.value,Number(total.value),.01);
 close(data.analysis.table.total.ordersMonthly,metrics['strategic.monthlyOrders']);close(data.analysis.table.total.groupsMonthly,metrics['strategic.monthlyGroups']);
 const dimensional=(await client.query(`SELECT COALESCE(NULLIF(btrim(${column('UF')}::text),''),'Não informado') AS label,${aggregate} FROM dw.pedidos_faturados WHERE ${where} GROUP BY 1`,[history.start,history.end])).rows;
 for(const row of dimensional){const result=data.analysis.table.rows.find(item=>item.label===row.label);assert.ok(result);close(result.value,Number(row.value),.01);close(result.tonnes,Number(row.weight)/1000,.01);close(result.revenueKg,Number(row.value)/Number(row.weight),.0001);}
 const validStates=new Set('AC AL AP AM BA CE DF ES GO MA MT MS MG PA PB PR PE PI RJ RN RS RO RR SC SP SE TO'.split(' '));
 let unmappedValue=0;
 for(const row of dimensional){const UF=row.label.trim().toUpperCase();if(validStates.has(UF)){const point=data.financial.geography.rows.find(item=>item.UF===UF);assert.ok(point);close(point.value,Number(row.value),.01);}else unmappedValue+=Number(row.value);}
 close(data.financial.geography.unmapped.value,unmappedValue,.01);
 close(data.financial.geography.rows.reduce((total,row)=>total+row.value,0)+unmappedValue,data.financial.monthlyTable.total.value,.02);

 const financial=data.financial,comparison=financial.comparison;
 close(financial.monthlyTable.total.ticket,Number(total.value)/Number(total.quantity),.001);
 close(financial.monthlyTable.total.volume,Number(total.volume),.01);
 for(const month of monthly){const point=data.series.find(series=>series.id==='strategic.ticket').rows.find(row=>row.period===month.period);close(point.value,Number(month.value)/Number(month.quantity),.001);const table=financial.monthlyTable.rows.find(row=>row.period===month.period);close(table.value,Number(month.value),.01);close(table.volume,Number(month.volume),.01);}
 if(comparison.available){
  const current=(await client.query(`SELECT date_trunc('month',${column('DT_FATURA_DATE')}::date)::date::text AS period,${aggregate} FROM dw.pedidos_faturados WHERE ${where} GROUP BY 1 ORDER BY 1`,[comparison.start,comparison.end])).rows;
  const prior=(await client.query(`SELECT date_trunc('month',${column('DT_FATURA_DATE')}::date)::date::text AS period,${aggregate} FROM dw.pedidos_faturados WHERE ${where} GROUP BY 1 ORDER BY 1`,[comparison.previousStart,comparison.previousEnd])).rows;
  let cv=0,pv=0,cw=0,pw=0;
  for(const point of financial.annualSeries[0].rows){const c=current.find(row=>row.period===point.period),p=prior.find(row=>Number(row.period.slice(0,4))===Number(point.period.slice(0,4))-1&&row.period.slice(4)===point.period.slice(4));cv+=Number(c?.value||0);pv+=Number(p?.value||0);cw+=Number(c?.weight||0);pw+=Number(p?.weight||0);close(point.current,Number(c?.value||0),.02);close(point.previous,Number(p?.value||0),.02);close(point.currentAccumulated,cv,.03);close(point.previousAccumulated,pv,.03);if(cw>0)close(point.currentRevenueTon,cv/(cw/1000),.01);if(pw>0)close(point.previousRevenueTon,pv/(pw/1000),.01);}
  if(pv>0)close(comparison.revenueChange,(cv/pv-1)*100,.0001);
 }
 const heat=(await client.query(`SELECT extract(year from ${column('DT_FATURA_DATE')}::date)::integer AS year,extract(month from ${column('DT_FATURA_DATE')}::date)::integer AS month,sum(${column('VALOR_FATURADO_CLEAN')}) AS value FROM dw.pedidos_faturados WHERE ${where} GROUP BY 1,2`,[history.start,history.end])).rows;
 for(const row of heat){const cells=financial.heatmap.rows.find(cells=>cells.dimension===String(row.year));assert.ok(cells);close(cells['month_'+row.month],Number(row.value),.02);}
 const rate=(await client.query(`SELECT count(*)::integer AS records,sum(${column('VALOR_FATURADO_CLEAN')}::double precision)/90 AS daily FROM dw.pedidos_faturados WHERE ${where}`,[backlog.start,backlog.end])).rows[0];
 assert.equal(rate.records,backlog.records);close(Number(rate.daily),backlog.dailyAverage,.01);
 const realStatus="upper(translate(COALESCE(status_erp,''),'Íí','Ii')) ~ '(DOCUMENTO EM CARGA|LOGISTICA|FATURADO PARCIAL|DOCUMENTO LIBERADO)'";
 const balance=(await client.query(`SELECT CASE WHEN bool_or(valor_unitario IS NULL) FILTER(WHERE ${realStatus}) THEN NULL ELSE COALESCE(sum(quantidade_aberta*valor_unitario) FILTER(WHERE ${realStatus}),0) END AS real,
 count(DISTINCT pedido_id) FILTER(WHERE ${realStatus})::integer AS orders FROM logistica.item_pedido WHERE execucao_id=$1`,[logisticsVersion])).rows[0];
 close(Number(balance.real),backlog.realValue,.01);close(Number(balance.real),metrics['strategic.portfolioValue'],.01);
 assert.equal(balance.orders,backlog.orders);close(Number(balance.real)/Number(rate.daily),metrics['strategic.backlogReal']);
 assert.equal(backlog.generalDays,undefined);assert.equal(backlog.generalValue,undefined);
 const formation=await fetch(apiBase+'/api/v1/logistica/formacao').then(response=>{assert.ok(response.ok);return response.json();});
 const loads=(await client.query('SELECT count(DISTINCT carga_id)::integer AS loads FROM logistica.alocacao WHERE execucao_id=$1 AND quantidade_aberta>0',[logisticsVersion])).rows[0];
 assert.equal(loads.loads,formation.metrics.find(metric=>metric.id==='logistica.loads').value);
 assert.equal(formation.metrics.find(metric=>metric.id==='logistica.loads').label,'Cargas em aberto');
 assert.equal(data.metrics.length,13);
 const priority=(await client.query(`WITH orders AS (
  SELECT pedido_id,sum(quantidade_sem_carga) AS free_quantity,min(previsao_faturamento) AS forecast
  FROM logistica.item_pedido WHERE execucao_id=$2 GROUP BY pedido_id
 ) SELECT count(*) FILTER(WHERE free_quantity>=0.000001)::integer AS free_orders,
 count(*) FILTER(WHERE forecast<$1::date)::integer AS overdue_orders,
 count(*) FILTER(WHERE forecast IS NULL)::integer AS undated_orders FROM orders`,[data.referenceDate,logisticsVersion])).rows[0];
 assert.equal(priority.free_orders,priorities['priority.freeOrders']);
 assert.equal(priority.overdue_orders,priorities['priority.overdueOrders']);
 assert.equal(priority.undated_orders,priorities['priority.undatedOrders']);
 const freeValue=(await client.query(`SELECT sum(quantidade_sem_carga*valor_unitario) AS value,
 count(*) FILTER(WHERE quantidade_sem_carga<>0 AND valor_unitario IS NULL)::integer AS missing
 FROM logistica.item_pedido WHERE execucao_id=$1`,[logisticsVersion])).rows[0];
 if(freeValue.missing)assert.equal(priorities['priority.valueFree'],null);
 else close(Number(freeValue.value),priorities['priority.valueFree'],.01);
 const flowTotals=(await client.query(`WITH emitted AS (
  SELECT codigo_docfat AS id,min(data_emissao_pedido_tratada::date) AS emitted,sum(valor_emitido_tratado) AS value
  FROM dw.pedidos_emitidos WHERE ${exclusions} AND codigo_docfat IS NOT NULL AND data_emissao_pedido_tratada::date <= $4::date
  GROUP BY codigo_docfat HAVING count(DISTINCT data_emissao_pedido_tratada::date)=1
 ), eligible AS (SELECT * FROM emitted WHERE emitted BETWEEN $5::date AND $3::date),
 converted AS (
  SELECT DISTINCT codigo_docfat AS id,data_emissao_pedido_tratada::date AS emitted FROM dw.pedidos_faturados
  WHERE data_faturamento_tratada::date BETWEEN $5::date AND $3::date
  AND data_faturamento_tratada::date>=data_emissao_pedido_tratada::date
  AND date_trunc('month',data_faturamento_tratada)=date_trunc('month',data_emissao_pedido_tratada)
  AND (valor_faturado_tratado>0 OR peso_faturado_tratado>0 OR volume_m3_faturado_tratado>0 OR quantidade_faturada_tratada>0)
 ) SELECT count(*)::integer AS orders,count(c.id)::integer AS converted,
 (SELECT sum(value) FROM emitted WHERE emitted BETWEEN $1::date AND $2::date) AS emitted_value,
 (SELECT sum(valor_faturado_tratado) FROM dw.pedidos_faturados WHERE ${exclusions} AND data_faturamento_tratada::date BETWEEN $1::date AND $2::date) AS billed_value
 FROM eligible e LEFT JOIN converted c ON c.id=e.id AND c.emitted=e.emitted`,[flow.start,flow.end,flow.conversionThrough,data.referenceDate,flow.conversionStart])).rows[0];
 assert.equal(flowTotals.orders,flow.conversionOrders);assert.equal(flowTotals.converted,flow.convertedOrders);
 close(Number(flowTotals.emitted_value),flow.emittedValue,.01);close(Number(flowTotals.billed_value),flow.billedValue,.01);
 if(flowTotals.orders)close(metrics['strategic.sameMonthConversion'],flowTotals.converted/flowTotals.orders*100);
 else assert.equal(metrics['strategic.sameMonthConversion'],null);
 if(Number(flowTotals.emitted_value)>0)close(metrics['strategic.outflow'],Number(flowTotals.billed_value)/Number(flowTotals.emitted_value)*100);
 else assert.equal(metrics['strategic.outflow'],null);
 close(flow.monthlyBillingAverage,Number(flowTotals.billed_value)/flow.months,.01);
 close(flow.monthlyEmissionAverage,Number(flowTotals.emitted_value)/flow.months,.01);
 const cohortMonths=(await client.query(`WITH emitted AS (
  SELECT codigo_docfat AS id,min(data_emissao_pedido_tratada::date) AS emitted FROM dw.pedidos_emitidos
  WHERE ${exclusions} AND codigo_docfat IS NOT NULL AND data_emissao_pedido_tratada::date<=$3::date
  GROUP BY codigo_docfat HAVING count(DISTINCT data_emissao_pedido_tratada::date)=1
 ), converted AS (
  SELECT DISTINCT codigo_docfat AS id,data_emissao_pedido_tratada::date AS emitted FROM dw.pedidos_faturados
  WHERE data_faturamento_tratada::date BETWEEN $1::date AND $2::date
  AND data_faturamento_tratada::date>=data_emissao_pedido_tratada::date
  AND date_trunc('month',data_faturamento_tratada)=date_trunc('month',data_emissao_pedido_tratada)
  AND (valor_faturado_tratado>0 OR peso_faturado_tratado>0 OR volume_m3_faturado_tratado>0 OR quantidade_faturada_tratada>0)
 ) SELECT date_trunc('month',e.emitted)::date::text AS period,count(*)::integer AS orders,count(c.id)::integer AS converted
 FROM emitted e LEFT JOIN converted c ON c.id=e.id AND c.emitted=e.emitted
 WHERE e.emitted BETWEEN $1::date AND $2::date GROUP BY 1`,[flow.conversionStart,flow.conversionThrough,data.referenceDate])).rows;
 for(const row of cohortMonths){const month=data.financial.monthlyTable.rows.find(item=>item.period===row.period);assert.ok(month);close(month.conversion,row.converted/row.orders*100);}
 const summary=data.financial.cardSummary.rows[0];
 for(const [key,id] of [['tonnes','monthlyTonnage'],['volume','monthlyVolume'],['quantity','monthlyQuantity'],['orders','monthlyOrders'],['groups','monthlyGroups'],['service','serviceDays'],['otif','otif'],['ticket','ticket'],['revenueKg','revenueKg'],['conversion','sameMonthConversion'],['outflow','outflow']])assert.equal(summary[key],metrics['strategic.'+id]);
 assert.equal(data.portfolio.table.total.value,metrics['strategic.portfolioValue']);assert.equal(data.portfolio.table.total.backlog,metrics['strategic.backlogReal']);
 for(const row of monthly){const month=data.financial.monthlyTable.rows.find(item=>item.period===row.period);if(Number(row.weight)>0)close(month.revenueKg,Number(row.value)/Number(row.weight),.0001);}
 // Materialize the DW views before cohort joins: their dimension joins can
 // otherwise be repeated for each order when the planner underestimates dates.
 await client.query("SET LOCAL statement_timeout='60s'");
 const integral=(await client.query(`WITH emission_source AS MATERIALIZED (
  SELECT codigo_docfat,data_emissao_pedido_tratada,codigo_item,cor_descricao,quantidade_emitida_tratada
  FROM dw.pedidos_emitidos WHERE ${exclusions}
 ), billing_source AS MATERIALIZED (
  SELECT codigo_docfat,data_emissao_pedido_tratada,data_faturamento_tratada,codigo_item,cor_descricao,quantidade_faturada_tratada
  FROM dw.pedidos_faturados WHERE ${exclusions}
 ), orders AS (
  SELECT codigo_docfat AS id,min(data_emissao_pedido_tratada::date) AS emitted
  FROM emission_source
  GROUP BY codigo_docfat HAVING count(DISTINCT data_emissao_pedido_tratada::date)=1
 ), items AS (
  SELECT e.codigo_docfat AS id,o.emitted,e.codigo_item,btrim(COALESCE(e.cor_descricao,'')) AS color,
   sum(e.quantidade_emitida_tratada) AS quantity
  FROM emission_source e
  JOIN orders o ON o.id=e.codigo_docfat AND o.emitted=e.data_emissao_pedido_tratada::date
  WHERE o.emitted BETWEEN $1::date AND $2::date
  GROUP BY e.codigo_docfat,o.emitted,e.codigo_item,btrim(COALESCE(e.cor_descricao,''))
 ), billed AS (
  SELECT codigo_docfat AS id,data_emissao_pedido_tratada::date AS emitted,codigo_item,btrim(COALESCE(cor_descricao,'')) AS color,
   sum(quantidade_faturada_tratada) AS quantity
  FROM billing_source WHERE data_faturamento_tratada::date BETWEEN $1::date AND $2::date
   AND data_faturamento_tratada::date>=data_emissao_pedido_tratada::date
   AND date_trunc('month',data_faturamento_tratada)=date_trunc('month',data_emissao_pedido_tratada)
  GROUP BY codigo_docfat,data_emissao_pedido_tratada::date,codigo_item,btrim(COALESCE(cor_descricao,''))
 ), reconciled AS (
  SELECT i.id,bool_and(i.quantity>0 AND COALESCE(b.quantity,0)+0.000001>=i.quantity) AS complete
  FROM items i LEFT JOIN billed b ON b.id=i.id AND b.emitted=i.emitted AND b.codigo_item=i.codigo_item AND b.color=i.color GROUP BY i.id
 ) SELECT count(*)::integer AS orders,count(*) FILTER(WHERE complete)::integer AS integral FROM reconciled`,[flow.conversionStart,flow.conversionThrough])).rows[0];
 assert.equal(integral.orders,flow.conversionOrders);assert.equal(integral.integral,flow.fullyConvertedOrders);
 assert.equal(flow.fullConversionUnknownOrders,0);
 if(integral.orders)close(flow.fullSameMonthConversion,integral.integral/integral.orders*100);
 else assert.equal(flow.fullSameMonthConversion,null);
 const conversion=data.metrics.find(metric=>metric.id==='strategic.sameMonthConversion');
 assert.equal(conversion.value,flow.sameMonthConversion);assert.equal(conversion.label,'Conversão');
 assert.equal(conversion.supplementary,undefined);
 const outflowMonths=(await client.query(`WITH emitted AS (
 SELECT codigo_docfat AS id,min(data_emissao_pedido_tratada::date) AS emitted,sum(valor_emitido_tratado) AS value FROM dw.pedidos_emitidos WHERE ${exclusions} AND codigo_docfat IS NOT NULL AND data_emissao_pedido_tratada::date<=$3::date GROUP BY codigo_docfat HAVING count(DISTINCT data_emissao_pedido_tratada::date)=1
 ), monthly_emission AS (SELECT date_trunc('month',emitted)::date::text AS period,sum(value) AS value FROM emitted WHERE emitted BETWEEN $1::date AND $2::date GROUP BY 1), monthly_billing AS (SELECT date_trunc('month',data_faturamento_tratada)::date::text AS period,sum(valor_faturado_tratado) AS value FROM dw.pedidos_faturados WHERE ${exclusions} AND data_faturamento_tratada::date BETWEEN $1::date AND $2::date GROUP BY 1)
 SELECT COALESCE(e.period,b.period) AS period,COALESCE(e.value,0) AS emitted,COALESCE(b.value,0) AS billed FROM monthly_emission e FULL JOIN monthly_billing b ON b.period=e.period`,[flow.start,flow.end,data.referenceDate])).rows;
 for(const row of outflowMonths){const point=data.series.find(series=>series.id==='strategic.outflow').rows.find(item=>item.period===row.period);assert.ok(point);close(point.emittedValue,Number(row.emitted),.02);close(point.billedValue,Number(row.billed),.02);if(Number(row.emitted)>0)close(point.value,Number(row.billed)/Number(row.emitted)*100);else assert.equal(point.value,null);}
 await client.query('COMMIT');
 const report={status:'passed',checkedAt:new Date().toISOString(),cardsChecked:13,operationalCardsChecked:4,monthlyBuckets:monthly.length,records:history.records,flow,payloadBytes:Buffer.byteLength(JSON.stringify(data)),publications};
 await fs.writeFile(new URL('../.local/strategic-real-verification.json',import.meta.url),JSON.stringify(report,null,2));
 console.log(JSON.stringify(report,null,2));
}catch(error){await client.query('ROLLBACK');throw error;}
finally{client.release();await pool.end();}
