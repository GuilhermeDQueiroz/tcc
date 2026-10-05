import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {spawnSync} from 'node:child_process';
import {consultantGoalRanking,consultantGoalTotal} from '../api-server/domain/goals.js';
test('metas expõem o ranking original por consultor', async () => {
  const module = await import('../api-server/domain/goals.js').catch(() => ({}));
  assert.equal(typeof module.consultantGoalRanking, 'function');
});
test('ranking real de agosto inclui consultores sem venda e mantém meta mensal integral',()=>{
  const root=fileURLToPath(new URL('../',import.meta.url)),legacy=path.resolve(root,'../legacy');
  const rows=JSON.parse(fs.readFileSync(path.join(root,'.local/normalized-emitidos.json'))),metas=JSON.parse(fs.readFileSync(path.join(root,'.local/normalized-metas.json')));
  const script="import json,sys;sys.path.insert(0,sys.argv[1]);from consultor_metas import build_consultant_goal_ranking;rows=json.load(open(sys.argv[2],encoding='utf8'));metas=json.load(open(sys.argv[3],encoding='utf8'));print(json.dumps(build_consultant_goal_ranking(rows,metas,2026,8,31,31),ensure_ascii=False))";
  const oracle=spawnSync(path.join(legacy,'.venv/Scripts/python.exe'),['-c',script,legacy,path.join(root,'.local/normalized-emitidos.json'),path.join(root,'.local/normalized-metas.json')],{encoding:'utf8',env:{...process.env,PYTHONIOENCODING:'utf-8'}});
  assert.equal(oracle.status,0,oracle.stderr);const expected=JSON.parse(oracle.stdout);
  const actual=consultantGoalRanking(rows,metas,2026,8,31,31);
  assert.deepEqual(actual,expected);
  assert.ok(actual.some(row=>row.VALOR_EMITIDO===0),'consultor sem movimento preservado');
  assert.ok(actual.some(row=>row.META_MENSAL===0&&row.PERCENTUAL_ATINGIDO===null),'ausência de meta não convertida em atingimento zero');
  const total=consultantGoalTotal(actual),sum=key=>expected.reduce((value,row)=>value+row[key],0);
  assert.equal(total.VALOR_EMITIDO,sum('VALOR_EMITIDO'));assert.equal(total.META_MENSAL,sum('META_MENSAL'));
  assert.equal(total.PROJECAO_FECHAMENTO,sum('PROJECAO_FECHAMENTO'));assert.equal(total.VALOR_RESTANTE,Math.max(sum('META_MENSAL')-sum('VALOR_EMITIDO'),0));
});
