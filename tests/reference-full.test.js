import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';

test('referência integral publica cálculos originais posteriores aos cards, somente da carga real', () => {
  assert.ok(existsSync('.local/domain-reference.json'), 'Referência integral ainda não publicada');
  const report = JSON.parse(readFileSync('.local/domain-reference.json', 'utf8'));
  assert.equal(report.source, 'firebird/apache-hop');
  assert.equal(report.synthetic, false);
  assert.equal(report.referenceDate, '2026-10-01');
  assert.ok(report.version);
  for (const area of ['emitidos', 'faturados']) {
    for (const tab of ['mensal', 'evolucao', 'carteira', 'semanal', 'geografia']) {
      assert.ok(report.captures[`${area}.${tab}`], `Ausente ${area}.${tab}`);
    }
    assert.ok(report.captures[`${area}.carteira`].clientes_df.length > 0);
    assert.ok(report.captures[`${area}.carteira`].clientes_df.some(row => row.RFM_Score));
    assert.ok(report.captures[`${area}.dimensao.UF`].summary.length > 0);
    assert.ok(report.captures[`${area}.dimensao.UF`].tot_dict);
    for (const choice of ['Oportunidades', 'Qualidade da Carteira', 'Cobertura por UF']) {
      assert.ok(report.captures[`${area}.carteira.${choice}`], `Aba avançada ausente: ${area}.${choice}`);
    }
  }
  assert.equal(report.captures['abertos.calendario.geral'].length, 31);
  assert.equal(report.captures['abertos.calendario.real'].length, 31);
  assert.ok(report.captures['abertos.previsao'] || report.captures['abertos.previsao_status']);
  assert.ok(report.sources.every(source => source.sha256 && source.functions.length));
  assert.ok(report.captures['emitidos.agosto.metas'].return.length > 0);
  assert.ok(report.captures['emitidos.agosto.metas_total'].return);
  assert.deepEqual(report.errors, []);
});

test('recortes normalizados preservam linhas reais, números limpos e datas ISO', () => {
  for (const area of ['abertos', 'emitidos', 'faturados', 'carteira', 'metas']) {
    assert.ok(existsSync(`.local/normalized-${area}.json`), `Recorte real ausente: ${area}`);
    const rows = JSON.parse(readFileSync(`.local/normalized-${area}.json`, 'utf8'));
    assert.ok(rows.length > 0);
    for (const row of rows) for (const [key, value] of Object.entries(row)) {
      if (key.endsWith('_DATE') && value !== null) assert.match(value, /^\d{4}-\d{2}-\d{2}$/);
      if (key.endsWith('_CLEAN') && value !== null) assert.equal(typeof value, 'number');
    }
  }
});
