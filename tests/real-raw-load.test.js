import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
test('carga real publicada usa staging bruto e banco físico do projeto', () => {
  const report=JSON.parse(readFileSync('.local/real-load.json','utf8'));
  assert.equal(report.postgresPort,5434);
  assert.equal(report.architecture,'firebird/raw-staging/transformed-dw/dashboard');
  assert.equal(report.synthetic,false);
  assert.equal(report.stagingContainsOnlyRawTables,true);
  assert.equal(Object.keys(report.rawTables).length,32);
  assert.ok(report.rawTables.stg_metas_vendas.rows>0);
  assert.ok(report.rawTables.stg_pessoa_consultorvendas.rows>0);
  assert.equal(report.validatedRawTimestampColumns.length,4);
  for (const table of Object.values(report.tables))assert.ok(table.rows>0);
});
