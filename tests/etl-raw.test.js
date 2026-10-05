import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
test('staging contém espelhos brutos e joins são executados somente no PostgreSQL', () => {
  const result=spawnSync('../legacy/.venv/Scripts/python.exe',['etl/scripts/validate_raw_etl.py'],{encoding:'utf8'});
  assert.equal(result.status,0,result.stderr || result.stdout);
});
