import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';

test('Hop extrai as cinco bases reais e publica atomicamente em destino separado', () => {
  assert.ok(existsSync('etl/workflows/main.hwf'), 'Workflow Hop ainda não implementado');
  const result = spawnSync('../legacy/.venv/Scripts/python.exe', ['etl/scripts/validate_raw_etl.py'], { encoding: 'utf8' });
  assert.equal(result.status, 0, result.stderr || result.stdout);
  const publish = readFileSync('etl/sql/003_publicacao.sql', 'utf8');
  assert.match(publish, /BEGIN;/);
  assert.match(publish, /COMMIT;/);
  assert.match(publish, /pg_advisory_xact_lock/);
});
