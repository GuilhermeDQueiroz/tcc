import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';

test('ETL usa a organização do Portal e pode ser aberto como projeto Hop', () => {
  for (const path of [
    'metadata/rdbms/DADOS.json', 'metadata/rdbms/DW.json',
    'pipelines/extracao/dimensoes/ext_pessoa.hpl',
    'pipelines/extracao/fatos/ext_documento_fatura.hpl',
    'pipelines/extracao/fatos/ext_documento_item.hpl',
    'pipelines/extracao/fatos/ext_documento_entrega.hpl',
    'pipelines/extracao/fatos/ext_metas_vendas.hpl',
    'pipelines/transformacao-carregamento/load_modelo_analitico.hpl',
    'workflows/main.hwf', 'workflows/wf_extracao_dimensoes.hwf',
    'workflows/wf_extracao_fatos.hwf', 'workflows/wf_load.hwf',
    'scripts/run_hop.py', 'scripts/abrir_hop.py',
  ]) assert.ok(existsSync(`etl/${path}`), path);
  const main = readFileSync('etl/workflows/main.hwf', 'utf8');
  for (const name of ['wf_extracao_dimensoes','wf_extracao_fatos','wf_load'])
    assert.ok(main.includes(`/workflows/${name}.hwf`), name);
  assert.ok(!existsSync('etl/pipelines/extrair_abertos.hpl'));
});

test('configuração aponta para a instância física do projeto', () => {
  assert.match(readFileSync('.env.example','utf8'), /^PG_PORT=5434$/m);
  for (const name of ['iniciar.ps1','parar.ps1','status.ps1'])
    assert.ok(existsSync(`banco/scripts/${name}`), name);
  assert.match(readFileSync('.gitignore','utf8'), /banco\/data\//);
});
