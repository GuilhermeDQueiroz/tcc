// Read-only SQL verification independent of the JavaScript cohort calculator.
import 'dotenv/config';
import pg from 'pg';
import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
const contract=JSON.parse(await fs.readFile(new URL('../etl/contrato-colunas-dw.json',import.meta.url),'utf8'));
const column=(area,key)=>'"'+contract.areas[area].columns.find(column=>column.legacy===key).name+'"';
const exclusions=area=>['CONSULTOR','SUPERVISOR','GRUPO_CLIENTE'].map(key=>`COALESCE(${column(area,key)}::text,'') NOT ILIKE '%tekdashboard%'`).join(' AND ');
const value=area=>`COALESCE(${column(area,area==='emitidos'?'VALOR_EMITIDO_CLEAN':'VALOR_FATURADO_CLEAN')},0)::double precision`;
const weight=area=>`COALESCE(${column(area,area==='emitidos'?'PESO_EMITIDO_CLEAN':'PESO_FATURADO_CLEAN')},0)::real::double precision`;
const volume=area=>{const col=`COALESCE(${column(area,area==='emitidos'?'VOLUME_M3_EMITIDO_CLEAN':'VOLUME_M3_FATURADO_CLEAN')},0)::real`;return `(CASE WHEN ${col}>1000 THEN (${col}/1000)::real ELSE ${col} END)::double precision`;};
const close=(actual,expected,label)=>{
 if(expected==null){assert.equal(actual,null,label);return;}
 assert.ok(actual!=null&&Math.abs(Number(actual)-Number(expected))<=Math.max(.0001,Math.abs(Number(expected))*1e-10),`${label}: aggregate differs`);
};
assert.ok(process.env.PG_USER&&process.env.PG_PASSWORD,'Configure PG_USER e PG_PASSWORD em memória ou no .env local.');
const pool=new pg.Pool({host:process.env.PG_HOST||'localhost',port:5434,database:'dados',user:process.env.PG_USER,password:process.env.PG_PASSWORD,connectionTimeoutMillis:30000,statement_timeout:60000});
const client=await pool.connect();
try{
 await client.query('BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY');
 const version=(await client.query("SELECT id::text FROM etl.execucao_carga WHERE status='publicado' ORDER BY fim DESC LIMIT 1")).rows[0].id;
 const cuts=[{}, {dimensions:{UF:['SP']}}, {emissionRange:['2026-08-01','2026-08-31'],billingRange:['2026-08-01','2026-08-31']}];
 const reports=[];
 for(const filters of cuts){
  const response=await fetch('http://127.0.0.1:3002/api/v1/logistica/estrategico?filters='+encodeURIComponent(JSON.stringify(filters)));
  assert.ok(response.ok,'API must load the published cohort sources');const data=await response.json();
  assert.equal(data.meta.publications.billing.version,version,'API and SQL must inspect the same publication');
  const {cohorts}=data;let uf='';const params=[cohorts.start,cohorts.end,data.referenceDate];
  if(filters.dimensions?.UF){params.push(filters.dimensions.UF);uf=` AND ${column('emitidos','UF')}=ANY($4)`;}
  const emit=column('emitidos','DATA_EMISSAO_PEDIDO_DATE'),id=column('emitidos','CODIGO_PEDIDO');
  const billedId=column('faturados','CODIGO_PEDIDO'),billedEmission=column('faturados','DATA_EMISSAO_PEDIDO_DATE'),billedDate=column('faturados','DT_FATURA_DATE');
  const query=`WITH emitted AS (
   SELECT ${id} AS id,${emit}::date AS emitted,${value('emitidos')} AS value,${weight('emitidos')} AS weight,${volume('emitidos')} AS volume
   FROM dw.pedidos_emitidos WHERE ${exclusions('emitidos')} AND ${emit}::date<=$3::date${uf}
  ), consistent AS (SELECT id FROM emitted GROUP BY id HAVING count(DISTINCT emitted)=1),
  orders AS (
   SELECT e.id,e.emitted,sum(value) AS value,sum(weight) AS weight,sum(volume) AS volume
   FROM emitted e JOIN consistent c ON e.id=c.id WHERE e.emitted BETWEEN $1::date AND $2::date GROUP BY e.id,e.emitted
  ), invoices AS (
   SELECT ${billedId} AS id,${billedEmission}::date AS emitted,${billedDate}::date AS billed,${value('faturados')} AS value,${weight('faturados')} AS weight,${volume('faturados')} AS volume,
    (${value('faturados')}>0 OR ${weight('faturados')}>0 OR ${volume('faturados')}>0 OR COALESCE(${column('faturados','QUANTIDADE_FATURADA_CLEAN')},0)>0) AS positive
   FROM dw.pedidos_faturados WHERE ${exclusions('faturados')}
  ), per_order AS (
   SELECT o.id,o.emitted,o.value,o.weight,o.volume,w.days,
    COALESCE(sum(i.value),0) AS billed_value,COALESCE(sum(i.weight),0) AS billed_weight,COALESCE(sum(i.volume),0) AS billed_volume,
    COALESCE(bool_or(i.positive),false) AS has_billing
   FROM orders o CROSS JOIN (VALUES(7),(15),(30)) w(days)
   LEFT JOIN invoices i ON i.id=o.id AND i.emitted=o.emitted AND i.billed BETWEEN o.emitted AND least(o.emitted+w.days,$3::date)
   GROUP BY o.id,o.emitted,o.value,o.weight,o.volume,w.days
  ) SELECT to_char(emitted,'YYYY-MM') AS month,days,count(*)::int AS orders,sum(value) AS value,sum(weight) AS weight,sum(volume) AS volume,
   count(*) FILTER(WHERE has_billing)::int AS billed_orders,sum(billed_value) AS billed_value,sum(billed_weight) AS billed_weight,sum(billed_volume) AS billed_volume,
   ((date_trunc('month',emitted)+interval '1 month - 1 day')::date+days)::text AS available_on
   FROM per_order GROUP BY 1,days,available_on ORDER BY 1,days`;
  const expected=(await client.query(query,params)).rows;
  assert.equal(expected.length,cohorts.rows.length*3,'same monthly cohort population');
  for(const oracle of expected){
   const row=cohorts.rows.find(row=>row.month===oracle.month),window=row.windows.find(window=>window.days===oracle.days);
   assert.equal(row.orders,oracle.orders);close(row.value,oracle.value,'emitted value');close(row.weightKg,oracle.weight,'emitted weight');close(row.volumeM3,oracle.volume,'emitted volume');
   assert.equal(window.billedOrders,oracle.billed_orders);close(window.billedValue,oracle.billed_value,'billed value');close(window.billedWeightKg,oracle.billed_weight,'billed weight');close(window.billedVolumeM3,oracle.billed_volume,'billed volume');
   assert.equal(window.availableOn,oracle.available_on);
   assert.equal(window.mature,cohorts.observedThrough!=null&&oracle.available_on<=cohorts.observedThrough);
   for(const [key,numerator,denominator] of [['ordersPercent','billed_orders','orders'],['valuePercent','billed_value','value'],['weightPercent','billed_weight','weight'],['volumePercent','billed_volume','volume']]){
    const ratio=window.mature&&Number(oracle[denominator])>0&&Number(oracle[numerator])>=0?Number(oracle[numerator])/Number(oracle[denominator])*100:null;
    close(window[key],ratio,key);
   }
  }
  reports.push({filters,months:cohorts.rows.length,windows:expected.length,quality:cohorts.quality});
 }
 await client.query('COMMIT');
 const report={status:'passed',checkedAt:new Date().toISOString(),publication:version,cuts:reports};
 await fs.mkdir(new URL('../.local/',import.meta.url),{recursive:true});
 await fs.writeFile(new URL('../.local/cohorts-real-verification.json',import.meta.url),JSON.stringify(report,null,2));
 console.log(JSON.stringify(report,null,2));
}catch(error){await client.query('ROLLBACK');throw error;}
finally{client.release();await pool.end();}
