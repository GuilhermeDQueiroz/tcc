import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync, existsSync} from 'node:fs';

test('DW mantém nomes copiados e inclui tratamentos usados pelas métricas do legacy', () => {
  assert.ok(existsSync('etl/contrato-colunas-dw.json'), 'Contrato de nomes do DW ausente');
  const contract = JSON.parse(readFileSync('etl/contrato-colunas-dw.json', 'utf8'));
  assert.equal(contract.areas.emitidos.columns.find(c => c.legacy === 'VALOR_EMITIDO').name, 'vlrbrutoliquido_docitemdet');
  assert.equal(contract.areas.faturados.columns.find(c => c.legacy === 'DT_FATURA').name, 'dtemissao_docfat');
  assert.equal(contract.areas.faturados.columns.find(c => c.legacy === 'ENTREGA').name, 'codigo_docfat_entrega');
  for (const area of ['abertos', 'emitidos', 'faturados']) {
    const query = readFileSync(`etl/sql/transformacoes/${area}.sql`, 'utf8');
    for (const column of contract.areas[area].columns.filter(c => c.kind === 'numeric-treatment')) {
      assert.match(query, new RegExp(`AS "${column.name}"`));
    }
    assert.match(query, /::real/);
    assert.match(query, /::text::double precision/);
    assert.doesNotMatch(query, /AS "[a-z_]+_clean"/);
  }
  const workflow = readFileSync('etl/workflows/reprocessar_dw.hwf', 'utf8');
  assert.doesNotMatch(workflow, /wf_extracao|005_preparacao/);
  assert.match(workflow, /010_preparacao_dw/);
  assert.doesNotMatch(readFileSync('etl/sql/010_preparacao_dw.sql', 'utf8'), /TRUNCATE staging\./);
});

test('modelo indexa referências dimensionais para substituir a carga publicada', () => {
  const ddl=readFileSync('etl/sql/002_modelo_analitico.sql','utf8');
  for(const area of ['abertos','emitidos','faturados'])
    for(const dim of ['cliente','comercial','geografia','produto'])
      assert.ok(ddl.includes(`idx_${area}_${dim} ON dw.fato_${area}(${dim}_id)`), `Índice da referência ${area}/${dim} ausente`);
});
