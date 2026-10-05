import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {buildOpenDashboard} from '../api-server/domain/open.js';
import {buildDimensionDashboard} from '../api-server/domain/dimensions.js';
const real=JSON.parse(fs.readFileSync(new URL('../.local/core-reference.json',import.meta.url),'utf8'));
test('open cards and dimension totalizers use real original grain',()=>{
  const payload=buildOpenDashboard({rows:real.rows,referenceDate:'2026-10-01',dailyAverage:0,tab:'resumo'});
  assert.equal(payload.metrics.find(m=>m.id==='abertos.resumo.value').value,real.expected.VALOR_EM_ABERTO_CLEAN.sum);
  assert.equal(payload.metrics.find(m=>m.id==='abertos.resumo.weightKg').value,real.expected.PESO_EM_ABERTO_CLEAN.sum);
  assert.equal(payload.metrics.find(m=>m.id==='abertos.resumo.backlogReal').value,0);
  assert.ok(payload.series.find(s=>s.id==='abertos.resumo.aging'));
  const dimension=buildDimensionDashboard({rows:real.rows,area:'abertos',dimension:'STATUS',referenceDate:'2026-10-01'});
  assert.equal(dimension.tables[0].total.Qtd_Pedidos,new Set(real.rows.map(r=>r.CODIGO_PEDIDO)).size);
  for(const row of dimension.tables[0].rows){
    const e=real.expected.PESO_EM_ABERTO_CLEAN.byStatus.find(g=>g.STATUS===row.STATUS);
    assert.equal(row.Peso,e.sum);
  }
});
