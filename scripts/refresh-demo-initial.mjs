// Rebuild the static landing responses from an existing anonymized demo export.
// The published snapshots remain untouched and no database connection is needed.
import {readFile,writeFile,rename} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import {gzipSync,gunzipSync} from 'node:zlib';
import {unpackRows,demoRequestKey,demoInitialPaths} from '../shared/demo-snapshot.js';
import {createDemoApi} from '../src/demo/engine.js';

const directory=fileURLToPath(new URL('../.local/demo/',import.meta.url));
const manifest=JSON.parse(await readFile(directory+'manifest.json','utf8'));
const cache=new Map();
async function load(name){
 if(cache.has(name))return cache.get(name);
 const asset=manifest.assets[name];
 let value=JSON.parse(gunzipSync(await readFile(directory+asset.file)));
 if(asset.encoding==='commercial')value={...value,frames:Object.fromEntries(Object.entries(value.frames).map(([key,rows])=>[key,unpackRows(rows)]))};
 if(asset.encoding==='logistics')value={...value,items:unpackRows(value.items),allocations:unpackRows(value.allocations)};
 if(asset.encoding==='aftersales')value={...value,rows:unpackRows(value.rows)};
 if(cache.size>=2)cache.delete(cache.keys().next().value);
 cache.set(name,value);
 return value;
}
const request=createDemoApi({manifest,load});
for(let index=0;index<demoInitialPaths.length;index++){
 const path=demoInitialPaths[index],name='initial-'+index;
 const json=JSON.stringify(await request(path));
 const contents=gzipSync(json,{level:9});
 const sha256=createHash('sha256').update(contents).digest('hex');
 const file=name+'-'+sha256.slice(0,16)+'.json.gz';
 await writeFile(directory+file,contents);
 manifest.assets[name]={file,sha256,contentSha256:createHash('sha256').update(json).digest('hex'),bytes:contents.length,encoding:'json'};
 manifest.initial[demoRequestKey(path,manifest.referenceDate)]=name;
 console.log(`${name}: ${(contents.length/1024/1024).toFixed(2)} MiB`);
}
await writeFile(directory+'manifest.next.json',JSON.stringify(manifest,null,2)+'\n');
await rename(directory+'manifest.next.json',directory+'manifest.json');
console.log('Respostas iniciais atualizadas a partir da publicação demonstrativa existente.');
