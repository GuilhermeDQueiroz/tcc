import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {sum,mean,groupSum,groupMean,summarize} from '../api-server/domain/metrics.js';
const {rows,expected}=JSON.parse(fs.readFileSync(new URL('../.local/core-reference.json',import.meta.url),'utf8'));
test('precision and grouping match original pandas on real August records',()=>{
  for(const [field,e] of Object.entries(expected)){
    const float32=!field.startsWith('VALOR_'); const values=rows.map(r=>r[field]);
    assert.equal(sum(values,{float32}),e.sum,field+' sum');
    assert.equal(mean(values,{float32}),e.mean,field+' mean');
    for(const group of e.byStatus){const v=rows.filter(r=>r.STATUS===group.STATUS).map(r=>r[field]);
      assert.equal(groupSum(v,{float32}),group.sum,field+' group sum');
      assert.equal(groupMean(v,{float32}),group.mean,field+' group mean');
    }
  }
  const s=summarize(rows,'abertos');
  assert.equal(s.orders,new Set(rows.map(r=>r.CODIGO_PEDIDO)).size);
  assert.equal(s.value,expected.VALOR_EM_ABERTO_CLEAN.sum);
});
