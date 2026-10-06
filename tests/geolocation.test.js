import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,readFile,writeFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import * as geo from '../api-server/geolocation.js';
const now=new Date('2026-10-06T12:00:00Z');
const item={cep:'01001-000',uf:'SP',cidade:'São Paulo',latitude:null,longitude:null,valor_aberto:123};
const response={cep:'01001000',state:'SP',city:'São Paulo',location:{type:'Point',coordinates:{latitude:'-23.55',longitude:'-46.63'}}};
const entry={...response,checkedAt:now.toISOString(),status:'ok',provider:'BrasilAPI CEP v2'};
const cache={version:'a',entries:{'01001000':entry}};
test('CEP preserves initial zero and rejects malformed inputs',()=>{
 for(const [value,want] of [['01001-000','01001000'],[' 01001000 ','01001000'],['00000000',null],['abc01001000',null],['1001000',null],[1001000,null],[null,null]])assert.equal(geo.normalizeCep(value),want);
});
test('ERP coordinates win; compatible CEP enriches only missing locations without changing measures',()=>{
 const erp={...item,latitude:'-22.9',longitude:'-47.1'};
 const rows=geo.enrichLocations([erp,item,{...item,cidade:'Outra cidade'},{...item,uf:'RJ'}],cache,now);
 assert.equal(rows[0].latitude,-22.9);assert.equal(rows[0].geo_origin,'ERP');
 assert.equal(rows[1].latitude,-23.55);assert.equal(rows[1].geo_origin,'CEP');
 assert.equal(rows[2].latitude,null);assert.equal(rows[3].longitude,null);
 assert.deepEqual(rows.map(row=>row.valor_aberto),[123,123,123,123]);assert.equal(item.latitude,null);
});
test('empty, invalid, expired or conflicting provider locations never become markers',()=>{
 for(const change of [{cep:'99999999'},{state:'RJ'},{city:'Outra cidade'},{location:{coordinates:{latitude:'',longitude:null}}},{location:{coordinates:{latitude:0,longitude:-46}}},{location:{coordinates:{latitude:-23,longitude:200}}},{location:{coordinates:{latitude:-3.1,longitude:-60}}},{checkedAt:'2025-01-01T00:00:00Z'}]){
  assert.equal(geo.enrichLocations([item],{version:'a',entries:{'01001000':{...entry,...change}}},now)[0].geo_origin,null);
 }
});
test('batch persists unique CEPs, reuses cache and retries negative results only after cooldown',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'tcc-cep-'));const path=join(dir,'cache.json');let calls=0;
 const fetchImpl=async url=>{assert.equal(url,'https://brasilapi.com.br/api/cep/v2/01001000');calls++;return {ok:true,json:async()=>({...response,street:'Test address',location:{...response.location,street:'Test address'}})};};
 try{
  const first=await geo.updateGeoCache([item,item],{path,fetchImpl,now,delayMs:0});assert.equal(first.lookups,1);
  const stored=await geo.readGeoCache(path);assert.equal(geo.enrichLocations([item],stored,now)[0].geo_origin,'CEP');
  assert.equal(stored.entries['01001000'].street,undefined);assert.equal(stored.entries['01001000'].location.street,undefined);
  await geo.updateGeoCache([item],{path,fetchImpl,now,delayMs:0});assert.equal(calls,1);
  await writeFile(path,JSON.stringify({entries:{'01001000':{status:'failed',checkedAt:now.toISOString()}}}));
  await geo.updateGeoCache([item],{path,fetchImpl,now,delayMs:0});assert.equal(calls,1);
  await geo.updateGeoCache([item],{path,fetchImpl,now:new Date('2026-10-08T12:00:00Z'),delayMs:0});assert.equal(calls,2);
  assert.ok(JSON.parse(await readFile(path,'utf8')).entries['01001000']);
 }finally{await rm(dir,{recursive:true,force:true});}
});
test('failed requests and malformed cache preserve ERP points and can be retried',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'tcc-cep-'));const path=join(dir,'cache.json');
 try{
  assert.deepEqual((await geo.readGeoCache(path)).entries,{});
  await writeFile(path,'broken');assert.deepEqual((await geo.readGeoCache(path)).entries,{});
  const result=await geo.updateGeoCache([item],{path,fetchImpl:async()=>{throw new Error('offline');},now,delayMs:0});
  assert.equal(result.failed,1);const stored=await geo.readGeoCache(path);
  assert.equal(geo.enrichLocations([item],stored,now)[0].latitude,null);
  assert.equal(geo.enrichLocations([{...item,latitude:-23,longitude:-46}],stored,now)[0].geo_origin,'ERP');
 }finally{await rm(dir,{recursive:true,force:true});}
});
test('expiry changes cache identity even when its file has not changed',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'tcc-cep-'));const path=join(dir,'cache.json');
 try{
  await writeFile(path,JSON.stringify(cache));
  const before=await geo.readGeoCache(path,now);
  const after=await geo.readGeoCache(path,new Date('2027-05-01T12:00:00Z'));
  assert.notEqual(before.version,after.version);
  assert.equal(geo.enrichLocations([item],after,new Date('2027-05-01T12:00:00Z'))[0].geo_origin,null);
 }finally{await rm(dir,{recursive:true,force:true});}
});
