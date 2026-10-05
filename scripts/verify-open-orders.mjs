import fs from 'node:fs';
import assert from 'node:assert/strict';
const reference=JSON.parse(fs.readFileSync('.local/open-orders-reference.json','utf8'));
const base=process.env.APP_URL || 'http://127.0.0.1:3002';
const params={grain:'order',referenceDate:'2026-10-01',pageSize:'100000',sort:'VALOR_EM_ABERTO_CLEAN',direction:'desc'};
let fields=0;
async function get(extra={}){const query=new URLSearchParams({...params,...extra}),response=await fetch(base+'/api/v1/bi/abertos/detalhes?'+query);assert.equal(response.status,200);return response.json();}
function compare(actual,expected){
 assert.equal(actual.dataVersion,reference.version);assert.equal(actual.total,expected.rows.length);assert.deepEqual(actual.totalRow,expected.total);
 const lookup=new Map(actual.rows.map(row=>[row.CODIGO_PEDIDO,row]));
 for(const row of expected.rows){assert.deepEqual(lookup.get(row.CODIGO_PEDIDO),row);fields+=Object.keys(row).length;}
}
const all=await get();compare(all,reference.all);
for(const filter of reference.filters)compare(await get({detailFilters:JSON.stringify({dimensions:{[filter.key]:[String(filter.value)]}})}),filter.expected);
const query=new URLSearchParams({...params,export:'csv'}),response=await fetch(base+'/api/v1/bi/abertos/detalhes?'+query);assert.equal(response.status,200);
const csv=await response.text();assert.equal(csv.split('\r\n').length,reference.all.rows.length+1);assert.ok(csv.includes('"Pedido";"Cód. Cliente"'));
assert.equal((await fetch(base+'/api/v1/bi/abertos/detalhes?grain=invalid')).status,400);
assert.equal((await fetch(base+'/api/v1/bi/abertos/detalhes?grain=order&detailFilters='+encodeURIComponent(JSON.stringify({dimensions:{UF:['SP']}})))).status,400);
const result={complete:true,verifiedAt:new Date().toISOString(),dataVersion:reference.version,orders:all.total,localFilterSelections:reference.filters.length,comparedFields:fields,csvRows:reference.all.rows.length,readOnly:true};
fs.writeFileSync('.local/open-orders-http-verification.json',JSON.stringify(result,null,2));console.log(JSON.stringify(result));
