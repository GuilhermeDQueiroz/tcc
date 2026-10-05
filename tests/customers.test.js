import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {buildCommercialDashboard} from '../api-server/domain/commercial.js';
import {buildCustomerDashboard} from '../api-server/domain/customers.js';
const read=name=>JSON.parse(fs.readFileSync(new URL(`../.local/${name}.json`,import.meta.url)));
const reference=read('normalized-reference-comercial'),carteira=read('normalized-carteira');
function close(actual,expected,path) {
  if(typeof expected==='number')assert.ok(typeof actual==='number'&&Math.abs(actual-expected)<=Math.max(1e-6,Math.abs(expected)*1e-8),`${path}: ${actual} != ${expected}`);
  else assert.equal(actual,expected,path);
}
test('a carteira expõe status e agrupamento RFM para registros reais', async () => {
  const module = await import('../api-server/domain/customers.js').catch(() => ({}));
  assert.equal(typeof module.customerStatus, 'function');
  assert.equal(typeof module.buildCustomerDashboard, 'function');
});
for(const area of ['emitidos','faturados'])test(`${area}: carteira completa, concentração e RFM coincidem com pandas nos clientes reais`,()=>{
  const rows=read(`normalized-${area}`),original=reference.captures[`${area}.agosto.carteira`];assert.ok(original,'oracle carteira real disponível');
  const payload=buildCommercialDashboard({area,tab:'carteira',rows,carteira,referenceDate:reference.referenceDate}),clients=payload.tables[0].rows;
  assert.deepEqual(payload.meta.status,original.status);
  original.shares.forEach((value,index)=>close(payload.meta.shares[index],value,`share${index}`));
  assert.equal(clients.length,original.clientes_df.length);
  const byGroup=new Map(clients.map(row=>[row.GRUPO_CLIENTE,row]));
  original.clientes_df.forEach((expected,index)=>Object.entries(expected).forEach(([key,value])=>close(byGroup.get(expected.GRUPO_CLIENTE)[key],key==='Ultima_Compra'?value?.slice(0,10):value,`client${index}.${key}`)));
  assert.ok(clients.every((row,index)=>index===0||clients[index-1].Valor>=row.Valor),'ranking por valor decrescente');
  for(const key of ['Valor','Diff_Raw','% Part','Media_Mensal','Ticket Medio','R$/Ton','Peso','Volume_M3','OTIF','NS','Meses_Ativos','Recencia','Pedidos'])close(payload.tables[0].total[key],original.tot_dict_dim[key],`total.${key}`);
});
for(const area of ['emitidos','faturados'])test(`${area}: status e RFM preservam a carteira e todo o histórico real`,()=>{
  const rows=read(`normalized-full-${area}`),original=reference.captures[`${area}.carteira`];assert.ok(original,'oracle histórico completo disponível');
  const payload=buildCustomerDashboard({area,rows,carteira}),clients=payload.tables[0].rows,byGroup=new Map(clients.map(row=>[row.GRUPO_CLIENTE,row]));
  assert.deepEqual(payload.meta.status,original.status);
  original.shares.forEach((value,index)=>close(payload.meta.shares[index],value,`share${index}`));
  assert.equal(clients.length,original.clientes_df.length);
  original.clientes_df.forEach((expected,index)=>Object.entries(expected).forEach(([key,value])=>close(byGroup.get(expected.GRUPO_CLIENTE)[key],key==='Ultima_Compra'?value?.slice(0,10):value,`fullclient${index}.${key}`)));
  const originalOpportunities=read('domain-reference').captures[`${area}.carteira.Oportunidades`];
  assert.deepEqual(payload.series.find(series=>series.id==='inactivity').rows,originalOpportunities.inactivity_dist,'faixas de inatividade ordenadas por quantidade de grupos');
});
for(const area of ['emitidos','faturados'])test(`${area}: oportunidades, segmentos e cobertura UF preservam suas tabelas e totais`,()=>{
  const payload=buildCommercialDashboard({area,tab:'carteira',rows:read(`normalized-${area}`),carteira});
  const tables=new Map(payload.tables.map(table=>[table.id,table]));
  const variants={reactivation:['Oportunidades','priority','tot_dict_prio','GRUPO_CLIENTE'],rfmSummary:['Qualidade da Carteira','rfm_summary','tot_dict_rfm','Segmento'],uf:['Cobertura por UF','uf_summary','tot_dict_uf','UF']};
  for(const [id,[name,rowsKey,totalKey,groupKey]]of Object.entries(variants)) {
    const original=reference.captures[`${area}.agosto.carteira.${name}`];assert.ok(original,`oracle ${name}`);
    const table=tables.get(id),actual=new Map(table.rows.map(row=>[row[groupKey],row]));
    assert.equal(table.rows.length,original[rowsKey].length);
    for(const expected of original[rowsKey])for(const [key,value]of Object.entries(expected))if(!key.endsWith('_Fmt'))close(actual.get(expected[groupKey])[key],key==='Ultima_Compra'?value?.slice(0,10):value,`${id}.${key}`);
    for(const [key,value]of Object.entries(original[totalKey]))if(key!==groupKey&&!key.endsWith('_Fmt'))close(table.total[key],value,`${id}.total.${key}`);
  }
  const inactivity=reference.captures[`${area}.agosto.carteira.Oportunidades`].inactivity_dist;
  assert.deepEqual(payload.series.find(series=>series.id==='inactivity').rows,inactivity);
});
