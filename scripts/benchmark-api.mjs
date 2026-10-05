import fs from 'node:fs/promises';
import {performance} from 'node:perf_hooks';
const base=process.env.API_URL||'http://127.0.0.1:3002';
const endpoints=['abertos/resumo','emitidos/mensal','faturados/mensal'];
const results=[];
for(const endpoint of endpoints){
  const samples=[];let dataVersion,bytes;
  for(let run=0;run<4;run++){
    const start=performance.now();
    const response=await fetch(`${base}/api/v1/bi/${endpoint}?referenceDate=2026-10-01`);
    if(!response.ok)throw new Error(`${endpoint}: HTTP ${response.status}`);
    const body=await response.text(),payload=JSON.parse(body);
    if(payload.source!=='firebird/apache-hop'||!payload.dataVersion)throw new Error('Fonte real publicada ausente.');
    if(dataVersion&&payload.dataVersion!==dataVersion)throw new Error('A versão mudou durante a medição. Repita o benchmark.');
    dataVersion=payload.dataVersion;bytes=Buffer.byteLength(body);
    samples.push(Number((performance.now()-start).toFixed(2)));
  }
  results.push({endpoint,dataVersion,bytes,firstRequestMs:samples[0],subsequentRequestsMs:samples.slice(1)});
}
const report={measuredAt:new Date().toISOString(),base,source:'firebird/apache-hop',synthetic:false,description:'Tempo HTTP local incluindo transferência e leitura da resposta; primeira requisição pode já estar em cache. Não mede trabalho manual nem tempo completo do ETL.',results};
await fs.mkdir('.local',{recursive:true});
await fs.writeFile('.local/benchmark-api.json',JSON.stringify(report,null,2));
console.log(JSON.stringify(report,null,2));
