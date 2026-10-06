import 'dotenv/config';
import pg from 'pg';
import {readConfig} from '../api-server/config.js';
import {updateGeoCache} from '../api-server/geolocation.js';

// Explicit enrichment step: opening the dashboard never contacts this provider.
const args=process.argv.slice(2);
if(args.some((arg,index)=>index%2===0&&arg!=='--limit')||args.length%2){console.error('Uso: npm run geocode:cep -- --limit 500');process.exit(1);}
const limit=args.length?Number(args[1]):500;
const pool=new pg.Pool(readConfig().postgres);
try{
 const result=await pool.query(`SELECT DISTINCT ip.cep,ip.uf,ip.cidade,ip.latitude,ip.longitude
  FROM logistica.item_pedido ip JOIN logistica.publicacao p ON p.execucao_id=ip.execucao_id`);
 const stats=await updateGeoCache(result.rows,{limit,onProgress:progress=>{
  if(progress.lookups%25===0)console.log(`Consultas: ${progress.lookups}; aceitas: ${progress.accepted}; sem localização compatível: ${progress.failed}.`);
 }});
 console.log(JSON.stringify(stats));
}catch(error){console.error(error.code==='42703'?'Publique novamente a logística pelo Hop para incluir o CEP.':'Falha no enriquecimento de CEP. Confira configuração, banco e acesso à rede.');process.exitCode=1;}
finally{await pool.end();}
