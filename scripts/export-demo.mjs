import 'dotenv/config';
import pg from 'pg';
import {mkdir,writeFile,readFile,rename} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import {gzipSync,gunzipSync} from 'node:zlib';
import {readConfig} from '../api-server/config.js';
import {PostgresRepository} from '../api-server/repositories/postgres.js';
import {LogisticsRepository} from '../api-server/repositories/logistics.js';
import {AftersalesRepository} from '../api-server/repositories/posvenda.js';
import {SettingsStore} from '../api-server/settings.js';
import {packRows,unpackRows,demoRequestKey,demoInitialPaths,generalizeLogisticsLocation} from '../shared/demo-snapshot.js';
import {createDemoApi} from '../src/demo/engine.js';

const directory=fileURLToPath(new URL('../.local/demo/',import.meta.url));
const pool=new pg.Pool(readConfig().postgres);
await mkdir(directory,{recursive:true});
const manifest={schema:1,source:'firebird/apache-hop',synthetic:false,exportedAt:new Date().toISOString(),referenceDate:'',publications:{},assets:{},initial:{}};
async function save(name,value,encoding){
 const json=JSON.stringify(value),contents=gzipSync(json,{level:9}),sha256=createHash('sha256').update(contents).digest('hex');
 const file=name+'-'+sha256.slice(0,16)+'.json.gz';
 await writeFile(directory+file,contents);
 manifest.assets[name]={file,sha256,contentSha256:createHash('sha256').update(json).digest('hex'),bytes:contents.length,encoding};
 console.log(`${name}: ${(contents.length/1024/1024).toFixed(2)} MiB`);
}
const execution=value=>Object.fromEntries(['id','data_inicio','data_referencia','fim','data_version','dimensionsVersion'].filter(key=>value[key]!==undefined).map(key=>[key,value[key]]));
try{
 const logisticsRepository=new LogisticsRepository(pool),repository=new PostgresRepository(pool);
 {
  const snapshot=await logisticsRepository.snapshot();
  manifest.referenceDate=snapshot.execution.data_referencia;
  manifest.publications.logistics=String(snapshot.execution.id);
  const items=snapshot.items.map(generalizeLogisticsLocation);
  await save('logistica',{execution:{...execution(snapshot.execution),origem:'Cópia local anonimizada · Apache Hop'},items:packRows(items),allocations:packRows(snapshot.allocations),geoVersion:'demo-generalized-locations',geoWarning:'Pontos aproximados em malha de 0,25°; CEP e coordenadas exatas não são publicados.'},'logistics');
 }
 logisticsRepository.snapshots.clear();
 for(const area of ['abertos','faturados','emitidos']){
  const snapshot=await repository.snapshot(manifest.referenceDate,area);
  manifest.publications.commercial??=snapshot.version;
  if(snapshot.version!==manifest.publications.commercial)throw new Error('A publicação comercial mudou durante a exportação. Execute novamente.');
  await save(area,{...snapshot,frames:Object.fromEntries(Object.entries(snapshot.frames).map(([key,rows])=>[key,packRows(rows)]))},'commercial');
  repository.snapshots.clear();
 }
 const aftersales=new AftersalesRepository(pool);
 {
  const snapshot=await aftersales.snapshot();
  if(snapshot.execution.data_referencia!==manifest.referenceDate)throw new Error('As posições de logística e pós-venda divergem. Alinhe as publicações antes da exportação.');
  manifest.publications.aftersales=snapshot.execution.data_version||String(snapshot.execution.id);
  await save('posvenda',{execution:execution(snapshot.execution),rows:packRows(snapshot.rows)},'aftersales');
 }
 aftersales.snapshots.clear();
 await save('metas',await new SettingsStore().getMetas(),'json');
 if(await repository.getVersion()!==manifest.publications.commercial)throw new Error('A publicação comercial mudou durante a exportação.');
}finally{await pool.end();}

// Precompute landing screens using the same frozen query engine. Deep
// interactions load publications lazily in a browser worker.
const cache=new Map();
async function load(name){
 if(cache.has(name))return cache.get(name);
 const asset=manifest.assets[name];
 let value=JSON.parse(gunzipSync(await readFile(directory+asset.file)));
 if(asset.encoding==='commercial')value={...value,frames:Object.fromEntries(Object.entries(value.frames).map(([key,rows])=>[key,unpackRows(rows)]))};
 if(asset.encoding==='logistics')value={...value,items:unpackRows(value.items),allocations:unpackRows(value.allocations)};
 if(asset.encoding==='aftersales')value={...value,rows:unpackRows(value.rows)};
 // Bound retained source areas; strategic can require two at once.
 if(cache.size>=2)cache.delete(cache.keys().next().value);
 cache.set(name,value);return value;
}
const request=createDemoApi({manifest,load});
for(let index=0;index<demoInitialPaths.length;index++){
 const path=demoInitialPaths[index],name='initial-'+index;
 await save(name,await request(path),'json');
 manifest.initial[demoRequestKey(path,manifest.referenceDate)]=name;
}
await writeFile(directory+'manifest.next.json',JSON.stringify(manifest,null,2)+'\n');
await rename(directory+'manifest.next.json',directory+'manifest.json');
console.log(`Demonstração exportada. Posição: ${manifest.referenceDate}. Nenhum dado gerado artificialmente.`);
