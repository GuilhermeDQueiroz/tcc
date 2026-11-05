// Independent read-only SQL oracle. Requires the project's PG_USER/PG_PASSWORD
// environment, never reads or prints credentials and never writes to the DW.
import pg from 'pg';
import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
const contract=JSON.parse(await fs.readFile(new URL('../etl/contrato-colunas-dw.json',import.meta.url),'utf8'));
const names=Object.fromEntries(contract.areas.faturados.columns.map(column=>[column.legacy,column.name]));
const column=name=>'"'+names[name].replaceAll('"','""')+'"';
const close=(actual,expected,tolerance=0.00002)=>assert.ok(Math.abs(actual-expected)<tolerance,`${actual} does not match ${expected}`);
const data=await fetch('http://127.0.0.1:3002/api/v1/logistica/estrategico').then(response=>{assert.ok(response.ok);return response.json();});
const metrics=Object.fromEntries(data.metrics.map(metric=>[metric.id,metric.value]));
const priorities=Object.fromEntries(data.operationalMetrics.map(metric=>[metric.id,metric.value]));
const pool=new pg.Pool({host:'127.0.0.1',port:5434,database:'dados',user:process.env.PG_USER,password:process.env.PG_PASSWORD,connectionTimeoutMillis:20000});
const client=await pool.connect();
try{
 await client.query('BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY');
 const exclusions=['CONSULTOR','SUPERVISOR','GRUPO_CLIENTE'].map(name=>`COALESCE(${column(name)}::text,'') NOT ILIKE '%tekdashboard%'`).join(' AND ');
 const aggregate=`count(*)::integer AS records,sum(${column('VALOR_FATURADO_CLEAN')}::double precision) AS value,sum(${column('PESO_FATURADO_CLEAN')}::real::double precision) AS weight,avg(COALESCE(${column('NIVEL_DE_SERVICO_CLEAN')},0)::real::double precision) AS service,avg(COALESCE(${column('ON_TIME_CLEAN')},0)::real::double precision)*100 AS otif,count(${column('DT_PREVISAO_FATURAMENTO_DATE')})::integer AS forecasts`;
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
 const rate=(await client.query(`SELECT count(*)::integer AS records,sum(${column('VALOR_FATURADO_CLEAN')}::double precision)/90 AS daily FROM dw.pedidos_faturados WHERE ${where}`,[backlog.start,backlog.end])).rows[0];
 assert.equal(rate.records,backlog.records);close(Number(rate.daily),backlog.dailyAverage,.01);
 const balance=(await client.query(`SELECT sum(quantidade_alocada*valor_unitario) AS allocated,sum(quantidade_aberta*peso_unitario) AS weight,sum(quantidade_aberta*valor_unitario) AS value,count(DISTINCT pedido_id) FILTER(WHERE emissao::date < $1::date-30)::integer AS aged FROM logistica.item_pedido WHERE execucao_id=$2`,[data.referenceDate,logisticsVersion])).rows[0];
 close(Number(balance.allocated),metrics['strategic.valueLoad'],.01);close(Number(balance.weight),metrics['strategic.weightKg'],.01);
 assert.equal(balance.aged,metrics['strategic.orders30']);close(Number(balance.value)/Number(rate.daily),metrics['strategic.backlogReal']);
 const loads=(await client.query('SELECT count(DISTINCT carga_id)::integer AS loads FROM logistica.alocacao WHERE execucao_id=$1 AND quantidade_aberta>0',[logisticsVersion])).rows[0];
 assert.equal(loads.loads,metrics['strategic.loads']);
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
 assert.equal(conversion.supplementary.find(detail=>detail.label==='Integral no mês').value,flow.fullSameMonthConversion);
 await client.query('COMMIT');
 const report={status:'passed',checkedAt:new Date().toISOString(),cardsChecked:9,operationalCardsChecked:4,monthlyBuckets:monthly.length,records:history.records,flow,payloadBytes:Buffer.byteLength(JSON.stringify(data)),publications};
 await fs.writeFile(new URL('../.local/strategic-real-verification.json',import.meta.url),JSON.stringify(report,null,2));
 console.log(JSON.stringify(report,null,2));
}catch(error){await client.query('ROLLBACK');throw error;}
finally{client.release();await pool.end();}
