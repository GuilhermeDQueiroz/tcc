import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {filterRows} from '../api-server/domain/filters.js';
import {toggleCrossFilter} from '../shared/cross-filter.js';
const {rows}=JSON.parse(fs.readFileSync(new URL('../.local/core-reference.json',import.meta.url),'utf8'));

test('order drilldown accepts browser string selections for real numeric order codes',()=>{
  const code=rows[0].CODIGO_PEDIDO;
  const expected=rows.filter(row=>row.CODIGO_PEDIDO===code);
  assert.ok(expected.length>0);
  assert.deepEqual(filterRows(rows,{dimensions:{CODIGO_PEDIDO:[String(code)]}}),expected);
  assert.equal(filterRows(rows,{dimensions:{CODIGO_PEDIDO:['null','undefined']}}).length,0);
});
test('all numeric comparators and inclusive dates on real orders',()=>{
  const threshold=rows[0].VALOR_EM_ABERTO_CLEAN;
  const ops={'>':(a,b)=>a>b,'>=':(a,b)=>a>=b,'<':(a,b)=>a<b,'<=':(a,b)=>a<=b,'==':(a,b)=>a===b,'!=':(a,b)=>a!==b};
  for(const [operator,compare] of Object.entries(ops))assert.equal(filterRows(rows,{value:{operator,value:threshold}}).length,rows.filter(r=>compare(r.VALOR_EM_ABERTO_CLEAN,threshold)).length);
  const group=rows[0].GRUPO_CLIENTE;
  assert.equal(filterRows(rows,{includeGroups:[group]}).length,rows.filter(r=>r.GRUPO_CLIENTE===group).length);
  assert.equal(filterRows(rows,{excludeGroups:[group]}).length,rows.filter(r=>r.GRUPO_CLIENTE!==group).length);
  assert.equal(filterRows(rows,{emissionRange:['2026-08-01','2026-08-31']}).length,rows.length);
  assert.equal(filterRows(rows,{emissionRange:['2026-09-01','2026-09-30']}).length,0);
});

test('cross-filter click toggles its dimension and preserves unrelated filters',()=>{
 const original={dimensions:{UF:['MG'],STATUS:['Aberto']},search:'Cliente',billingRange:['2026-01-01','2026-12-31']};
 const changed=toggleCrossFilter(original,'UF','SP');
 assert.deepEqual(changed,{...original,dimensions:{UF:['SP'],STATUS:['Aberto']}});
 assert.deepEqual(original.dimensions.UF,['MG']);
 assert.deepEqual(toggleCrossFilter(changed,'UF','SP'),{search:original.search,billingRange:original.billingRange,dimensions:{STATUS:['Aberto']}});
 assert.deepEqual(toggleCrossFilter({dimensions:{UF:['SP']}},'UF','SP'),{});
});

test('grouped cross-filter values toggle as a set regardless of order',()=>{
 const filters={dimensions:{UF:['SP','MG']},search:'pedido'};
 assert.deepEqual(toggleCrossFilter(filters,'UF',['MG','SP','SP']),{search:'pedido'});
 assert.deepEqual(toggleCrossFilter(filters,'UF',['RJ','MG']),{dimensions:{UF:['RJ','MG']},search:'pedido'});
 assert.equal(toggleCrossFilter(filters,'UF',[]),filters);
 assert.equal(toggleCrossFilter(filters,'',null),filters);
});
