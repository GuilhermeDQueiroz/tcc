import fs from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {performance} from 'node:perf_hooks';
import pg from 'pg';
import {readConfig} from '../api-server/config.js';
import {LogisticsRepository} from '../api-server/repositories/logistics.js';

// Read-only benchmark against an actual publication; never generates ERP data.
const direct=process.argv.includes('--repository');
const outputIndex=process.argv.indexOf('--output');
const output=outputIndex>=0?process.argv[outputIndex+1]:'.local/benchmark-logistica.json';
const base=process.env.API_URL||'http://127.0.0.1:3002';
let pool,repository,bulkReads=0;
if(direct){
  pool=new pg.Pool(readConfig().postgres);
  pool.on('connect',client=>{
    const query=client.query.bind(client);
    client.query=(...args)=>{
      if(/FROM logistica\.(item_pedido|alocacao)\b/.test(String(args[0])))bulkReads++;
      return query(...args);
    };
  });
  repository=new LogisticsRepository(pool);
}
const results=[],hashes=new Map();
let version;
try{
  for(const filters of [{},{},{},{},{uf:'SP'},{uf:'SP'}]){
    const started=performance.now();
    let payload;
    if(direct)payload=await repository.getDashboard(filters);
    else{
      const response=await fetch(`${base}/api/v1/logistica/formacao?${new URLSearchParams(filters)}`);
      if(!response.ok)throw new Error(`HTTP ${response.status}`);
      payload=await response.json();
    }
    if(!payload.dataVersion)throw new Error('Publicação real ausente.');
    if(version&&version!==payload.dataVersion)throw new Error('A publicação mudou; repita a medição.');
    version=payload.dataVersion;
    const body=JSON.stringify(payload),hash=createHash('sha256').update(body).digest('hex');
    const key=JSON.stringify(filters);
    if(hashes.has(key)&&hashes.get(key)!==hash)throw new Error('Resultado divergente no mesmo recorte.');
    hashes.set(key,hash);
    results.push({filters,ms:Number((performance.now()-started).toFixed(2)),bytes:Buffer.byteLength(body),sha256:hash});
  }
  const report={measuredAt:new Date().toISOString(),mode:direct?'repository':'http',dataVersion:version,synthetic:false,
    description:direct?'Repositório local, serialização JSON e hash de equivalência; exclui HTTP, renderização e ETL.':'HTTP local, parsing, serialização JSON e hash de equivalência; exclui renderização e ETL.',
    ...(direct?{bulkReads}:{}),results};
  await fs.mkdir('.local',{recursive:true});
  await fs.writeFile(output,JSON.stringify(report,null,2)+'\n');
  console.log(JSON.stringify(report,null,2));
}finally{await pool?.end();}
