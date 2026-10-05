import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm,readFile} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {SettingsStore} from '../api-server/settings.js';
test('local settings validate and preserve concurrent real preset changes',async()=>{
 const dir=await mkdtemp(path.join(os.tmpdir(),'tcc-settings-'));
 try{const s=new SettingsStore(dir,path.join(dir,'missing-private-defaults.json'));const initial=await s.getMetas();assert.ok(Number.isFinite(initial.default.financeira)&&initial.default.financeira>=0);
   await assert.rejects(s.setMetas({default:{financeira:'inválida'}}));
   const [a,b]=await Promise.all([s.addPreset({name:'Agosto emitidos',area:'emitidos',filters:{emissionRange:['2026-08-01','2026-08-31']}}),s.addPreset({name:'Agosto faturados',area:'faturados',filters:{billingRange:['2026-08-01','2026-08-31']}})]);
   assert.equal((await s.getPresets()).length,2);await s.deletePreset(a.id);assert.equal((await s.getPresets())[0].id,b.id);
   assert.ok(JSON.parse(await readFile(path.join(dir,'presets.json'),'utf8')));
 }finally{await rm(dir,{recursive:true,force:true});}
});

test('a clean checkout uses the public unconfigured goal template and local goals remain independent of private defaults',async()=>{
 const dir=await mkdtemp(path.join(os.tmpdir(),'tcc-settings-clean-'));
 const empty={default:{financeira:0,peso:0,emissao_financeira:0,emissao_peso:0}};
 try{
  const store=new SettingsStore(dir,path.join(dir,'missing-private-defaults.json'));
  assert.deepEqual(await store.getMetas(),empty);
  const configured={default:{financeira:100,peso:10,emissao_financeira:200,emissao_peso:20}};
  await store.setMetas(configured);
  assert.deepEqual(await store.getMetas(),configured);
 }finally{await rm(dir,{recursive:true,force:true});}
});
