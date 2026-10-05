import test from 'node:test';
import assert from 'node:assert/strict';
import {cloneLogisticsFilters} from '../src/domain/logistics/filters.ts';

test('editing a filter draft cannot mutate applied categories',()=>{
 const applied={uf:['MG','RJ'],freeVolumeMin:'0.2'};
 const draft=cloneLogisticsFilters(applied);draft.uf.pop();draft.freeVolumeMin='1';
 assert.deepEqual(applied,{uf:['MG','RJ'],freeVolumeMin:'0.2'});
 assert.deepEqual(cloneLogisticsFilters({uf:'MG'}).uf,['MG']);
});
test('draft retains every selected category so validation cannot silently broaden the cut',()=>{
 const products=Array.from({length:101},(_,index)=>String(index));
 const client='Cliente '+('a'.repeat(150));
 const draft=cloneLogisticsFilters({product:products,client:[client]});
 assert.equal(draft.product.length,101);assert.deepEqual(draft.client,[client]);
});
