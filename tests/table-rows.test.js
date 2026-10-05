import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {sortTableRows} from '../src/domain/analytics/tableRows.ts';

test('shared collator preserves numeric and Portuguese sorting on real published orders',()=>{
 const rows=JSON.parse(fs.readFileSync('.local/normalized-abertos.json','utf8')).slice(0,2000);
 const original=rows.slice();
 for(const key of ['CONSULTOR','CODIGO_PEDIDO','VALOR_EM_ABERTO_CLEAN'])for(const direction of ['asc','desc']){
  const expected=[...rows].sort((a,b)=>{
   const first=a[key],second=b[key];
   const result=typeof first==='number'&&typeof second==='number'?first-second:String(first??'').localeCompare(String(second??''),'pt-BR',{numeric:true});
   return direction==='asc'?result:-result;
  });
  assert.deepEqual(sortTableRows(rows,key,direction),expected);
 }
 assert.deepEqual(rows,original);assert.equal(sortTableRows(rows,'','asc'),rows);
});
