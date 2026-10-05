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
 const {history,backlog,publications}=data.meta;
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
 const balance=(await client.query(`SELECT sum(quantidade_alocada*valor_unitario) AS allocated,sum(quantidade_aberta*peso_unitario) AS weight,sum(quantidade_aberta*valor_unitario) AS value,count(DISTINCT pedido_id) FILTER(WHERE emissao::date < $1::date-30)::integer AS aged FROM logistica.item_pedido WHERE execucao_id=$2`,[data.referenceDate,publications.logistics.version])).rows[0];
 close(Number(balance.allocated),metrics['strategic.valueLoad'],.01);close(Number(balance.weight),metrics['strategic.weightKg'],.01);
 assert.equal(balance.aged,metrics['strategic.orders30']);close(Number(balance.value)/Number(rate.daily),metrics['strategic.backlogReal']);
 const loads=(await client.query('SELECT count(DISTINCT carga_id)::integer AS loads FROM logistica.alocacao WHERE execucao_id=$1 AND quantidade_aberta>0',[publications.logistics.version])).rows[0];
 assert.equal(loads.loads,metrics['strategic.loads']);
 const priority=(await client.query(`WITH orders AS (
  SELECT pedido_id,sum(quantidade_sem_carga) AS free_quantity,min(previsao_faturamento) AS forecast
  FROM logistica.item_pedido WHERE execucao_id=$2 GROUP BY pedido_id
 ) SELECT count(*) FILTER(WHERE free_quantity>=0.000001)::integer AS free_orders,
 count(*) FILTER(WHERE forecast<$1::date)::integer AS overdue_orders,
 count(*) FILTER(WHERE forecast IS NULL)::integer AS undated_orders FROM orders`,[data.referenceDate,publications.logistics.version])).rows[0];
 assert.equal(priority.free_orders,priorities['priority.freeOrders']);
 assert.equal(priority.overdue_orders,priorities['priority.overdueOrders']);
 assert.equal(priority.undated_orders,priorities['priority.undatedOrders']);
 const freeValue=(await client.query(`SELECT sum(quantidade_sem_carga*valor_unitario) AS value,
 count(*) FILTER(WHERE quantidade_sem_carga<>0 AND valor_unitario IS NULL)::integer AS missing
 FROM logistica.item_pedido WHERE execucao_id=$1`,[publications.logistics.version])).rows[0];
 if(freeValue.missing)assert.equal(priorities['priority.valueFree'],null);
 else close(Number(freeValue.value),priorities['priority.valueFree'],.01);
 await client.query('COMMIT');
 const report={status:'passed',checkedAt:new Date().toISOString(),cardsChecked:7,operationalCardsChecked:4,monthlyBuckets:monthly.length,records:history.records,payloadBytes:Buffer.byteLength(JSON.stringify(data)),publications};
 await fs.writeFile(new URL('../.local/strategic-real-verification.json',import.meta.url),JSON.stringify(report,null,2));
 console.log(JSON.stringify(report,null,2));
}catch(error){await client.query('ROLLBACK');throw error;}
finally{client.release();await pool.end();}
