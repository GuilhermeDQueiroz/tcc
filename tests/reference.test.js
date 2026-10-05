import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';

test('a referência exige carga real pelo Apache Hop e catálogo rastreável', () => {
  assert.ok(existsSync('docs/catalogo-equivalencia.md'), 'Catálogo ainda não criado');
  assert.ok(existsSync('.local/real-load.json'), 'Carga real Hop ainda não validada');
  const result = JSON.parse(readFileSync('.local/real-load.json', 'utf8'));
  assert.equal(result.source, 'firebird/apache-hop');
  assert.equal(result.synthetic, false);
  for (const area of ['abertos', 'emitidos', 'faturados', 'carteira', 'metas']) {
    assert.ok(result.tables[area]?.rows > 0, `Carga real ausente: ${area}`);
  }
});
