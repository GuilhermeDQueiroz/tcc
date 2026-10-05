import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';

test('contrato recusa filtros ambíguos e impede fallback para simulação', async () => {
  assert.ok(existsSync('api-server/domain/contracts.js'), 'Contrato ainda não implementado');
  const { validateFilters, validateAreaTab } = await import('../api-server/domain/contracts.js');
  assert.throws(()=>validateAreaTab('outra','mensal'), /área/i);
  assert.throws(()=>validateAreaTab('abertos','mensal'), /análise/i);
  assert.throws(()=>validateFilters({ dimensions:{ COLUNA_DESCONHECIDA:['qualquer'] } }), /dimensão/i);
  assert.throws(()=>validateFilters({ billingRange:['2026-10-02','2026-10-01'] }), /intervalo/i);
  assert.throws(()=>validateFilters({ emissionRange:['2026-02-30','2026-10-01'] }), /data/i);
  assert.throws(()=>validateFilters({ value:{ operator:'=',value:0 } }), /operador/i);
  assert.throws(()=>validateFilters({ quantity:{ operator:'>',value:'texto' } }), /número/i);
  assert.deepEqual(validateFilters({}), {});
  const { readConfig } = await import('../api-server/config.js');
  assert.throws(()=>readConfig({ DATA_SOURCE:'demo' }), /reais/i);
  assert.throws(()=>readConfig({ PG_DATABASE:'DW' }), /dados/i);
  assert.throws(()=>readConfig({ PG_HOST:'localhost',PG_PORT:'5432',PG_USER:'API',PG_PASSWORD:'x' }), /5434/);
});
