import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {forecastCalendar,filterForecastBacklog,backlogSummary} from '../api-server/domain/forecast.js';
const real=JSON.parse(fs.readFileSync(new URL('../.local/core-reference.json',import.meta.url),'utf8'));
test('forecast calendar and backlog status preserve real original calculations',()=>{
  for(const type of ['real','geral']){
    const actual=forecastCalendar(real.rows,2026,9,type);
    assert.equal(actual.length,30);
    actual.forEach((row,i)=>assert.equal(row.value,real.calendar[type][i].value));
  }
  assert.equal(filterForecastBacklog(real.rows,'real').length,real.realRows);
  const summary=backlogSummary(real.rows,real.expected.VALOR_EM_ABERTO_CLEAN.mean);
  assert.equal(summary.realValue,real.realValue);
  assert.equal(summary.realDays,real.realValue/real.expected.VALOR_EM_ABERTO_CLEAN.mean);
  assert.equal(backlogSummary(real.rows,0).realDays,0);
});
