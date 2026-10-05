import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {spawnSync} from 'node:child_process';

test('amostragem compara as cinco consultas reais sem afirmar equivalência integral',()=>{
  const report=JSON.parse(readFileSync('.local/extractor-sample.json','utf8'));
  assert.equal(report.mode,'sample');
  assert.equal(report.synthetic,false);
  assert.equal(report.sameSourceSnapshot,false);
  assert.equal(report.fullEquivalenceProven,false);
  assert.equal(report.postgresPort,5434);
  assert.equal(report.period.start,'2026-08-01');
  assert.equal(report.period.endExclusive,'2026-09-01');
  for(const area of ['abertos','emitidos','faturados','carteira','metas']){
    assert.ok(report.areas[area].selectedKeys>0);
    assert.ok(report.areas[area].firebirdRows>0);
    assert.ok(report.areas[area].dwRows>0);
    assert.equal(report.areas[area].comparisonPreservesDuplicates,true);
    assert.ok(Array.isArray(report.areas[area].missingExtractorColumns));
  }
});

test('comparador distingue volume cru preservado do volume tratado do extrator',()=>{
  const code=`
import sys
sys.path.insert(0,'etl/scripts')
import pandas as pd
from compare_sample import original_contract,processed_with_original,original_csv_values,summary
raw=pd.read_pickle('.local/sample-2026-08/dw-faturados.pkl')
_,contracts,code,_=original_contract()
sample=raw.iloc[:20].copy()
actual,_=original_csv_values(processed_with_original(sample,contracts['faturados'],code),code)
actual['VOLUME_M3_FATURADO']=sample['VOLUME_M3_FATURADO'].to_numpy()
result=summary(sample,actual,contracts['faturados'],code)
assert result['extractorCsvOutputVsActualDW']['equal'], result['extractorCsvOutputVsActualDW']
assert result.get('preservedRawVolumes') is not None, 'Conferencia separada do volume cru ausente'
assert result['preservedRawVolumes']['equal']
missing=summary(sample,actual.drop(columns=['VOLUME_M3_FATURADO']),contracts['faturados'],code)
assert not missing['preservedRawVolumes']['equal']
`;
  const result=spawnSync('../legacy/.venv/Scripts/python.exe',['-c',code],{encoding:'utf8',timeout:120000});
  assert.equal(result.status,0,result.stderr || result.stdout);
});

test('comparador preserva duplicidades e reconhece espaços nos rótulos reais',()=>{
  const code=`
import sys
sys.path.insert(0,'etl/scripts')
import pandas as pd
from compare_sample import compare,right_trim_diagnostic
raw=pd.read_pickle('.local/sample-2026-08/firebird-abertos.pkl')
sample=raw.iloc[:20]
assert compare(sample,sample.iloc[::-1])['equal']
extra=pd.concat([sample,sample.iloc[:1]],ignore_index=True)
result=compare(sample,extra)
assert result['referenceOnlyRows']==0 and result['dwOnlyRows']==1
assert any(raw['TIPO_ENTREGA'].str.endswith(' '))
trimmed=right_trim_diagnostic(raw)
assert not any(trimmed['TIPO_ENTREGA'].str.endswith(' '))
assert len(trimmed)==len(raw)
`;
  const result=spawnSync('../legacy/.venv/Scripts/python.exe',['-c',code],{encoding:'utf8',timeout:120000});
  assert.equal(result.status,0,result.stderr || result.stdout);
});
