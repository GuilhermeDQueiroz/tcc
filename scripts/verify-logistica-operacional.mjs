import assert from 'node:assert/strict';
import fs from 'node:fs';
const audit=JSON.parse(fs.readFileSync('.local/logistica-medidas-origem.json','utf8')).measures;
const get=async(query='')=>{const response=await fetch('http://127.0.0.1:3002/api/v1/logistica/formacao'+query);assert.equal(response.status,200);return response.json()};
const sum=(rows,key)=>rows.reduce((sum,row)=>sum+row[key],0);
const data=await get();
for(const [key,field] of Object.entries({peso_aberto:'WEIGHT_OPEN',peso_em_carga:'WEIGHT_LOAD',peso_sem_carga:'WEIGHT_FREE',cubagem_aberto:'CUBE_OPEN',cubagem_em_carga:'CUBE_LOAD',cubagem_sem_carga:'CUBE_FREE',valor_em_carga:'VALUE_LOAD',valor_sem_carga:'VALUE_FREE'})){
 const measured=data.meta.measures[key];assert.equal(measured.missing,0);assert.ok(Math.abs(measured.value-Number(audit[field]))<0.000001,key);
 if(key.endsWith('_em_carga'))assert.ok(Math.abs(sum(data.tables[1].rows,key)-measured.value)<0.000001,key+' load reconciliation');
}
assert.equal(data.metrics.length,12);
assert.equal(data.series[1].rows.length,7);
assert.ok(Math.abs(data.meta.forecast.withoutDateQuantity+data.meta.forecast.overdueQuantity+data.meta.forecast.scheduledQuantity-data.meta.openQuantity)<0.000001);
const forecast=JSON.parse(fs.readFileSync('.local/logistica-previsao-referencia.json','utf8'));assert.equal(forecast.runId,data.dataVersion);
for(const [key,value] of Object.entries(forecast.forecast))assert.ok(Math.abs(data.meta.forecast[key]-Number(value))<0.000001,key);
assert.equal(data.series[0].rows.length,forecast.monthly.length);
for(const row of forecast.monthly){const actual=data.series[0].rows.find(value=>value.month===row.month);assert.ok(actual);for(const key of ['em_carga','sem_carga'])assert.ok(Math.abs(actual[key]-Number(row[key]))<0.000001,'month '+row.month+key);}
for(const actual of data.series[1].rows){const expected=forecast.daily.find(row=>row.date===actual.date);for(const key of ['em_carga','sem_carga'])assert.ok(Math.abs(actual[key]-Number(expected?.[key]??0))<0.000001,'day '+actual.date+key);}
assert.equal(sum(data.operationalTables[0].rows,'pedidos'),data.metrics[0].value);
if(data.meta.missingGeographyOrders===0)assert.ok(Math.abs(sum(data.series[2].rows,'volumeM3')-Number(audit.CUBE_FREE))<0.000001,'map cubage reconciliation');
for(const status of ['none','partial','full']){
 const selected=await get('?status='+status);for(const kind of ['cubagem','peso','valor'])assert.ok(Math.abs(selected.meta.measures[kind+'_aberto'].value-selected.meta.measures[kind+'_em_carga'].value-selected.meta.measures[kind+'_sem_carga'].value)<0.000001);
}
const uf=data.options.ufs.find(value=>/^[A-Z]{2}$/.test(value));
const geography=await get('?uf='+uf);assert.ok(geography.tables[0].rows.every(row=>row.uf===uf));
const city=data.tables[0].rows.find(row=>row.uf===uf)?.cidade;
const local=await get('?uf='+uf+'&city='+encodeURIComponent(city));assert.ok(local.tables[0].rows.every(row=>row.uf===uf&&row.cidade===city));
const aged=await get('?ageMin=31');assert.ok(aged.tables[0].rows.every(row=>row.idade>=31));
const dated=await get('?forecastStart=2026-09-30&forecastEnd=2026-10-06');assert.ok(dated.tables[0].rows.every(row=>row.previsao>='2026-09-30'&&row.previsao<='2026-10-06'));
const empty=await get('?company=999999');assert.equal(empty.meta.measures.cubagem_sem_carga.value,0);assert.equal(empty.tables[1].rows.length,0);
for(const query of ['emissionStart=2026-10-01&emissionEnd=2026-01-01','ageMin=-1','uf=MG&uf=SP','forecastStart=invalid'])assert.equal((await fetch('http://127.0.0.1:3002/api/v1/logistica/formacao?'+query)).status,400);
const report={passed:true,runId:data.dataVersion,metrics:12,forecasts:data.meta.forecast,measures:data.meta.measures,filters:['uf','city','age','forecast-date','allocation','empty'],source:'independent-real-firebird-aggregates'};
fs.writeFileSync('.local/logistica-operacional-verificacao.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report));
