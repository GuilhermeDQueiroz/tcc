import test from 'node:test';
import assert from 'node:assert/strict';
const module=await import('../src/domain/logistics/strategic.ts').catch(()=>({}));
const transfer=(...args)=>{
 assert.equal(typeof module.strategicFormationFilters,'function','strategic priorities must open the relevant formation cut');
 return module.strategicFormationFilters(...args);
};

test('priority navigation preserves destinations and emission while excluding the historical billing window',()=>{
 const input={dimensions:{UF:['MG','SP'],CIDADE:['Belo Horizonte'],TIPO_ENTREGA:['RETIRA']},billingRange:['2026-09-01','2026-09-30'],emissionRange:['2026-01-01','2026-09-30']};
 const result=transfer(input,'overdue');
 assert.deepEqual(result.uf,['MG','SP']);assert.deepEqual(result.city,['Belo Horizonte']);assert.deepEqual(result.delivery,['Retirada']);
 assert.equal(result.emissionStart,'2026-01-01');assert.equal(result.emissionEnd,'2026-09-30');
 assert.equal(result.forecastStatus,'overdue');assert.equal(result.forecastStart,'');assert.equal(result.forecastEnd,'');
 assert.equal(result.company,'');assert.equal(result.search,'');assert.equal(result.status,'');
 result.uf.pop();assert.deepEqual(input.dimensions.UF,['MG','SP'],'navigation cannot mutate applied strategic filters');
});

test('free-balance navigation includes partially allocated orders and missing forecasts get their own cut',()=>{
 assert.equal(transfer({},'free').freeQuantityMin,'0.000001');
 assert.equal(transfer({},'free').status,'','partially allocated orders have a free balance too');
 assert.equal(transfer({},'undated').forecastStatus,'undated');
 assert.equal(transfer({dimensions:{TIPO_ENTREGA:['ENTREGA','Não informado']}},'all').forecastStatus,'');
 assert.deepEqual(transfer({dimensions:{TIPO_ENTREGA:['ENTREGA','Não informado']}},'all').delivery,['Entrega','Não informado']);
});
