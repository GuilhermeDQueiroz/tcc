import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {groupOpenOrders} from '../api-server/domain/open-orders.js';
import {filterRows} from '../api-server/domain/filters.js';
test('consolidated research reproduces original real order rows, totals and local filters',()=>{
 const rows=JSON.parse(fs.readFileSync('.local/normalized-abertos.json','utf8')),reference=JSON.parse(fs.readFileSync('.local/open-orders-reference.json','utf8'));
 assert.equal(reference.version,JSON.parse(fs.readFileSync('.local/domain-reference.json','utf8')).version);
 assert.deepEqual(groupOpenOrders(rows),reference.all);
 for(const filter of reference.filters)assert.deepEqual(groupOpenOrders(filterRows(rows,{dimensions:{[filter.key]:[String(filter.value)]}})),filter.expected);
});
